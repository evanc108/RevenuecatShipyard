import { CookbookCard } from '@/components/ui/CookbookCard';
import { CreateCookbookModal } from '@/components/ui/CreateCookbookModal';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

// --- Types ---

type SortMode = 'recent' | 'oldest' | 'a-z' | 'z-a';

type CookbookDoc = {
  _id: Id<'cookbooks'>;
  name: string;
  description?: string;
  coverImageUrl?: string;
  createdAt: number;
  updatedAt: number;
};

type CookbookGridItem = { type: 'cookbook'; data: CookbookDoc };
type CreateGridItem = { type: 'create' };
type GridItem = CookbookGridItem | CreateGridItem;

// --- Constants ---

const SORT_OPTIONS: readonly { mode: SortMode; label: string }[] = [
  { mode: 'recent', label: 'Recent' },
  { mode: 'oldest', label: 'Oldest' },
  { mode: 'a-z', label: 'A → Z' },
  { mode: 'z-a', label: 'Z → A' },
];

const SEARCH_ICON_SIZE = 40;

const COPY = {
  title: 'Cookbooks',
  searchPlaceholder: 'Search...',
  newCookbook: 'New Cookbook',
  deleteTitle: 'Delete Cookbook',
  deleteMessage: "Are you sure? This can't be undone.",
  delete: 'Delete',
  cancel: 'Cancel',
  emptyTitle: 'No cookbooks yet',
  emptySubtitle: 'Tap + to create your first cookbook',
} as const;

// --- Component ---

