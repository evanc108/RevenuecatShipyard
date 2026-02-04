import { RecentCookCard } from '@/components/ui/RecentCookCard';
import { RecipeCard } from '@/components/ui/RecipeCard';
import { COPY } from '@/constants/copy';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
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
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

// --- Mock Recipe Data ---

type MockRecipe = {
  id: string;
  title: string;
  description: string;
  cuisine: string;
  difficulty: number;
  totalTimeMinutes: number;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  servings: number;
  calories: number;
  imageUrl?: string;
  dietaryTags: readonly string[];
};

const MOCK_RECIPES: readonly MockRecipe[] = [
  {
    id: '1',
    title: 'Truffle Mushroom Risotto',
    description: 'Creamy arborio rice with wild mushrooms and truffle oil',
    cuisine: 'Italian',
    difficulty: 4,
    totalTimeMinutes: 45,
    prepTimeMinutes: 15,
    cookTimeMinutes: 30,
    servings: 4,
    calories: 420,
    dietaryTags: ['Vegetarian', 'Gluten-Free'],
  },
  {
    id: '2',
    title: 'Miso Glazed Salmon',
    description: 'Sweet white miso marinated salmon with sesame bok choy',
    cuisine: 'Japanese',
    difficulty: 2,
    totalTimeMinutes: 30,
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    servings: 2,
    calories: 380,
    dietaryTags: ['High Protein', 'Dairy-Free'],
  },
  {
    id: '3',
    title: 'Shakshuka',
    description: 'Poached eggs in spiced tomato and pepper sauce',
    cuisine: 'Middle Eastern',
    difficulty: 1,
    totalTimeMinutes: 25,
    prepTimeMinutes: 5,
    cookTimeMinutes: 20,
    servings: 3,
    calories: 290,
    dietaryTags: ['Vegetarian'],
  },
  {
    id: '4',
    title: 'Pad Thai',
    description: 'Rice noodles with shrimp, peanuts, and tamarind sauce',
    cuisine: 'Thai',
    difficulty: 3,
    totalTimeMinutes: 35,
    prepTimeMinutes: 15,
    cookTimeMinutes: 20,
    servings: 2,
    calories: 450,
    dietaryTags: ['Dairy-Free'],
  },
  {
    id: '5',
    title: 'Sourdough Focaccia',
    description: 'Olive oil and rosemary topped artisan flatbread',
    cuisine: 'Italian',
    difficulty: 3,
    totalTimeMinutes: 180,
    prepTimeMinutes: 30,
    cookTimeMinutes: 25,
    servings: 8,
    calories: 210,
    dietaryTags: ['Vegan'],
  },
  {
    id: '6',
    title: 'Korean Fried Chicken',
    description: 'Double-fried chicken with gochujang glaze',
    cuisine: 'Korean',
    difficulty: 4,
    totalTimeMinutes: 60,
    prepTimeMinutes: 20,
    cookTimeMinutes: 40,
    servings: 4,
    calories: 520,
    dietaryTags: ['High Protein'],
  },
] as const;

// --- Types ---

type SortMode = 'recent' | 'oldest' | 'a-z' | 'z-a';

// --- Constants ---

const SORT_OPTIONS: readonly { mode: SortMode; label: string }[] = [
  { mode: 'recent', label: 'Recent' },
  { mode: 'oldest', label: 'Oldest' },
  { mode: 'a-z', label: 'A \u2192 Z' },
  { mode: 'z-a', label: 'Z \u2192 A' },
];

const SEARCH_ICON_SIZE = 40;
const SWIPE_VELOCITY_THRESHOLD = 500;

