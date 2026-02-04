/**
 * Modal showing all pending and completed recipe uploads.
 *
 * Displays:
 * - Currently loading uploads with progress
 * - Recently completed uploads with links to recipes
 * - Failed uploads with error messages
 */

import { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Icon } from '@/components/ui/Icon';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import {
  usePendingUploadsStore,
  type PendingUpload,
} from '@/stores/usePendingUploadsStore';
import { getDomainFromUrl } from '@/hooks/useShareHandler';
import { useModalAnimation } from '@/hooks/useModalAnimation';

type UploadsHistoryModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function UploadsHistoryModal({
  visible,
  onClose,
}: UploadsHistoryModalProps): React.ReactElement | null {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Use shared modal animation
  const { isRendered, backdropOpacity, modalTranslateY } = useModalAnimation({
    visible,
  });

  const uploads = usePendingUploadsStore((s) => s.uploads);
  const removeUpload = usePendingUploadsStore((s) => s.removeUpload);
  const clearCompleted = usePendingUploadsStore((s) => s.clearCompleted);

  // Sort uploads: active first, then by creation time (newest first)
  const sortedUploads = Object.values(uploads).sort((a, b) => {
    const aActive = a.status !== 'complete' && a.status !== 'error';
    const bActive = b.status !== 'complete' && b.status !== 'error';
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    return b.createdAt - a.createdAt;
  });

  const activeUploads = sortedUploads.filter(
    (u) => u.status !== 'complete' && u.status !== 'error'
  );
  const completedUploads = sortedUploads.filter(
    (u) => u.status === 'complete' || u.status === 'error'
  );

  const handleViewRecipe = useCallback(
    (upload: PendingUpload) => {
      if (upload.recipeId) {
        onClose();
        router.push({
          pathname: '/recipe/[id]',
          params: { id: upload.recipeId },
        });
      }
    },
    [onClose, router]
  );

  const handleRemove = useCallback(
    (id: string) => {
      removeUpload(id);
    },
    [removeUpload]
  );

  const handleClearAll = useCallback(() => {
    clearCompleted();
  }, [clearCompleted]);

  const renderUploadItem = (upload: PendingUpload) => {
    const isActive = upload.status !== 'complete' && upload.status !== 'error';
    const isComplete = upload.status === 'complete';
    const isError = upload.status === 'error';
    const domain = getDomainFromUrl(upload.url);
    const progressPercent = Math.round(upload.progress * 100);

    return (
      <View key={upload.id} style={styles.uploadItem}>
        {/* Status indicator */}
        <View style={styles.statusContainer}>
          {isActive ? (
            <ActivityIndicator size="small" color={Colors.accent} />
          ) : isComplete ? (
            <Icon name="checkmark-circle" size={24} color={Colors.semantic.success} />
          ) : (
            <Icon name="alert-circle" size={24} color={Colors.semantic.error} />
          )}
        </View>

        {/* Content */}
        <View style={styles.uploadContent}>
          <Text style={styles.uploadTitle} numberOfLines={1}>
            {isComplete && upload.recipeTitle
              ? upload.recipeTitle
              : `Recipe from ${domain}`}
          </Text>
          <Text style={styles.uploadSubtitle} numberOfLines={1}>
            {isActive
              ? `${upload.message} (${progressPercent}%)`
              : isError
                ? upload.error ?? 'Import failed'
                : `Saved to ${upload.cookbookName}`}
          </Text>
        </View>

        {/* Action */}
        {isComplete && upload.recipeId ? (
          <Pressable
            style={styles.viewButton}
            onPress={() => handleViewRecipe(upload)}
            accessibilityRole="button"
            accessibilityLabel="View recipe"
          >
            <Text style={styles.viewButtonText}>View</Text>
          </Pressable>
        ) : !isActive ? (
          <Pressable
            onPress={() => handleRemove(upload.id)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Remove"
          >
            <Icon name="close" size={20} color={Colors.text.tertiary} />
          </Pressable>
        ) : null}
      </View>
    );
  };

  const isEmpty = sortedUploads.length === 0;

  if (!isRendered) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Animated Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Animated Modal Content */}
      <Animated.View
        style={[
          styles.modalContainer,
          { transform: [{ translateY: modalTranslateY }] },
        ]}
      >
        <View
          style={[
            styles.modal,
            { paddingBottom: Math.max(insets.bottom, Spacing.lg) },
          ]}
        >
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Uploads</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Icon name="close" size={24} color={Colors.text.secondary} />
            </Pressable>
          </View>

          {/* Content */}
          {isEmpty ? (
            <View style={styles.emptyContainer}>
              <Icon name="download" size={40} color={Colors.text.tertiary} />
              <Text style={styles.emptyTitle}>No uploads yet</Text>
              <Text style={styles.emptySubtitle}>
                Import a recipe to see it here
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Active uploads */}
              {activeUploads.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>In Progress</Text>
                  {activeUploads.map(renderUploadItem)}
                </View>
              )}

              {/* Completed uploads */}
              {completedUploads.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Recent</Text>
                    {completedUploads.length > 0 && (
                      <Pressable onPress={handleClearAll}>
                        <Text style={styles.clearAllText}>Clear all</Text>
                      </Pressable>
                    )}
                  </View>
                  {completedUploads.map(renderUploadItem)}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background.overlay,
  },
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  modal: {
    backgroundColor: Colors.background.primary,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '70%',
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    ...Typography.h2,
    color: Colors.text.primary,
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.label,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  clearAllText: {
    ...Typography.caption,
    color: Colors.accent,
  },
  uploadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  statusContainer: {
    width: 32,
    alignItems: 'center',
  },
  uploadContent: {
    flex: 1,
  },
  uploadTitle: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  uploadSubtitle: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  viewButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  viewButtonText: {
    ...Typography.label,
    color: Colors.text.inverse,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
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
    textAlign: 'center',
  },
});
