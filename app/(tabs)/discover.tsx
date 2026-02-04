import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { FlashList } from '@shopify/flash-list';
import { useAction, useMutation, useQuery } from 'convex/react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/convex/_generated/api';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { TabSlider } from '@/components/ui/TabSlider';
import { SwipeableCardStack } from '@/components/discover/SwipeableCardStack';
import { CookbookSelectionModal } from '@/components/ui/CookbookSelectionModal';
import { FeedPost } from '@/components/ui/FeedPost';
import { COPY } from '@/constants/copy';
import type { Recipe } from '@/components/discover/RecipeCard';
import type { Doc, Id } from '@/convex/_generated/dataModel';

// --- Types ---
type TabKey = 'discover' | 'feed';

type DiscoverRecipe = Doc<'discoverRecipes'>;
type RecipeWithId = Recipe & { _discoverRecipeId: Id<'discoverRecipes'> };

type FeedRecipeInfo = {
  _id: Id<'recipes'>;
  title: string;
  imageUrl?: string;
  totalTimeMinutes?: number;
  url: string;
};

type FeedPostData = {
  _id: Id<'posts'>;
  _creationTime: number;
  userId: Id<'users'>;
  recipeId: Id<'recipes'>;
  easeRating: number;
  tasteRating: number;
  presentationRating: number;
  notes?: string;
  createdAt: number;
  user: {
    _id: Id<'users'>;
    firstName: string;
    lastName: string;
    username: string;
    imageUrl: string | undefined;
  };
  recipe: FeedRecipeInfo;
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  isSaved: boolean;
};

// --- Constants ---
const TABS = [
  { key: 'discover' as const, label: COPY.discover.tabs.discover },
  { key: 'feed' as const, label: COPY.discover.tabs.feed },
];

const LOW_RECIPE_THRESHOLD = 8;
const POPULATE_COUNT = 15;
const MAX_POPULATE_ATTEMPTS = 3;
const POPULATE_COOLDOWN_MS = 10000;

// --- Helpers ---
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
    _discoverRecipeId: recipe._id,
  } as Recipe & { _discoverRecipeId: string };
}

