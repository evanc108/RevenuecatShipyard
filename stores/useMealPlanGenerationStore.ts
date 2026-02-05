import { create } from 'zustand';
import type { MealType } from './useMealPlanStore';

/**
 * Generated recipe from AI - temporary until added to meal plan
 */
export type GeneratedRecipe = {
  id: string; // Temporary ID for UI key
  title: string;
  description: string;
  cuisine?: string;
  difficulty?: string;
  servings: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  totalTimeMinutes?: number;
  calories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  dietaryTags?: string[];
  ingredients: {
    name: string;
    quantity: number;
    unit: string;
    preparation?: string;
  }[];
  instructions: {
    stepNumber: number;
    text: string;
  }[];
};

export type GeneratedMealPlan = {
  breakfast: GeneratedRecipe[];
  lunch: GeneratedRecipe[];
  dinner: GeneratedRecipe[];
  snack: GeneratedRecipe[];
};

type GenerationStatus = 'idle' | 'generating' | 'success' | 'error';

type MealPlanGenerationState = {
  // Generation inputs
  vibe: string;
  cuisine: string;

  // Status
  status: GenerationStatus;
  errorMessage: string | null;

  // Generated recipes (temporary, not persisted)
  generatedRecipes: GeneratedMealPlan | null;

  // UI state
  isGenerateModalVisible: boolean;
  isReviewSheetVisible: boolean;
  isScheduleSheetVisible: boolean;

  // Scheduling context
  selectedRecipe: GeneratedRecipe | null;
  selectedMealType: MealType | null;

  // Actions
  setVibe: (vibe: string) => void;
  setCuisine: (cuisine: string) => void;
  setStatus: (status: GenerationStatus, error?: string) => void;
  setGeneratedRecipes: (recipes: GeneratedMealPlan) => void;

  openGenerateModal: () => void;
  closeGenerateModal: () => void;
  closeGenerateModalKeepLoading: () => void;
  dismissFloatingProgress: () => void;
  openReviewSheet: () => void;
  closeReviewSheet: () => void;
  openScheduleSheet: (recipe: GeneratedRecipe, mealType: MealType) => void;
  closeScheduleSheet: () => void;

  reset: () => void;
};

const initialState = {
  vibe: '',
  cuisine: '',
  status: 'idle' as GenerationStatus,
  errorMessage: null,
  generatedRecipes: null,
  isGenerateModalVisible: false,
  isReviewSheetVisible: false,
  isScheduleSheetVisible: false,
  selectedRecipe: null,
  selectedMealType: null,
};

export const useMealPlanGenerationStore = create<MealPlanGenerationState>((set) => ({
  ...initialState,

  setVibe: (vibe) => set({ vibe }),
  setCuisine: (cuisine) => set({ cuisine }),

  setStatus: (status, error) =>
    set({
      status,
      errorMessage: error ?? null,
    }),

  setGeneratedRecipes: (recipes) =>
    set({
      generatedRecipes: recipes,
      status: 'success',
    }),

  openGenerateModal: () => set({ isGenerateModalVisible: true }),
  closeGenerateModal: () =>
    set({
      isGenerateModalVisible: false,
      vibe: '',
      cuisine: '',
      status: 'idle',
      errorMessage: null,
    }),

  closeGenerateModalKeepLoading: () =>
    set({
      isGenerateModalVisible: false,
      // Keep status, vibe, cuisine - don't reset them
    }),

  dismissFloatingProgress: () =>
    set({
      status: 'idle',
      errorMessage: null,
    }),

  openReviewSheet: () => set({ isReviewSheetVisible: true }),
  closeReviewSheet: () =>
    set({
      isReviewSheetVisible: false,
      generatedRecipes: null,
      status: 'idle',
    }),

  openScheduleSheet: (recipe, mealType) =>
    set({
      isScheduleSheetVisible: true,
      selectedRecipe: recipe,
      selectedMealType: mealType,
    }),
  closeScheduleSheet: () =>
    set({
      isScheduleSheetVisible: false,
      selectedRecipe: null,
      selectedMealType: null,
    }),

  reset: () => set(initialState),
}));
