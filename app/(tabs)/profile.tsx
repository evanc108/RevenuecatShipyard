import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Image } from 'expo-image';
import { Icon } from '@/components/ui/Icon';
import { Loading } from '@/components/ui/Loading';
import { api } from '@/convex/_generated/api';
import { Avatar } from '@/components/ui/Avatar';
import { ProfileStats } from '@/components/ui/ProfileStats';
import { CookbookCard } from '@/components/cookbook/CookbookCard';
import { CookbookOptionsSheet } from '@/components/cookbook/CookbookOptionsSheet';
import { CreateCookbookModal } from '@/components/cookbook/CreateCookbookModal';
import { ProfilePostCard } from '@/components/ui/ProfilePostCard';
import { PostGridItem } from '@/components/ui/PostGridItem';
import { SmallProfileCard } from '@/components/ui/SmallProfileCard';
import { ViewModeToggle, ViewMode } from '@/components/ui/ViewModeToggle';
import { Colors, Spacing, Typography, Radius } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import type { Id } from '@/convex/_generated/dataModel';

// Decorative stroke colors for add cookbook card
const STROKE_FILL_PRIMARY = '#EEEEF3';
const STROKE_FILL_SECONDARY = '#F2F2F6';

// Add cookbook icon
const ADD_COOKBOOK_ICON = require('@/assets/images/create-cookbook-icon.png');

const DRAWER_WIDTH = Dimensions.get('window').width * 0.75;
const GRID_COLUMNS = 2;
const GRID_GAP = Spacing.sm;
const POSTS_GRID_COLUMNS = 2;
const POSTS_GRID_GAP = 1; // Thin gap creates border effect

// Profile card carousel constants - 2.5 cards visible for bigger cards
const PROFILE_CARD_GAP = Spacing.sm;
const VISIBLE_CARDS = 2.5;

// Cookbook carousel constants - 2.3 visible for less white space when scrolling
const COOKBOOK_CARD_GAP = Spacing.md;
const VISIBLE_COOKBOOK_CARDS = 2.3;

type ProfileTab = 'cookbooks' | 'posts';

import type { IconName } from '@/components/ui/Icon';

const TABS: { key: ProfileTab; icon: IconName; label: string }[] = [
  { key: 'cookbooks', icon: 'book', label: 'Cookbooks' },
  { key: 'posts', icon: 'grid', label: 'Posts' },
];

