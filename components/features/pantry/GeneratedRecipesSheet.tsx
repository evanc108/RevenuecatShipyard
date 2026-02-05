import { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import { useModalAnimation } from '@/hooks/useModalAnimation';
import {
  useMealPlanGenerationStore,
  type GeneratedRecipe,
} from '@/stores/useMealPlanGenerationStore';
import type { MealType } from '@/stores/useMealPlanStore';
import { GeneratedRecipeCard } from './GeneratedRecipeCard';

const copy = COPY.pantry.review;

const MEAL_TYPE_ICONS: Record<MealType, string> = {
  breakfast: 'sun',
  lunch: 'restaurant',
  dinner: 'moon',
  snack: 'cookie',
};

export function GeneratedRecipesSheet(): React.ReactElement | null {
  const insets = useSafeAreaInsets();

  const isVisible = useMealPlanGenerationStore((s) => s.isReviewSheetVisible);
  const generatedRecipes = useMealPlanGenerationStore((s) => s.generatedRecipes);
  const closeReviewSheet = useMealPlanGenerationStore((s) => s.closeReviewSheet);
  const openScheduleSheet = useMealPlanGenerationStore((s) => s.openScheduleSheet);

  const { isRendered, backdropOpacity, modalTranslateY } = useModalAnimation({
    visible: isVisible,
  });

  const handleClose = useCallback(() => {
    closeReviewSheet();
  }, [closeReviewSheet]);

  const handleAddToMealPlan = useCallback(
    (recipe: GeneratedRecipe, mealType: MealType) => {
      openScheduleSheet(recipe, mealType);
    },
    [openScheduleSheet]
  );

  const totalRecipes = useMemo(() => {
    if (!generatedRecipes) return 0;
    return (
      generatedRecipes.breakfast.length +
      generatedRecipes.lunch.length +
      generatedRecipes.dinner.length +
      generatedRecipes.snack.length
    );
  }, [generatedRecipes]);

  if (!isRendered || !generatedRecipes) return null;

  const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

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
            paddingTop: insets.top,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{copy.title}</Text>
            <Text style={styles.subtitle}>{copy.subtitle(totalRecipes)}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.done}
            onPress={handleClose}
            style={styles.doneButton}
          >
            <Text style={styles.doneButtonText}>{copy.done}</Text>
          </Pressable>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + Spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {mealTypes.map((mealType) => {
            const recipes = generatedRecipes[mealType];
            if (!recipes || recipes.length === 0) return null;

            return (
              <View key={mealType} style={styles.section}>
                {/* Section Header */}
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIconContainer}>
                    <Icon
                      name={MEAL_TYPE_ICONS[mealType]}
                      size={20}
                      color={Colors.accent}
                    />
                  </View>
                  <Text style={styles.sectionTitle}>
                    {copy.mealTypes[mealType]}
                  </Text>
                </View>

                {/* Horizontal Recipe Cards */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.cardsContainer}
                >
                  {recipes.map((recipe) => (
                    <GeneratedRecipeCard
                      key={recipe.id}
                      recipe={recipe}
                      mealType={mealType}
                      onAddToMealPlan={handleAddToMealPlan}
                    />
                  ))}
                </ScrollView>
              </View>
            );
          })}
        </ScrollView>
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
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    ...Typography.h2,
    color: Colors.text.primary,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  doneButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
  },
  doneButtonText: {
    ...Typography.label,
    color: Colors.text.inverse,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
  },
  cardsContainer: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
});
