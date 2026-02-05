import { memo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { Colors, Spacing, Radius, Typography, Shadow } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import type { GeneratedRecipe } from '@/stores/useMealPlanGenerationStore';
import type { MealType } from '@/stores/useMealPlanStore';

type GeneratedRecipeCardProps = {
  recipe: GeneratedRecipe;
  mealType: MealType;
  onAddToMealPlan: (recipe: GeneratedRecipe, mealType: MealType) => void;
};

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: Colors.semantic.success,
  Medium: Colors.semantic.warning,
  Hard: Colors.semantic.error,
};

function GeneratedRecipeCardComponent({
  recipe,
  mealType,
  onAddToMealPlan,
}: GeneratedRecipeCardProps): React.ReactElement {
  const handleAddToMealPlan = useCallback(() => {
    onAddToMealPlan(recipe, mealType);
  }, [recipe, mealType, onAddToMealPlan]);

  const difficultyColor = recipe.difficulty
    ? DIFFICULTY_COLORS[recipe.difficulty] ?? Colors.text.secondary
    : Colors.text.secondary;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Icon name="restaurant" size={24} color={Colors.accent} />
        </View>
        {recipe.difficulty && (
          <View style={[styles.difficultyBadge, { backgroundColor: `${difficultyColor}20` }]}>
            <Text style={[styles.difficultyText, { color: difficultyColor }]}>
              {recipe.difficulty}
            </Text>
          </View>
        )}
      </View>

      {/* Title & Description */}
      <Text style={styles.title} numberOfLines={2}>
        {recipe.title}
      </Text>
      <Text style={styles.description} numberOfLines={2}>
        {recipe.description}
      </Text>

      {/* Meta Row */}
      <View style={styles.metaRow}>
        {recipe.calories !== undefined && (
          <View style={styles.metaItem}>
            <Icon name="flame" size={14} color={Colors.accent} />
            <Text style={styles.metaText}>{recipe.calories} cal</Text>
          </View>
        )}
        {recipe.totalTimeMinutes !== undefined && (
          <View style={styles.metaItem}>
            <Icon name="time-outline" size={14} color={Colors.text.tertiary} />
            <Text style={styles.metaText}>{recipe.totalTimeMinutes} min</Text>
          </View>
        )}
        {recipe.cuisine && (
          <View style={styles.metaItem}>
            <Icon name="compass" size={14} color={Colors.text.tertiary} />
            <Text style={styles.metaText}>{recipe.cuisine}</Text>
          </View>
        )}
      </View>

      {/* Nutrition Highlights */}
      {(recipe.proteinGrams !== undefined || recipe.carbsGrams !== undefined || recipe.fatGrams !== undefined) && (
        <View style={styles.nutritionRow}>
          {recipe.proteinGrams !== undefined && (
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{recipe.proteinGrams}g</Text>
              <Text style={styles.nutritionLabel}>Protein</Text>
            </View>
          )}
          {recipe.carbsGrams !== undefined && (
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{recipe.carbsGrams}g</Text>
              <Text style={styles.nutritionLabel}>Carbs</Text>
            </View>
          )}
          {recipe.fatGrams !== undefined && (
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{recipe.fatGrams}g</Text>
              <Text style={styles.nutritionLabel}>Fat</Text>
            </View>
          )}
        </View>
      )}

      {/* Ingredients Preview */}
      <View style={styles.ingredientsPreview}>
        <Text style={styles.ingredientsLabel}>
          {recipe.ingredients.length} ingredients
        </Text>
        <Text style={styles.ingredientsList} numberOfLines={1}>
          {recipe.ingredients.slice(0, 4).map((i) => i.name).join(', ')}
          {recipe.ingredients.length > 4 ? '...' : ''}
        </Text>
      </View>

      {/* Add Button */}
      <Pressable
        style={styles.addButton}
        onPress={handleAddToMealPlan}
        accessibilityRole="button"
        accessibilityLabel={COPY.pantry.review.addToMealPlan}
      >
        <Icon name="add" size={18} color={Colors.text.inverse} />
        <Text style={styles.addButtonText}>{COPY.pantry.review.addToMealPlan}</Text>
      </Pressable>
    </View>
  );
}

const CARD_WIDTH = 280;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.background.primary,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadow.surface,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  difficultyBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  difficultyText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  title: {
    ...Typography.h3,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  description: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metaText: {
    ...Typography.caption,
    color: Colors.text.secondary,
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionValue: {
    ...Typography.label,
    color: Colors.text.primary,
  },
  nutritionLabel: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    fontSize: 10,
  },
  ingredientsPreview: {
    marginBottom: Spacing.md,
  },
  ingredientsLabel: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    marginBottom: 2,
  },
  ingredientsList: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
  },
  addButtonText: {
    ...Typography.label,
    color: Colors.text.inverse,
  },
});

export const GeneratedRecipeCard = memo(GeneratedRecipeCardComponent);
