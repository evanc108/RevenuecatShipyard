import { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from 'convex/react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/convex/_generated/api';
import { UserListItem } from '@/components/ui/UserListItem';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import type { Doc } from '@/convex/_generated/dataModel';

type UserSearchProps = {
  placeholder?: string;
  showSuggestions?: boolean;
};

function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export function UserSearch({
  placeholder = COPY.socialFeed?.searchPlaceholder ?? 'Search users...',
  showSuggestions = true,
}: UserSearchProps): React.ReactElement {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const searchResults = useQuery(
    api.users.search,
    debouncedQuery.length >= 2 ? { query: debouncedQuery, limit: 20 } : 'skip'
  );

  const suggestedUsers = useQuery(
    api.users.suggested,
    showSuggestions && debouncedQuery.length < 2 ? { limit: 10 } : 'skip'
  );

  const isSearching = debouncedQuery.length >= 2;
  const isLoading = isSearching ? searchResults === undefined : suggestedUsers === undefined;
  const users = isSearching ? searchResults : suggestedUsers;

  const renderItem = useCallback(
    ({ item }: { item: Doc<'users'> }) => <UserListItem user={item} showFollowButton />,
    []
  );

  const keyExtractor = useCallback((item: Doc<'users'>) => item._id, []);

  const ListEmptyComponent = useMemo(() => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      );
    }

    if (isSearching && debouncedQuery.length >= 2) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={48} color={Colors.text.tertiary} />
          <Text style={styles.emptyTitle}>
            {COPY.socialFeed?.noResults ?? 'No users found'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {COPY.socialFeed?.tryDifferentSearch ?? 'Try a different search term'}
          </Text>
        </View>
      );
    }

    if (!isSearching && showSuggestions) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={48} color={Colors.text.tertiary} />
          <Text style={styles.emptyTitle}>
            {COPY.socialFeed?.noSuggestions ?? 'No suggestions'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {COPY.socialFeed?.searchToFind ?? 'Search to find people to follow'}
          </Text>
        </View>
      );
    }

    return null;
  }, [isLoading, isSearching, debouncedQuery.length, showSuggestions]);

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color={Colors.text.tertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder={placeholder}
          placeholderTextColor={Colors.text.tertiary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => setQuery('')}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={20} color={Colors.text.tertiary} />
          </Pressable>
        ) : null}
      </View>

      {/* Section Header */}
      {!isSearching && showSuggestions && users && users.length > 0 ? (
        <Text style={styles.sectionHeader}>
          {COPY.socialFeed?.suggestedUsers ?? 'Suggested for you'}
        </Text>
      ) : null}

      {isSearching && users && users.length > 0 ? (
        <Text style={styles.sectionHeader}>
          {COPY.socialFeed?.searchResults ?? 'Search results'}
        </Text>
      ) : null}

      {/* Results List */}
      <View style={styles.listContainer}>
        <FlashList
          data={users ?? []}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          estimatedItemSize={64}
          ListEmptyComponent={ListEmptyComponent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    fontSize: 16,
    color: Colors.text.primary,
  },
  sectionHeader: {
    ...Typography.label,
    color: Colors.text.secondary,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  listContainer: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...Typography.body,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
});
