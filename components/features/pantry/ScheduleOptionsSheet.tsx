import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Icon } from '@/components/ui/Icon';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import { useModalAnimation } from '@/hooks/useModalAnimation';
import { useMealPlanGenerationStore } from '@/stores/useMealPlanGenerationStore';

const copy = COPY.pantry.schedule;

type ScheduleOption = 'once' | 'weekly' | 'daily' | 'thisWeek';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekDates(startDate: Date): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  // Start from Sunday of current week
  const dayOfWeek = current.getDay();
  current.setDate(current.getDate() - dayOfWeek);

  for (let i = 0; i < 7; i++) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export function ScheduleOptionsSheet(): React.ReactElement | null {
  const insets = useSafeAreaInsets();

  const isVisible = useMealPlanGenerationStore((s) => s.isScheduleSheetVisible);
  const selectedRecipe = useMealPlanGenerationStore((s) => s.selectedRecipe);
  const selectedMealType = useMealPlanGenerationStore((s) => s.selectedMealType);
  const closeScheduleSheet = useMealPlanGenerationStore((s) => s.closeScheduleSheet);

  const [scheduleOption, setScheduleOption] = useState<ScheduleOption>('once');
  const [selectedDays, setSelectedDays] = useState<Set<number>>(() => new Set([new Date().getDay()])); // 0-6
  const [dailyCount, setDailyCount] = useState('5');
  const [isLoading, setIsLoading] = useState(false);

  const toggleDay = useCallback((dayIndex: number) => {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayIndex)) {
        // Don't allow deselecting the last day
        if (next.size > 1) {
          next.delete(dayIndex);
        }
      } else {
        next.add(dayIndex);
      }
      return next;
    });
  }, []);

  const saveRecipe = useMutation(api.recipes.saveGenerated);
  const addMealPlanEntry = useMutation(api.mealPlan.addEntry);
  const getOrCreateMealPrepCookbook = useMutation(api.cookbooks.getOrCreateMealPrepCookbook);
  const addRecipeToCookbook = useMutation(api.cookbooks.addRecipe);

  const resetState = useCallback(() => {
    setScheduleOption('once');
    setSelectedDays(new Set([new Date().getDay()]));
    setDailyCount('5');
    setIsLoading(false);
  }, []);

  const { isRendered, backdropOpacity, modalTranslateY } = useModalAnimation({
    visible: isVisible,
    onAnimationComplete: resetState,
  });

  const handleClose = useCallback(() => {
    if (isLoading) return;
    closeScheduleSheet();
  }, [isLoading, closeScheduleSheet]);

  const handleConfirm = useCallback(async () => {
    if (!selectedRecipe || !selectedMealType || isLoading) return;

    setIsLoading(true);

    try {
      // First, save the generated recipe to the database
      const recipeId = await saveRecipe({
        title: selectedRecipe.title,
        description: selectedRecipe.description,
        cuisine: selectedRecipe.cuisine,
        difficulty: selectedRecipe.difficulty,
        servings: selectedRecipe.servings,
        prepTimeMinutes: selectedRecipe.prepTimeMinutes,
        cookTimeMinutes: selectedRecipe.cookTimeMinutes,
        totalTimeMinutes: selectedRecipe.totalTimeMinutes,
        calories: selectedRecipe.calories,
        proteinGrams: selectedRecipe.proteinGrams,
        carbsGrams: selectedRecipe.carbsGrams,
        fatGrams: selectedRecipe.fatGrams,
        dietaryTags: selectedRecipe.dietaryTags,
        ingredients: selectedRecipe.ingredients.map((ing, idx) => ({
          rawText: `${ing.quantity} ${ing.unit} ${ing.name}${ing.preparation ? `, ${ing.preparation}` : ''}`,
          name: ing.name,
          normalizedName: ing.name.toLowerCase(),
          quantity: ing.quantity,
          unit: ing.unit,
          preparation: ing.preparation,
          sortOrder: idx,
        })),
        instructions: selectedRecipe.instructions.map((inst) => ({
          stepNumber: inst.stepNumber,
          text: inst.text,
        })),
      });

      // Save recipe to Meal Prep cookbook
      const mealPrepCookbookId = await getOrCreateMealPrepCookbook({});
      await addRecipeToCookbook({ cookbookId: mealPrepCookbookId, recipeId });

      // Determine which dates to add entries for
      const today = new Date();
      const datesToAdd: string[] = [];

      switch (scheduleOption) {
        case 'once': {
          // Just today
          datesToAdd.push(formatDate(today));
          break;
        }
        case 'weekly': {
          // Next occurrence of each selected day
          for (const dayIndex of selectedDays) {
            const nextDate = new Date(today);
            const daysUntil = (dayIndex - today.getDay() + 7) % 7;
            // If today is the selected day, add today; otherwise add next occurrence
            nextDate.setDate(today.getDate() + (daysUntil === 0 ? 0 : daysUntil));
            datesToAdd.push(formatDate(nextDate));
          }
          break;
        }
        case 'daily': {
          // Next N days
          const count = parseInt(dailyCount, 10) || 5;
          for (let i = 0; i < count; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            datesToAdd.push(formatDate(date));
          }
          break;
        }
        case 'thisWeek': {
          // Rest of this week starting today
          const weekDates = getWeekDates(today);
          const todayStr = formatDate(today);
          for (const date of weekDates) {
            if (date >= todayStr) {
              datesToAdd.push(date);
            }
          }
          break;
        }
      }

      // Add meal plan entries
      for (const date of datesToAdd) {
        await addMealPlanEntry({
          date,
          mealType: selectedMealType,
          recipeId,
        });
      }

      closeScheduleSheet();
    } catch (error) {
      console.error('Failed to add to meal plan:', error);
    } finally {
      setIsLoading(false);
    }
  }, [
    selectedRecipe,
    selectedMealType,
    isLoading,
    scheduleOption,
    selectedDays,
    dailyCount,
    saveRecipe,
    addMealPlanEntry,
    getOrCreateMealPrepCookbook,
    addRecipeToCookbook,
    closeScheduleSheet,
  ]);

  if (!isRendered || !selectedRecipe) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheetContainer,
          {
            transform: [{ translateY: modalTranslateY }],
            paddingBottom: Math.max(insets.bottom, Spacing.lg),
          },
        ]}
      >
        {/* Handle */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{copy.title}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={handleClose}
            hitSlop={12}
            disabled={isLoading}
          >
            <Icon
              name="close"
              size={24}
              color={isLoading ? Colors.text.disabled : Colors.text.secondary}
            />
          </Pressable>
        </View>

        {/* Recipe Preview */}
        <View style={styles.recipePreview}>
          <Icon name="restaurant" size={20} color={Colors.accent} />
          <Text style={styles.recipeTitle} numberOfLines={1}>
            {selectedRecipe.title}
          </Text>
        </View>

        {/* Options */}
        <View style={styles.optionsContainer}>
          {/* Once */}
          <Pressable
            style={[styles.optionRow, scheduleOption === 'once' && styles.optionRowSelected]}
            onPress={() => setScheduleOption('once')}
            disabled={isLoading}
          >
            <View style={[styles.radioCircle, scheduleOption === 'once' && styles.radioCircleSelected]}>
              {scheduleOption === 'once' && <View style={styles.radioInner} />}
            </View>
            <Text style={styles.optionText}>{copy.once}</Text>
          </Pressable>

          {/* Weekly */}
          <Pressable
            style={[styles.optionRow, scheduleOption === 'weekly' && styles.optionRowSelected]}
            onPress={() => setScheduleOption('weekly')}
            disabled={isLoading}
          >
            <View style={[styles.radioCircle, scheduleOption === 'weekly' && styles.radioCircleSelected]}>
              {scheduleOption === 'weekly' && <View style={styles.radioInner} />}
            </View>
            <Text style={styles.optionText}>{copy.weekly}</Text>
          </Pressable>

          {/* Day selector for weekly */}
          {scheduleOption === 'weekly' && (
            <View style={styles.daySelector}>
              {DAY_NAMES.map((day, index) => (
                <Pressable
                  key={day}
                  style={[
                    styles.dayChip,
                    selectedDays.has(index) && styles.dayChipSelected,
                  ]}
                  onPress={() => toggleDay(index)}
                  disabled={isLoading}
                >
                  <Text
                    style={[
                      styles.dayChipText,
                      selectedDays.has(index) && styles.dayChipTextSelected,
                    ]}
                  >
                    {day}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Daily for N days */}
          <Pressable
            style={[styles.optionRow, scheduleOption === 'daily' && styles.optionRowSelected]}
            onPress={() => setScheduleOption('daily')}
            disabled={isLoading}
          >
            <View style={[styles.radioCircle, scheduleOption === 'daily' && styles.radioCircleSelected]}>
              {scheduleOption === 'daily' && <View style={styles.radioInner} />}
            </View>
            <Text style={styles.optionText}>{copy.daily}</Text>
            <TextInput
              style={styles.daysInput}
              value={dailyCount}
              onChangeText={setDailyCount}
              keyboardType="number-pad"
              maxLength={2}
              editable={!isLoading && scheduleOption === 'daily'}
            />
            <Text style={styles.optionText}>{copy.days}</Text>
          </Pressable>

          {/* This whole week */}
          <Pressable
            style={[styles.optionRow, scheduleOption === 'thisWeek' && styles.optionRowSelected]}
            onPress={() => setScheduleOption('thisWeek')}
            disabled={isLoading}
          >
            <View style={[styles.radioCircle, scheduleOption === 'thisWeek' && styles.radioCircleSelected]}>
              {scheduleOption === 'thisWeek' && <View style={styles.radioInner} />}
            </View>
            <Text style={styles.optionText}>{copy.thisWeek}</Text>
          </Pressable>
        </View>

        {/* Confirm Button */}
        <Pressable
          style={[styles.confirmButton, isLoading && styles.confirmButtonLoading]}
          onPress={handleConfirm}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel={copy.confirm}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={Colors.text.inverse} />
          ) : (
            <>
              <Icon name="checkmark" size={20} color={Colors.text.inverse} />
              <Text style={styles.confirmButtonText}>{copy.confirm}</Text>
            </>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background.overlay,
  },
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background.primary,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  title: {
    ...Typography.h2,
    color: Colors.text.primary,
  },
  recipePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    marginBottom: Spacing.lg,
  },
  recipeTitle: {
    ...Typography.body,
    color: Colors.accent,
    fontWeight: '600',
    flex: 1,
  },
  optionsContainer: {
    marginBottom: Spacing.lg,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    marginBottom: Spacing.xs,
  },
  optionRowSelected: {
    backgroundColor: Colors.background.secondary,
  },
  optionText: {
    ...Typography.body,
    color: Colors.text.primary,
  },
  daySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  dayChip: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.secondary,
  },
  dayChipSelected: {
    backgroundColor: Colors.accent,
  },
  dayChipText: {
    ...Typography.caption,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  dayChipTextSelected: {
    color: Colors.text.inverse,
  },
  daysInput: {
    ...Typography.body,
    color: Colors.text.primary,
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    width: 50,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  confirmButtonLoading: {
    opacity: 0.8,
  },
  confirmButtonText: {
    ...Typography.label,
    fontSize: 16,
    color: Colors.text.inverse,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.text.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: Colors.accent,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.accent,
  },
});
