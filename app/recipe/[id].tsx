import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Icon } from '@/components/ui/Icon';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Colors, Spacing, Typography, Radius } from '@/constants/theme';
import { COPY } from '@/constants/copy';

const copy = COPY.recipeDetail;

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const recipeId = id as Id<'recipes'>;

  const recipe = useQuery(api.recipes.get, recipeId ? { id: recipeId } : 'skip');
  const userRating = useQuery(
    api.recipes.getUserRating,
    recipeId ? { recipeId } : 'skip'
  );
  const rateMutation = useMutation(api.recipes.rate);

  const [servingsMultiplier, setServingsMultiplier] = useState(1);

  const originalServings = recipe?.servings ?? 1;
  const adjustedServings = Math.round(originalServings * servingsMultiplier);

  const adjustServings = (delta: number) => {
    const newMultiplier = servingsMultiplier + delta;
    if (newMultiplier >= 0.25 && newMultiplier <= 10) {
      setServingsMultiplier(newMultiplier);
    }
  };

  const formatQuantity = useCallback((qty: number): string => {
    const adjusted = qty * servingsMultiplier;
    if (adjusted === Math.floor(adjusted)) {
      return adjusted.toString();
    }
    const rounded = Math.round(adjusted * 100) / 100;
    if (Math.abs(rounded - 0.25) < 0.01) return '\u00BC';
    if (Math.abs(rounded - 0.33) < 0.01) return '\u2153';
    if (Math.abs(rounded - 0.5) < 0.01) return '\u00BD';
    if (Math.abs(rounded - 0.67) < 0.01) return '\u2154';
    if (Math.abs(rounded - 0.75) < 0.01) return '\u00BE';
    return rounded.toString();
  }, [servingsMultiplier]);

  const handleRate = async (value: number) => {
    if (!recipeId) return;
    await rateMutation({ recipeId, value });
  };

  if (!recipeId) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{copy.notFound}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (recipe === undefined) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (recipe === null) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Icon name="chevron-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{copy.notFound}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Icon name="chevron-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{copy.title}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Recipe Image */}
        {recipe.imageUrl ? (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: recipe.imageUrl }}
              style={styles.recipeImage}
              contentFit="cover"
              transition={300}
              cachePolicy="memory-disk"
            />
          </View>
        ) : null}

        {/* Recipe Header */}
        <View style={styles.recipeHeader}>
          <Text style={styles.recipeTitle}>{recipe.title}</Text>
          {recipe.description ? (
            <Text style={styles.recipeDescription}>{recipe.description}</Text>
          ) : null}
        </View>

        {/* Rating Section */}
        <View style={styles.ratingSection}>
          <Text style={styles.ratingLabel}>{copy.rateThisRecipe}</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => handleRate(star)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Icon
                  name="star"
                  size={28}
                  color={userRating != null && star <= userRating ? '#FFB800' : Colors.text.tertiary}
                  filled={userRating != null && star <= userRating}
                />
              </TouchableOpacity>
            ))}
          </View>
          {recipe.averageRating !== undefined && recipe.averageRating !== null && (
            <Text style={styles.avgRatingText}>
              {copy.communityAverage(recipe.averageRating)}
            </Text>
          )}
        </View>

        {/* Meta Tags */}
        <View style={styles.metaRow}>
          {recipe.cuisine ? (
            <View style={styles.metaTag}>
              <Text style={styles.metaText}>{recipe.cuisine}</Text>
            </View>
          ) : null}
          {recipe.difficulty ? (
            <View style={styles.metaTag}>
              <Text style={styles.metaText}>{recipe.difficulty}</Text>
            </View>
          ) : null}
          {recipe.totalTimeMinutes ? (
            <View style={styles.metaTag}>
              <Text style={styles.metaText}>
                {copy.minutes(recipe.totalTimeMinutes)}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Servings Adjuster */}
        {recipe.servings ? (
          <View style={styles.servingsSection}>
            <Text style={styles.servingsLabel}>{copy.servings.label}</Text>
            <View style={styles.servingsAdjuster}>
              <TouchableOpacity
                style={styles.servingsButton}
                onPress={() => adjustServings(-0.5)}
                disabled={servingsMultiplier <= 0.25}
              >
                <Icon
                  name="minus"
                  size={20}
                  color={servingsMultiplier <= 0.25 ? Colors.text.tertiary : Colors.accent}
                />
              </TouchableOpacity>
              <View style={styles.servingsDisplay}>
                <Text style={styles.servingsValue}>{adjustedServings}</Text>
                {servingsMultiplier !== 1 && (
                  <Text style={styles.servingsOriginal}>
                    {copy.servings.was(originalServings)}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.servingsButton}
                onPress={() => adjustServings(0.5)}
                disabled={servingsMultiplier >= 10}
              >
                <Icon
                  name="plus"
                  size={20}
                  color={servingsMultiplier >= 10 ? Colors.text.tertiary : Colors.accent}
                />
              </TouchableOpacity>
            </View>
            {servingsMultiplier !== 1 && (
              <TouchableOpacity onPress={() => setServingsMultiplier(1)}>
                <Text style={styles.resetServings}>{copy.servings.reset}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {/* Nutrition Info */}
        {(recipe.calories ?? recipe.proteinGrams ?? recipe.carbsGrams ?? recipe.fatGrams) ? (
          <View style={styles.nutritionSection}>
            <Text style={styles.nutritionTitle}>{copy.nutrition.title}</Text>
            <View style={styles.nutritionGrid}>
              {recipe.calories ? (
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{Math.round(recipe.calories * servingsMultiplier)}</Text>
                  <Text style={styles.nutritionLabel}>{copy.nutrition.calories}</Text>
                </View>
              ) : null}
              {recipe.proteinGrams ? (
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{Math.round(recipe.proteinGrams * servingsMultiplier)}g</Text>
                  <Text style={styles.nutritionLabel}>{copy.nutrition.protein}</Text>
                </View>
              ) : null}
              {recipe.carbsGrams ? (
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{Math.round(recipe.carbsGrams * servingsMultiplier)}g</Text>
                  <Text style={styles.nutritionLabel}>{copy.nutrition.carbs}</Text>
                </View>
              ) : null}
              {recipe.fatGrams ? (
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{Math.round(recipe.fatGrams * servingsMultiplier)}g</Text>
                  <Text style={styles.nutritionLabel}>{copy.nutrition.fat}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.nutritionNote}>{copy.nutrition.perServing}</Text>
          </View>
        ) : null}

        {/* Creator */}
        {recipe.creatorName ? (
          <Text style={styles.creatorText}>{copy.by} {recipe.creatorName}</Text>
        ) : null}

        {/* Ingredients */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>
            {copy.ingredients} ({recipe.ingredients.length})
          </Text>
          {recipe.ingredients.map((ing, idx) => (
            <View key={idx} style={styles.ingredientRow}>
              <Text style={styles.ingredientBullet}>{'\u2022'}</Text>
              <Text style={styles.ingredientText}>
                {servingsMultiplier !== 1 && ing.quantity > 0 ? (
                  <>
                    <Text style={styles.ingredientQuantity}>
                      {formatQuantity(ing.quantity)} {ing.unit}{' '}
                    </Text>
                    {ing.name}
                    {ing.preparation ? `, ${ing.preparation}` : ''}
                  </>
                ) : (
                  ing.rawText
                )}
              </Text>
            </View>
          ))}
        </View>

        {/* Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>
            {copy.instructions} ({recipe.instructions.length})
          </Text>
          {recipe.instructions.map((inst, idx) => (
            <View key={idx} style={styles.instructionRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{inst.stepNumber}</Text>
              </View>
              <Text style={styles.instructionText}>{inst.text}</Text>
            </View>
          ))}
        </View>

        {/* Dietary Tags */}
        {recipe.dietaryTags && recipe.dietaryTags.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>{copy.dietary}</Text>
            <View style={styles.tagRow}>
              {recipe.dietaryTags.map((tag, idx) => (
                <View key={idx} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Equipment */}
        {recipe.equipment && recipe.equipment.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>{copy.equipment}</Text>
            <View style={styles.tagRow}>
              {recipe.equipment.map((equip, idx) => (
                <View key={idx} style={styles.tag}>
                  <Text style={styles.tagText}>{equip}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Extraction Method */}
        <View style={styles.methodContainer}>
          <Text style={styles.methodLabel}>{copy.extractedVia}</Text>
          <Text style={styles.methodValue}>{recipe.methodUsed} {copy.tier}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: Spacing.xs,
    marginLeft: -Spacing.xs,
  },
  headerTitle: {
    ...Typography.label,
    color: Colors.text.primary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: Spacing.md,
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  imageContainer: {
    marginBottom: Spacing.lg,
    marginHorizontal: -Spacing.lg,
    marginTop: -Spacing.lg,
  },
  recipeImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: Colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  errorText: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  recipeHeader: {
    marginBottom: Spacing.md,
  },
  recipeTitle: {
    ...Typography.h1,
    color: Colors.text.primary,
  },
  recipeDescription: {
    ...Typography.body,
    color: Colors.text.secondary,
    marginTop: Spacing.sm,
  },
  ratingSection: {
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  ratingLabel: {
    ...Typography.label,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  starsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  avgRatingText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    marginTop: Spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  metaTag: {
    backgroundColor: Colors.accentLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  metaText: {
    ...Typography.caption,
    color: Colors.accent,
  },
  servingsSection: {
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  servingsLabel: {
    ...Typography.label,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  servingsAdjuster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  servingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  servingsDisplay: {
    alignItems: 'center',
    minWidth: 60,
  },
  servingsValue: {
    ...Typography.h2,
    color: Colors.text.primary,
  },
  servingsOriginal: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
  resetServings: {
    ...Typography.caption,
    color: Colors.accent,
    marginTop: Spacing.xs,
  },
  nutritionSection: {
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  nutritionTitle: {
    ...Typography.label,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  nutritionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  nutritionItem: {
    alignItems: 'center',
    minWidth: 70,
  },
  nutritionValue: {
    ...Typography.h3,
    color: Colors.accent,
  },
  nutritionLabel: {
    ...Typography.caption,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  nutritionNote: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  creatorText: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
  },
  section: {
    marginTop: Spacing.lg,
  },
  sectionHeader: {
    ...Typography.label,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  ingredientRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  ingredientBullet: {
    ...Typography.body,
    color: Colors.accent,
    marginRight: Spacing.sm,
  },
  ingredientText: {
    ...Typography.body,
    color: Colors.text.primary,
    flex: 1,
  },
  ingredientQuantity: {
    fontWeight: '600',
    color: Colors.accent,
  },
  instructionRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  stepNumberText: {
    ...Typography.caption,
    color: Colors.text.inverse,
    fontWeight: '700',
  },
  instructionText: {
    ...Typography.body,
    color: Colors.text.primary,
    flex: 1,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tag: {
    backgroundColor: Colors.background.tertiary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  tagText: {
    ...Typography.caption,
    color: Colors.text.secondary,
  },
  methodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  methodLabel: {
    ...Typography.bodySmall,
    color: Colors.text.tertiary,
  },
  methodValue: {
    ...Typography.label,
    color: Colors.semantic.success,
    textTransform: 'capitalize',
  },
});
