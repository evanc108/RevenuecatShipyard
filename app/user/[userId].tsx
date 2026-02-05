import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation } from 'convex/react';
import { Icon } from '@/components/ui/Icon';
import { api } from '@/convex/_generated/api';
import { Avatar } from '@/components/ui/Avatar';
import { ProfileStats } from '@/components/ui/ProfileStats';
import { FollowButton } from '@/components/ui/FollowButton';
import { FeedPost } from '@/components/ui/FeedPost';
import { CookbookSelectionModal } from '@/components/cookbook/CookbookSelectionModal';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import type { Id } from '@/convex/_generated/dataModel';

export default function UserProfileScreen(): React.ReactElement {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();

  const user = useQuery(
    api.users.getById,
    userId ? { userId: userId as Id<'users'> } : 'skip'
  );
  const currentUser = useQuery(api.users.current);
  const stats = useQuery(
    api.follows.stats,
    userId ? { userId: userId as Id<'users'> } : 'skip'
  );
  const isFollowing = useQuery(
    api.follows.isFollowing,
    userId ? { userId: userId as Id<'users'> } : 'skip'
  );
  const posts = useQuery(
    api.posts.listByUserEnriched,
    userId ? { userId: userId as Id<'users'> } : 'skip'
  );

  const addRecipeToCookbook = useMutation(api.cookbooks.addRecipe);

  // Cookbook modal state
  const [showCookbookModal, setShowCookbookModal] = useState(false);
  const [pendingRecipe, setPendingRecipe] = useState<{
    _id: Id<'recipes'>;
    title: string;
    imageUrl?: string;
    url: string;
  } | null>(null);
  const [isSavingToCookbook, setIsSavingToCookbook] = useState(false);

  const isLoading = user === undefined || stats === undefined || isFollowing === undefined;
  const isCurrentUser = currentUser?._id === userId;

  const handleBookmarkPress = useCallback((recipe: {
    _id: Id<'recipes'>;
    title: string;
    imageUrl?: string;
    url: string;
  }) => {
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

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            hitSlop={8}
          >
            <Icon name="arrow-back" size={24} color={Colors.text.primary} />
          </Pressable>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (user === null) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            hitSlop={8}
          >
            <Icon name="arrow-back" size={24} color={Colors.text.primary} />
          </Pressable>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{COPY.profile.userNotFound}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const fullName = `${user.firstName} ${user.lastName}`.trim() || 'User';

  // Skip Clerk's default gradient avatars
  const isClerkDefaultAvatar = user.imageUrl?.includes('img.clerk.com');
  const avatarUrl = isClerkDefaultAvatar ? null : user.imageUrl;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Icon name="arrow-back" size={24} color={Colors.text.primary} />
        </Pressable>
        <Text style={styles.headerName}>{fullName}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          <Avatar
            imageUrl={avatarUrl}
            firstName={user.firstName || 'U'}
            lastName={user.lastName || 'N'}
            size="xl"
          />
          {user.username ? (
            <Text style={styles.username}>@{user.username}</Text>
          ) : null}

          <View style={styles.statsContainer}>
            <ProfileStats
              userId={user._id}
              followerCount={stats.followerCount}
              followingCount={stats.followingCount}
            />
          </View>

          {!isCurrentUser ? (
            <View style={styles.followButtonContainer}>
              <FollowButton userId={user._id} initialIsFollowing={isFollowing} />
            </View>
          ) : null}
        </View>

        {/* Posts Section */}
        <View style={styles.postsSection}>
          <Text style={styles.postsSectionTitle}>Posts</Text>
          <View style={styles.postsContainer}>
            {posts === undefined ? (
              <ActivityIndicator size="small" color={Colors.accent} style={styles.postsLoading} />
            ) : posts.length > 0 ? (
              posts.map((post) => (
                <FeedPost
                  key={post._id}
                  postId={post._id}
                  user={post.user}
                  recipe={post.recipe}
                  easeRating={post.easeRating}
                  tasteRating={post.tasteRating}
                  presentationRating={post.presentationRating}
                  notes={post.notes}
                  createdAt={post.createdAt}
                  likeCount={post.likeCount}
                  commentCount={post.commentCount}
                  isLiked={post.isLiked}
                  isSaved={post.isSaved}
                  currentUserId={currentUser?._id}
                  onBookmarkPress={handleBookmarkPress}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Icon name="grid" size={48} color={Colors.text.tertiary} />
                <Text style={styles.emptyStateTitle}>{COPY.posts.emptyTitle}</Text>
                <Text style={styles.emptyStateText}>{COPY.posts.emptySubtitle}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Cookbook Selection Modal */}
      <CookbookSelectionModal
        visible={showCookbookModal}
        recipe={pendingRecipe}
        onClose={handleCookbookModalClose}
        onSelect={handleCookbookSelect}
        isLoading={isSavingToCookbook}
      />
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerName: {
    ...Typography.h3,
    color: Colors.text.primary,
  },
  headerSpacer: {
    width: 24,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  errorText: {
    ...Typography.body,
    color: Colors.text.secondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  username: {
    ...Typography.body,
    color: Colors.text.secondary,
    marginTop: Spacing.sm,
  },
  statsContainer: {
    marginTop: Spacing.lg,
  },
  followButtonContainer: {
    marginTop: Spacing.lg,
  },
  postsSection: {
    marginTop: Spacing.lg,
    marginHorizontal: -Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  postsSectionTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  postsContainer: {
    flex: 1,
  },
  postsLoading: {
    paddingVertical: Spacing.xl,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
  },
  emptyStateTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
    marginTop: Spacing.md,
  },
  emptyStateText: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
});
