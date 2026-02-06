import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY ?? '';

let isConfigured = false;

/**
 * Initialize RevenueCat SDK. Must be called once after app launch.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function configureRevenueCat(): void {
  if (isConfigured || !API_KEY) return;

  Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey: API_KEY });
  isConfigured = true;
}

/**
 * Identify the RevenueCat user with their Clerk ID.
 * Call after authentication is confirmed.
 */
export async function identifyUser(clerkId: string): Promise<void> {
  if (!isConfigured) {
    configureRevenueCat();
  }
  await Purchases.logIn(clerkId);
}

/**
 * Log out the current RevenueCat user (on sign-out).
 */
export async function logOutRevenueCat(): Promise<void> {
  if (!isConfigured) return;
  const customerInfo = await Purchases.getCustomerInfo();
  if (!customerInfo.originalAppUserId) return;
  await Purchases.logOut();
}

/** Re-export Purchases for direct access when needed */
export { Purchases };
