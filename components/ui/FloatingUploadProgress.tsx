/**
 * Floating card to display ongoing/completed upload progress.
 *
 * - Shows a compact progress indicator in the bottom-left corner.
 * - Persists across all tabs while extraction is in progress.
 * - Shows completion state with "Recipe added to [Cookbook]" message.
 * - Can be dismissed after completion.
 */

import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    Animated,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import * as Progress from 'react-native-progress';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import {
    PendingUpload,
    usePendingUploadsStore,
} from '@/stores/usePendingUploadsStore';

export function FloatingUploadProgress(): React.ReactElement | null {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const [slideAnim] = useState(() => new Animated.Value(300));

  const uploads = usePendingUploadsStore((s) => s.uploads);
  const removeUpload = usePendingUploadsStore((s) => s.removeUpload);

  // Get the most relevant upload to display
  // Priority: in-progress > recently completed > recently errored
  const displayUpload = useMemo<PendingUpload | null>(() => {
    const all = Object.values(uploads);
    if (all.length === 0) return null;

    // Active uploads (not complete, not error)
    const active = all.filter((u) => u.status !== 'complete' && u.status !== 'error');
    if (active.length > 0) {
      // Return the oldest active upload
      return active.sort((a, b) => a.createdAt - b.createdAt)[0];
    }

    // Recently completed/errored (within last 10 seconds)
    const recent = all
      .filter((u) => u.completedAt && Date.now() - u.completedAt < 10000)
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
    return recent[0] ?? null;
  }, [uploads]);

  // Animate in/out
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: displayUpload ? 0 : 300,
      useNativeDriver: true,
      tension: 50,
      friction: 10,
    }).start();
  }, [displayUpload, slideAnim]);

  if (!displayUpload) return null;

  const isComplete = displayUpload.status === 'complete';
  const isError = displayUpload.status === 'error';
  const isActive = !isComplete && !isError;

  const handlePress = () => {
    if (isComplete && displayUpload.recipeId) {
      router.push(`/recipe/${displayUpload.recipeId}`);
      removeUpload(displayUpload.id);
    }
  };

  const handleDismiss = () => {
    removeUpload(displayUpload.id);
  };

  // Calculate card width (smaller, in-between size)
  const cardWidth = Math.min(screenWidth - 2 * Spacing.lg, 240);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: insets.bottom + 100, // Position above navbar
          left: Spacing.lg,
          width: 'auto', // Allow valid auto-sizing
          maxWidth: cardWidth, // Cap max width
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <Pressable
        style={[
          styles.card,
          isComplete && styles.cardComplete,
          isError && styles.cardError,
        ]}
        onPress={handlePress}
        disabled={isActive}
      >
        {/* Icon */}
        <View style={styles.iconContainer}>
          {isComplete ? (
            <Icon name="checkmark-circle" size={20} color={Colors.semantic.success} />
          ) : isError ? (
            <Icon name="alert-circle" size={20} color={Colors.semantic.error} />
          ) : (
            <Progress.Circle
              size={20}
              indeterminate={true}
              color={Colors.accent}
              borderWidth={2}
            />
          )}
        </View>

        {/* Text Content */}
        <View style={styles.textContainer}>
          {isComplete ? (
            <Text style={styles.title} numberOfLines={1}>
              Saved!
            </Text>
          ) : isError ? (
            <Text style={styles.title} numberOfLines={1}>
              Import failed
            </Text>
          ) : (
            <Text style={styles.title} numberOfLines={1}>
              Importing Recipe...
            </Text>
          )}
        </View>

        {/* Action/Dismiss Button */}
        <Pressable
          style={styles.dismissButton}
          onPress={handleDismiss}
          hitSlop={8}
        >
          <Icon name="close" size={16} color={Colors.text.tertiary} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 1000,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.primary,
    borderRadius: Radius.full, // Pill shape
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardComplete: {
    borderColor: Colors.semantic.success,
  },
  cardError: {
    borderColor: Colors.semantic.error,
  },
  iconContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flexShrink: 1,
    marginRight: Spacing.xs,
  },
  title: {
    ...Typography.label,
    color: Colors.text.primary,
    fontSize: 14,
  },
  dismissButton: {
    padding: 2,
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.full,
  },
});
