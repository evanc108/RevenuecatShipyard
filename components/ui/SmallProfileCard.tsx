import { memo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { api } from '@/convex/_generated/api';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import type { Doc, Id } from '@/convex/_generated/dataModel';

type SmallProfileCardProps = {
  user: Doc<'users'>;
  onPress: () => void;
  onDismiss?: (userId: Id<'users'>) => void;
  showDismiss?: boolean;
};

export const SmallProfileCard = memo(function SmallProfileCard({
  user,
  onPress,
  onDismiss,
  showDismiss = false,
}: SmallProfileCardProps): React.ReactElement {
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

  const handleDismiss = useCallback(() => {
    onDismiss?.(user._id);
  }, [onDismiss, user._id]);

  return (
    <View style={styles.cardContainer}>
      {/* Dismiss button */}
      {showDismiss && onDismiss ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Dismiss ${fullName} suggestion`}
          style={styles.dismissButton}
          onPress={handleDismiss}
          hitSlop={8}
        >
          <Icon name="close" size={18} color={Colors.accent} />
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${fullName}'s profile`}
        style={styles.card}
        onPress={onPress}
      >
        <Avatar
          imageUrl={avatarUrl}
          firstName={user.firstName || 'U'}
          lastName={user.lastName || 'N'}
          size="lg"
        />
        <View style={styles.nameContainer}>
          <Text style={styles.fullName} numberOfLines={1}>
            {fullName}
          </Text>
          {hasUsername ? (
            <Text style={styles.username} numberOfLines={1}>
              @{user.username}
            </Text>
          ) : null}
        </View>
      </Pressable>

      {/* Follow button */}
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
          <Text style={[styles.followText, isFollowing && styles.followingText]}>
            {isFollowing ? COPY.profile.following_button : COPY.profile.follow}
          </Text>
        )}
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  cardContainer: {
    flex: 1,
    position: 'relative',
  },
  card: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl + Spacing.md,
    paddingHorizontal: Spacing.sm,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  nameContainer: {
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: 2,
  },
  fullName: {
    ...Typography.label,
    fontWeight: '700',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  username: {
    ...Typography.caption,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  dismissButton: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    zIndex: 10,
    padding: Spacing.sm,
  },
  followButton: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: Spacing.sm,
    right: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 28,
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  followText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.text.inverse,
  },
  followingText: {
    color: Colors.text.secondary,
  },
});
