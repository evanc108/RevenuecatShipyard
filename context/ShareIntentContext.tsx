/**
 * Context for coordinating share-to functionality.
 *
 * Provides:
 * - triggerImport(url) for programmatic imports
 * - Listens to useShareHandler for incoming intents
 * - Opens AddModal with URL pre-filled for cookbook selection + import
 * - Picks up pending share extension imports on foreground
 */

import { useAddModal } from '@/context/AddModalContext';
import { useShareHandler } from '@/hooks/useShareHandler';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
} from 'react';

type ShareIntentContextType = {
  /** Trigger an import with a URL - opens AddModal with URL pre-filled */
  triggerImport: (url: string) => void;
};

const ShareIntentContext = createContext<ShareIntentContextType | null>(null);

type ShareIntentProviderProps = {
  children: ReactNode;
};

export function ShareIntentProvider({
  children,
}: ShareIntentProviderProps): React.ReactElement {
  const { pendingUrl, clearPendingUrl } = useShareHandler();
  const { openModal } = useAddModal();

  // Handle incoming URLs from share handler (deep links)
  useEffect(() => {
    if (pendingUrl) {
      openModal({ initialUrl: pendingUrl });
      clearPendingUrl();
    }
  }, [pendingUrl, clearPendingUrl, openModal]);

  const triggerImport = useCallback(
    (url: string) => {
      openModal({ initialUrl: url });
    },
    [openModal]
  );

  return (
    <ShareIntentContext.Provider value={{ triggerImport }}>
      {children}
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
