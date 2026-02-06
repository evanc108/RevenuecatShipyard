/**
 * Reads pending share-extension imports when the app comes to foreground
 * and feeds them into the existing extraction pipeline.
 *
 * If a pending import has `newCookbookName`, the cookbook is created first
 * via Convex mutation, then the URL is added to the upload store and
 * extraction is started.
 *
 * Mount inside ShareIntentProvider.
 */

import { useMutation } from 'convex/react';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { api } from '@/convex/_generated/api';
import { useBackgroundExtraction } from '@/hooks/useBackgroundExtraction';
import { clearPendingImports, getPendingImports } from '@/lib/appGroups';
import type { PendingShareImport } from '@/lib/appGroups';
import type { Id } from '@/convex/_generated/dataModel';
import { usePendingUploadsStore } from '@/stores/usePendingUploadsStore';

export function usePendingShareImports(): void {
  const { startExtraction } = useBackgroundExtraction();
  const addUpload = usePendingUploadsStore((s) => s.addUpload);
  const createCookbook = useMutation(api.cookbooks.create);
  const isProcessingRef = useRef(false);

  const processImports = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      const imports = await getPendingImports();
      if (imports.length === 0) return;

      for (const item of imports) {
        await processSingleImport(item);
      }

      await clearPendingImports();
    } catch {
      // Silently ignore - this is expected in Expo Go where native module isn't available
    } finally {
      isProcessingRef.current = false;
    }
  }, [addUpload, startExtraction, createCookbook]);

  async function processSingleImport(item: PendingShareImport): Promise<void> {
    let cookbookId: Id<'cookbooks'> | undefined;
    let cookbookName: string | undefined;

    if (item.newCookbookName) {
      // Create the cookbook first
      try {
        cookbookId = await createCookbook({ name: item.newCookbookName });
        cookbookName = item.newCookbookName;
      } catch {
        // Continue without cookbook — recipe still gets imported
      }
    } else if (item.cookbookId) {
      cookbookId = item.cookbookId as Id<'cookbooks'>;
      cookbookName = undefined; // The store will figure it out
    }

    const uploadId = addUpload(item.url, cookbookId, cookbookName);
    startExtraction(uploadId);
  }

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
