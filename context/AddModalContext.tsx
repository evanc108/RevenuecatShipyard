import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type AddModalContextType = {
  isVisible: boolean;
  openModal: () => void;
  closeModal: () => void;
};

const AddModalContext = createContext<AddModalContextType | null>(null);

type AddModalProviderProps = {
  children: ReactNode;
};

export function AddModalProvider({ children }: AddModalProviderProps): React.ReactElement {
  const [isVisible, setIsVisible] = useState(false);

  const openModal = useCallback(() => {
    setIsVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsVisible(false);
  }, []);

  return (
    <AddModalContext.Provider value={{ isVisible, openModal, closeModal }}>
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
