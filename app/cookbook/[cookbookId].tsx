import { RecentCookCard } from '@/components/cookbook/RecentCookCard';
import { RecipeCard } from '@/components/cookbook/RecipeCard';
import { COPY } from '@/constants/copy';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Icon } from '@/components/ui/Icon';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useMutation, useQuery } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAddModal } from '@/context/AddModalContext';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

// --- Helpers ---

const DIFFICULTY_MAP: Record<string, number> = {
  easy: 1,
  medium: 2,
  moderate: 2,
  intermediate: 3,
  hard: 4,
  difficult: 4,
  expert: 5,
};

function parseDifficulty(difficulty?: string | number): number {
  if (difficulty === undefined || difficulty === null) return 0;
  if (typeof difficulty === 'number') return Math.min(5, Math.max(1, Math.round(difficulty)));
  const mapped = DIFFICULTY_MAP[difficulty.toLowerCase()];
  if (mapped !== undefined) return mapped;
  const num = parseInt(difficulty, 10);
  if (!isNaN(num) && num >= 1 && num <= 5) return num;
  return 3;
}

// --- Recipe type from getRecipes query ---

type CookbookRecipe = {
  _id: Id<'recipes'>;
  title: string;
  description?: string;
  cuisine?: string;
  difficulty?: string | number;
  imageUrl?: string;
  totalTimeMinutes?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  servings?: number;
  calories?: number;
  createdAt: number;
  addedAt: number;
};

// --- Constants ---

const SEARCH_ICON_SIZE = 48;
const STROKE_FILL_PRIMARY = '#EEEEF3';
const STROKE_FILL_SECONDARY = '#F2F2F6';
const SWIPE_VELOCITY_THRESHOLD = 500;

// Main card hugs left wall — wider so info text is visible
const CARD_WIDTH_RATIO = 0.68;
const SCALE_STEP = 0.1;
// Ghost card offset (peeks right + drops down behind main)
const GHOST_OFFSET_X = 160;
const GHOST_OFFSET_Y = 60;

const SNAP_SPRING = {
  damping: 20,
  stiffness: 150,
  mass: 0.8,
} as const;

const DOT_SIZE = 6;
const DOT_ACTIVE_WIDTH = 18;

// --- Stacked Recipe Card ---

type StackedCardProps = {
  recipe: CookbookRecipe;
  index: number;
  translateX: SharedValue<number>;
  cardWidth: number;
  cardStep: number;
  screenWidth: number;
  onPress: () => void;
};

const StackedRecipeCard = memo(function StackedRecipeCard({
  recipe,
  index,
  translateX,
  cardWidth,
  cardStep,
  screenWidth,
  onPress,
}: StackedCardProps): React.ReactElement {
  const animatedStyle = useAnimatedStyle(() => {
    const activeIndex = -translateX.value / cardStep;
    const distance = index - activeIndex;
    const absDistance = Math.abs(distance);

    // Active card flush left; ghost peeks right; exiting slides left
    const cardTranslateX = interpolate(
      distance,
      [-1, 0, 1, 2],
      [-screenWidth * 0.6, 0, GHOST_OFFSET_X, GHOST_OFFSET_X * 2],
      Extrapolation.CLAMP,
    );

    // Ghost card drops lower
    const translateY = interpolate(
      distance,
      [-1, 0, 1, 2],
      [0, 0, GHOST_OFFSET_Y, GHOST_OFFSET_Y * 1.5],
      Extrapolation.CLAMP,
    );

    const scale = interpolate(
      absDistance,
      [0, 1, 2],
      [1, 1 - SCALE_STEP, 1 - SCALE_STEP * 2],
      Extrapolation.CLAMP,
    );

    // Ghost visible, 3rd card+ fully hidden to prevent text clipping
    const opacity = interpolate(
      absDistance,
      [0, 1, 2, 3],
      [1, 0.6, 0, 0],
      Extrapolation.CLAMP,
    );

    const zIndex = 100 - Math.round(absDistance);

    return {
      transform: [
        { translateX: cardTranslateX },
        { translateY },
        { scale },
      ],
      opacity,
      zIndex,
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: cardWidth,
          top: 0,
          bottom: 0,
          left: 0,
          borderRadius: Radius.xl,
          backgroundColor: Colors.background.primary,
        },
        Shadow.elevated,
        animatedStyle,
      ]}
    >
      <View style={stackStyles.cardInner}>
        <RecipeCard
          title={recipe.title}
          imageUrl={recipe.imageUrl}
          totalTimeMinutes={recipe.totalTimeMinutes ?? 0}
          difficulty={parseDifficulty(recipe.difficulty)}
          cuisine={recipe.cuisine}
          onPress={onPress}
        />
      </View>
    </Animated.View>
  );
});

