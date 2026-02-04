import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { Icon } from '@/components/ui/Icon';
import { api } from '@/convex/_generated/api';
import { Avatar } from '@/components/ui/Avatar';
import { ProfileStats } from '@/components/ui/ProfileStats';
import { FollowButton } from '@/components/ui/FollowButton';
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

  const isLoading = user === undefined || stats === undefined || isFollowing === undefined;
  const isCurrentUser = currentUser?._id === userId;

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
      </ScrollView>
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
});
