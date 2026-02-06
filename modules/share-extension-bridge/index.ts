/**
 * Typed JS wrapper for the ShareExtensionBridge native module.
 *
 * Provides App Groups UserDefaults read/write and extension lifecycle
 * methods (close, openHostApp) that post NSNotifications to the Swift VC.
 *
 * In Expo Go, the native module is not available, so we provide no-op fallbacks.
 */

import { NativeModules, Platform } from 'react-native';

type ShareExtensionBridgeType = {
  close: () => void;
  openHostApp: (path: string) => void;
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const { ShareExtensionBridge: NativeBridge } = NativeModules;

/**
 * Check if we're running in Expo Go (native module won't be available)
 */
const isExpoGo = !NativeBridge;

/**
 * No-op fallback for when native module isn't available (Expo Go)
 */
const fallbackBridge: ShareExtensionBridgeType = {
  close: () => {
    // No-op in Expo Go
  },
  openHostApp: () => {
    // No-op in Expo Go
  },
  getItem: async () => {
    // Return null in Expo Go - no App Groups storage available
    return null;
  },
  setItem: async () => {
    // No-op in Expo Go
  },
  removeItem: async () => {
    // No-op in Expo Go
  },
};

const ShareExtensionBridge: ShareExtensionBridgeType = isExpoGo
  ? fallbackBridge
  : NativeBridge;

export default ShareExtensionBridge;