// Main card hugs left wall — wider so info text is visible
const CARD_WIDTH_RATIO = 0.62;
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
  recipe: MockRecipe;
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
          totalTimeMinutes={recipe.totalTimeMinutes}
          difficulty={recipe.difficulty}
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

  // Search state
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const searchProgress = useSharedValue(0);
  const inputRef = useRef<TextInput>(null);

  const searchMaxWidth = (screenWidth - Spacing.lg * 2) * 0.45;

  // Swipable card state
  const translateX = useSharedValue(0);
  const contextX = useSharedValue(0);

  const cardWidth = screenWidth * CARD_WIDTH_RATIO;
  const cardStep = screenWidth * 0.35;

  // Most recent recipe for the "recently cooked" card
  const mostRecentRecipe = MOCK_RECIPES[0];

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

  // --- Sort & Filter ---

  const sortedRecipes = useMemo(() => {
    let result = [...MOCK_RECIPES];

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.cuisine.toLowerCase().includes(q),
      );
    }

    switch (sortMode) {
      case 'recent':
        break;
      case 'oldest':
        result.reverse();
        break;
      case 'a-z':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'z-a':
        result.sort((a, b) => b.title.localeCompare(a.title));
        break;
    }

    return result;
  }, [searchQuery, sortMode]);

  const maxIndex = Math.max(sortedRecipes.length - 1, 0);

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

  const handleRecipePress = useCallback((_recipeId: string) => {
    // TODO: Navigate to recipe detail
  }, []);

  const handleCookPress = useCallback((_recipeId: string) => {
    // TODO: Start cooking flow
  }, []);

  // --- Loading / Error States ---

  if (cookbook === undefined) {
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
            <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
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
        <View style={styles.headerLeft}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            hitSlop={12}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
            {cookbook.name}
          </Text>
        </View>

        <Animated.View style={[styles.searchBar, searchBarAnimatedStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search"
            onPress={!isSearchActive ? handleOpenSearch : undefined}
            style={styles.searchIconButton}
          >
            <Ionicons
              name="search"
              size={20}
              color={isSearchActive ? Colors.text.tertiary : Colors.text.secondary}
            />
          </Pressable>

          {isSearchActive ? (
            <Animated.View style={[styles.searchInputContainer, searchInputOpacity]}>
              <TextInput
                ref={inputRef}
                style={styles.searchInput}
                placeholder={COPY.cookbookDetail.searchPlaceholder}
                placeholderTextColor={Colors.text.tertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={COPY.cookbookDetail.searchPlaceholder}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close search"
                onPress={handleCloseSearch}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={20} color={Colors.text.tertiary} />
              </Pressable>
            </Animated.View>
          ) : null}
        </Animated.View>
      </View>

      {/* Sort Bar */}
      <View style={styles.sortBar}>
        {SORT_OPTIONS.map((option) => {
          const isActive = sortMode === option.mode;
          return (
            <Pressable
              key={option.mode}
              accessibilityRole="button"
              accessibilityLabel={`Sort by ${option.label}`}
              accessibilityState={{ selected: isActive }}
              style={[
                styles.sortPill,
                isActive && styles.sortPillActive,
              ]}
              onPress={() => setSortMode(option.mode)}
            >
              <Text
                style={[
                  styles.sortPillText,
                  isActive && styles.sortPillTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        {/* Recently Cooked — single card */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>{COPY.cookbookDetail.recentlyCooked}</Text>
          <View style={styles.recentCardWrapper}>
            <RecentCookCard
              title={mostRecentRecipe.title}
              imageUrl={mostRecentRecipe.imageUrl}
              totalTimeMinutes={mostRecentRecipe.totalTimeMinutes}
              cuisine={mostRecentRecipe.cuisine}
              onPress={() => handleRecipePress(mostRecentRecipe.id)}
              onCook={() => handleCookPress(mostRecentRecipe.id)}
            />
          </View>
        </View>

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
                  key={recipe.id}
                  index={idx}
                  translateX={translateX}
                  cardStep={cardStep}
                />
              ))}
            </View>
          ) : null}
        </View>

        {/* Stacked Swipable Cards — positioned from top, clipped at edges */}
        {sortedRecipes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>{COPY.cookbookDetail.emptyTitle}</Text>
            <Text style={styles.emptySubtitle}>{COPY.cookbookDetail.emptySubtitle}</Text>
          </View>
        ) : (
          <View style={styles.carouselSection}>
            <GestureDetector gesture={panGesture}>
              <Animated.View style={styles.carouselTrack}>
                {sortedRecipes.map((recipe, idx) => (
                  <StackedRecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    index={idx}
                    translateX={translateX}
                    cardWidth={cardWidth}
                    cardStep={cardStep}
                    screenWidth={screenWidth}
                    onPress={() => handleRecipePress(recipe.id)}
                  />
                ))}
              </Animated.View>
            </GestureDetector>
          </View>
        )}
      </View>

      {/* FAB */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={COPY.cookbookDetail.addRecipe}
        style={styles.fab}
        onPress={() => {
          // TODO: Add recipe flow
        }}
      >
        <Ionicons name="add" size={28} color={Colors.text.inverse} />
      </Pressable>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    minHeight: 52,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
    marginRight: Spacing.sm,
  },
  headerTitle: {
    ...Typography.h1,
    color: Colors.text.primary,
    flex: 1,
  },

  // Search
  searchBar: {
    height: SEARCH_ICON_SIZE,
    backgroundColor: Colors.background.primary,
    borderRadius: SEARCH_ICON_SIZE / 2,
    flexDirection: 'row',
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
    paddingRight: Spacing.sm,
    gap: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    color: Colors.text.primary,
    paddingVertical: 0,
  },

  // Sort
  sortBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  sortPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.background.primary,
    ...Shadow.surface,
  },
  sortPillActive: {
    backgroundColor: Colors.accentLight,
  },
  sortPillText: {
    ...Typography.caption,
    color: Colors.text.primary,
  },
  sortPillTextActive: {
    color: Colors.accent,
    fontWeight: '600',
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

  // Empty
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
  emptySubtitle: {
    ...Typography.body,
    color: Colors.text.secondary,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: Spacing.lg,
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.elevated,
    zIndex: 10,
  },
});
