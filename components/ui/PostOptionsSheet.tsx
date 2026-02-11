import { Icon } from '@/components/ui/Icon';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useModalAnimation } from '@/hooks/useModalAnimation';
import { useMutation } from 'convex/react';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type PostOptionsSheetProps = {
  visible: boolean;
  postId: Id<'posts'> | null;
  recipeId: Id<'recipes'> | null;
  recipeTitle: string;
  onClose: () => void;
};

type SheetView = 'options' | 'confirmDelete';

export function PostOptionsSheet({
  visible,
  postId,
  recipeId,
  recipeTitle,
  onClose,
}: PostOptionsSheetProps): React.ReactElement | null {
  const router = useRouter();
  const [sheetView, setSheetView] = useState<SheetView>('options');
  const [isLoading, setIsLoading] = useState(false);

  const deletePost = useMutation(api.posts.remove);

  const { isRendered, backdropOpacity, modalTranslateY, animateOut } =
    useModalAnimation({
      visible,
      onAnimationComplete: () => {
        setSheetView('options');
        setIsLoading(false);
      },
    });

  const handleClose = useCallback(() => {
    if (isLoading) return;
    animateOut(onClose);
  }, [animateOut, onClose, isLoading]);

  const handleEditReview = useCallback(() => {
    if (!recipeId) return;
    animateOut(() => {
      onClose();
      // Navigate to recipe page and scroll to review section
      router.push(`/recipe/${recipeId}?scrollToReview=true`);
    });
  }, [recipeId, animateOut, onClose, router]);

  const handleDelete = useCallback(async () => {
    if (!postId || isLoading) return;
    setIsLoading(true);
    try {
      await deletePost({ postId });
      animateOut(onClose);
    } finally {
      setIsLoading(false);
    }
  }, [postId, deletePost, animateOut, onClose, isLoading]);

  if (!isRendered) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { transform: [{ translateY: modalTranslateY }] },
        ]}
      >
        {/* Handle bar */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {sheetView === 'options' ? (
          <View style={styles.content}>
            {/* Recipe title */}
            <Text style={styles.recipeTitle} numberOfLines={1}>
              {recipeTitle}
            </Text>

            {/* Options */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit review"
              style={styles.optionRow}
              onPress={handleEditReview}
            >
              <Icon name="pencil" size={22} color={Colors.text.primary} />
              <Text style={styles.optionText}>Edit Review</Text>
              <Icon name="chevron-forward" size={18} color={Colors.text.tertiary} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete post"
              style={styles.optionRow}
              onPress={() => setSheetView('confirmDelete')}
            >
              <Icon name="trash" size={22} color={Colors.semantic.error} />
              <Text style={[styles.optionText, styles.optionTextDestructive]}>
                Delete Post
              </Text>
            </Pressable>

            {/* Cancel */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={styles.cancelButton}
              onPress={handleClose}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.content}>
            {/* Confirm delete */}
            <Text style={styles.confirmTitle}>Delete Post?</Text>
            <Text style={styles.confirmMessage}>
              This will permanently delete your review for this recipe. This action cannot be undone.
            </Text>

            <View style={styles.confirmButtons}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                style={styles.confirmCancelButton}
                onPress={() => setSheetView('options')}
                disabled={isLoading}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete"
                style={styles.confirmDeleteButton}
                onPress={handleDelete}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={Colors.text.inverse} />
                ) : (
                  <Text style={styles.confirmDeleteText}>Delete</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background.overlay,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background.primary,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  recipeTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  optionText: {
    ...Typography.body,
    color: Colors.text.primary,
    flex: 1,
  },
  optionTextDestructive: {
    color: Colors.semantic.error,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  cancelText: {
    ...Typography.label,
    color: Colors.text.secondary,
  },
  confirmTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  confirmMessage: {
    ...Typography.body,
    color: Colors.text.secondary,
    marginBottom: Spacing.lg,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  confirmCancelButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  confirmCancelText: {
    ...Typography.label,
    color: Colors.text.primary,
  },
  confirmDeleteButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.semantic.error,
  },
  confirmDeleteText: {
    ...Typography.label,
    color: Colors.text.inverse,
  },
});