export default function CookbookScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const cookbooks = useQuery(api.cookbooks.list);
  const createCookbook = useMutation(api.cookbooks.create);
  const generateUploadUrl = useMutation(api.users.generateUploadUrl);

  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const searchProgress = useSharedValue(0);
  const inputRef = useRef<TextInput>(null);

  // Search expands to ~55% of header width, staying right of the title
  const searchMaxWidth = (screenWidth - Spacing.lg * 2) * 0.45;

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

  const sortedAndFiltered = useMemo(() => {
    if (!cookbooks) return [];

    let result = [...cookbooks];

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.description?.toLowerCase().includes(q) ?? false),
      );
    }

    switch (sortMode) {
      case 'recent':
        result.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'oldest':
        result.sort((a, b) => a.createdAt - b.createdAt);
        break;
      case 'a-z':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'z-a':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
    }

    return result;
  }, [cookbooks, searchQuery, sortMode]);

  const gridData: GridItem[] = useMemo(() => {
    const items: GridItem[] = sortedAndFiltered.map((c) => ({
      type: 'cookbook' as const,
      data: c as CookbookDoc,
    }));
    items.push({ type: 'create' as const });
    return items;
  }, [sortedAndFiltered]);

  // --- Handlers ---

  const handleCreateCookbook = useCallback(
    async (name: string, description?: string, imageUri?: string) => {
      try {
        setIsCreating(true);

        let coverImageStorageId: Id<'_storage'> | undefined;

        if (imageUri) {
          const uploadUrl = await generateUploadUrl();
          const response = await fetch(imageUri);
          const blob = await response.blob();
          const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': blob.type },
            body: blob,
          });
          if (!uploadResponse.ok) {
            throw new Error('Failed to upload image');
          }
          const { storageId } = await uploadResponse.json();
          coverImageStorageId = storageId as Id<'_storage'>;
        }

        await createCookbook({ name, description, coverImageStorageId });
        setIsCreateModalVisible(false);
      } catch {
        Alert.alert('Error', 'Failed to create cookbook. Please try again.');
      } finally {
        setIsCreating(false);
      }
    },
    [createCookbook, generateUploadUrl],
  );

  const getKeyExtractor = useCallback(
    (item: GridItem) =>
      item.type === 'create' ? 'create-card' : item.data._id,
    [],
  );

  const isLoading = cookbooks === undefined;

  // --- Render ---

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="book-outline" size={32} color={Colors.text.primary} />
          <Text style={styles.title}>{COPY.title}</Text>
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
                placeholder={COPY.searchPlaceholder}
                placeholderTextColor={Colors.text.tertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={COPY.searchPlaceholder}
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

      {/* Grid */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <FlashList
          key={`${sortMode}-${searchQuery.trim().length > 0}`}
          data={gridData}
          numColumns={2}
          keyExtractor={getKeyExtractor}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>{COPY.emptyTitle}</Text>
              <Text style={styles.emptySubtitle}>{COPY.emptySubtitle}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.gridItem}>
              {item.type === 'create' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={COPY.newCookbook}
                  style={styles.createCardOuter}
                  onPress={() => setIsCreateModalVisible(true)}
                >
                  <View style={styles.createCardInner}>
                    {/* Top-right thick plus */}
                    <Ionicons
                      name="add"
                      size={30}
                      color={Colors.accent}
                      style={styles.createPlusIcon}
                    />

                    {/* Soft paint stroke behind image */}
                    <Svg
                      style={styles.createStroke}
                      viewBox="0 0 200 160"
                      preserveAspectRatio="xMidYMid meet"
                    >
                      <Path
                        d="M30,80 C45,30 90,15 130,40 C155,55 175,30 185,55 C195,80 170,110 135,105 C100,100 70,120 45,105 C20,90 20,95 30,80Z"
                        fill="#EEEEF3"
                      />
                      <Path
                        d="M145,25 C155,18 170,22 165,35 C160,48 148,40 145,25Z"
                        fill="#F2F2F6"
                      />
                      <Path
                        d="M25,105 C30,98 45,100 40,112 C35,120 22,115 25,105Z"
                        fill="#F2F2F6"
                      />
                    </Svg>

                    {/* Centered illustration */}
                    <Image
                      source={require('@/assets/images/create-cookbook-icon.png')}
                      style={styles.createImage}
                      contentFit="contain"
                    />

                    {/* Bottom fade over image */}
                    <LinearGradient
                      colors={[
                        'rgba(255,255,255,0)',
                        'rgba(255,255,255,0.15)',
                        'rgba(255,255,255,0.4)',
                        'rgba(255,255,255,0.7)',
                        'rgba(255,255,255,1)',
                      ]}
                      locations={[0, 0.25, 0.5, 0.75, 1]}
                      style={styles.createGradient}
                    />

                    {/* Bottom-left label */}
                    <View style={styles.createBottom}>
                      <Text style={styles.createLabel}>{'Add\nCookbook'}</Text>
                    </View>
                  </View>
                </Pressable>
              ) : (
                <CookbookCard
                  name={item.data.name}
                  description={item.data.description}
                  recipeCount={0}
                  coverImageUrl={item.data.coverImageUrl}
                  onPress={() => { }}
                />
              )}
            </View>
          )}
        />
      )}

      {/* Create Modal */}
      <CreateCookbookModal
        visible={isCreateModalVisible}
        onClose={() => setIsCreateModalVisible(false)}
        onSubmit={handleCreateCookbook}
        isLoading={isCreating}
      />
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
    paddingBottom: Spacing.lg,
    minHeight: 52,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    ...Typography.h1,
    color: Colors.text.primary,
  },

  // Search
  searchBar: {
    position: 'absolute',
    right: Spacing.lg,
    height: SEARCH_ICON_SIZE,
    backgroundColor: Colors.background.primary,
    borderRadius: SEARCH_ICON_SIZE / 2,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
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
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
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

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
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

  // Grid
  gridContent: {
    paddingHorizontal: Spacing.lg - Spacing.xs,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xxl,
  },
  gridItem: {
    flex: 1,
    padding: Spacing.xs,
    minHeight: 10,
  },

  // Create Card (outer = shadow, inner = clip)
  createCardOuter: {
    width: '100%',
    aspectRatio: 1.2,
    borderRadius: Radius.xl,
    backgroundColor: Colors.background.primary,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 6,
  },
  createCardInner: {
    flex: 1,
    borderRadius: Radius.xl,
    backgroundColor: Colors.background.primary,
    overflow: 'hidden',
  },
  createStroke: {
    position: 'absolute',
    width: '90%',
    height: '70%',
    top: '8%',
    left: '5%',
  },
  createImage: {
    position: 'absolute',
    width: '92%',
    height: '78%',
    top: '10%',
    left: '6%',
  },
  createGradient: {
    position: 'absolute',
    bottom: 0,
    left: -1,
    right: -1,
    height: '80%',
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
  },
  createBottom: {
    position: 'absolute',
    bottom: Spacing.md,
    left: Spacing.md,
  },
  createLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    lineHeight: 23,
    textShadowColor: 'rgba(0, 0, 0, 0.12)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  createPlusIcon: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    zIndex: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 2, height: 3 },
    textShadowRadius: 3,
  },
});
