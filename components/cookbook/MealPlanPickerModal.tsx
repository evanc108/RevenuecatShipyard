import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Icon } from '@/components/ui/Icon';
import { Colors, Spacing, Radius, Typography, Shadow } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import { useModalAnimation } from '@/hooks/useModalAnimation';

const copy = COPY.recipeDetail.mealPlanPicker;

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const MEAL_TYPES: { key: MealType; label: string; icon: string }[] = [
  { key: 'breakfast', label: copy.breakfast, icon: 'sun' },
  { key: 'lunch', label: copy.lunch, icon: 'utensils' },
  { key: 'dinner', label: copy.dinner, icon: 'moon' },
  { key: 'snack', label: copy.snack, icon: 'cookie' },
];

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDayLabel(date: Date, index: number): string {
  if (index === 0) return copy.today;
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function getDayNumber(date: Date): string {
  return date.getDate().toString();
}

function getNext7Days(): Date[] {
  const days: Date[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

type MealPlanPickerModalProps = {
  visible: boolean;
  recipeId: Id<'recipes'> | null;
  recipeTitle: string;
  onClose: () => void;
  onSuccess?: () => void;
};

export function MealPlanPickerModal({
  visible,
  recipeId,
  recipeTitle,
  onClose,
  onSuccess,
}: MealPlanPickerModalProps): React.ReactElement | null {
  const insets = useSafeAreaInsets();

  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('dinner');
  const [isLoading, setIsLoading] = useState(false);

  const addMealPlanEntry = useMutation(api.mealPlan.addEntry);

  const days = getNext7Days();

  const resetState = useCallback(() => {
    setSelectedDayIndex(0);
    setSelectedMealType('dinner');
    setIsLoading(false);
  }, []);

  const { isRendered, backdropOpacity, modalTranslateY } = useModalAnimation({
    visible,
    onAnimationComplete: resetState,
  });

  const handleClose = useCallback(() => {
    if (isLoading) return;
    onClose();
  }, [isLoading, onClose]);

  const handleConfirm = useCallback(async () => {
    if (!recipeId || isLoading) return;
    setIsLoading(true);

    try {
      const selectedDate = days[selectedDayIndex];
      if (!selectedDate) return;

      await addMealPlanEntry({
        date: formatDate(selectedDate),
        mealType: selectedMealType,
        recipeId,
        addToGroceryList: true,
      });

      onClose();
      onSuccess?.();
    } finally {
      setIsLoading(false);
    }
  }, [recipeId, isLoading, days, selectedDayIndex, selectedMealType, addMealPlanEntry, onClose, onSuccess]);

  if (!isRendered || !recipeId) return null;

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
          <Icon name="utensils" size={18} color={Colors.text.secondary} />
          <Text style={styles.recipeTitle} numberOfLines={1}>
            {recipeTitle}
          </Text>
        </View>

        {/* Day Selector */}
        <Text style={styles.sectionLabel}>{copy.selectDay}</Text>
        <View style={styles.daysRow}>
          {days.map((date, index) => {
            const isSelected = index === selectedDayIndex;
            return (
              <Pressable
                key={index}
                style={[styles.dayChip, isSelected && styles.dayChipSelected]}
                onPress={() => setSelectedDayIndex(index)}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityLabel={getDayLabel(date, index)}
                accessibilityState={{ selected: isSelected }}
              >
                <Text
                  style={[
                    styles.dayLabel,
                    isSelected && styles.dayLabelSelected,
                  ]}
                >
                  {getDayLabel(date, index)}
                </Text>
                <Text
                  style={[
                    styles.dayNumber,
                    isSelected && styles.dayNumberSelected,
                  ]}
                >
                  {getDayNumber(date)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Meal Type Selector */}
        <Text style={styles.sectionLabel}>{copy.selectMeal}</Text>
        <View style={styles.mealsRow}>
          {MEAL_TYPES.map(({ key, label, icon }) => {
            const isSelected = key === selectedMealType;
            return (
              <Pressable
                key={key}
                style={[
                  styles.mealChip,
                  isSelected && styles.mealChipSelected,
                ]}
                onPress={() => setSelectedMealType(key)}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: isSelected }}
              >
                <Icon
                  name={icon}
                  size={20}
                  color={isSelected ? Colors.text.inverse : Colors.text.secondary}
                />
                <Text
                  style={[
                    styles.mealLabel,
                    isSelected && styles.mealLabelSelected,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
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
              <Icon name="calendar" size={20} color={Colors.text.inverse} />
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
    marginBottom: Spacing.lg,
  },
  recipeTitle: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '600',
    flex: 1,
  },
  sectionLabel: {
    ...Typography.label,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
    gap: Spacing.xs,
  },
  dayChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.background.secondary,
  },
  dayChipSelected: {
    backgroundColor: Colors.text.primary,
  },
  dayLabel: {
    ...Typography.caption,
    color: Colors.text.secondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  dayLabelSelected: {
    color: Colors.text.inverse,
  },
  dayNumber: {
    ...Typography.label,
    color: Colors.text.primary,
    fontWeight: '700',
  },
  dayNumberSelected: {
    color: Colors.text.inverse,
  },
  mealsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  mealChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.background.secondary,
    gap: Spacing.xs,
  },
  mealChipSelected: {
    backgroundColor: Colors.accent,
    ...Shadow.surface,
  },
  mealLabel: {
    ...Typography.caption,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  mealLabelSelected: {
    color: Colors.text.inverse,
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
});
