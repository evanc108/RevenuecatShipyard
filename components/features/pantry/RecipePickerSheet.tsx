import { useState, useMemo, useCallback } from 'react';
import {
  Animated,
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Icon } from '@/components/ui/Icon';
import { CookbookCard } from '@/components/cookbook/CookbookCard';
import { RecipeCard } from '@/components/cookbook/RecipeCard';
import { Colors, Spacing, Radius, Typography, Shadow } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import { useModalAnimation } from '@/hooks/useModalAnimation';
import { useDebounce } from '@/hooks/useDebounce';
import { useRecipePicker } from '@/context/RecipePickerContext';
import { parseDifficulty } from '@/utils/parseDifficulty';

type ViewMode = 'cookbooks' | 'allRecipes' | 'cookbookRecipes';

export function RecipePickerSheet(): React.ReactElement | null {
  const insets = useSafeAreaInsets();
  const { state, closePicker, onRecipeSelected } = useRecipePicker();
  const { visible } = state;

  const [viewMode, setViewMode] = useState<ViewMode>('cookbooks');
  const [selectedCookbookId, setSelectedCookbookId] =
    useState<Id<'cookbooks'> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 300);

  const { isRendered, backdropOpacity, modalTranslateY, animateOut } =
    useModalAnimation({
      visible,
      onAnimationComplete: () => {
        setSearchQuery('');
        setViewMode('cookbooks');
        setSelectedCookbookId(null);
      },
    });

  const cookbooks = useQuery(api.cookbooks.list);
  const savedRecipes = useQuery(api.savedRecipes.listSavedRecipes);
  const cookbookRecipes = useQuery(
    api.cookbooks.getRecipes,
    selectedCookbookId ? { cookbookId: selectedCookbookId } : 'skip'
  );

  // Filter recipes based on search for the "all" view
  const filteredAllRecipes = useMemo(() => {
    if (!savedRecipes) return [];
    if (debouncedQuery.length < 2) return savedRecipes;
    const q = debouncedQuery.toLowerCase();
    return savedRecipes.filter((r) => r.title.toLowerCase().includes(q));
  }, [savedRecipes, debouncedQuery]);

  // Filter recipes based on search for the cookbook view
  const filteredCookbookRecipes = useMemo(() => {
    if (!cookbookRecipes) return [];
    if (debouncedQuery.length < 2) return cookbookRecipes;
    const q = debouncedQuery.toLowerCase();
    return cookbookRecipes.filter((r) => r.title.toLowerCase().includes(q));
  }, [cookbookRecipes, debouncedQuery]);

  const handleClose = useCallback(() => {
    animateOut(closePicker);
  }, [animateOut, closePicker]);

  const handleBack = useCallback(() => {
    setSearchQuery('');
    if (viewMode === 'cookbookRecipes') {
      setViewMode('cookbooks');
      setSelectedCookbookId(null);
    }
  }, [viewMode]);

  const handleSelectRecipe = useCallback(
    (recipeId: Id<'recipes'>) => {
      onRecipeSelected?.(recipeId);
      animateOut(closePicker);
    },
    [onRecipeSelected, animateOut, closePicker]
  );

  const handleSelectCookbook = useCallback((cookbookId: Id<'cookbooks'>) => {
    setSelectedCookbookId(cookbookId);
    setViewMode('cookbookRecipes');
    setSearchQuery('');
  }, []);

  const handleToggleView = useCallback(() => {
    setSearchQuery('');
    setSelectedCookbookId(null);
    setViewMode((prev) => (prev === 'allRecipes' ? 'cookbooks' : 'allRecipes'));
  }, []);

  if (!isRendered) return null;

  const showSearch = viewMode === 'allRecipes' || viewMode === 'cookbookRecipes';
  const showBackButton = viewMode === 'cookbookRecipes';

  // Find cookbook name for header
  const selectedCookbookName =
    viewMode === 'cookbookRecipes' && cookbooks
      ? cookbooks.find((c) => c._id === selectedCookbookId)?.name ?? ''
      : '';

  const headerTitle =
    viewMode === 'cookbooks'
      ? COPY.pantry.mealPlan.addRecipe
      : viewMode === 'allRecipes'
        ? 'All Recipes'
        : selectedCookbookName;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        pointerEvents="box-none"
      >
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        {/* Modal Content */}
        <Animated.View
          style={[
            styles.modalContent,
            { transform: [{ translateY: modalTranslateY }] },
          ]}
        >
          {/* Handle bar */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {showBackButton && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                  onPress={handleBack}
                  hitSlop={8}
                >
                  <Icon
                    name="chevron-left"
                    size={24}
                    color={Colors.text.primary}
                  />
                </Pressable>
              )}
              <Text style={styles.title} numberOfLines={1}>
                {headerTitle}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={handleClose}
              hitSlop={12}
            >
              <Icon name="close" size={24} color={Colors.text.secondary} />
            </Pressable>
          </View>

          {/* View toggle (cookbooks vs all) — only in cookbooks or allRecipes mode */}
          {viewMode !== 'cookbookRecipes' && (
            <View style={styles.toggleRow}>
              <Pressable
                style={[
                  styles.toggleButton,
                  viewMode === 'cookbooks' && styles.toggleButtonActive,
                ]}
                onPress={() => {
                  setViewMode('cookbooks');
                  setSearchQuery('');
                }}
              >
                <Text
                  style={[
                    styles.toggleText,
                    viewMode === 'cookbooks' && styles.toggleTextActive,
                  ]}
                >
                  Cookbooks
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.toggleButton,
                  viewMode === 'allRecipes' && styles.toggleButtonActive,
                ]}
                onPress={handleToggleView}
              >
                <Text
                  style={[
                    styles.toggleText,
                    viewMode === 'allRecipes' && styles.toggleTextActive,
                  ]}
                >
                  All Recipes
                </Text>
              </Pressable>
            </View>
          )}

          {/* Search (only in recipe views) */}
          {showSearch && (
            <View style={styles.searchContainer}>
              <Icon name="search" size={18} color={Colors.text.tertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder={COPY.pantry.mealPlan.searchPlaceholder}
                placeholderTextColor={Colors.text.tertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  onPress={() => setSearchQuery('')}
                  hitSlop={8}
                >
                  <Icon name="close" size={16} color={Colors.text.tertiary} />
                </Pressable>
              )}
            </View>
          )}

          {/* Content */}
          <View
            style={[
              styles.listContainer,
              { paddingBottom: Math.max(insets.bottom, Spacing.md) },
            ]}
          >
            {viewMode === 'cookbooks' && (
              <CookbookGrid
                cookbooks={cookbooks}
                onSelect={handleSelectCookbook}
              />
            )}
            {viewMode === 'allRecipes' && (
              <RecipeGrid
                recipes={filteredAllRecipes}
                isLoading={savedRecipes === undefined}
                isEmpty={
                  savedRecipes !== undefined && savedRecipes.length === 0
                }
                noResults={
                  savedRecipes !== undefined &&
                  savedRecipes.length > 0 &&
                  filteredAllRecipes.length === 0
                }
                onSelect={handleSelectRecipe}
              />
            )}
            {viewMode === 'cookbookRecipes' && (
              <RecipeGrid
                recipes={filteredCookbookRecipes}
                isLoading={cookbookRecipes === undefined}
                isEmpty={
                  cookbookRecipes !== undefined &&
                  cookbookRecipes.length === 0
                }
                noResults={
                  cookbookRecipes !== undefined &&
                  cookbookRecipes.length > 0 &&
                  filteredCookbookRecipes.length === 0
                }
                onSelect={handleSelectRecipe}
              />
            )}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

