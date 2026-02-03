import { useState, useCallback } from 'react';
import { Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import type { Id } from '@/convex/_generated/dataModel';

type FollowButtonProps = {
  userId: Id<'users'>;
  initialIsFollowing: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
};

export function FollowButton({
  userId,
  initialIsFollowing,
  onFollowChange,
}: FollowButtonProps): React.ReactElement {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isLoading, setIsLoading] = useState(false);

  const followMutation = useMutation(api.follows.follow);
  const unfollowMutation = useMutation(api.follows.unfollow);

  const handlePress = useCallback(async () => {
    if (isLoading) return;

    const newFollowingState = !isFollowing;

    // Optimistic update
    setIsFollowing(newFollowingState);
    setIsLoading(true);

    try {
      if (newFollowingState) {
        await followMutation({ followingId: userId });
      } else {
        await unfollowMutation({ followingId: userId });
      }
      onFollowChange?.(newFollowingState);
    } catch {
      // Rollback on error
      setIsFollowing(!newFollowingState);
    } finally {
      setIsLoading(false);
    }
  }, [isFollowing, isLoading, userId, followMutation, unfollowMutation, onFollowChange]);

  const buttonStyle = isFollowing ? styles.followingButton : styles.followButton;
  const textStyle = isFollowing ? styles.followingText : styles.followText;
  const label = isFollowing ? COPY.profile.following_button : COPY.profile.follow;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isFollowing ? 'Unfollow' : 'Follow'}
      onPress={handlePress}
      style={[styles.button, buttonStyle]}
      disabled={isLoading}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={isFollowing ? Colors.text.secondary : Colors.text.inverse}
        />
      ) : (
        <Text style={[styles.text, textStyle]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 88,
    minHeight: 32,
  },
  followButton: {
    backgroundColor: Colors.accent,
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
  },
  followText: {
    color: Colors.text.inverse,
  },
  followingText: {
    color: Colors.text.secondary,
  },
});
