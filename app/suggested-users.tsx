import { memo, useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { Loading } from '@/components/ui/Loading';
import { COPY } from '@/constants/copy';
import { Colors, NAV_BUTTON_SIZE, Radius, Spacing, Typography } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { useDebounce } from '@/hooks/useDebounce';

type SuggestedUserCardProps = {
  user: Doc<'users'>;
  onPress: () => void;
};

const SuggestedUserCard = memo(function SuggestedUserCard({
  user,
  onPress,
}: SuggestedUserCardProps): React.ReactElement {
  const fullName = `${user.firstName} ${user.lastName}`.trim() || 'User';
  const hasUsername = Boolean(user.username);

  // Skip Clerk's default gradient avatars
  const isClerkDefaultAvatar = user.imageUrl?.includes('img.clerk.com');
  const avatarUrl = isClerkDefaultAvatar ? null : user.imageUrl;

  // Check if already following
  const isFollowingQuery = useQuery(api.follows.isFollowing, { userId: user._id });
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const followMutation = useMutation(api.follows.follow);
  const unfollowMutation = useMutation(api.follows.unfollow);

  // Update local state when query returns
  if (isFollowingQuery !== undefined && isFollowingQuery !== isFollowing && !isLoading) {
    setIsFollowing(isFollowingQuery);
  }

  const handleFollow = useCallback(async () => {
    if (isLoading) return;

    const newFollowingState = !isFollowing;
    setIsFollowing(newFollowingState);
    setIsLoading(true);

    try {
      if (newFollowingState) {
        await followMutation({ followingId: user._id });
      } else {
        await unfollowMutation({ followingId: user._id });
      }
    } catch {
      setIsFollowing(!newFollowingState);
    } finally {
      setIsLoading(false);
    }
  }, [isFollowing, isLoading, user._id, followMutation, unfollowMutation]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${fullName}'s profile`}
      style={styles.userCard}
      onPress={onPress}
    >
      <Avatar
        imageUrl={avatarUrl}
        firstName={user.firstName || 'U'}
        lastName={user.lastName || 'N'}
        size="lg"
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName} numberOfLines={1}>
          {fullName}
        </Text>
        {hasUsername ? (
          <Text style={styles.userHandle} numberOfLines={1}>
            @{user.username}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isFollowing ? 'Unfollow' : 'Follow'}
        style={[styles.followButton, isFollowing && styles.followingButton]}
        onPress={handleFollow}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator
            size="small"
            color={isFollowing ? Colors.text.secondary : Colors.text.inverse}
          />
        ) : (
          <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
            {isFollowing ? COPY.profile.following_button : COPY.profile.follow}
          </Text>
        )}
      </Pressable>
    </Pressable>
  );
});

export default function SuggestedUsersScreen(): React.ReactElement {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 300);

  const suggestedUsers = useQuery(api.users.suggested, { limit: 50 });
  const searchResults = useQuery(
    api.users.search,
    debouncedQuery.length >= 2 ? { query: debouncedQuery } : 'skip'
  );

  const handleUserPress = useCallback((userId: Id<'users'>) => {
    router.push(`/user/${userId}`);
  }, [router]);

  const isSearching = debouncedQuery.length >= 2;
  const displayUsers = isSearching ? searchResults : suggestedUsers;
  const isLoading = displayUsers === undefined;

  const renderItem = useCallback(({ item }: { item: Doc<'users'> }) => (
    <SuggestedUserCard
      user={item}
      onPress={() => handleUserPress(item._id)}
    />
  ), [handleUserPress]);

  const keyExtractor = useCallback((item: Doc<'users'>) => item._id, []);

  const ListEmptyComponent = useMemo(() => {
    if (isLoading) return null;

    return (
      <View style={styles.emptyState}>
        <Icon name="users" size={48} color={Colors.text.tertiary} />
        <Text style={styles.emptyTitle}>
          {isSearching ? COPY.suggestedUsers.noResults : COPY.suggestedUsers.emptyTitle}
        </Text>
        <Text style={styles.emptySubtitle}>
          {COPY.suggestedUsers.emptySubtitle}
        </Text>
      </View>
    );
  }, [isLoading, isSearching]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Icon name="arrow-back" size={20} color={Colors.text.inverse} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>{COPY.suggestedUsers.title}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Icon name="search" size={20} color={Colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder={COPY.suggestedUsers.searchPlaceholder}
            placeholderTextColor={Colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setSearchQuery('')}
              hitSlop={8}
            >
              <Icon name="close" size={18} color={Colors.text.tertiary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* User List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Loading size="large" color={Colors.accent} />
        </View>
      ) : (
        <FlashList
          data={displayUsers ?? []}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={ListEmptyComponent}
          showsVerticalScrollIndicator={false}
        />
      )}
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
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  backButton: {
    width: NAV_BUTTON_SIZE,
    height: NAV_BUTTON_SIZE,
    borderRadius: NAV_BUTTON_SIZE / 2,
    backgroundColor: Colors.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text.primary,
  },
  headerSpacer: {
    width: NAV_BUTTON_SIZE,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    color: Colors.text.primary,
    padding: 0,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.primary,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    ...Typography.label,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  userHandle: {
    ...Typography.caption,
    color: Colors.text.secondary,
  },
  followButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  followButtonText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.text.inverse,
  },
  followingButtonText: {
    color: Colors.text.secondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.xxl * 2,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
});
