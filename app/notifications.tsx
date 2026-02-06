import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { Loading } from '@/components/ui/Loading';
import { Colors, NAV_BUTTON_SIZE, Spacing, Typography } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';

type FollowerWithTimestamp = {
  _id: Id<'users'>;
  firstName: string;
  lastName: string;
  username: string;
  imageUrl?: string;
  followedAt: number;
};

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (weeks > 0) return `${weeks}w ago`;
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

const FollowerCard = memo(function FollowerCard({
  follower,
  onPress,
}: {
  follower: FollowerWithTimestamp;
  onPress: () => void;
}) {
  const fullName = `${follower.firstName} ${follower.lastName}`.trim();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${fullName}'s profile`}
      style={styles.followerCard}
      onPress={onPress}
    >
      <Avatar
        size="md"
        imageUrl={follower.imageUrl}
        firstName={follower.firstName}
        lastName={follower.lastName}
      />
      <View style={styles.followerInfo}>
        <Text style={styles.followerName}>{fullName}</Text>
        <Text style={styles.followerAction}>
          started following you
        </Text>
      </View>
      <Text style={styles.timeAgo}>{formatTimeAgo(follower.followedAt)}</Text>
    </Pressable>
  );
});

export default function NotificationsScreen() {
  const router = useRouter();
  const recentFollowers = useQuery(api.follows.getRecentFollowers, { limit: 50 });

  const handleFollowerPress = useCallback(
    (userId: Id<'users'>) => {
      router.push(`/user/${userId}`);
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: FollowerWithTimestamp }) => (
      <FollowerCard
        follower={item}
        onPress={() => handleFollowerPress(item._id)}
      />
    ),
    [handleFollowerPress]
  );

  const keyExtractor = useCallback(
    (item: FollowerWithTimestamp) => item._id,
    []
  );

  const isLoading = recentFollowers === undefined;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Icon
            name="arrow-back"
            size={20}
            color={Colors.text.inverse}
            strokeWidth={2}
          />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Loading size="large" color={Colors.accent} />
        </View>
      ) : recentFollowers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="bell" size={64} color={Colors.text.tertiary} />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySubtitle}>
            When someone follows you, you'll see it here
          </Text>
        </View>
      ) : (
        <FlashList<FollowerWithTimestamp>
          data={recentFollowers}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  backButton: {
    width: NAV_BUTTON_SIZE,
    height: NAV_BUTTON_SIZE,
    borderRadius: NAV_BUTTON_SIZE / 2,
    backgroundColor: Colors.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    ...Typography.h2,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  headerSpacer: {
    width: NAV_BUTTON_SIZE,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
    marginTop: Spacing.lg,
  },
  emptySubtitle: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  followerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  followerInfo: {
    flex: 1,
  },
  followerName: {
    ...Typography.label,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  followerAction: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  timeAgo: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
});
