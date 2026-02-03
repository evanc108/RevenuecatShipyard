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

export default function ProfileScreen(): React.ReactElement {
  const { signOut } = useAuth();
  const router = useRouter();
  const user = useQuery(api.users.current);
  const stats = useQuery(
    api.follows.stats,
    user ? { userId: user._id } : 'skip'
  );
  const [drawerVisible, setDrawerVisible] = useState(false);

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
});