const stackStyles = StyleSheet.create({
  cardInner: {
    flex: 1,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
});

// --- Add Recipe Card (last in stack) ---

type AddRecipeCardProps = {
  index: number;
  translateX: SharedValue<number>;
  cardWidth: number;
  cardStep: number;
  screenWidth: number;
  onPress: () => void;
};

const AddRecipeStackedCard = memo(function AddRecipeStackedCard({
  index,
  translateX,
  cardWidth,
  cardStep,
  screenWidth,
  onPress,
}: AddRecipeCardProps): React.ReactElement {
  // Add-recipe card is slightly wider than recipe cards
  const addCardWidth = cardWidth * 1.12;
  const centerX = (screenWidth - addCardWidth) / 2;

  const animatedStyle = useAnimatedStyle(() => {
    const activeIndex = -translateX.value / cardStep;
    const distance = index - activeIndex;
    const absDistance = Math.abs(distance);

    // When active (distance=0), center in screen instead of flush left
    const cardTranslateX = interpolate(
      distance,
      [-1, 0, 1, 2],
      [-screenWidth * 0.6, centerX, GHOST_OFFSET_X, GHOST_OFFSET_X * 2],
      Extrapolation.CLAMP,
    );

    // No vertical offset when centered/active
    const translateY = interpolate(
      distance,
      [-1, 0, 1, 2],
      [0, 0, GHOST_OFFSET_Y, GHOST_OFFSET_Y * 1.5],
      Extrapolation.CLAMP,
    );

    const scale = interpolate(
      absDistance,
      [0, 1, 2],
      [1, 1 - SCALE_STEP, 1 - SCALE_STEP * 2],
      Extrapolation.CLAMP,
    );

    const opacity = interpolate(
      absDistance,
      [0, 1, 2, 3],
      [1, 0.6, 0, 0],
      Extrapolation.CLAMP,
    );

    const zIndex = 100 - Math.round(absDistance);

    return {
      transform: [
        { translateX: cardTranslateX },
        { translateY },
        { scale },
      ],
      opacity,
      zIndex,
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: addCardWidth,
          top: 0,
          bottom: 0,
          left: 0,
          borderRadius: Radius.xl,
        },
        Shadow.elevated,
        animatedStyle,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add new recipe"
        style={addCardStyles.inner}
        onPress={onPress}
      >
        {/* Top-right plus icon */}
        <Icon
          name="plus"
          size={30}
          color={Colors.accent}
          style={addCardStyles.plusIcon}
        />

        {/* Decorative brush stroke */}
        <Svg
          style={addCardStyles.stroke}
          viewBox="0 0 200 160"
          preserveAspectRatio="xMidYMid meet"
        >
          <Path
            d="M30,80 C45,30 90,15 130,40 C155,55 175,30 185,55 C195,80 170,110 135,105 C100,100 70,120 45,105 C20,90 20,95 30,80Z"
            fill={STROKE_FILL_PRIMARY}
          />
          <Path
            d="M145,25 C155,18 170,22 165,35 C160,48 148,40 145,25Z"
            fill={STROKE_FILL_SECONDARY}
          />
          <Path
            d="M25,105 C30,98 45,100 40,112 C35,120 22,115 25,105Z"
            fill={STROKE_FILL_SECONDARY}
          />
        </Svg>

        {/* Centered illustration */}
        <Image
          source={require('@/assets/images/create-recipe-icon.png')}
          style={addCardStyles.image}
          contentFit="contain"
          cachePolicy="memory-disk"
        />

        {/* Bottom fade */}
        <LinearGradient
          colors={[
            'rgba(255,255,255,0)',
            'rgba(255,255,255,0.15)',
            'rgba(255,255,255,0.4)',
            'rgba(255,255,255,0.7)',
            'rgba(255,255,255,1)',
          ]}
          locations={[0, 0.25, 0.5, 0.75, 1]}
          style={addCardStyles.gradient}
        />

        {/* Top-left label */}
        <View style={addCardStyles.topLabel}>
          <Text style={addCardStyles.title}>{'Add\nRecipe'}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
});

const addCardStyles = StyleSheet.create({
  inner: {
    flex: 1,
    borderRadius: Radius.xl,
    backgroundColor: Colors.background.primary,
    overflow: 'hidden',
  },
  plusIcon: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    zIndex: 1,
  },
  stroke: {
    position: 'absolute',
    width: '92%',
    height: '65%',
    top: '8%',
    left: '4%',
  },
  image: {
    position: 'absolute',
    width: '88%',
    height: '80%',
    top: '8%',
    left: '6%',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: -1,
    right: -1,
    height: '75%',
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
  },
  topLabel: {
    position: 'absolute',
    top: Spacing.lg,
    left: Spacing.md,
    zIndex: 1,
  },
  title: {
    ...Typography.h1,
    color: Colors.text.primary,
  },
});

// --- Pagination Dot ---

type PaginationDotProps = {
  index: number;
  translateX: SharedValue<number>;
  cardStep: number;
};

const PaginationDot = memo(function PaginationDot({
  index,
  translateX,
  cardStep,
}: PaginationDotProps): React.ReactElement {
  const animatedStyle = useAnimatedStyle(() => {
    const activeIndex = -translateX.value / cardStep;
    const distance = Math.abs(index - activeIndex);

    const dotWidth = interpolate(
      distance,
      [0, 1],
      [DOT_ACTIVE_WIDTH, DOT_SIZE],
      Extrapolation.CLAMP,
    );
    const dotOpacity = interpolate(
      distance,
      [0, 1],
      [1, 0.3],
      Extrapolation.CLAMP,
    );

    return { width: dotWidth, opacity: dotOpacity };
  });

  return <Animated.View style={[styles.dot, animatedStyle]} />;
});

// --- Component ---

export default function CookbookDetailScreen(): React.ReactElement {
  const { cookbookId } = useLocalSearchParams<{ cookbookId: string }>();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();

  const cookbook = useQuery(
    api.cookbooks.getById,
    cookbookId ? { cookbookId: cookbookId as Id<'cookbooks'> } : 'skip',
  );

  const cookbookRecipes = useQuery(
    api.cookbooks.getRecipes,
    cookbookId ? { cookbookId: cookbookId as Id<'cookbooks'> } : 'skip',
  );

  const recentlyCooked = useQuery(
    api.cookbooks.getRecentlyCooked,
    cookbookId ? { cookbookId: cookbookId as Id<'cookbooks'> } : 'skip',
  );

  // Fetch suggested recipes eagerly (avoids waterfall with recentlyCooked)
  const suggestedRecipes = useQuery(
    api.discoverFeed.getUnviewedRecipes,
    { limit: 1 },
  );

  const { openModal } = useAddModal();
  const saveToCookbookMutation = useMutation(api.discoverFeed.saveToCookbook);

  // Search state
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchProgress = useSharedValue(0);
  const inputRef = useRef<TextInput>(null);

  const searchMaxWidth = 260;

  // Swipable card state
  const translateX = useSharedValue(0);
  const contextX = useSharedValue(0);

  const cardWidth = screenWidth * CARD_WIDTH_RATIO;
  const cardStep = screenWidth * 0.35;

  const recipes: CookbookRecipe[] = cookbookRecipes ?? [];
  // Wait for all visible data before rendering content
  const isPageLoading =
    cookbookRecipes === undefined ||
    recentlyCooked === undefined ||
    (recentlyCooked === null && suggestedRecipes === undefined);

  // --- Success animation state ---
  const [isAddingSuggested, setIsAddingSuggested] = useState(false);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const successOverlayOpacity = useSharedValue(0);
  const successIconScale = useSharedValue(0);
  const successIconTranslateY = useSharedValue(20);
  const plusButtonScale = useSharedValue(1);

  // Reset local state when navigating between cookbooks
  useEffect(() => {
    translateX.value = 0;
    contextX.value = 0;
    setSearchQuery('');
    setIsSearchActive(false);
  }, [cookbookId]);

  // --- Search Animation ---

  const handleOpenSearch = useCallback(() => {
    setIsSearchActive(true);
    searchProgress.value = withTiming(1, { duration: 250 });
    setTimeout(() => inputRef.current?.focus(), 150);
  }, [searchProgress]);

  const handleCloseSearch = useCallback(() => {
    searchProgress.value = withTiming(0, { duration: 200 });
    setSearchQuery('');
    setTimeout(() => setIsSearchActive(false), 220);
  }, [searchProgress]);

  const searchBarAnimatedStyle = useAnimatedStyle(() => ({
    width: interpolate(
      searchProgress.value,
      [0, 1],
      [SEARCH_ICON_SIZE, searchMaxWidth],
    ),
  }));

  const searchInputOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(searchProgress.value, [0.3, 0.7], [0, 1]),
  }));

  // --- Success Animation ---

  const successOverlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: successOverlayOpacity.value,
  }));

  const successIconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: successIconScale.value },
      { translateY: successIconTranslateY.value },
    ],
  }));

  const plusButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: plusButtonScale.value }],
  }));

  const playSuccessAnimation = useCallback(() => {
    setShowSuccessOverlay(true);

    // Fade in, hold, fade out
    successOverlayOpacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(900, withTiming(0, { duration: 250 })),
    );

    // Icon: scale up, overshoot, settle, then shrink
    successIconScale.value = withSequence(
      withTiming(0, { duration: 0 }),
      withTiming(1.2, { duration: 250 }),
      withSpring(1, { damping: 10, stiffness: 200 }),
      withDelay(500, withTiming(0, { duration: 200 })),
    );

    // Icon: start below, bounce up, settle
    successIconTranslateY.value = withSequence(
      withTiming(20, { duration: 0 }),
      withSpring(0, { damping: 8, stiffness: 150 }),
    );

    // Clean up after animation completes
    setTimeout(() => setShowSuccessOverlay(false), 1400);
  }, [successOverlayOpacity, successIconScale, successIconTranslateY]);

  // --- Filter ---

  const sortedRecipes = useMemo(() => {
    let result = [...recipes];

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.cuisine?.toLowerCase().includes(q) ?? false),
      );
    }

    // Default sort: most recent first
    result.sort((a, b) => b.addedAt - a.addedAt);

    return result;
  }, [recipes, searchQuery]);

  // +1 for the add recipe card at the end
  const totalCards = sortedRecipes.length + 1;
  const maxIndex = Math.max(totalCards - 1, 0);

  // --- Pan Gesture ---

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-5, 5])
    .onStart(() => {
      contextX.value = translateX.value;
    })
    .onUpdate((event) => {
      const proposed = contextX.value + event.translationX;
      const minTranslate = -maxIndex * cardStep;
      const maxTranslate = 0;

      if (proposed > maxTranslate) {
        translateX.value = maxTranslate + (proposed - maxTranslate) * 0.3;
      } else if (proposed < minTranslate) {
        translateX.value = minTranslate + (proposed - minTranslate) * 0.3;
      } else {
        translateX.value = proposed;
      }
    })
    .onEnd((event) => {
      const currentIndex = -translateX.value / cardStep;
      let targetIndex: number;

      if (Math.abs(event.velocityX) > SWIPE_VELOCITY_THRESHOLD) {
        targetIndex =
          event.velocityX > 0
            ? Math.floor(currentIndex)
            : Math.ceil(currentIndex);
      } else {
        targetIndex = Math.round(currentIndex);
      }

      targetIndex = Math.max(0, Math.min(targetIndex, maxIndex));
      translateX.value = withSpring(-targetIndex * cardStep, SNAP_SPRING);
    });

  // --- Handlers ---

  const handleRecipePress = useCallback((recipeId: Id<'recipes'>) => {
    router.push(`/recipe/${recipeId}`);
  }, [router]);

  const handleCookPress = useCallback((_recipeId: Id<'recipes'>) => {
    // TODO: Start cooking flow
  }, []);

  const handleAddRecipe = useCallback(() => {
    if (!cookbookId) return;
    plusButtonScale.value = withSequence(
      withTiming(0.85, { duration: 80 }),
      withSpring(1, { damping: 15, stiffness: 400 }),
    );
    openModal({ initialCookbookId: cookbookId as Id<'cookbooks'> });
  }, [cookbookId, openModal, plusButtonScale]);

  const handleAddSuggestedRecipe = useCallback(
    async (discoverRecipeId: Id<'discoverRecipes'>) => {
      if (!cookbookId || isAddingSuggested) return;
      setIsAddingSuggested(true);
      try {
        await saveToCookbookMutation({
          discoverRecipeId,
          cookbookId: cookbookId as Id<'cookbooks'>,
        });
        playSuccessAnimation();
      } finally {
        setIsAddingSuggested(false);
      }
    },
    [cookbookId, saveToCookbookMutation, isAddingSuggested, playSuccessAnimation],
  );

  // --- Loading / Error States ---

  if (cookbook === undefined || (cookbook && `${cookbook._id}` !== cookbookId)) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (cookbook === null) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            hitSlop={12}
          >
            <Icon name="arrow-back" size={24} color={Colors.text.primary} />
          </Pressable>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>{COPY.cookbookDetail.notFound}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // --- Render ---

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        {/* Top row: back button + actions */}
        <View style={styles.headerTopRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            hitSlop={12}
          >
            <Icon name="arrow-back" size={24} color={Colors.text.primary} />
          </Pressable>

          <View style={styles.headerActions}>
            <Animated.View style={[styles.searchBar, searchBarAnimatedStyle]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Search"
                onPress={!isSearchActive ? handleOpenSearch : undefined}
                style={styles.searchIconButton}
              >
                <Icon
                  name="search"
                  size={22}
                  strokeWidth={2.5}
                  color={isSearchActive ? Colors.text.inverse : Colors.text.inverse}
                />
              </Pressable>

              {isSearchActive ? (
                <Animated.View style={[styles.searchInputContainer, searchInputOpacity]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close search"
                    onPress={handleCloseSearch}
                    hitSlop={8}
                    style={styles.searchCloseButton}
                  >
                    <Icon name="close" size={18} strokeWidth={2.5} color="rgba(255,255,255,0.7)" />
                  </Pressable>
                  <TextInput
                    ref={inputRef}
                    style={styles.searchInput}
                    placeholder="Search..."
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessibilityLabel="Search"
                  />
                </Animated.View>
              ) : null}
            </Animated.View>

            <Animated.View style={plusButtonAnimatedStyle}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add recipe"
                style={styles.plusButton}
                onPress={handleAddRecipe}
                hitSlop={8}
              >
                <Icon name="add" size={24} color={Colors.text.inverse} />
              </Pressable>
            </Animated.View>
          </View>
        </View>

        {/* Cookbook name below back button */}
        <Text style={styles.headerTitle} numberOfLines={2} ellipsizeMode="tail">
          {cookbook.name}
        </Text>
      </View>

      {/* Content */}
      {isPageLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <View style={styles.contentContainer}>
          {/* Suggested Recipe / Recently Cooked */}
          {recentlyCooked ? (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>{COPY.cookbookDetail.recentlyCooked}</Text>
              <View style={styles.recentCardWrapper}>
                <RecentCookCard
                  title={recentlyCooked.title}
                  imageUrl={recentlyCooked.imageUrl}
                  totalTimeMinutes={recentlyCooked.totalTimeMinutes ?? 0}
                  cuisine={recentlyCooked.cuisine}
                  onPress={() => handleRecipePress(recentlyCooked._id)}
                  onCook={() => handleCookPress(recentlyCooked._id)}
                />
              </View>
            </View>
          ) : suggestedRecipes && suggestedRecipes.length > 0 ? (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>{COPY.cookbookDetail.suggestedRecipe}</Text>
              <View style={styles.recentCardWrapper}>
                <RecentCookCard
                  title={suggestedRecipes[0].title}
                  imageUrl={suggestedRecipes[0].imageUrl}
                  totalTimeMinutes={suggestedRecipes[0].totalTimeMinutes ?? 0}
                  cuisine={suggestedRecipes[0].cuisine}
                  onPress={() => {
                    // Discover recipes don't have a detail page yet
                  }}
                  onCook={() => handleAddSuggestedRecipe(suggestedRecipes[0]._id)}
                  actionLabel={COPY.cookbookDetail.add}
                  actionLoading={isAddingSuggested}
                />
              </View>
            </View>
          ) : null}

          {/* Your Recipes header + pagination dots inline */}
          <View style={styles.recipesHeaderRow}>
            <View style={styles.recipesHeaderTextRow}>
              <Text style={styles.recipesHeaderLight}>
                {COPY.cookbookDetail.yourRecipesPrefix}{' '}
              </Text>
              <Text style={styles.recipesHeaderBold}>
                {COPY.cookbookDetail.yourRecipesBold}
              </Text>
            </View>

            {/* Pagination dots — inline right */}
            {sortedRecipes.length > 1 ? (
              <View style={styles.dotsContainer}>
                {sortedRecipes.map((recipe, idx) => (
                  <PaginationDot
                    key={recipe._id}
                    index={idx}
                    translateX={translateX}
                    cardStep={cardStep}
                  />
                ))}
              </View>
            ) : null}
          </View>

          {/* Cards section */}
          {sortedRecipes.length > 0 ? (
            <View style={styles.carouselSection}>
              <GestureDetector gesture={panGesture}>
                <Animated.View style={styles.carouselTrack}>
                  {sortedRecipes.map((recipe, idx) => (
                    <StackedRecipeCard
                      key={recipe._id}
                      recipe={recipe}
                      index={idx}
                      translateX={translateX}
                      cardWidth={cardWidth}
                      cardStep={cardStep}
                      screenWidth={screenWidth}
                      onPress={() => handleRecipePress(recipe._id)}
                    />
                  ))}

                  {/* Add Recipe card — always last */}
                  <AddRecipeStackedCard
                    index={sortedRecipes.length}
                    translateX={translateX}
                    cardWidth={cardWidth}
                    cardStep={cardStep}
                    screenWidth={screenWidth}
                    onPress={handleAddRecipe}
                  />
                </Animated.View>
              </GestureDetector>
            </View>
          ) : (
            /* Empty: static add card fills to bottom */
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add new recipe"
              style={styles.emptyAddCard}
              onPress={handleAddRecipe}
            >
              <View style={styles.emptyAddCardInner}>
                {/* Red plus icon — top right */}
                <View style={styles.emptyPlusButton}>
                  <Icon name="add" size={28} color={Colors.accent} />
                </View>

                {/* Decorative brush stroke */}
                <Svg
                  style={styles.emptyStroke}
                  viewBox="0 0 200 160"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <Path
                    d="M30,80 C45,30 90,15 130,40 C155,55 175,30 185,55 C195,80 170,110 135,105 C100,100 70,120 45,105 C20,90 20,95 30,80Z"
                    fill={STROKE_FILL_PRIMARY}
                  />
                  <Path
                    d="M145,25 C155,18 170,22 165,35 C160,48 148,40 145,25Z"
                    fill={STROKE_FILL_SECONDARY}
                  />
                  <Path
                    d="M25,105 C30,98 45,100 40,112 C35,120 22,115 25,105Z"
                    fill={STROKE_FILL_SECONDARY}
                  />
                </Svg>

                {/* Centered illustration */}
                <Image
                  source={require('@/assets/images/create-recipe-icon.png')}
                  style={styles.emptyImage}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />

                {/* Bottom fade */}
                <LinearGradient
                  colors={[
                    'rgba(255,255,255,0)',
                    'rgba(255,255,255,0.15)',
                    'rgba(255,255,255,0.4)',
                    'rgba(255,255,255,0.7)',
                    'rgba(255,255,255,1)',
                  ]}
                  locations={[0, 0.25, 0.5, 0.75, 1]}
                  style={styles.emptyCardGradient}
                />

                {/* Top-left label */}
                <View style={styles.emptyCardTopLabel}>
                  <Text style={styles.emptyCardTitle}>{'Add\nRecipe'}</Text>
                </View>
              </View>
            </Pressable>
          )}
        </View>
      )}

      {/* Bottom screen gradient fade */}
      <View style={styles.bottomFadeContainer} pointerEvents="none">
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.02)', 'rgba(0,0,0,0.06)']}
          locations={[0, 0.5, 1]}
          style={styles.bottomFadeGradient}
        />
      </View>

      {/* Success overlay */}
      {showSuccessOverlay ? (
        <Animated.View
          style={[styles.successOverlay, successOverlayAnimatedStyle]}
          pointerEvents="none"
        >
          <Animated.View style={successIconAnimatedStyle}>
            <View style={styles.successIconCircle}>
              <Icon name="check" size={40} color={Colors.background.primary} strokeWidth={3} />
            </View>
          </Animated.View>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },

  // Header
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.3,
  },
  plusButton: {
    width: SEARCH_ICON_SIZE,
    height: SEARCH_ICON_SIZE,
    borderRadius: SEARCH_ICON_SIZE / 2,
    backgroundColor: Colors.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.surface,
  },

  // Search
  searchBar: {
    height: SEARCH_ICON_SIZE,
    backgroundColor: Colors.text.primary,
    borderRadius: SEARCH_ICON_SIZE / 2,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    overflow: 'hidden',
    ...Shadow.surface,
  },
  searchIconButton: {
    width: SEARCH_ICON_SIZE,
    height: SEARCH_ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  searchCloseButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    color: Colors.text.inverse,
    paddingVertical: 0,
  },

  // Content
  contentContainer: {
    flex: 1,
  },

  // Recently Cooked — single card
  sectionContainer: {
    paddingTop: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.label,
    color: Colors.text.secondary,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  recentCardWrapper: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },

  // Your Recipes header with dots inline
  recipesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  recipesHeaderTextRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  recipesHeaderLight: {
    fontSize: 22,
    fontWeight: '400',
    color: Colors.text.primary,
    letterSpacing: -0.2,
  },
  recipesHeaderBold: {
    ...Typography.h2,
    color: Colors.text.primary,
  },

  // Pagination dots — inline with header
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dot: {
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: Colors.text.primary,
  },

  // Stacked cards carousel — starts from top, clips at edges
  carouselSection: {
    flex: 1,
    overflow: 'hidden',
  },
  carouselTrack: {
    flex: 1,
  },

  // Empty state — add card fills remaining space to screen bottom
  emptyAddCard: {
    flex: 1,
    marginHorizontal: Spacing.lg,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    backgroundColor: Colors.background.primary,
    ...Shadow.elevated,
  },
  emptyAddCardInner: {
    flex: 1,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    overflow: 'hidden',
  },
  emptyPlusButton: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
    zIndex: 1,
  },
  emptyStroke: {
    position: 'absolute',
    width: '110%',
    height: '80%',
    top: '0%',
    left: '-5%',
  },
  emptyImage: {
    position: 'absolute',
    width: '100%',
    height: '90%',
    top: '0%',
    left: '0%',
  },
  emptyCardGradient: {
    position: 'absolute',
    bottom: 0,
    left: -1,
    right: -1,
    height: '75%',
  },
  emptyCardTopLabel: {
    position: 'absolute',
    top: Spacing.lg,
    left: Spacing.lg,
    zIndex: 1,
  },
  emptyCardTitle: {
    ...Typography.h1,
    color: Colors.text.primary,
  },

  // Not found
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
  },

  // Bottom screen gradient fade
  bottomFadeContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  bottomFadeGradient: {
    flex: 1,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Success overlay
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.97)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.semantic.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
