import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Id } from '@/convex/_generated/dataModel';
import type { MealType } from '@/stores/useMealPlanStore';

type RecipePickerState = {
  visible: boolean;
  date: string;
  mealType: MealType;
};

type RecipePickerContextType = {
  state: RecipePickerState;
  openPicker: (date: string, mealType: MealType) => void;
  closePicker: () => void;
  onRecipeSelected: ((recipeId: Id<'recipes'>) => void) | null;
  setOnRecipeSelected: (cb: ((recipeId: Id<'recipes'>) => void) | null) => void;
};

const RecipePickerContext = createContext<RecipePickerContextType | null>(null);

type RecipePickerProviderProps = {
  children: ReactNode;
};

export function RecipePickerProvider({ children }: RecipePickerProviderProps): React.ReactElement {
  const [state, setState] = useState<RecipePickerState>({
    visible: false,
    date: '',
    mealType: 'breakfast',
  });
  const [onRecipeSelected, setOnRecipeSelectedState] = useState<
    ((recipeId: Id<'recipes'>) => void) | null
  >(null);

  const openPicker = useCallback((date: string, mealType: MealType) => {
    setState({ visible: true, date, mealType });
  }, []);

  const closePicker = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  const setOnRecipeSelected = useCallback(
    (cb: ((recipeId: Id<'recipes'>) => void) | null) => {
      // Wrap in function to avoid React treating the callback as a state updater
      setOnRecipeSelectedState(() => cb);
    },
    []
  );

  return (
    <RecipePickerContext.Provider
      value={{ state, openPicker, closePicker, onRecipeSelected, setOnRecipeSelected }}
    >
      {children}
    </RecipePickerContext.Provider>
  );
}

export function useRecipePicker(): RecipePickerContextType {
  const context = useContext(RecipePickerContext);
  if (!context) {
    throw new Error('useRecipePicker must be used within a RecipePickerProvider');
  }
  return context;
}
