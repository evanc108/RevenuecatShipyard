import { create } from 'zustand';
import type { Id } from '@/convex/_generated/dataModel';

type PantryCategory = 'produce' | 'dairy' | 'meat' | 'pantry' | 'spice' | 'frozen' | 'other';

export type PantryItemData = {
  _id: Id<'pantryItems'>;
  name: string;
  category?: PantryCategory;
  quantity?: number;
  unit?: string;
};

type PantryItemModalState = {
  isVisible: boolean;
  editingItem: PantryItemData | null;

  openAddModal: () => void;
  openEditModal: (item: PantryItemData) => void;
  closeModal: () => void;
};

export const usePantryItemModalStore = create<PantryItemModalState>((set) => ({
  isVisible: false,
  editingItem: null,

  openAddModal: () => set({ isVisible: true, editingItem: null }),
  openEditModal: (item) => set({ isVisible: true, editingItem: item }),
  closeModal: () => set({ isVisible: false, editingItem: null }),
}));
