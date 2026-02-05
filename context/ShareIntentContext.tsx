/**
 * Context for coordinating share-to functionality.
 *
 * Provides:
 * - triggerImport(url) for programmatic imports
 * - Listens to useShareHandler for incoming intents
 * - Shows ShareCookbookSheet when URL is pending
 * - Starts background extraction on submit
 */

import { ShareCookbookSheet } from '@/components/cookbook/ShareCookbookSheet';
import type { Id } from '@/convex/_generated/dataModel';
import { useBackgroundExtraction } from '@/hooks/useBackgroundExtraction';
import { useShareHandler } from '@/hooks/useShareHandler';
import { usePendingUploadsStore } from '@/stores/usePendingUploadsStore';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

type ShareIntentContextType = {
  /** Trigger an import with a URL - shows cookbook selection sheet */
  triggerImport: (url: string) => void;
  /** Whether the share sheet is currently visible */
  isSheetVisible: boolean;
};

const ShareIntentContext = createContext<ShareIntentContextType | null>(null);

type ShareIntentProviderProps = {
  children: ReactNode;
};

export function ShareIntentProvider({
  children,
}: ShareIntentProviderProps): React.ReactElement {
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const { pendingUrl, clearPendingUrl } = useShareHandler();
  const { startExtraction } = useBackgroundExtraction();
  const addUpload = usePendingUploadsStore((s) => s.addUpload);

  // Handle incoming URLs from share handler
  useEffect(() => {
    if (pendingUrl) {
      // Direct import for shared URLs - bypass modal
      const uploadId = addUpload(pendingUrl, undefined, 'Cookbook'); // Add to general/default
      startExtraction(uploadId);
      clearPendingUrl();
    }
  }, [pendingUrl, clearPendingUrl, addUpload, startExtraction]);

  const triggerImport = useCallback((url: string) => {
    // When triggering manually (e.g. from clipboard), show sheet to let user choose
    setSheetUrl(url);
  }, []);

  const handleSheetClose = useCallback(() => {
    setSheetUrl(null);
  }, []);

  const handleSheetSubmit = useCallback(
    (cookbookId: Id<'cookbooks'>, cookbookName: string) => {
      if (!sheetUrl) return;

      // Add to pending uploads store
      const uploadId = addUpload(sheetUrl, cookbookId, cookbookName);

      // Start background extraction
      startExtraction(uploadId);

      // Close the sheet
      setSheetUrl(null);
    },
    [sheetUrl, addUpload, startExtraction]
  );

  const isSheetVisible = sheetUrl !== null;

  return (
    <ShareIntentContext.Provider value={{ triggerImport, isSheetVisible }}>
      {children}
      <ShareCookbookSheet
        visible={isSheetVisible}
        url={sheetUrl}
        onClose={handleSheetClose}
        onSubmit={handleSheetSubmit}
      />
    </ShareIntentContext.Provider>
  );
}

export function useShareIntent(): ShareIntentContextType {
  const context = useContext(ShareIntentContext);
  if (!context) {
    throw new Error('useShareIntent must be used within a ShareIntentProvider');
  }
  return context;
}
