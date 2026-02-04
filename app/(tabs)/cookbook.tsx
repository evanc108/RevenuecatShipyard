import { CreateCookbookModal } from '@/components/ui/CreateCookbookModal';
import { CookbookCarousel } from '@/components/ui/CookbookCarousel';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
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
} as const;

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
              styles.emptyCard,
              {
                width: screenWidth * 0.85,
                height: screenHeight * 0.65,
              },
            ]}
            onPress={() => setIsCreateModalVisible(true)}
          >
            <Text style={styles.emptyCardTitle}>Add Cookbook</Text>
            <View style={styles.emptyCardImageContainer}>
              <Image
                source={require('@/assets/images/create-cookbook-icon.png')}
                style={styles.emptyCardImage}
                contentFit="contain"
              />
            </View>
            <LinearGradient
              colors={['transparent', 'rgba(245,245,247,0.6)', Colors.background.secondary]}
              locations={[0.3, 0.6, 1]}
              style={styles.emptyCardGradient}
            />
          </Pressable>
        </View>
      ) : (
        <CookbookCarousel
          cookbooks={sortedAndFiltered as CookbookDoc[]}
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
    fontSize: 18,
    lineHeight: 22,
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

  // Empty ghost card
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: Spacing.xxl,
  },
  emptyCard: {
    borderRadius: Radius.xl,
    backgroundColor: Colors.background.secondary,
    overflow: 'hidden',
  },
  emptyCardTitle: {
    ...Typography.h2,
    color: Colors.text.primary,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxl,
  },
  emptyCardImageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyCardImage: {
    width: '70%',
    height: '70%',
  },
  emptyCardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
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
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 10,
  },
});
