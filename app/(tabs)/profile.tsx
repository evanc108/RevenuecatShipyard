import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/convex/_generated/api';
import { Avatar } from '@/components/ui/Avatar';
import { ProfileStats } from '@/components/ui/ProfileStats';
import { Colors, Spacing, Typography } from '@/constants/theme';

const DRAWER_WIDTH = Dimensions.get('window').width * 0.75;

type ProfileTab = 'cookbooks' | 'posts';

const TABS: { key: ProfileTab; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { key: 'cookbooks', icon: 'book-outline', label: 'Cookbooks' },
  { key: 'posts', icon: 'grid-outline', label: 'Posts' },
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
              <Ionicons name="close" size={28} color={Colors.text.primary} />
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
              <Ionicons name="person-outline" size={22} color={Colors.text.primary} />
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
              <Ionicons name="log-out-outline" size={22} color={Colors.semantic.error} />
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
                <Ionicons
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
  const user = useQuery(api.users.current);
  const stats = useQuery(
    api.follows.stats,
    user ? { userId: user._id } : 'skip'
  );
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('cookbooks');

  if (user === undefined) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
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
          <Ionicons name="menu" size={28} color={Colors.text.primary} />
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
              <Ionicons name="pencil" size={16} color={Colors.text.inverse} />
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
            <View style={styles.emptyState}>
              <Ionicons name="book-outline" size={48} color={Colors.text.tertiary} />
              <Text style={styles.emptyStateTitle}>No Cookbooks Yet</Text>
              <Text style={styles.emptyStateText}>
                Your saved cookbook collections will appear here
              </Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="grid-outline" size={48} color={Colors.text.tertiary} />
              <Text style={styles.emptyStateTitle}>No Posts Yet</Text>
              <Text style={styles.emptyStateText}>
                Share your first recipe to see it here
              </Text>
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
    paddingTop: Spacing.xl,
    paddingHorizontal: Spacing.lg,
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
});
