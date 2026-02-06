import { Icon } from '@/components/ui/Icon';
import { StarRatingInput } from '@/components/ui/StarRatingInput';
import { COPY } from '@/constants/copy';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useModalAnimation } from '@/hooks/useModalAnimation';
import { useMutation } from 'convex/react';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type RateRecipeModalProps = {
  visible: boolean;
  recipeId: Id<'recipes'>;
  recipeTitle: string;
  onClose: () => void;
  onSuccess?: () => void;
};

const copy = COPY.addModal.sharePost;

export function RateRecipeModal({
  visible,
  recipeId,
  recipeTitle,
  onClose,
  onSuccess,
}: RateRecipeModalProps): React.ReactElement | null {
  const insets = useSafeAreaInsets();

  const [easeRating, setEaseRating] = useState(0);
  const [tasteRating, setTasteRating] = useState(0);
  const [presentationRating, setPresentationRating] = useState(0);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const createPost = useMutation(api.posts.create);

  const resetState = useCallback(() => {
    setEaseRating(0);
    setTasteRating(0);
    setPresentationRating(0);
    setNotes('');
    setIsLoading(false);
  }, []);

  const { isRendered, backdropOpacity, modalTranslateY, animateOut } =
    useModalAnimation({
      visible,
      onAnimationComplete: resetState,
    });

  const handleClose = useCallback(() => {
    if (isLoading) return;
    animateOut(onClose);
  }, [animateOut, onClose, isLoading]);

  const handleSubmit = useCallback(async () => {
    if (easeRating === 0 || tasteRating === 0 || presentationRating === 0) {
      return;
    }

    setIsLoading(true);
    try {
      await createPost({
        recipeId,
        easeRating,
        tasteRating,
        presentationRating,
        notes: notes.trim() || undefined,
      });
      animateOut(() => {
        onClose();
        onSuccess?.();
      });
    } catch (error) {
      console.error('Failed to create rating:', error);
    } finally {
      setIsLoading(false);
    }
  }, [
    recipeId,
    easeRating,
    tasteRating,
    presentationRating,
    notes,
    createPost,
    animateOut,
    onClose,
    onSuccess,
  ]);

  const canSubmit =
    easeRating > 0 && tasteRating > 0 && presentationRating > 0;

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
          {
            transform: [{ translateY: modalTranslateY }],
            paddingBottom: Math.max(insets.bottom, Spacing.lg),
          },
        ]}
      >
        {/* Handle bar */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            style={styles.closeButton}
            accessibilityLabel="Close"
            disabled={isLoading}
          >
            <Icon
              name="close"
              size={24}
              color={isLoading ? Colors.text.disabled : Colors.text.secondary}
            />
          </Pressable>
          <Text style={styles.title}>Rate This Recipe</Text>
          <View style={styles.closeButton} />
        </View>

        {/* Recipe Title */}
        <Text style={styles.recipeTitle} numberOfLines={2}>
          {recipeTitle}
        </Text>

        {/* Ratings */}
        <View style={styles.ratingsSection}>
          <StarRatingInput
            label={copy.ratings.ease}
            value={easeRating}
            onChange={setEaseRating}
            disabled={isLoading}
          />
          <StarRatingInput
            label={copy.ratings.taste}
            value={tasteRating}
            onChange={setTasteRating}
            disabled={isLoading}
          />
          <StarRatingInput
            label={copy.ratings.presentation}
            value={presentationRating}
            onChange={setPresentationRating}
            disabled={isLoading}
          />
        </View>

        {/* Notes */}
        <View style={styles.notesSection}>
          <Text style={styles.notesLabel}>{copy.notes}</Text>
          <TextInput
            style={styles.notesInput}
            placeholder={copy.notesPlaceholder}
            placeholderTextColor={Colors.text.tertiary}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            editable={!isLoading}
          />
        </View>

        {/* Submit Button */}
        <Pressable
          style={[
            styles.submitButton,
            canSubmit && styles.submitButtonActive,
            isLoading && styles.submitButtonLoading,
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit || isLoading}
          accessibilityRole="button"
          accessibilityLabel="Submit rating"
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={Colors.text.inverse} />
          ) : (
            <Text
              style={[
                styles.submitButtonText,
                !canSubmit && styles.submitButtonTextDisabled,
              ]}
            >
              {copy.submit}
            </Text>
          )}
        </Pressable>
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
    paddingHorizontal: Spacing.lg,
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Typography.h2,
    color: Colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  recipeTitle: {
    ...Typography.h3,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  ratingsSection: {
    marginBottom: Spacing.md,
  },
  notesSection: {
    marginBottom: Spacing.lg,
  },
  notesLabel: {
    ...Typography.label,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  notesInput: {
    ...Typography.body,
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 80,
  },
  submitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.tertiary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
  },
  submitButtonActive: {
    backgroundColor: Colors.accent,
  },
  submitButtonLoading: {
    backgroundColor: Colors.accent,
    opacity: 0.8,
  },
  submitButtonText: {
    ...Typography.label,
    fontSize: 16,
    color: Colors.text.inverse,
  },
  submitButtonTextDisabled: {
    color: Colors.text.disabled,
  },
});
