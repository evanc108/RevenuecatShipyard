import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import Purchases from 'react-native-purchases';
import { create } from 'zustand';

// TODO: Set to false before release
/** Bypass paywall for testing - set to false to restore normal behavior */
const DEV_BYPASS_PAYWALL = false;

/** Maximum saved recipes for free users */
export const FREE_RECIPE_LIMIT = 10;

/** Entitlement identifier configured in RevenueCat dashboard */
const PRO_ENTITLEMENT = 'pro';

type SubscriptionState = {
	/** Whether the user has an active pro subscription */
	isPro: boolean;
	/** Whether subscription status is being checked */
	isLoading: boolean;
	/** Available package for purchase (from default offering) */
	currentPackage: PurchasesPackage | null;
	/** Price string for display (e.g. "$4.99/mo") */
	priceString: string;

	/** Check current entitlement status */
	checkSubscription: () => Promise<void>;
	/** Purchase the default offering package. Returns { success, error? } */
	purchase: () => Promise<{ success: boolean; error?: string }>;
	/** Restore previous purchases. Returns { success, error? } */
	restore: () => Promise<{ success: boolean; error?: string }>;
	/** Update pro status from customer info (used by listener) */
	updateFromCustomerInfo: (info: CustomerInfo) => void;
};

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
	isPro: DEV_BYPASS_PAYWALL,
	isLoading: DEV_BYPASS_PAYWALL ? false : true,
	currentPackage: null,
	priceString: '$4.99/mo',

	checkSubscription: async () => {
		// Skip RevenueCat calls when bypassing paywall
		if (DEV_BYPASS_PAYWALL) {
			set({ isPro: true, isLoading: false });
			return;
		}

		try {
			set({ isLoading: true });
			const customerInfo = await Purchases.getCustomerInfo();
			const isPro =
				customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;

			// Fetch offerings for purchase
			const offerings = await Purchases.getOfferings();
			const pkg = offerings.current?.availablePackages[0] ?? null;
			const priceString = pkg?.product.priceString
				? `${pkg.product.priceString}/mo`
				: '$4.99/mo';

			set({ isPro, currentPackage: pkg, priceString, isLoading: false });
		} catch {
			set({ isLoading: false });
		}
	},

	purchase: async () => {
		const { currentPackage } = get();
		if (!currentPackage) {
			return {
				success: false,
				error: 'No subscription package available. Please try again later.',
			};
		}

		try {
			const { customerInfo } =
				await Purchases.purchasePackage(currentPackage);
			const isPro =
				customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;
			set({ isPro });
			return { success: isPro, error: isPro ? undefined : 'Purchase did not activate subscription.' };
		} catch (e) {
			const isCancelled =
				e instanceof Error && e.message.toLowerCase().includes('cancel');
			return {
				success: false,
				error: isCancelled ? undefined : 'Purchase failed. Please try again.',
			};
		}
	},

	restore: async () => {
		try {
			const customerInfo = await Purchases.restorePurchases();
			const isPro =
				customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;
			set({ isPro });
			return {
				success: isPro,
				error: isPro ? undefined : 'No active subscription found.',
			};
		} catch {
			return {
				success: false,
				error: 'Restore failed. Please try again.',
			};
		}
	},

	updateFromCustomerInfo: (info: CustomerInfo) => {
		if (DEV_BYPASS_PAYWALL) return;
		const isPro = info.entitlements.active[PRO_ENTITLEMENT] !== undefined;
		set({ isPro });
	}
}));
