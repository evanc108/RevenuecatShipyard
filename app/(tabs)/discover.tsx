import { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { SwipeableCardStack } from '@/components/discover/SwipeableCardStack';
import type { Recipe } from '@/components/discover/RecipeCard';
import type { Doc, Id } from '@/convex/_generated/dataModel';

// Threshold for triggering more recipe population
const LOW_RECIPE_THRESHOLD = 8;
// Number of recipes to populate when running low
const POPULATE_COUNT = 15;
// Maximum populate attempts per session to prevent infinite loops
const MAX_POPULATE_ATTEMPTS = 3;
// Cooldown in ms before allowing another populate after success
// This gives Convex queries time to sync
const POPULATE_COOLDOWN_MS = 10000;

type DiscoverRecipe = Doc<'discoverRecipes'>;
type RecipeWithId = Recipe & { _discoverRecipeId: Id<'discoverRecipes'> };

/**
 * Convert a discoverRecipe document to the Recipe type used by cards.
 */
function toRecipeCard(recipe: DiscoverRecipe): Recipe {
  return {
    url: recipe.sourceUrl,
    title: recipe.title,
    description: recipe.description,
    cuisine: recipe.cuisine,
    difficulty: recipe.difficulty,
    imageUrl: recipe.imageUrl,
    servings: recipe.servings,
    prepTimeMinutes: recipe.prepTimeMinutes,
    cookTimeMinutes: recipe.cookTimeMinutes,
    totalTimeMinutes: recipe.totalTimeMinutes,
    calories: recipe.calories,
    proteinGrams: recipe.proteinGrams,
    carbsGrams: recipe.carbsGrams,
    fatGrams: recipe.fatGrams,
    dietaryTags: recipe.dietaryTags,
    keywords: recipe.keywords,
    creatorName: recipe.creatorName,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    // Include the discover recipe ID for tracking
    _discoverRecipeId: recipe._id,
  } as Recipe & { _discoverRecipeId: string };
}

export default function DiscoverScreen() {
  const [isPopulating, setIsPopulating] = useState(false);
  const [populateError, setPopulateError] = useState<string | null>(null);
  const [hasAttemptedPopulate, setHasAttemptedPopulate] = useState(false);
  // Track total attempts this session to prevent infinite loops
  const [populateAttempts, setPopulateAttempts] = useState(0);
  // Track if we're in cooldown period after a successful populate
  const [isInCooldown, setIsInCooldown] = useState(false);

  // Stable queue of recipes - new recipes are appended to the end
  const [recipeQueue, setRecipeQueue] = useState<RecipeWithId[]>([]);
  // Track which recipe IDs we've already added to the queue
  const seenRecipeIds = useRef<Set<string>>(new Set());

  const currentUser = useQuery(api.users.current);
  const unviewedRecipes = useQuery(api.discoverFeed.getUnviewedRecipes, {
    limit: 20,
  });
  const unviewedCount = useQuery(api.discoverFeed.getUnviewedCount);

  const recordView = useMutation(api.discoverFeed.recordView);
  const saveRecipe = useMutation(api.savedRecipes.saveRecipe);
  const populateFromBackend = useAction(api.discoverFeedActions.populateFromBackend);

  // User preferences for population
  const dietaryRestrictions = currentUser?.dietaryRestrictions ?? [];
  const ingredientDislikes = currentUser?.ingredientDislikes ?? [];

  // When unviewedRecipes changes, append any new recipes to the end of our queue
  useEffect(() => {
    if (!unviewedRecipes) return;

    const newRecipes: RecipeWithId[] = [];
    for (const recipe of unviewedRecipes) {
      if (!seenRecipeIds.current.has(recipe._id)) {
        seenRecipeIds.current.add(recipe._id);
        newRecipes.push(toRecipeCard(recipe) as RecipeWithId);
      }
    }

    if (newRecipes.length > 0) {
      setRecipeQueue((prev) => [...prev, ...newRecipes]);
    }
  }, [unviewedRecipes]);

  // Use our stable queue instead of directly using query results
  const recipes = recipeQueue;

  // Check if we need to populate more recipes
  // SAFETY: Multiple guards to prevent infinite loops that waste OpenAI tokens
  useEffect(() => {
    const shouldPopulate =
      unviewedCount !== undefined &&
      unviewedCount < LOW_RECIPE_THRESHOLD &&
      !isPopulating &&
      !hasAttemptedPopulate &&
      !isInCooldown &&
      populateAttempts < MAX_POPULATE_ATTEMPTS &&
      currentUser !== undefined;

    if (shouldPopulate) {
      setHasAttemptedPopulate(true);
      setPopulateAttempts((prev) => prev + 1);
      handlePopulate();
    }
  }, [unviewedCount, isPopulating, currentUser, hasAttemptedPopulate, isInCooldown, populateAttempts]);

  const handlePopulate = useCallback(async () => {
    if (isPopulating || isInCooldown) return;

    setIsPopulating(true);
    setPopulateError(null);

    try {
      const result = await populateFromBackend({
        count: POPULATE_COUNT,
        dietaryRestrictions:
          dietaryRestrictions.length > 0 ? dietaryRestrictions : undefined,
        excludeIngredients:
          ingredientDislikes.length > 0 ? ingredientDislikes : undefined,
      });

      // SAFETY: Only allow another populate if we actually added NEW recipes
      // This prevents loops when all recipes already exist in the database
      const newlyInserted = result.newlyInserted ?? 0;

      if (newlyInserted > 0) {
        // Start cooldown period to let Convex queries sync
        // This prevents race condition where hasAttemptedPopulate resets
        // before unviewedCount query has updated
        setIsInCooldown(true);
        setTimeout(() => {
          setIsInCooldown(false);
          setHasAttemptedPopulate(false);
        }, POPULATE_COOLDOWN_MS);
      } else {
        // No new recipes added - don't reset, we've exhausted the pool
        console.log('No new recipes were added - may have exhausted available recipes');
      }
    } catch (err) {
      console.error('Failed to populate recipes:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      if (errorMessage.includes('402') || errorMessage.includes('limit')) {
        setPopulateError('Recipe service temporarily unavailable. Try again later.');
      } else {
        setPopulateError('Failed to load more recipes');
      }
      // On error, don't reset - prevent retry loops
    } finally {
      setIsPopulating(false);
    }
  }, [
    isPopulating,
    isInCooldown,
    populateFromBackend,
    dietaryRestrictions,
    ingredientDislikes,
  ]);

  const handleSwipeLeft = async (recipe: Recipe) => {
    // Record skip action
    const discoverRecipeId = (recipe as Recipe & { _discoverRecipeId?: string })
      ._discoverRecipeId;
    if (discoverRecipeId) {
      try {
        await recordView({
          discoverRecipeId: discoverRecipeId as any,
          action: 'skipped',
        });
      } catch (err) {
        console.error('Failed to record skip:', err);
      }
    }
  };

  const handleSwipeRight = async (recipe: Recipe) => {
    const discoverRecipeId = (recipe as Recipe & { _discoverRecipeId?: string })
      ._discoverRecipeId;

    // Record save action
    if (discoverRecipeId) {
      try {
        await recordView({
          discoverRecipeId: discoverRecipeId as any,
          action: 'saved',
        });
      } catch (err) {
        console.error('Failed to record save:', err);
      }
    }

    // Save to user's collection
    try {
      await saveRecipe({
        url: recipe.url,
        title: recipe.title,
        description: recipe.description,
        imageUrl: recipe.imageUrl,
        cuisine: recipe.cuisine,
        difficulty: recipe.difficulty,

        servings: recipe.servings,
        prepTimeMinutes: recipe.prepTimeMinutes,
        cookTimeMinutes: recipe.cookTimeMinutes,
        totalTimeMinutes: recipe.totalTimeMinutes,

        calories: recipe.calories,
        proteinGrams: recipe.proteinGrams,
        carbsGrams: recipe.carbsGrams,
        fatGrams: recipe.fatGrams,

        dietaryTags: recipe.dietaryTags,
        keywords: recipe.keywords,

        creatorName: recipe.creatorName,

        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
      });
    } catch (err) {
      console.error('Failed to save recipe:', err);
    }
  };

  const renderContent = () => {
    // Loading state - waiting for initial data
    if (unviewedRecipes === undefined || currentUser === undefined) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading recipes...</Text>
        </View>
      );
    }

    // Populating state - fetching new recipes from backend
    if (isPopulating && recipes.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Finding recipes for you...</Text>
          <Text style={styles.subText}>
            This may take a moment as we curate the best recipes
          </Text>
        </View>
      );
    }

    // Error state
    if (populateError && recipes.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{populateError}</Text>
          <Pressable style={styles.retryButton} onPress={handlePopulate}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      );
    }

    // Empty state - no recipes available
    if (recipes.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No recipes available</Text>
          <Text style={styles.subText}>
            Check back soon for new recipes!
          </Text>
          <Pressable style={styles.retryButton} onPress={handlePopulate}>
            <Text style={styles.retryButtonText}>Load Recipes</Text>
          </Pressable>
        </View>
      );
    }

    // Show recipe cards
    return (
      <SwipeableCardStack
        recipes={recipes}
        onSwipeLeft={handleSwipeLeft}
        onSwipeRight={handleSwipeRight}
      />
    );
  };

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Discover</Text>
          <Text style={styles.subtitle}>Swipe to find your next meal</Text>
        </View>

        <View style={styles.cardContainer}>{renderContent()}</View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: {
    ...Typography.h1,
    color: Colors.text.primary,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  cardContainer: {
    flex: 1,
    paddingBottom: Spacing.md,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.text.secondary,
    marginTop: Spacing.md,
  },
  subText: {
    ...Typography.bodySmall,
    color: Colors.text.tertiary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  errorText: {
    ...Typography.body,
    color: Colors.semantic.error,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  retryButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 4,
    borderRadius: 12,
    marginTop: Spacing.md,
  },
  retryButtonText: {
    ...Typography.label,
    color: Colors.text.inverse,
  },
});
