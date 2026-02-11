import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Id } from '@/convex/_generated/dataModel';

type OpenModalOptions = {
  initialCookbookId?: Id<'cookbooks'>;
  initialUrl?: string;
};

type AddModalContextType = {
  isVisible: boolean;
  initialCookbookId: Id<'cookbooks'> | null;
  initialUrl: string | null;
  openModal: (options?: OpenModalOptions) => void;
  closeModal: () => void;
};

const AddModalContext = createContext<AddModalContextType | null>(null);

type AddModalProviderProps = {
  children: ReactNode;
};

export function AddModalProvider({ children }: AddModalProviderProps): React.ReactElement {
  const [isVisible, setIsVisible] = useState(false);
  const [initialCookbookId, setInitialCookbookId] = useState<Id<'cookbooks'> | null>(null);
  const [initialUrl, setInitialUrl] = useState<string | null>(null);

  const openModal = useCallback((options?: OpenModalOptions) => {
    setInitialCookbookId(options?.initialCookbookId ?? null);
    setInitialUrl(options?.initialUrl ?? null);
    setIsVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsVisible(false);
  }, []);

  return (
    <AddModalContext.Provider value={{ isVisible, initialCookbookId, initialUrl, openModal, closeModal }}>
      {children}
    </AddModalContext.Provider>
  );
}

export function useAddModal(): AddModalContextType {
  const context = useContext(AddModalContext);
  if (!context) {
    throw new Error('useAddModal must be used within an AddModalProvider');
  }
  return context;
}
