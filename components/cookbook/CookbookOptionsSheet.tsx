import { Icon } from '@/components/ui/Icon';
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
  View,
} from 'react-native';

const copy = COPY.cookbooks.options;

type CookbookOptionsSheetProps = {
  visible: boolean;
  cookbookId: Id<'cookbooks'> | null;
  cookbookName: string;
  onClose: () => void;
  onEdit: (cookbookId: Id<'cookbooks'>) => void;
};

type SheetView = 'options' | 'confirmDelete';

export function CookbookOptionsSheet({
  visible,
  cookbookId,
  cookbookName,
  onClose,
  onEdit,
}: CookbookOptionsSheetProps): React.ReactElement | null {
  const [sheetView, setSheetView] = useState<SheetView>('options');
  const [isLoading, setIsLoading] = useState(false);

  const deleteCookbook = useMutation(api.cookbooks.remove);

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

  const handleEdit = useCallback(() => {
    if (!cookbookId) return;
    animateOut(() => {
      onClose();
      onEdit(cookbookId);
    });
  }, [cookbookId, animateOut, onClose, onEdit]);

  const handleDelete = useCallback(async () => {
    if (!cookbookId || isLoading) return;
    setIsLoading(true);
    try {
      await deleteCookbook({ cookbookId });
      animateOut(onClose);
    } finally {
      setIsLoading(false);
    }
  }, [cookbookId, deleteCookbook, animateOut, onClose, isLoading]);

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
            {/* Cookbook name */}
            <Text style={styles.cookbookName} numberOfLines={1}>
              {cookbookName}
            </Text>

            {/* Options */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.editCookbook}
              style={styles.optionRow}
              onPress={handleEdit}
            >
              <Icon name="pencil" size={22} color={Colors.text.primary} />
              <Text style={styles.optionText}>{copy.editCookbook}</Text>
              <Icon name="chevron-forward" size={18} color={Colors.text.tertiary} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.deleteCookbook}
              style={styles.optionRow}
              onPress={() => setSheetView('confirmDelete')}
            >
              <Icon name="trash" size={22} color={Colors.semantic.error} />
              <Text style={[styles.optionText, styles.optionTextDestructive]}>
                {copy.deleteCookbook}
              </Text>
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
            {/* Confirm delete */}
            <Text style={styles.confirmTitle}>{copy.deleteConfirmTitle}</Text>
            <Text style={styles.confirmMessage}>{copy.deleteConfirmMessage}</Text>

            <View style={styles.confirmButtons}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.cancel}
                style={styles.confirmCancelButton}
                onPress={() => setSheetView('options')}
                disabled={isLoading}
              >
                <Text style={styles.confirmCancelText}>{copy.cancel}</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.delete}
                style={styles.confirmDeleteButton}
                onPress={handleDelete}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={Colors.text.inverse} />
                ) : (
                  <Text style={styles.confirmDeleteText}>{copy.delete}</Text>
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
  cookbookName: {
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
