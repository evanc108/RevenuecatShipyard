import { memo, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQuery } from 'convex/react';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { Colors, Spacing, Typography, Radius } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_HEIGHT = SCREEN_HEIGHT * (2 / 3);

type CommentUser = {
  _id: Id<'users'>;
  firstName: string;
  lastName: string;
  username: string;
  imageUrl?: string;
};

type Comment = {
  _id: Id<'postComments'>;
  text: string;
  createdAt: number;
  user: CommentUser;
};

type CommentSectionProps = {
  visible: boolean;
  postId: Id<'posts'>;
  onClose: () => void;
  currentUserId?: Id<'users'>;
};

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

const CommentItem = memo(function CommentItem({
  comment,
  isOwn,
  onDelete,
}: {
  comment: Comment;
  isOwn: boolean;
  onDelete: (commentId: Id<'postComments'>) => void;
}) {
  const isClerkDefaultAvatar = comment.user.imageUrl?.includes('img.clerk.com');
  const avatarUrl = isClerkDefaultAvatar ? undefined : comment.user.imageUrl;

  const handleLongPress = useCallback(() => {
    if (isOwn) {
      Alert.alert(COPY.comments.deleteConfirm, undefined, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: COPY.comments.delete,
          style: 'destructive',
          onPress: () => onDelete(comment._id),
        },
      ]);
    }
  }, [isOwn, comment._id, onDelete]);

  return (
    <Pressable onLongPress={handleLongPress} style={styles.commentItem}>
      <Avatar
        imageUrl={avatarUrl}
        firstName={comment.user.firstName || 'U'}
        lastName={comment.user.lastName || 'N'}
        size="sm"
      />
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentUsername}>{comment.user.username}</Text>
          <Text style={styles.commentTime}>
            {formatRelativeDate(comment.createdAt)}
          </Text>
        </View>
        <Text style={styles.commentText}>{comment.text}</Text>
      </View>
    </Pressable>
  );
});

export const CommentSection = memo(function CommentSection({
  visible,
  postId,
  onClose,
  currentUserId,
}: CommentSectionProps) {
  const [commentText, setCommentText] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  const commentsData = useQuery(
    api.postComments.list,
    visible ? { postId } : 'skip'
  );
  const addComment = useMutation(api.postComments.add);
  const removeComment = useMutation(api.postComments.remove);

  // Filter out comments with deleted users and ensure type safety
  const comments: Comment[] = useMemo(() => {
    if (!commentsData) return [];
    return commentsData.filter((c) => c.user !== null) as Comment[];
  }, [commentsData]);

  const handlePost = useCallback(async () => {
    const trimmed = commentText.trim();
    if (trimmed.length === 0) return;

    setIsPosting(true);
    try {
      await addComment({ postId, text: trimmed });
      setCommentText('');
    } catch (err) {
      console.error('Failed to post comment:', err);
      Alert.alert(COPY.comments.errors.failed);
    } finally {
      setIsPosting(false);
    }
  }, [commentText, postId, addComment]);

  const handleDelete = useCallback(
    async (commentId: Id<'postComments'>) => {
      try {
        await removeComment({ commentId });
      } catch (err) {
        console.error('Failed to delete comment:', err);
      }
    },
    [removeComment]
  );

  const renderComment = useCallback(
    ({ item }: { item: Comment }) => (
      <CommentItem
        comment={item}
        isOwn={currentUserId === item.user._id}
        onDelete={handleDelete}
      />
    ),
    [currentUserId, handleDelete]
  );

  const keyExtractor = useCallback(
    (item: Comment) => item._id,
    []
  );

  const ListEmptyComponent = useCallback(() => {
    if (commentsData === undefined) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="small" color={Colors.accent} />
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Icon name="message-circle" size={48} color={Colors.text.tertiary} />
        <Text style={styles.emptyTitle}>{COPY.comments.empty}</Text>
        <Text style={styles.emptySubtitle}>{COPY.comments.beFirst}</Text>
      </View>
    );
  }, [commentsData]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Sheet */}
      <View style={styles.sheet}>
        {/* Drag handle */}
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Text style={styles.headerTitle}>{COPY.comments.title}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close comments"
            style={styles.closeButton}
            onPress={onClose}
          >
            <Icon name="close" size={22} color={Colors.text.primary} strokeWidth={2} />
          </Pressable>
        </View>

        {/* Comments List */}
        <View style={styles.listContainer}>
          <FlashList<Comment>
            data={comments}
            renderItem={renderComment}
            keyExtractor={keyExtractor}
            ListEmptyComponent={ListEmptyComponent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        </View>

        {/* Input */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={COPY.comments.placeholder}
              placeholderTextColor={Colors.text.tertiary}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={500}
              editable={!isPosting}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={COPY.comments.post}
              style={[
                styles.postButton,
                (commentText.trim().length === 0 || isPosting) &&
                  styles.postButtonDisabled,
              ]}
              onPress={handlePost}
              disabled={commentText.trim().length === 0 || isPosting}
            >
              {isPosting ? (
                <ActivityIndicator size="small" color={Colors.text.inverse} />
              ) : (
                <Text style={styles.postButtonText}>{COPY.comments.post}</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.background.overlay,
  },
  sheet: {
    height: MODAL_HEIGHT,
    backgroundColor: Colors.background.primary,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.text.tertiary,
    opacity: 0.4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headerSpacer: {
    width: 40,
  },
  headerTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingVertical: Spacing.sm,
  },
  commentItem: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  commentUsername: {
    ...Typography.label,
    color: Colors.text.primary,
  },
  commentTime: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
  commentText: {
    ...Typography.body,
    color: Colors.text.primary,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.text.secondary,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    ...Typography.body,
    color: Colors.text.tertiary,
    marginTop: Spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    ...Typography.body,
    color: Colors.text.primary,
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    maxHeight: 100,
  },
  postButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    ...Typography.label,
    color: Colors.text.inverse,
  },
});
