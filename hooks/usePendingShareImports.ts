/**
 * Reads pending share-extension imports when the app comes to foreground
 * and surfaces them via a callback for in-app UI handling.
 *
 * The callback receives the URL from the most recent pending import.
 * The caller (ShareIntentProvider) opens the AddModal with the URL
 * pre-filled so the user can select a cookbook and import.
 *
 * Mount inside ShareIntentProvider.
 */

import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { clearPendingImports, getPendingImports } from '@/lib/appGroups';

export function usePendingShareImports(onUrlReady: (url: string) => void): void {
  const isProcessingRef = useRef(false);

  const processImports = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      const imports = await getPendingImports();
      if (imports.length === 0) return;

      // Surface the most recent pending import URL for in-app handling
      const lastImport = imports[imports.length - 1];
      if (lastImport) {
        onUrlReady(lastImport.url);
      }

      await clearPendingImports();
    } catch {
      // Silently ignore - this is expected in Expo Go where native module isn't available
    } finally {
      isProcessingRef.current = false;
    }
  }, [onUrlReady]);

  // Process on mount
  useEffect(() => {
    processImports();
  }, [processImports]);

  // Process when app returns to foreground
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        processImports();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, [processImports]);
}
