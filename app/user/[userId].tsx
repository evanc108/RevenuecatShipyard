import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation } from 'convex/react';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import { api } from '@/convex/_generated/api';
import { Avatar } from '@/components/ui/Avatar';
import { ProfileStats } from '@/components/ui/ProfileStats';
import { FollowButton } from '@/components/ui/FollowButton';
import { FeedPost } from '@/components/ui/FeedPost';
import { ProfilePostCard } from '@/components/ui/ProfilePostCard';
import { PostGridItem } from '@/components/ui/PostGridItem';
import { CookbookSelectionModal } from '@/components/cookbook/CookbookSelectionModal';
import { CookbookCard } from '@/components/cookbook/CookbookCard';
import { Loading } from '@/components/ui/Loading';
import { Colors, NAV_BUTTON_SIZE, Radius, Spacing, Typography } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import type { Id } from '@/convex/_generated/dataModel';
import type { ViewMode } from '@/components/ui/ViewModeToggle';

type ProfileTab = 'cookbooks' | 'posts';

const TABS: { key: ProfileTab; icon: IconName; label: string }[] = [
  { key: 'cookbooks', icon: 'book', label: 'Cookbooks' },
  { key: 'posts', icon: 'grid', label: 'Posts' },
];

const POSTS_GRID_COLUMNS = 2;
const POSTS_GRID_GAP = 1;
const GRID_COLUMNS = 2;
const GRID_GAP = Spacing.sm;
const COOKBOOK_CARD_GAP = Spacing.md;
const VISIBLE_COOKBOOK_CARDS = 1.8;

// --- Profile Tab Bar ---

function ProfileTabBar({
  activeTab,
  onTabPress,
}: {
  activeTab: ProfileTab;
  onTabPress: (tab: ProfileTab) => void;
}): React.ReactElement {
  return (
    <View style={styles.tabBarWrapper}>
      <View style={styles.tabBarContainer}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
              style={styles.tabItem}
              onPress={() => onTabPress(tab.key)}
            >
              <Icon
                name={tab.icon}
                size={26}
                color={isActive ? Colors.accent : Colors.text.tertiary}
                strokeWidth={isActive ? 2 : 1.5}
              />
              {isActive ? <View style={styles.tabUnderlineActive} /> : null}
            </Pressable>
          );
        })}
      </View>
      <LinearGradient
        colors={['rgba(0,0,0,0.00)', 'transparent']}
        style={styles.tabBarShadow}
      />
    </View>
  );
}

