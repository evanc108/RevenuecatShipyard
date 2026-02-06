import { memo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation } from 'convex/react';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { CommentSection } from '@/components/ui/CommentSection';
import { Colors, Spacing, Typography, Radius } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

type RecipeInfo = {
  _id: Id<'recipes'>;
  title: string;
  imageUrl?: string;
  totalTimeMinutes?: number;
  url: string;
};

type FeedPostProps = {
  postId: Id<'posts'>;
  user: {
    _id: Id<'users'>;
    firstName: string;
    lastName: string;
    username: string;
    imageUrl?: string;
  };
  recipe: RecipeInfo;
  easeRating: number;
  tasteRating: number;
  presentationRating: number;
  notes?: string;
  createdAt: number;
  likeCount?: number;
  commentCount?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  currentUserId?: Id<'users'>;
  onBookmarkPress?: (recipe: RecipeInfo) => void;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_WIDTH = SCREEN_WIDTH - Spacing.md * 2;
const IMAGE_HEIGHT = IMAGE_WIDTH * 0.65; // 16:10 aspect ratio - shorter

const PASTEL_FALLBACKS: readonly string[] = [
  '#FFE8D6',
  '#D6E8FF',
  '#E0D6FF',
  '#D6FFE8',
  '#FFF5D6',
  '#FFD6E0',
] as const;

function getPastelForTitle(title: string): string {
  const hash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return PASTEL_FALLBACKS[hash % PASTEL_FALLBACKS.length] ?? PASTEL_FALLBACKS[0];
}

function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  return `${Math.floor(days / 30)}mo`;
}

export const FeedPost = memo(function FeedPost({
  postId,
  user,
  recipe,
  easeRating,
  tasteRating,
  presentationRating,
  notes,
  createdAt,
  likeCount: initialLikeCount = 0,
  commentCount: initialCommentCount = 0,
  isLiked: initialIsLiked = false,
  isSaved: initialIsSaved = false,
  currentUserId,
  onBookmarkPress,
}: FeedPostProps): React.ReactElement {
  const router = useRouter();
  const fallbackBg = getPastelForTitle(recipe.title);

  // Optimistic state for likes and saves
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isSaved, setIsSaved] = useState(initialIsSaved);
  const [showComments, setShowComments] = useState(false);
  const commentCount = initialCommentCount;

  const toggleLike = useMutation(api.postLikes.toggle);
  const toggleSave = useMutation(api.savedPosts.toggle);

  // Skip Clerk's default gradient avatars
  const isClerkDefaultAvatar = user.imageUrl?.includes('img.clerk.com');
  const avatarUrl = isClerkDefaultAvatar ? undefined : user.imageUrl;

  const fullName = `${user.firstName} ${user.lastName}`.trim() || 'User';
  const displayName = user.username || fullName;

  const handleUserPress = () => {
    router.push(`/user/${user._id}`);
  };

  const handleRecipePress = () => {
    router.push(`/recipe/${recipe._id}`);
  };

  const handleLikePress = useCallback(async () => {
    // Optimistic update
    setIsLiked((prev) => !prev);
    setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1));

    try {
      await toggleLike({ postId });
    } catch {
      // Revert on error
      setIsLiked(isLiked);
      setLikeCount(likeCount);
    }
  }, [postId, isLiked, likeCount, toggleLike]);

  const handleSavePress = useCallback(async () => {
    // If already saved, unsave regardless of whether onBookmarkPress is provided
    if (isSaved) {
      setIsSaved(false);
      try {
        await toggleSave({ postId });
      } catch {
        // Revert on error
        setIsSaved(true);
      }
      return;
    }

    // If onBookmarkPress is provided and NOT saved, use it to show the cookbook modal
    if (onBookmarkPress) {
      onBookmarkPress(recipe);
      return;
    }

    // Otherwise, use the default save toggle
    setIsSaved(true);

    try {
      await toggleSave({ postId });
    } catch {
      // Revert on error
      setIsSaved(false);
    }
  }, [postId, isSaved, toggleSave, onBookmarkPress, recipe]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${displayName}'s profile`}
          style={styles.headerLeft}
          onPress={handleUserPress}
        >
          <Avatar
            imageUrl={avatarUrl}
            firstName={user.firstName || 'U'}
            lastName={user.lastName || 'N'}
            size="md"
          />
          <View>
            <Text style={styles.username}>{displayName}</Text>
            <Text style={styles.timestamp}>{formatRelativeDate(createdAt)}</Text>
          </View>
        </Pressable>
      </View>

      {/* Caption - "<user> made <recipe>" */}
      <View style={styles.captionContainer}>
        <Text style={styles.caption}>
          <Text style={styles.captionBold} onPress={handleUserPress}>
            {displayName}
          </Text>
          {' made '}
          <Text style={styles.captionBold} onPress={handleRecipePress}>
            {recipe.title}
          </Text>
        </Text>
      </View>

      {/* Image */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${recipe.title} recipe`}
        onPress={handleRecipePress}
      >
        <View
          style={[
            styles.imageContainer,
            !recipe.imageUrl && { backgroundColor: fallbackBg },
          ]}
        >
          {recipe.imageUrl ? (
            <Image
              source={{ uri: recipe.imageUrl }}
              style={styles.image}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons
                name="restaurant-outline"
                size={48}
                color={Colors.text.tertiary}
              />
            </View>
          )}
        </View>
      </Pressable>

      {/* Notes */}
      {notes ? (
        <Text style={styles.notes} numberOfLines={3}>
          "{notes}"
        </Text>
      ) : null}

      {/* Ratings */}
      <Text style={styles.ratings}>
        ease {easeRating} · taste {tasteRating} · look {presentationRating}
        {recipe.totalTimeMinutes ? ` · ${recipe.totalTimeMinutes} min` : ''}
      </Text>

      {/* Footer: Like + Comment + Bookmark */}
      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isLiked ? 'Unlike' : 'Like'}
          style={styles.footerAction}
          onPress={handleLikePress}
        >
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={24}
            color={isLiked ? Colors.accent : '#000000'}
          />
          {likeCount > 0 && (
            <Text
              style={[
                styles.footerCount,
                isLiked && { color: Colors.accent },
              ]}
            >
              {likeCount}
            </Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View comments"
          style={styles.footerAction}
          onPress={() => setShowComments(true)}
        >
          <Ionicons
            name="chatbubble-outline"
            size={22}
            color="#000000"
          />
          {commentCount > 0 && (
            <Text style={styles.footerCount}>{commentCount}</Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isSaved ? 'Unsave post' : 'Save to cookbook'}
          style={styles.footerAction}
          onPress={handleSavePress}
        >
          <Ionicons
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={24}
            color={isSaved ? Colors.accent : '#000000'}
          />
        </Pressable>
      </View>

      {/* Comments Modal */}
      <CommentSection
        visible={showComments}
        postId={postId}
        onClose={() => {
          setShowComments(false);
          // Refresh comment count would happen via Convex reactivity
        }}
        currentUserId={currentUserId}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background.primary,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  username: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700' as const,
    color: '#000000',
  },
  timestamp: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400' as const,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  captionContainer: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  caption: {
    ...Typography.body,
    color: Colors.text.primary,
  },
  captionBold: {
    fontFamily: 'Lora_700Bold',
    fontWeight: '700',
  },
  imageContainer: {
    marginHorizontal: Spacing.md,
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notes: {
    ...Typography.body,
    color: Colors.text.secondary,
    fontStyle: 'italic',
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  ratings: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  footerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    minWidth: 44,
  },
  footerCount: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600' as const,
    color: '#000000',
  },
});