// --- Discover Content Component ---
function DiscoverContent() {
  const [isPopulating, setIsPopulating] = useState(false);
  const [populateError, setPopulateError] = useState<string | null>(null);
  const [hasAttemptedPopulate, setHasAttemptedPopulate] = useState(false);
  const [populateAttempts, setPopulateAttempts] = useState(0);
  const [isInCooldown, setIsInCooldown] = useState(false);
  const [recipeQueue, setRecipeQueue] = useState<RecipeWithId[]>([]);
  const seenRecipeIds = useRef<Set<string>>(new Set());

  const [showCookbookModal, setShowCookbookModal] = useState(false);
  const [pendingRecipe, setPendingRecipe] = useState<Recipe | null>(null);
  const [isSavingToCookbook, setIsSavingToCookbook] = useState(false);

  const currentUser = useQuery(api.users.current);
  const unviewedRecipes = useQuery(api.discoverFeed.getUnviewedRecipes, {
    limit: 20,
  });
  const unviewedCount = useQuery(api.discoverFeed.getUnviewedCount);

  const recordView = useMutation(api.discoverFeed.recordView);
  const saveRecipe = useMutation(api.savedRecipes.saveRecipe);
  const addRecipeToCookbook = useMutation(api.cookbooks.addRecipe);
  const populateFromBackend = useAction(api.discoverFeedActions.populateFromBackend);

  const dietaryRestrictions = currentUser?.dietaryRestrictions ?? [];
  const ingredientDislikes = currentUser?.ingredientDislikes ?? [];

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

  const recipes = recipeQueue;

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

      const newlyInserted = result.newlyInserted ?? 0;

      if (newlyInserted > 0) {
        setIsInCooldown(true);
        setTimeout(() => {
          setIsInCooldown(false);
          setHasAttemptedPopulate(false);
        }, POPULATE_COOLDOWN_MS);
      }
    } catch (err) {
      console.error('Failed to populate recipes:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      if (errorMessage.includes('402') || errorMessage.includes('limit')) {
        setPopulateError('Recipe service temporarily unavailable. Try again later.');
      } else {
        setPopulateError('Failed to load more recipes');
      }
    } finally {
      setIsPopulating(false);
    }
  }, [isPopulating, isInCooldown, populateFromBackend, dietaryRestrictions, ingredientDislikes]);

  const handleSwipeLeft = async (recipe: Recipe) => {
    const discoverRecipeId = (recipe as Recipe & { _discoverRecipeId?: string })
      ._discoverRecipeId;
    if (discoverRecipeId) {
      try {
        await recordView({
          discoverRecipeId: discoverRecipeId as Id<'discoverRecipes'>,
          action: 'skipped',
        });
      } catch (err) {
        console.error('Failed to record skip:', err);
      }
    }
  };

  const handleSwipeRight = async (recipe: Recipe) => {
    setPendingRecipe(recipe);
    setShowCookbookModal(true);
  };

  const handleCookbookSelect = async (cookbookId: Id<'cookbooks'>) => {
    if (!pendingRecipe) return;

    setIsSavingToCookbook(true);

    const discoverRecipeId = (pendingRecipe as Recipe & { _discoverRecipeId?: string })
      ._discoverRecipeId;

    if (discoverRecipeId) {
      try {
        await recordView({
          discoverRecipeId: discoverRecipeId as Id<'discoverRecipes'>,
          action: 'saved',
        });
      } catch (err) {
        console.error('Failed to record save:', err);
      }
    }

    try {
      const recipeId = await saveRecipe({
        url: pendingRecipe.url,
        title: pendingRecipe.title,
        description: pendingRecipe.description,
        imageUrl: pendingRecipe.imageUrl,
        cuisine: pendingRecipe.cuisine,
        difficulty: pendingRecipe.difficulty,
        servings: pendingRecipe.servings,
        prepTimeMinutes: pendingRecipe.prepTimeMinutes,
        cookTimeMinutes: pendingRecipe.cookTimeMinutes,
        totalTimeMinutes: pendingRecipe.totalTimeMinutes,
        calories: pendingRecipe.calories,
        proteinGrams: pendingRecipe.proteinGrams,
        carbsGrams: pendingRecipe.carbsGrams,
        fatGrams: pendingRecipe.fatGrams,
        dietaryTags: pendingRecipe.dietaryTags,
        keywords: pendingRecipe.keywords,
        creatorName: pendingRecipe.creatorName,
        ingredients: pendingRecipe.ingredients,
        instructions: pendingRecipe.instructions,
      });

      if (recipeId) {
        await addRecipeToCookbook({
          cookbookId,
          recipeId,
        });
      }

      setShowCookbookModal(false);
      setPendingRecipe(null);
    } catch (err) {
      console.error('Failed to save recipe:', err);
    } finally {
      setIsSavingToCookbook(false);
    }
  };

  const handleCookbookModalClose = () => {
    if (pendingRecipe) {
      const discoverRecipeId = (pendingRecipe as Recipe & { _discoverRecipeId?: string })
        ._discoverRecipeId;

      if (discoverRecipeId) {
        recordView({
          discoverRecipeId: discoverRecipeId as Id<'discoverRecipes'>,
          action: 'saved',
        }).catch((err) => console.error('Failed to record save:', err));
      }

      saveRecipe({
        url: pendingRecipe.url,
        title: pendingRecipe.title,
        description: pendingRecipe.description,
        imageUrl: pendingRecipe.imageUrl,
        cuisine: pendingRecipe.cuisine,
        difficulty: pendingRecipe.difficulty,
        servings: pendingRecipe.servings,
        prepTimeMinutes: pendingRecipe.prepTimeMinutes,
        cookTimeMinutes: pendingRecipe.cookTimeMinutes,
        totalTimeMinutes: pendingRecipe.totalTimeMinutes,
        calories: pendingRecipe.calories,
        proteinGrams: pendingRecipe.proteinGrams,
        carbsGrams: pendingRecipe.carbsGrams,
        fatGrams: pendingRecipe.fatGrams,
        dietaryTags: pendingRecipe.dietaryTags,
        keywords: pendingRecipe.keywords,
        creatorName: pendingRecipe.creatorName,
        ingredients: pendingRecipe.ingredients,
        instructions: pendingRecipe.instructions,
      }).catch((err) => console.error('Failed to save recipe:', err));
    }

    setShowCookbookModal(false);
    setPendingRecipe(null);
  };

  if (unviewedRecipes === undefined || currentUser === undefined) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.loadingText}>Loading recipes...</Text>
      </View>
    );
  }

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

  if (recipes.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No recipes available</Text>
        <Text style={styles.subText}>Check back soon for new recipes!</Text>
        <Pressable style={styles.retryButton} onPress={handlePopulate}>
          <Text style={styles.retryButtonText}>Load Recipes</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <SwipeableCardStack
        recipes={recipes}
        onSwipeLeft={handleSwipeLeft}
        onSwipeRight={handleSwipeRight}
      />
      <CookbookSelectionModal
        visible={showCookbookModal}
        recipe={pendingRecipe}
        onClose={handleCookbookModalClose}
        onSelect={handleCookbookSelect}
        isLoading={isSavingToCookbook}
      />
    </>
  );
}