// --- Cookbook Grid ---

type CookbookGridProps = {
  cookbooks:
    | Array<{
        _id: Id<'cookbooks'>;
        name: string;
        coverImageUrl?: string;
        recipeCount: number;
      }>
    | undefined;
  onSelect: (cookbookId: Id<'cookbooks'>) => void;
};

function CookbookGrid({
  cookbooks,
  onSelect,
}: CookbookGridProps): React.ReactElement {
  if (cookbooks === undefined) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="small" color={Colors.accent} />
      </View>
    );
  }

  if (cookbooks.length === 0) {
    return (
      <View style={styles.centeredState}>
        <Text style={styles.stateText}>No cookbooks yet</Text>
      </View>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.gridContent}
    >
      <View style={styles.grid}>
        {cookbooks.map((cookbook) => (
          <View key={cookbook._id} style={styles.cardWrapper}>
            <CookbookCard
              name={cookbook.name}
              recipeCount={cookbook.recipeCount}
              coverImageUrl={cookbook.coverImageUrl}
              onPress={() => onSelect(cookbook._id)}
              variant="grid"
            />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// --- Recipe Grid ---

type RecipeGridItem = {
  _id: Id<'recipes'>;
  title: string;
  imageUrl?: string;
  cuisine?: string;
  totalTimeMinutes?: number;
  difficulty?: string | number;
};

type RecipeGridProps = {
  recipes: RecipeGridItem[];
  isLoading: boolean;
  isEmpty: boolean;
  noResults: boolean;
  onSelect: (recipeId: Id<'recipes'>) => void;
};

function RecipeGrid({
  recipes,
  isLoading,
  isEmpty,
  noResults,
  onSelect,
}: RecipeGridProps): React.ReactElement {
  if (isLoading) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="small" color={Colors.accent} />
      </View>
    );
  }

  if (isEmpty) {
    return (
      <View style={styles.centeredState}>
        <Text style={styles.stateText}>
          {COPY.pantry.mealPlan.noSavedRecipes}
        </Text>
      </View>
    );
  }

  if (noResults) {
    return (
      <View style={styles.centeredState}>
        <Text style={styles.stateText}>{COPY.pantry.mealPlan.noResults}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.gridContent}
    >
      <View style={styles.grid}>
        {recipes.map((item) => (
          <View key={item._id} style={styles.cardWrapper}>
            <RecipeCard
              title={item.title}
              imageUrl={item.imageUrl}
              totalTimeMinutes={item.totalTimeMinutes ?? 0}
              difficulty={parseDifficulty(item.difficulty)}
              cuisine={item.cuisine}
              onPress={() => onSelect(item._id)}
            />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const GRID_GAP = Spacing.md;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - Spacing.lg * 2 - GRID_GAP) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background.overlay,
  },
  modalContent: {
    width: '100%',
    backgroundColor: Colors.background.primary,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    height: '90%',
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
  },
  title: {
    ...Typography.h2,
    color: Colors.text.primary,
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.full,
    padding: 3,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: Radius.full,
  },
  toggleButtonActive: {
    backgroundColor: Colors.background.primary,
    ...Shadow.surface,
  },
  toggleText: {
    ...Typography.label,
    color: Colors.text.tertiary,
  },
  toggleTextActive: {
    color: Colors.text.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
  },
  searchInput: {
    ...Typography.body,
    flex: 1,
    color: Colors.text.primary,
    padding: 0,
  },
  listContainer: {
    flex: 1,
    minHeight: 250,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
  },
  stateText: {
    ...Typography.body,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
  gridContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  // Card wrapper (both CookbookCard and RecipeCard use flex:1)
  cardWrapper: {
    width: CARD_WIDTH,
    aspectRatio: 0.75,
  },
});
