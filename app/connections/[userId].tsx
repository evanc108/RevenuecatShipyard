import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  FlatList,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/convex/_generated/api';
import { UserListItem } from '@/components/ui/UserListItem';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import { formatCount } from '@/utils/format';
import type { Id, Doc } from '@/convex/_generated/dataModel';

type Tab = 'followers' | 'following';

export default function ConnectionsScreen(): React.ReactElement {
  const { userId, tab: initialTab } = useLocalSearchParams<{
    userId: string;
    tab?: string;
  }>();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState<Tab>(
    initialTab === 'following' ? 'following' : 'followers'
  );

  const user = useQuery(
    api.users.getById,
    userId ? { userId: userId as Id<'users'> } : 'skip'
  );

  const stats = useQuery(
    api.follows.stats,
    userId ? { userId: userId as Id<'users'> } : 'skip'
  );

  const followers = useQuery(
    api.follows.listFollowers,
    userId ? { userId: userId as Id<'users'> } : 'skip'
  );

  const following = useQuery(
    api.follows.listFollowing,
    userId ? { userId: userId as Id<'users'> } : 'skip'
  );

  const renderItem = useCallback(
    ({ item }: { item: Doc<'users'> }) => <UserListItem user={item} />,
    []
  );

  const keyExtractor = useCallback((item: Doc<'users'>) => item._id, []);

  const isLoading = user === undefined || stats === undefined;
  const activeData = activeTab === 'followers' ? followers : following;
  const isListLoading = activeData === undefined;

  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim() || user.username || 'User'
    : '';

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            hitSlop={8}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Loading...
            </Text>
          </View>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const tabWidth = width / 2;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {displayName}
          </Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.tabBar}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'following' }}
          onPress={() => setActiveTab('following')}
          style={[styles.tab, { width: tabWidth }]}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'following' && styles.tabTextActive,
            ]}
          >
            {formatCount(stats?.followingCount ?? 0)} {COPY.profile.following}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'followers' }}
          onPress={() => setActiveTab('followers')}
          style={[styles.tab, { width: tabWidth }]}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'followers' && styles.tabTextActive,
            ]}
          >
            {formatCount(stats?.followerCount ?? 0)} {COPY.profile.followers}
          </Text>
        </Pressable>

        <View
          style={[
            styles.tabIndicator,
            {
              width: tabWidth,
              transform: [
                { translateX: activeTab === 'following' ? 0 : tabWidth },
              ],
            },
          ]}
        />
      </View>

      {isListLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : activeData.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {activeTab === 'followers'
              ? COPY.profile.noFollowers
              : COPY.profile.noFollowing}
          </Text>
        </View>
      ) : (
        <FlatList
          data={activeData}
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
  },
  headerTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
  },
  headerRight: {
    width: 32,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    position: 'relative',
  },
  tab: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    ...Typography.body,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: Colors.text.primary,
    fontWeight: '600',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    backgroundColor: Colors.accent,
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
    paddingHorizontal: Spacing.lg,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.text.secondary,
  },
  listContent: {
    paddingVertical: Spacing.sm,
  },
});
