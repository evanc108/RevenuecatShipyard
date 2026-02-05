import { Icon } from '@/components/ui/Icon';
import { COPY } from '@/constants/copy';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useModalAnimation } from '@/hooks/useModalAnimation';
import { useMutation, useQuery } from 'convex/react';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const copy = COPY.cookbookDetail.recipeOptions;

type RecipeOptionsSheetProps = {
  visible: boolean;
  recipeId: Id<'recipes'> | null;
  recipeTitle: string;
  cookbookId: Id<'cookbooks'>;
  onClose: () => void;
  onViewRecipe: (recipeId: Id<'recipes'>) => void;
};

type SheetView = 'options' | 'movePicker';

export function RecipeOptionsSheet({
  visible,
  recipeId,
  recipeTitle,
  cookbookId,
  onClose,
  onViewRecipe,
}: RecipeOptionsSheetProps): React.ReactElement | null {
  const [sheetView, setSheetView] = useState<SheetView>('options');
  const [isLoading, setIsLoading] = useState(false);

  const cookbooks = useQuery(api.cookbooks.list);
  const removeRecipe = useMutation(api.cookbooks.removeRecipe);
  const moveRecipe = useMutation(api.cookbooks.moveRecipe);

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

  const handleViewRecipe = useCallback(() => {
    if (!recipeId) return;
    animateOut(() => {
      onClose();
      onViewRecipe(recipeId);
    });
  }, [recipeId, animateOut, onClose, onViewRecipe]);

  const handleRemove = useCallback(async () => {
    if (!recipeId || isLoading) return;
    setIsLoading(true);
    try {
      await removeRecipe({ cookbookId, recipeId });
      animateOut(onClose);
    } finally {
      setIsLoading(false);
    }
  }, [recipeId, cookbookId, removeRecipe, animateOut, onClose, isLoading]);

  const handleMove = useCallback(
    async (toCookbookId: Id<'cookbooks'>) => {
      if (!recipeId || isLoading) return;
      setIsLoading(true);
      try {
        await moveRecipe({
          recipeId,
          fromCookbookId: cookbookId,
          toCookbookId,
        });
        animateOut(onClose);
      } finally {
        setIsLoading(false);
      }
    },
    [recipeId, cookbookId, moveRecipe, animateOut, onClose, isLoading],
  );

  if (!isRendered) return null;

  // Filter out the current cookbook from the move list
  const otherCookbooks = cookbooks?.filter((c) => c._id !== cookbookId) ?? [];

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
              accessibilityLabel={copy.viewRecipe}
              style={styles.optionRow}
              onPress={handleViewRecipe}
            >
              <Icon name="book" size={22} color={Colors.text.primary} />
              <Text style={styles.optionText}>{copy.viewRecipe}</Text>
              <Icon name="chevron-forward" size={18} color={Colors.text.tertiary} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.moveToCookbook}
              style={styles.optionRow}
              onPress={() => setSheetView('movePicker')}
            >
              <Icon name="share" size={22} color={Colors.text.primary} />
              <Text style={styles.optionText}>{copy.moveToCookbook}</Text>
              <Icon name="chevron-forward" size={18} color={Colors.text.tertiary} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.deleteFromCookbook}
              style={styles.optionRow}
              onPress={handleRemove}
              disabled={isLoading}
            >
              <Icon name="trash" size={22} color={Colors.semantic.error} />
              <Text style={[styles.optionText, styles.optionTextDestructive]}>
                {copy.deleteFromCookbook}
              </Text>
              {isLoading ? (
                <ActivityIndicator size="small" color={Colors.semantic.error} />
              ) : null}
            </Pressable>

            {/* Cancel */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.cancel}
              style={styles.cancelButton}
              onPress={handleClose}
            >
              <Text style={styles.cancelText}>{copy.cancel}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.content}>
            {/* Move picker header */}
            <View style={styles.moveHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={() => setSheetView('options')}
                hitSlop={8}
              >
                <Icon name="arrow-back" size={22} color={Colors.text.primary} />
              </Pressable>
              <Text style={styles.moveTitle}>{copy.selectCookbook}</Text>
              <View style={{ width: 22 }} />
            </View>

            {/* Cookbook list */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.cookbookList}
            >
              {otherCookbooks.length === 0 ? (
                <Text style={styles.emptyText}>No other cookbooks</Text>
              ) : (
                otherCookbooks.map((cb) => (
                  <Pressable
                    key={cb._id}
                    accessibilityRole="button"
                    accessibilityLabel={`Move to ${cb.name}`}
                    style={styles.cookbookRow}
                    onPress={() => handleMove(cb._id)}
                    disabled={isLoading}
                  >
                    <View style={styles.cookbookInfo}>
                      <Text style={styles.cookbookName} numberOfLines={1}>
                        {cb.name}
                      </Text>
                      <Text style={styles.cookbookCount}>
                        {cb.recipeCount} {cb.recipeCount === 1 ? 'recipe' : 'recipes'}
                      </Text>
                    </View>
                    {isLoading ? (
                      <ActivityIndicator size="small" color={Colors.accent} />
                    ) : (
                      <Icon name="chevron-forward" size={18} color={Colors.text.tertiary} />
                    )}
                  </Pressable>
                ))
              )}
            </ScrollView>
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
    maxHeight: '60%',
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
  moveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  moveTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
  },
  cookbookList: {
    maxHeight: 300,
  },
  cookbookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cookbookInfo: {
    flex: 1,
    gap: 2,
  },
  cookbookName: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  cookbookCount: {
    ...Typography.caption,
    color: Colors.text.secondary,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.text.tertiary,
    textAlign: 'center',
    paddingVertical: Spacing.xl,
  },
});
