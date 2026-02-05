import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { Icon } from '@/components/ui/Icon';
import { Loading } from '@/components/ui/Loading';
import { api } from '@/convex/_generated/api';
import { Avatar } from '@/components/ui/Avatar';
import { ProfileStats } from '@/components/ui/ProfileStats';
import { CookbookCard } from '@/components/cookbook/CookbookCard';
import { CreateCookbookModal } from '@/components/cookbook/CreateCookbookModal';
import { PostRow } from '@/components/ui/PostRow';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { COPY } from '@/constants/copy';

const DRAWER_WIDTH = Dimensions.get('window').width * 0.75;

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

// Mock cookbook data - will be replaced with Convex query
type Cookbook = {
  _id: string;
  name: string;
  description?: string | null;
  recipeCount: number;
  coverImageUrl?: string | null;
};

export default function ProfileScreen(): React.ReactElement {
  const { signOut } = useAuth();
  const router = useRouter();
  const user = useQuery(api.users.current);
  const stats = useQuery(
    api.follows.stats,
    user ? { userId: user._id } : 'skip'
  );
  const posts = useQuery(api.posts.listMine);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('cookbooks');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Mock cookbooks - replace with: useQuery(api.cookbooks.list)
  const [cookbooks, setCookbooks] = useState<Cookbook[]>([]);

  const handleCreateCookbook = useCallback(
    async (name: string, description?: string, imageUri?: string) => {
      setIsCreating(true);
      try {
        // TODO: Replace with actual Convex mutation
        // await createCookbook({ name, description, imageUri });

        // Mock creation for now
        const newCookbook: Cookbook = {
          _id: `cookbook-${Date.now()}`,
          name,
          description,
          recipeCount: 0,
          coverImageUrl: imageUri ?? null,
        };
        setCookbooks((prev) => [newCookbook, ...prev]);
        setCreateModalVisible(false);
      } finally {
        setIsCreating(false);
      }
    },
    []
  );

  const handleCookbookPress = useCallback((cookbook: Cookbook) => {
    // TODO: Navigate to cookbook detail screen
    // router.push(`/cookbook/${cookbook._id}`);
  }, []);

  const handleEditCookbook = useCallback((cookbook: Cookbook) => {
    // TODO: Open edit modal or navigate to edit screen
    // router.push(`/cookbook/${cookbook._id}/edit`);
  }, []);

  const handleDeleteCookbook = useCallback((cookbook: Cookbook) => {
    // TODO: Show confirmation dialog and delete
    setCookbooks((prev) => prev.filter((c) => c._id !== cookbook._id));
  }, []);

  const handlePostPress = useCallback((recipeId: string) => {
    router.push(`/recipe/${recipeId}`);
  }, [router]);

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerName}>{fullName}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          onPress={() => setDrawerVisible(true)}
          hitSlop={8}
        >
          <Icon name="menu" size={28} color={Colors.text.primary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
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
            <View style={styles.statsContainer}>
              <ProfileStats
                userId={user._id}
                followerCount={stats.followerCount}
                followingCount={stats.followingCount}
              />
            </View>
          ) : null}
        </View>

        {/* Sticky Tab Bar */}
        <ProfileTabBar activeTab={activeTab} onTabPress={setActiveTab} />

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'cookbooks' ? (
            <View style={styles.cookbooksContainer}>
              {/* Cookbook Grid */}
              <View style={styles.cookbookGrid}>
                {/* Existing cookbooks */}
                {cookbooks.map((cookbook) => (
                  <CookbookCard
                    key={cookbook._id}
                    name={cookbook.name}
                    description={cookbook.description}
                    recipeCount={cookbook.recipeCount}
                    coverImageUrl={cookbook.coverImageUrl}
                    onPress={() => handleCookbookPress(cookbook)}
                  />
                ))}
              </View>

              {/* Empty state hint - only show when no cookbooks */}
              {cookbooks.length === 0 && (
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
                posts.map((post) => (
                  <PostRow
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
                ))
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
  statsContainer: {
    marginTop: Spacing.sm,
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
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
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
  // Cookbook grid styles
  cookbooksContainer: {
    flex: 1,
    alignItems: 'center',
  },
  cookbookGrid: {
    width: '100%',
    gap: Spacing.md,
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
  postsContainer: {
    flex: 1,
    marginHorizontal: -Spacing.md,
  },
});