export default function UserProfileScreen(): React.ReactElement {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();

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
  const cookbooks = useQuery(
    api.cookbooks.listByUser,
    userId ? { userId: userId as Id<'users'> } : 'skip'
  );

  const addRecipeToCookbook = useMutation(api.cookbooks.addRecipe);

  // State
  const [activeTab, setActiveTab] = useState<ProfileTab>('cookbooks');
  const [viewMode, setViewMode] = useState<ViewMode>('slider');
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
  const postsGridItemWidth = (screenWidth - POSTS_GRID_GAP * (POSTS_GRID_COLUMNS - 1)) / POSTS_GRID_COLUMNS;
  const cookbookCardWidth = (screenWidth - Spacing.lg * 2 - COOKBOOK_CARD_GAP) / VISIBLE_COOKBOOK_CARDS;
  const gridItemWidth = (screenWidth - Spacing.xl * 2 - GRID_GAP) / GRID_COLUMNS;
  const cookbookCount = cookbooks?.length ?? 0;
  const shouldCenterCookbooks = cookbookCount <= 1;

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

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === 'slider' ? 'grid' : 'slider'));
  }, []);

  const handlePostPress = useCallback((recipeId: Id<'recipes'>) => {
    router.push(`/recipe/${recipeId}`);
  }, [router]);

  const handleCookbookPress = useCallback((cookbookId: string) => {
    router.push(`/cookbook/${cookbookId}`);
  }, [router]);

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
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
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <Loading size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // User not found
  if (user === null) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
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
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{COPY.profile.userNotFound}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const fullName = `${user.firstName} ${user.lastName}`.trim() || 'User';
  const displayName = user.username ? `@${user.username}` : fullName;

  // Skip Clerk's default gradient avatars
  const isClerkDefaultAvatar = user.imageUrl?.includes('img.clerk.com');
  const avatarUrl = isClerkDefaultAvatar ? null : user.imageUrl;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[2]}
      >
        {/* Header */}
        <View style={styles.header}>
          {/* Center: Username */}
          <Text style={styles.headerName} numberOfLines={1}>
            {displayName}
          </Text>

          {/* Left: Back button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={12}
          >
            <Icon name="arrow-back" size={20} color={Colors.text.inverse} strokeWidth={2} />
          </Pressable>

          {/* Right: View toggle */}
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Switch to ${viewMode === 'slider' ? 'grid' : 'slider'} view`}
              style={styles.headerNavButton}
              onPress={toggleViewMode}
              hitSlop={12}
            >
              <Icon
                name={viewMode === 'slider' ? 'apps' : 'layers'}
                size={20}
                color={Colors.text.inverse}
                strokeWidth={1.5}
              />
            </Pressable>
          </View>
        </View>

        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <Avatar
            imageUrl={avatarUrl}
            firstName={user.firstName || 'U'}
            lastName={user.lastName || 'N'}
            size="xl"
          />
          <Text style={styles.fullName}>{fullName}</Text>

          {stats ? (
            <ProfileStats
              userId={user._id}
              followerCount={stats.followerCount}
              followingCount={stats.followingCount}
            />
          ) : null}

          {!isCurrentUser ? (
            <View style={styles.followButtonContainer}>
              <FollowButton userId={user._id} initialIsFollowing={isFollowing} />
            </View>
          ) : null}
        </View>

        {/* Tab Bar */}
        <ProfileTabBar activeTab={activeTab} onTabPress={setActiveTab} />

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'cookbooks' ? (
            <View style={styles.cookbooksContainer}>
              {cookbooks && cookbooks.length > 0 ? (
                viewMode === 'slider' ? (
                  /* Cookbook Carousel View */
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={[
                      styles.cookbookCarouselContent,
                      shouldCenterCookbooks && styles.cookbookCarouselCentered,
                    ]}
                    decelerationRate="fast"
                    snapToInterval={cookbookCardWidth + COOKBOOK_CARD_GAP}
                  >
                    {cookbooks.map((cookbook) => (
                      <View
                        key={cookbook._id}
                        style={[
                          styles.cookbookCarouselCard,
                          { width: cookbookCardWidth },
                        ]}
                      >
                        <CookbookCard
                          name={cookbook.name}
                          description={cookbook.description}
                          recipeCount={cookbook.recipeCount}
                          coverImageUrl={cookbook.coverImageUrl}
                          variant="carousel"
                          size="compact"
                          onPress={() => handleCookbookPress(cookbook._id)}
                        />
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  /* Cookbook Grid View */
                  <View style={styles.cookbookGrid}>
                    {cookbooks.map((cookbook) => (
                      <View
                        key={cookbook._id}
                        style={[
                          styles.cookbookGridCard,
                          { width: gridItemWidth },
                        ]}
                      >
                        <CookbookCard
                          name={cookbook.name}
                          description={cookbook.description}
                          recipeCount={cookbook.recipeCount}
                          coverImageUrl={cookbook.coverImageUrl}
                          variant="grid"
                          size="compact"
                          onPress={() => handleCookbookPress(cookbook._id)}
                        />
                      </View>
                    ))}
                  </View>
                )
              ) : (
                <View style={styles.emptyState}>
                  <Icon name="book" size={48} color={Colors.text.tertiary} />
                  <Text style={styles.emptyStateTitle}>{COPY.cookbooks.emptyTitle}</Text>
                  <Text style={styles.emptyStateText}>{COPY.cookbooks.emptySubtitle}</Text>
                </View>
              )}
            </View>
          ) : activeTab === 'posts' && posts && posts.length > 0 ? (
            viewMode === 'slider' ? (
              /* Posts Card View */
              <View style={styles.postsCardContainer}>
                {posts.map((post) => (
                  <ProfilePostCard
                    key={post._id}
                    recipeTitle={post.recipe?.title ?? 'Unknown Recipe'}
                    recipeImageUrl={post.recipe?.imageUrl}
                    easeRating={post.easeRating}
                    tasteRating={post.tasteRating}
                    presentationRating={post.presentationRating}
                    notes={post.notes}
                    createdAt={post.createdAt}
                    onPress={() => post.recipe && handlePostPress(post.recipe._id)}
                  />
                ))}
              </View>
            ) : (
              /* Posts Grid View */
              <View style={styles.postsGrid}>
                {posts.map((post) => (
                  <View
                    key={post._id}
                    style={[
                      styles.postGridItemWrapper,
                      { width: postsGridItemWidth, height: postsGridItemWidth },
                    ]}
                  >
                    <PostGridItem
                      imageUrl={post.recipe?.imageUrl}
                      title={post.recipe?.title ?? 'Unknown Recipe'}
                      onPress={() => post.recipe && handlePostPress(post.recipe._id)}
                    />
                  </View>
                ))}
              </View>
            )
          ) : activeTab === 'posts' ? (
            <View style={styles.emptyState}>
              <Icon name="grid" size={48} color={Colors.text.tertiary} />
              <Text style={styles.emptyStateTitle}>{COPY.posts.emptyTitle}</Text>
              <Text style={styles.emptyStateText}>{COPY.posts.emptySubtitle}</Text>
            </View>
          ) : null}
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
    paddingBottom: Spacing.xl,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    position: 'relative',
  },
  headerName: {
    ...Typography.h2,
    color: Colors.text.primary,
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl * 2,
  },
  headerSpacer: {
    width: NAV_BUTTON_SIZE,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    zIndex: 1,
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
  headerNavButton: {
    width: NAV_BUTTON_SIZE,
    height: NAV_BUTTON_SIZE,
    borderRadius: NAV_BUTTON_SIZE / 2,
    backgroundColor: Colors.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  // Profile Header
  profileHeader: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  fullName: {
    ...Typography.h3,
    color: Colors.text.primary,
    marginTop: Spacing.sm,
  },
  followButtonContainer: {
    marginTop: Spacing.lg,
  },
  // Tab Bar
  tabBarWrapper: {
    backgroundColor: Colors.background.primary,
  },
  tabBarShadow: {
    height: 12,
  },
  tabBarContainer: {
    flexDirection: 'row',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
  },
  tabUnderlineActive: {
    position: 'absolute',
    bottom: 0,
    width: 60,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.accent,
  },
  // Tab Content
  tabContent: {
    minHeight: 400,
    overflow: 'visible',
  },
  // Cookbooks
  cookbooksContainer: {
    flex: 1,
    overflow: 'visible',
  },
  cookbookCarouselContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: COOKBOOK_CARD_GAP,
  },
  cookbookCarouselCentered: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  cookbookCarouselCard: {
    aspectRatio: 0.58,
    borderRadius: Radius.xl,
    backgroundColor: Colors.background.primary,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  cookbookGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: GRID_GAP,
    overflow: 'visible',
  },
  cookbookGridCard: {
    aspectRatio: 0.65,
    borderRadius: Radius.xl,
    backgroundColor: Colors.background.primary,
    marginBottom: Spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  // Posts
  postsCardContainer: {
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  postGridItemWrapper: {
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxl,
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
