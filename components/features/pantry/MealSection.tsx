import { memo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import { RecipeCard } from '@/components/cookbook/RecipeCard';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import { parseDifficulty } from '@/utils/parseDifficulty';
import type { MealType } from '@/stores/useMealPlanStore';
import type { Id } from '@/convex/_generated/dataModel';

type MealEntry = {
  _id: Id<'mealPlanEntries'>;
  mealType: string;
  sortOrder: number;
  recipe: {
    _id: Id<'recipes'>;
    title: string;
    imageUrl?: string;
    cuisine?: string;
    totalTimeMinutes?: number;
    difficulty?: string | number;
  };
};

type MealSectionProps = {
  mealType: MealType;
  entries: MealEntry[];
  onAddPress: () => void;
  onRemoveEntry: (entryId: Id<'mealPlanEntries'>) => void;
};

const MEAL_ICON_MAP: Record<MealType, IconName> = {
  breakfast: 'sun',
  lunch: 'utensils',
  dinner: 'moon',
  snack: 'cookie',
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_GAP = Spacing.md;
const CARD_WIDTH = (SCREEN_WIDTH - Spacing.md * 2 - GRID_GAP) / 2;

function MealSectionComponent({
  mealType,
  entries,
  onAddPress,
  onRemoveEntry,
}: MealSectionProps): React.ReactElement {
  const router = useRouter();
  const iconName = MEAL_ICON_MAP[mealType];
  const label = COPY.pantry.mealPlan.mealTypes[mealType];

  const handleRecipePress = useCallback(
    (recipeId: Id<'recipes'>) => {
      router.push(`/recipe/${recipeId}`);
    },
    [router]
  );

  const handleRemove = useCallback(
    (entryId: Id<'mealPlanEntries'>) => {
      onRemoveEntry(entryId);
    },
    [onRemoveEntry]
  );

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Icon name={iconName} size={18} color={Colors.accent} />
          <Text style={styles.label}>{label}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add recipe to ${label}`}
          onPress={onAddPress}
          hitSlop={8}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>+ ADD</Text>
        </Pressable>
      </View>

      {/* Recipe Cards Grid */}
      {entries.length > 0 ? (
        <View style={styles.grid}>
          {entries.map((entry) => (
            <View key={entry._id} style={styles.cardWrapper}>
              <RecipeCard
                title={entry.recipe.title}
                imageUrl={entry.recipe.imageUrl}
                totalTimeMinutes={entry.recipe.totalTimeMinutes ?? 0}
                difficulty={parseDifficulty(entry.recipe.difficulty)}
                cuisine={entry.recipe.cuisine}
                onPress={() => handleRecipePress(entry.recipe._id)}
              />
              {/* Remove button overlay */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove recipe"
                onPress={() => handleRemove(entry._id)}
                hitSlop={8}
                style={styles.removeButton}
              >
                <Icon name="close" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {/* Bottom divider */}
      <View style={styles.bottomDivider} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  label: {
    ...Typography.h3,
    color: Colors.text.primary,
  },
  addButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.full,
  },
  addButtonText: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    marginTop: Spacing.xs,
  },
  cardWrapper: {
    width: CARD_WIDTH,
    aspectRatio: 0.75,
  },
  removeButton: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginTop: Spacing.xs,
  },
});

export const MealSection = memo(MealSectionComponent);
