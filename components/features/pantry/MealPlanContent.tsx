import { memo, useState, useMemo, useCallback, useEffect } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Colors, Spacing } from '@/constants/theme';
import { useMealPlanStore } from '@/stores/useMealPlanStore';
import type { MealType } from '@/stores/useMealPlanStore';
import { useRecipePicker } from '@/context/RecipePickerContext';
import { WeekdayPicker } from './WeekdayPicker';
import { MealSection } from './MealSection';

function formatToday(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function MealPlanContentComponent(): React.ReactElement {
  const [selectedDate, setSelectedDate] = useState(formatToday);
  const [activeMealType, setActiveMealType] = useState<MealType>('breakfast');

  const enabledMealTypes = useMealPlanStore((s) => s.enabledMealTypes);
  const { openPicker, setOnRecipeSelected } = useRecipePicker();

  const entries = useQuery(api.mealPlan.getEntriesForDate, {
    date: selectedDate,
  });
  const addEntry = useMutation(api.mealPlan.addEntry);
  const removeEntry = useMutation(api.mealPlan.removeEntry);

  const grouped = useMemo(() => {
    const map: Record<string, typeof entries> = {};
    for (const type of enabledMealTypes) {
      map[type] = [];
    }
    if (entries) {
      for (const entry of entries) {
        const key = entry.mealType;
        if (map[key]) {
          map[key].push(entry);
        }
      }
    }
    return map;
  }, [entries, enabledMealTypes]);

  // Register the recipe-selected callback
  const handleAddRecipe = useCallback(
    async (recipeId: Id<'recipes'>) => {
      await addEntry({
        date: selectedDate,
        mealType: activeMealType,
        recipeId,
      });
    },
    [addEntry, selectedDate, activeMealType]
  );

  useEffect(() => {
    setOnRecipeSelected(handleAddRecipe);
  }, [handleAddRecipe, setOnRecipeSelected]);

  const handleOpenPicker = useCallback(
    (mealType: MealType) => {
      setActiveMealType(mealType);
      openPicker(selectedDate, mealType);
    },
    [openPicker, selectedDate]
  );

  const handleRemoveEntry = useCallback(
    async (entryId: Id<'mealPlanEntries'>) => {
      await removeEntry({ entryId });
    },
    [removeEntry]
  );

  return (
    <View style={styles.container}>
      <WeekdayPicker
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
      />

      <View style={styles.divider} />
      {entries === undefined ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.accent} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {enabledMealTypes.map((mealType) => (
            <MealSection
              key={mealType}
              mealType={mealType}
              entries={grouped[mealType] ?? []}
              onAddPress={() => handleOpenPicker(mealType)}
              onRemoveEntry={handleRemoveEntry}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  divider: {
    height: 2,
    backgroundColor: Colors.accentLight,
    marginHorizontal: Spacing.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.lg,
  },
});

export const MealPlanContent = memo(MealPlanContentComponent);