function SlideOutDrawer({
  visible,
  onClose,
  onEditProfile,
  onSignOut,
}: {
  visible: boolean;
  onClose: () => void;
  onEditProfile: () => void;
  onSignOut: () => void;
}): React.ReactElement | null {
  const slideAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (shouldRender) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: DRAWER_WIDTH,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShouldRender(false);
      });
    }
  }, [visible]);

  const handleClose = () => {
    onClose();
  };

  if (!shouldRender) return null;

  return (
    <View style={styles.drawerOverlayAbsolute} pointerEvents="box-none">
      <Animated.View
        style={[styles.drawerBackdropAbsolute, { opacity: fadeAnim }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <Pressable style={styles.drawerBackdropPressable} onPress={handleClose} />
      </Animated.View>
      <Animated.View
        style={[styles.drawerContent, { transform: [{ translateX: slideAnim }] }]}
      >
        <SafeAreaView style={styles.drawerSafeArea} edges={['top', 'right']}>
          <View style={styles.drawerHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close menu"
              onPress={handleClose}
              hitSlop={8}
            >
              <Icon name="close" size={28} color={Colors.text.primary} />
            </Pressable>
          </View>

          <View style={styles.drawerItems}>
            <Pressable
              accessibilityRole="button"
              style={styles.drawerItem}
              onPress={() => {
                onClose();
                setTimeout(onEditProfile, 280);
              }}
            >
              <Icon name="user" size={22} color={Colors.text.primary} />
              <Text style={styles.drawerItemText}>Edit Profile</Text>
            </Pressable>

            <View style={styles.drawerDivider} />

            <Pressable
              accessibilityRole="button"
              style={styles.drawerItem}
              onPress={() => {
                onClose();
                setTimeout(onSignOut, 280);
              }}
            >
              <Icon name="log-out" size={22} color={Colors.semantic.error} />
              <Text style={[styles.drawerItemText, { color: Colors.semantic.error }]}>
                Sign Out
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

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
              <View style={styles.tabItemContent}>
                <Icon
                  name={tab.icon}
                  size={20}
                  color={isActive ? Colors.accent : Colors.text.tertiary}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    isActive && styles.tabLabelActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </View>
              <View
                style={[
                  styles.tabUnderline,
                  isActive && styles.tabUnderlineActive,
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function ProfileScreen(): React.ReactElement {
  const { signOut } = useAuth();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const user = useQuery(api.users.current);
  const stats = useQuery(
    api.follows.stats,
    user ? { userId: user._id } : 'skip'
  );
  const posts = useQuery(api.posts.listMine);
  const suggestedUsers = useQuery(api.users.suggested, { limit: 10 });

  // Cookbooks from Convex
  const cookbooks = useQuery(api.cookbooks.list);
  const createCookbookMutation = useMutation(api.cookbooks.create);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('cookbooks');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showSuggestedUsers, setShowSuggestedUsers] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('slider');
  const [dismissedUserIds, setDismissedUserIds] = useState<Set<Id<'users'>>>(new Set());
  const [optionsSheetVisible, setOptionsSheetVisible] = useState(false);
  const [selectedCookbook, setSelectedCookbook] = useState<{ id: Id<'cookbooks'>; name: string } | null>(null);

  // Calculate card widths
  const profileCardWidth = (screenWidth - Spacing.lg * 2 - PROFILE_CARD_GAP * 3) / VISIBLE_CARDS;
  const cookbookCardWidth = (screenWidth - Spacing.lg * 2 - COOKBOOK_CARD_GAP) / VISIBLE_COOKBOOK_CARDS;
  const gridItemWidth = (screenWidth - Spacing.lg * 2 - GRID_GAP) / GRID_COLUMNS;
  const postsGridItemWidth = (screenWidth - POSTS_GRID_GAP * (POSTS_GRID_COLUMNS - 1)) / POSTS_GRID_COLUMNS;

  const handleCreateCookbook = useCallback(
    async (name: string, description?: string, _imageUri?: string) => {
      setIsCreating(true);
      try {
        await createCookbookMutation({
          name,
          description,
        });
        setCreateModalVisible(false);
      } finally {
        setIsCreating(false);
      }
    },
    [createCookbookMutation]
  );

  const handleCookbookPress = useCallback((cookbookId: string) => {
    router.push(`/cookbook/${cookbookId}`);
  }, [router]);

  const handleCookbookOptions = useCallback((cookbookId: Id<'cookbooks'>, cookbookName: string) => {
    setSelectedCookbook({ id: cookbookId, name: cookbookName });
    setOptionsSheetVisible(true);
  }, []);

  const handleEditCookbook = useCallback((cookbookId: Id<'cookbooks'>) => {
    // Navigate to edit screen or open edit modal
    router.push(`/cookbook/${cookbookId}/edit`);
  }, [router]);

  const handlePostPress = useCallback((recipeId: string) => {
    router.push(`/recipe/${recipeId}`);
  }, [router]);

  const handleUserPress = useCallback((userId: Id<'users'>) => {
    router.push(`/user/${userId}`);
  }, [router]);

  const handleDismissUser = useCallback((userId: Id<'users'>) => {
    setDismissedUserIds((prev) => new Set([...prev, userId]));
  }, []);

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === 'slider' ? 'grid' : 'slider'));
  }, []);

  if (user === undefined) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Loading size="large" color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (user === null) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.content}>
          <Text style={styles.errorText}>Unable to load profile</Text>
        </View>
      </SafeAreaView>
    );
  }

  const fullName = `${user.firstName} ${user.lastName}`.trim() || 'User';

  // Skip Clerk's default gradient avatars - only use custom uploaded images
  const isClerkDefaultAvatar = user.imageUrl?.includes('img.clerk.com');
  const avatarUrl = isClerkDefaultAvatar ? null : user.imageUrl;

  // Filter out dismissed users from suggestions
  const filteredSuggestedUsers = suggestedUsers?.filter(
    (u) => !dismissedUserIds.has(u._id)
  ) ?? [];

  // Check if suggested profiles should be centered
  const suggestedCount = filteredSuggestedUsers.length;
  const shouldCenterSuggestedProfiles = suggestedCount <= 3;

  // Check if cookbooks should be centered (for carousel view)
  const cookbookCount = cookbooks?.length ?? 0;
  const shouldCenterCookbooks = cookbookCount <= 1;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerName}>{fullName}</Text>
        <View style={styles.headerActions}>
          <ViewModeToggle
            viewMode={viewMode}
            onToggle={toggleViewMode}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open menu"
            style={styles.settingsButton}
            onPress={() => setDrawerVisible(true)}
            hitSlop={8}
          >
            <Icon name="menu" size={24} color={Colors.text.inverse} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[2]}
      >
        {/* Profile Header Section */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarRow}>
            <Avatar
              imageUrl={avatarUrl}
              firstName={user.firstName || 'U'}
              lastName={user.lastName || 'N'}
              size="xl"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
              style={styles.editButton}
              onPress={() => router.push('/edit-profile')}
            >
              <Icon name="pencil" size={16} color={Colors.text.inverse} />
            </Pressable>
          </View>
          {user.username ? (
            <Text style={styles.username}>@{user.username}</Text>
          ) : null}

          {stats ? (
            <View style={styles.statsRow}>
              {/* Spacer to balance the suggested button on the right */}
              <View style={styles.statsRowSpacer} />

              <ProfileStats
                userId={user._id}
                followerCount={stats.followerCount}
                followingCount={stats.followingCount}
              />

              {/* Suggested Users Toggle Button */}
              {filteredSuggestedUsers.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showSuggestedUsers ? "Hide suggested users" : "Show suggested users"}
                  style={styles.suggestedToggleButton}
                  onPress={() => setShowSuggestedUsers(!showSuggestedUsers)}
                  hitSlop={8}
                >
                  <Icon
                    name="user"
                    size={22}
                    color={Colors.accent}
                    filled={showSuggestedUsers}
                  />
                </Pressable>
              ) : (
                <View style={styles.statsRowSpacer} />
              )}
            </View>
          ) : null}
        </View>

        {/* Suggested Users Section (expandable) */}
        {showSuggestedUsers && filteredSuggestedUsers.length > 0 ? (
          <View style={styles.suggestedSection}>
            <Text style={styles.suggestedTitle}>{COPY.socialFeed.suggestedUsers}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[
                styles.suggestedScrollContent,
                shouldCenterSuggestedProfiles && styles.suggestedScrollCentered,
              ]}
            >
              {filteredSuggestedUsers.map((suggestedUser) => (
                <View
                  key={suggestedUser._id}
                  style={[styles.profileCardWrapper, { width: profileCardWidth }]}
                >
                  <SmallProfileCard
                    user={suggestedUser}
                    onPress={() => handleUserPress(suggestedUser._id)}
                    onDismiss={handleDismissUser}
                    showDismiss
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Sticky Tab Bar */}
        <ProfileTabBar
          activeTab={activeTab}
          onTabPress={setActiveTab}
        />

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'cookbooks' ? (
            <View style={styles.cookbooksContainer}>
              {viewMode === 'slider' ? (
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
                  {cookbooks?.map((cookbook) => (
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
                        onPress={() => handleCookbookPress(cookbook._id)}
                        onMorePress={() => handleCookbookOptions(cookbook._id, cookbook.name)}
                      />
                    </View>
                  ))}

                  {/* Add Cookbook Card */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Create new cookbook"
                    style={[
                      styles.addCookbookCard,
                      { width: cookbookCardWidth },
                    ]}
                    onPress={() => setCreateModalVisible(true)}
                  >
                    {/* Decorative brush stroke */}
                    <Svg
                      style={styles.addCardStroke}
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
                    {/* Cookbook icon - centered */}
                    <Image
                      source={ADD_COOKBOOK_ICON}
                      style={styles.addCardIcon}
                      contentFit="contain"
                    />
                    {/* Plus icon - top right */}
                    <View style={styles.addCardPlusIcon}>
                      <Icon name="plus" size={28} color={Colors.accent} />
                    </View>
                    {/* Title - top left */}
                    <View style={styles.addCardLabel}>
                      <Text style={styles.addCookbookTitle}>{'Add\nCookbook'}</Text>
                    </View>
                  </Pressable>
                </ScrollView>
              ) : (
                /* Cookbook Grid View */
                <View style={styles.cookbookGrid}>
                  {cookbooks?.map((cookbook) => (
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
                        onPress={() => handleCookbookPress(cookbook._id)}
                        onMorePress={() => handleCookbookOptions(cookbook._id, cookbook.name)}
                      />
                    </View>
                  ))}

                  {/* Add Cookbook Card */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Create new cookbook"
                    style={[
                      styles.addCookbookGridCard,
                      { width: gridItemWidth },
                    ]}
                    onPress={() => setCreateModalVisible(true)}
                  >
                    {/* Decorative brush stroke */}
                    <Svg
                      style={styles.addCardStrokeGrid}
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
                    </Svg>
                    {/* Cookbook icon - centered */}
                    <Image
                      source={ADD_COOKBOOK_ICON}
                      style={styles.addCardIconGrid}
                      contentFit="contain"
                    />
                    {/* Plus icon - top right */}
                    <View style={styles.addCardPlusIconGrid}>
                      <Icon name="plus" size={26} color={Colors.accent} />
                    </View>
                    {/* Title - top left */}
                    <View style={styles.addCardLabelGrid}>
                      <Text style={styles.addCookbookTitleGrid}>{'Add\nCookbook'}</Text>
                    </View>
                  </Pressable>
                </View>
              )}

              {/* Empty state hint - only show when no cookbooks */}
              {cookbookCount === 0 && (
                <View style={styles.emptyHint}>
                  <Text style={styles.emptyHintText}>
                    {COPY.cookbooks.emptySubtitle}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.postsContainer}>
              {posts && posts.length > 0 ? (
                <>
                  {viewMode === 'slider' ? (
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
                      {posts.map((post, index) => (
                        <View
                          key={post._id}
                          style={[
                            styles.postGridItemWrapper,
                            { width: postsGridItemWidth, height: postsGridItemWidth },
                            // Add right border except for last in row
                            index % POSTS_GRID_COLUMNS !== POSTS_GRID_COLUMNS - 1 && styles.postGridItemBorderRight,
                            // Add bottom border for all except last row
                            index < posts.length - POSTS_GRID_COLUMNS && styles.postGridItemBorderBottom,
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
                  )}
                </>
              ) : (
                <View style={styles.emptyState}>
                  <Icon name="grid" size={48} color={Colors.text.tertiary} />
                  <Text style={styles.emptyStateTitle}>{COPY.posts.emptyTitle}</Text>
                  <Text style={styles.emptyStateText}>
                    {COPY.posts.emptySubtitle}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <SlideOutDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        onEditProfile={() => router.push('/edit-profile')}
        onSignOut={() => signOut()}
      />

      <CreateCookbookModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSubmit={handleCreateCookbook}
        isLoading={isCreating}
      />

      <CookbookOptionsSheet
        visible={optionsSheetVisible}
        cookbookId={selectedCookbook?.id ?? null}
        cookbookName={selectedCookbook?.name ?? ''}
        onClose={() => {
          setOptionsSheetVisible(false);
          setSelectedCookbook(null);
        }}
        onEdit={handleEditCookbook}
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
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  errorText: {
    ...Typography.body,
    color: Colors.text.secondary,
    marginTop: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerName: {
    ...Typography.h2,
    color: Colors.text.primary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  avatarRow: {
    position: 'relative',
  },
  editButton: {
    position: 'absolute',
    right: -8,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: {
    ...Typography.body,
    color: Colors.text.secondary,
    marginTop: Spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    width: '100%',
  },
  statsRowSpacer: {
    width: 36,
  },
  suggestedToggleButton: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
  },
  // Suggested Users Section
  suggestedSection: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  suggestedTitle: {
    ...Typography.label,
    color: Colors.text.secondary,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  suggestedScrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: PROFILE_CARD_GAP,
  },
  suggestedScrollCentered: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  profileCardWrapper: {
    height: 220,
    paddingVertical: Spacing.sm,
  },
  // Drawer styles
  drawerOverlayAbsolute: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 1000,
  },
  drawerBackdropAbsolute: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  drawerBackdropPressable: {
    flex: 1,
  },
  drawerContent: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: Colors.background.primary,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  drawerSafeArea: {
    flex: 1,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  drawerItems: {
    paddingHorizontal: Spacing.lg,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  drawerItemText: {
    ...Typography.body,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  drawerDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  // Tab Bar styles
  tabBarWrapper: {
    backgroundColor: Colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  tabBarContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.md,
  },
  tabItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingBottom: Spacing.md,
  },
  tabLabel: {
    ...Typography.label,
    color: Colors.text.tertiary,
  },
  tabLabelActive: {
    color: Colors.accent,
  },
  tabUnderline: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'transparent',
  },
  tabUnderlineActive: {
    backgroundColor: Colors.accent,
  },
  // Tab Content styles
  tabContent: {
    minHeight: 400,
  },
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
  // Cookbook styles
  cookbooksContainer: {
    flex: 1,
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
    aspectRatio: 0.65,
    borderRadius: Radius.xl,
    backgroundColor: Colors.background.primary,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  addCookbookCard: {
    aspectRatio: 0.65,
    borderRadius: Radius.xl,
    backgroundColor: Colors.background.primary,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  addCardStroke: {
    position: 'absolute',
    width: '92%',
    height: '65%',
    top: '15%',
    left: '4%',
  },
  addCardIcon: {
    position: 'absolute',
    width: 100,
    height: 100,
    top: '32%',
    left: '50%',
    marginLeft: -50,
    zIndex: 1,
  },
  addCardPlusIcon: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    zIndex: 1,
  },
  addCardLabel: {
    position: 'absolute',
    top: Spacing.lg,
    left: Spacing.md,
    zIndex: 1,
  },
  addCookbookTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  cookbookGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: GRID_GAP,
  },
  cookbookGridCard: {
    aspectRatio: 1,
    borderRadius: Radius.xl,
    backgroundColor: Colors.background.primary,
    marginBottom: Spacing.sm,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  addCookbookGridCard: {
    aspectRatio: 1,
    borderRadius: Radius.xl,
    backgroundColor: Colors.background.primary,
    marginBottom: Spacing.sm,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  addCardStrokeGrid: {
    position: 'absolute',
    width: '85%',
    height: '50%',
    top: '40%',
    left: '7.5%',
  },
  addCardIconGrid: {
    position: 'absolute',
    width: 88,
    height: 88,
    top: '52%',
    left: '50%',
    marginLeft: -44,
    zIndex: 1,
  },
  addCardPlusIconGrid: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    zIndex: 1,
  },
  addCardLabelGrid: {
    position: 'absolute',
    top: Spacing.lg,
    left: Spacing.lg,
    zIndex: 1,
  },
  addCookbookTitleGrid: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  emptyHint: {
    marginTop: Spacing.lg,
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  emptyHintText: {
    ...Typography.bodySmall,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
  // Posts styles
  postsContainer: {
    flex: 1,
  },
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
  },
  postGridItemBorderRight: {
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  postGridItemBorderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
});
