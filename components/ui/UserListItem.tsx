import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Avatar } from '@/components/ui/Avatar';
import { FollowButton } from '@/components/ui/FollowButton';
import { Colors, Spacing, Typography } from '@/constants/theme';
import type { Doc } from '@/convex/_generated/dataModel';

type UserListItemProps = {
  user: Doc<'users'>;
  showFollowButton?: boolean;
};

export function UserListItem({
  user,
  showFollowButton = true,
}: UserListItemProps): React.ReactElement {
  const router = useRouter();
  const currentUser = useQuery(api.users.current);
  const isFollowing = useQuery(api.follows.isFollowing, { userId: user._id });

  const isCurrentUser = currentUser?._id === user._id;
  const fullName = `${user.firstName} ${user.lastName}`.trim() || 'User';

  // Skip Clerk's default gradient avatars
  const isClerkDefaultAvatar = user.imageUrl?.includes('img.clerk.com');
  const avatarUrl = isClerkDefaultAvatar ? null : user.imageUrl;

  const handlePress = () => {
    if (isCurrentUser) {
      router.push('/(tabs)/profile');
    } else {
      router.push(`/user/${user._id}`);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${fullName}'s profile`}
      onPress={handlePress}
      style={styles.container}
    >
      <Avatar
        imageUrl={avatarUrl}
        firstName={user.firstName || 'U'}
        lastName={user.lastName || 'N'}
        size="md"
      />

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {user.username ? user.username : fullName}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {user.username ? fullName : ''}
        </Text>
      </View>

      {showFollowButton && !isCurrentUser && isFollowing !== undefined ? (
        <FollowButton userId={user._id} initialIsFollowing={isFollowing} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 2,
  },
});
