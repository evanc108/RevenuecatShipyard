import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const ALL_MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

type MealPlanState = {
  enabledMealTypes: MealType[];
  toggleMealType: (mealType: MealType) => void;
};

export const useMealPlanStore = create<MealPlanState>()(
  persist(
    (set, get) => ({
      enabledMealTypes: ALL_MEAL_TYPES,
      toggleMealType: (mealType) => {
        const current = get().enabledMealTypes;
        const isEnabled = current.includes(mealType);

        // Must keep at least one meal type enabled
        if (isEnabled && current.length <= 1) return;

        set({
          enabledMealTypes: isEnabled
            ? current.filter((t) => t !== mealType)
            : [...current, mealType],
        });
      },
    }),
    {
      name: 'meal-plan-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
