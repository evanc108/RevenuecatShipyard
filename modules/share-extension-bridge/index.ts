/**
 * Typed JS wrapper for the ShareExtensionBridge native module.
 *
 * Provides App Groups UserDefaults read/write and extension lifecycle
 * methods (close, openHostApp) that post NSNotifications to the Swift VC.
 */

import { NativeModules } from 'react-native';

type ShareExtensionBridgeType = {
  close: () => void;
  openHostApp: (path: string) => void;
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const { ShareExtensionBridge } = NativeModules;

export default ShareExtensionBridge as ShareExtensionBridgeType;
