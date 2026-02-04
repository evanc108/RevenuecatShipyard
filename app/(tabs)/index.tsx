import { CookbookCarousel } from '@/components/ui/CookbookCarousel';
import { CreateCookbookModal } from '@/components/ui/CreateCookbookModal';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
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

// --- Constants ---

const SORT_OPTIONS: readonly { mode: SortMode; label: string }[] = [
  { mode: 'recent', label: 'Recent' },
  { mode: 'oldest', label: 'Oldest' },
  { mode: 'a-z', label: 'A \u2192 Z' },
  { mode: 'z-a', label: 'Z \u2192 A' },
];

const SEARCH_ICON_SIZE = 40;
const CARD_WIDTH_RATIO = 0.85;
const CARD_HEIGHT_RATIO = 0.65;
const FAB_SIZE = 56;

const COPY = {
  titleTop: 'Your',
  titleBottom: 'Cookbooks',
  searchPlaceholder: 'Search...',
  newCookbook: 'New Cookbook',
  deleteTitle: 'Delete Cookbook',
  deleteMessage: "Are you sure? This can't be undone.",
  delete: 'Delete',
  cancel: 'Cancel',
  emptyTitle: 'No cookbooks yet',
  emptySubtitle: 'Tap + to create your first cookbook',
  addCookbook: 'Add\nCookbook',
  createError: 'Failed to create cookbook. Please try again.',
} as const;

// Decorative SVG fill colors for brush stroke
const STROKE_FILL_PRIMARY = '#EEEEF3';
const STROKE_FILL_SECONDARY = '#F2F2F6';

// --- Component ---

export default function CookbookScreen() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
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
            throw new Error(COPY.createError);
          }
          const { storageId } = (await uploadResponse.json()) as { storageId: Id<'_storage'> };
          coverImageStorageId = storageId;
        }

        await createCookbook({ name, description, coverImageStorageId });
        setIsCreateModalVisible(false);
      } catch {
        Alert.alert('Error', COPY.createError);
      } finally {
        setIsCreating(false);
      }
    },
    [createCookbook, generateUploadUrl],
  );

  const router = useRouter();

  const handleCardPress = useCallback((id: Id<'cookbooks'>) => {
    router.push({ pathname: '/cookbook/[cookbookId]', params: { cookbookId: id } });
  }, [router]);

  const isLoading = cookbooks === undefined;

  // --- Render ---

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="book-outline" size={32} color={Colors.text.primary} />
          <View style={styles.titleStack}>
            <Text style={styles.titleTop}>{COPY.titleTop}</Text>
            <Text style={styles.titleBottom}>{COPY.titleBottom}</Text>
          </View>
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

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : sortedAndFiltered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={COPY.newCookbook}
            style={[
              styles.emptyCardOuter,
              {
                width: screenWidth * CARD_WIDTH_RATIO,
                height: screenHeight * CARD_HEIGHT_RATIO,
              },
            ]}
            onPress={() => setIsCreateModalVisible(true)}
          >
            <View style={styles.emptyCardInner}>
              {/* Top-right plus icon */}
              <Ionicons
                name="add"
                size={30}
                color={Colors.accent}
                style={styles.emptyPlusIcon}
              />

              {/* Decorative brush stroke behind image */}
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
                source={require('@/assets/images/create-cookbook-icon.png')}
                style={styles.emptyCardImage}
                contentFit="contain"
                cachePolicy="memory-disk"
              />

              {/* Bottom fade — white, over image only */}
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

              {/* Bottom-left label */}
              <View style={styles.emptyBottom}>
                <Text style={styles.emptyCardTitle}>{COPY.addCookbook}</Text>
              </View>
            </View>
          </Pressable>
        </View>
      ) : (
        <CookbookCarousel
          cookbooks={sortedAndFiltered}
          onCardPress={handleCardPress}
        />
      )}

      {/* FAB */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={COPY.newCookbook}
        style={styles.fab}
        onPress={() => setIsCreateModalVisible(true)}
      >
        <Ionicons name="add" size={28} color={Colors.text.inverse} />
      </Pressable>

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
  titleStack: {
    flexDirection: 'column',
  },
  titleTop: {
    ...Typography.h3,
    fontWeight: '400',
    color: Colors.text.primary,
    letterSpacing: -0.2,
  },
  titleBottom: {
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

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty ghost card — outer for shadow, inner for clip
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: Spacing.xxl,
  },
  emptyCardOuter: {
    borderRadius: Radius.xl,
    backgroundColor: Colors.background.primary,
    ...Shadow.elevated,
  },
  emptyCardInner: {
    flex: 1,
    borderRadius: Radius.xl,
    backgroundColor: Colors.background.primary,
    overflow: 'hidden',
  },
  emptyPlusIcon: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    zIndex: 1,
  },
  emptyStroke: {
    position: 'absolute',
    width: '92%',
    height: '65%',
    top: '8%',
    left: '4%',
  },
  emptyCardImage: {
    position: 'absolute',
    width: '88%',
    height: '80%',
    top: '5%',
    left: '6%',
  },
  emptyCardGradient: {
    position: 'absolute',
    bottom: 0,
    left: -1,
    right: -1,
    height: '75%',
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
  },
  emptyBottom: {
    position: 'absolute',
    bottom: Spacing.lg,
    left: Spacing.lg,
  },
  emptyCardTitle: {
    ...Typography.h1,
    color: Colors.text.primary,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: Spacing.lg,
    right: Spacing.lg,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.elevated,
    zIndex: 10,
  },
});
