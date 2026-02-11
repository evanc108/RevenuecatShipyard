import { create } from 'zustand';
import Purchases from 'react-native-purchases';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

// TODO: Set to false before release
/** Bypass paywall for testing - set to false to restore normal behavior */
const DEV_BYPASS_PAYWALL = true;

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
  /** Purchase the default offering package */
  purchase: () => Promise<boolean>;
  /** Restore previous purchases */
  restore: () => Promise<boolean>;
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
      const isPro = customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;

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
    if (!currentPackage) return false;

    try {
      const { customerInfo } = await Purchases.purchasePackage(currentPackage);
      const isPro = customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;
      set({ isPro });
      return isPro;
    } catch {
      return false;
    }
  },

  restore: async () => {
    try {
      const customerInfo = await Purchases.restorePurchases();
      const isPro = customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;
      set({ isPro });
      return isPro;
    } catch {
      return false;
    }
  },

  updateFromCustomerInfo: (info: CustomerInfo) => {
    if (DEV_BYPASS_PAYWALL) return;
    const isPro = info.entitlements.active[PRO_ENTITLEMENT] !== undefined;
    set({ isPro });
  },
}));