// --- Feed Content Component ---
function FeedContent() {
  const currentUser = useQuery(api.users.current);
  const feedPosts = useQuery(api.posts.socialFeed, { limit: 50 });
  const addRecipeToCookbook = useMutation(api.cookbooks.addRecipe);

  // Cookbook modal state
  const [showCookbookModal, setShowCookbookModal] = useState(false);
  const [pendingRecipe, setPendingRecipe] = useState<FeedRecipeInfo | null>(null);
  const [isSavingToCookbook, setIsSavingToCookbook] = useState(false);

  const handleBookmarkPress = useCallback((recipe: FeedRecipeInfo) => {
    setPendingRecipe(recipe);
    setShowCookbookModal(true);
  }, []);

  const handleCookbookSelect = useCallback(async (cookbookId: Id<'cookbooks'>) => {
    if (!pendingRecipe) return;

    setIsSavingToCookbook(true);
    try {
      await addRecipeToCookbook({
        cookbookId,
        recipeId: pendingRecipe._id,
      });
      setShowCookbookModal(false);
      setPendingRecipe(null);
    } catch (err) {
      console.error('Failed to add recipe to cookbook:', err);
    } finally {
      setIsSavingToCookbook(false);
    }
  }, [pendingRecipe, addRecipeToCookbook]);

  const handleCookbookModalClose = useCallback(() => {
    setShowCookbookModal(false);
    setPendingRecipe(null);
  }, []);

  const renderFeedItem = useCallback(
    ({ item }: { item: FeedPostData }) => (
      <FeedPost
        postId={item._id}
        user={item.user}
        recipe={item.recipe}
        easeRating={item.easeRating}
        tasteRating={item.tasteRating}
        presentationRating={item.presentationRating}
        notes={item.notes}
        createdAt={item.createdAt}
        likeCount={item.likeCount}
        commentCount={item.commentCount}
        isLiked={item.isLiked}
        isSaved={item.isSaved}
        currentUserId={currentUser?._id}
        onBookmarkPress={handleBookmarkPress}
      />
    ),
    [handleBookmarkPress, currentUser?._id]
  );

  const keyExtractor = useCallback((item: FeedPostData) => item._id, []);

  const EmptyFeedComponent = useMemo(() => {
    if (feedPosts === undefined) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="newspaper-outline" size={64} color={Colors.text.tertiary} />
        <Text style={styles.emptyTitle}>{COPY.socialFeed.emptyFeedTitle}</Text>
        <Text style={styles.emptySubtitle}>{COPY.socialFeed.emptyFeedSubtitle}</Text>
      </View>
    );
  }, [feedPosts]);

  const validPosts: FeedPostData[] = useMemo(() => {
    if (!feedPosts) return [];
    return feedPosts.filter(
      (post) => post.user !== null && post.recipe !== null
    ) as FeedPostData[];
  }, [feedPosts]);

  // Convert FeedRecipeInfo to CookbookSelectionModal's expected format
  const modalRecipe = pendingRecipe
    ? {
        title: pendingRecipe.title,
        imageUrl: pendingRecipe.imageUrl,
        url: pendingRecipe.url,
      }
    : null;

  return (
    <>
      <View style={styles.feedContainer}>
        <FlashList<FeedPostData>
          data={validPosts}
          renderItem={renderFeedItem}
          keyExtractor={keyExtractor}
          estimatedItemSize={320}
          ListEmptyComponent={EmptyFeedComponent}
          showsVerticalScrollIndicator={false}
        />
      </View>
      <CookbookSelectionModal
        visible={showCookbookModal}
        recipe={modalRecipe}
        onClose={handleCookbookModalClose}
        onSelect={handleCookbookSelect}
        isLoading={isSavingToCookbook}
      />
    </>
  );
}

// --- Main Screen Component ---
export default function DiscoverScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('discover');

  const content = useMemo(() => {
    switch (activeTab) {
      case 'discover':
        return <DiscoverContent />;
      case 'feed':
        return <FeedContent />;
      default:
        return <DiscoverContent />;
    }
  }, [activeTab]);

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>{COPY.discover.title}</Text>
        </View>
        <View style={styles.tabContainer}>
          <TabSlider
            tabs={TABS}
            activeTab={activeTab}
            onTabChange={(key) => setActiveTab(key as TabKey)}
          />
        </View>
        <View style={styles.content}>{content}</View>
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
  tabContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  content: {
    flex: 1,
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
  feedContainer: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
    paddingHorizontal: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
    marginTop: Spacing.lg,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...Typography.body,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
});
