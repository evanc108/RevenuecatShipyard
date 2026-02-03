import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import { formatCount } from '@/utils/format';
import type { Id } from '@/convex/_generated/dataModel';

type ProfileStatsProps = {
  userId: Id<'users'>;
  followerCount: number;
  followingCount: number;
};

export function ProfileStats({
  userId,
  followerCount,
  followingCount,
}: ProfileStatsProps): React.ReactElement {
  const router = useRouter();

  const handleFollowersPress = () => {
    router.push(`/connections/${userId}?tab=followers`);
  };

  const handleFollowingPress = () => {
    router.push(`/connections/${userId}?tab=following`);
  };

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${followerCount} ${COPY.profile.followers}`}
        onPress={handleFollowersPress}
        style={styles.stat}
      >
        <Text style={styles.count}>{formatCount(followerCount)}</Text>
        <Text style={styles.label}>{COPY.profile.followers}</Text>
      </Pressable>

      <View style={styles.divider} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${followingCount} ${COPY.profile.following}`}
        onPress={handleFollowingPress}
        style={styles.stat}
      >
        <Text style={styles.count}>{formatCount(followingCount)}</Text>
        <Text style={styles.label}>{COPY.profile.following}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  stat: {
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  count: {
    ...Typography.h3,
    color: Colors.text.primary,
  },
  label: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border,
  },
});
