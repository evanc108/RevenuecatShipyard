/**
 * Floating progress indicator for background recipe extraction.
 *
 * Small pill in bottom-left corner showing:
 * - Active upload with progress
 * - X button to dismiss
 * - Appears on all screens
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { Colors, Spacing, Radius, Typography, Shadow } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import {
  usePendingUploadsStore,
  useActiveUpload,
  useRecentCompletedUpload,
} from '@/stores/usePendingUploadsStore';

const SPRING_CONFIG = { damping: 20, stiffness: 300 };
const AUTO_DISMISS_DELAY = 4000;

const copy = COPY.shareIntent;

export function UploadProgressIndicator(): React.ReactElement | null {
  const insets = useSafeAreaInsets();

  // Store state
  const activeUpload = useActiveUpload();
  const recentCompleted = useRecentCompletedUpload();
  const removeUpload = usePendingUploadsStore((s) => s.removeUpload);

  // Local state for showing completed upload
  const [showingCompleted, setShowingCompleted] = useState<string | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animation values
  const translateY = useSharedValue(100);

  // Determine what to show
  const displayUpload = activeUpload ?? (showingCompleted ? recentCompleted : null);
  const isComplete = displayUpload?.status === 'complete';
  const isError = displayUpload?.status === 'error';
  const shouldShow = displayUpload !== null;

  // Handle completed upload display with auto-dismiss
  useEffect(() => {
    if (recentCompleted && !activeUpload) {
      setShowingCompleted(recentCompleted.id);

      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }

      dismissTimerRef.current = setTimeout(() => {
        setShowingCompleted(null);
        removeUpload(recentCompleted.id);
      }, AUTO_DISMISS_DELAY);
    }

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, [recentCompleted?.id, activeUpload, removeUpload]);

  // Animate visibility
  useEffect(() => {
    if (shouldShow) {
      translateY.value = withSpring(0, SPRING_CONFIG);
    } else {
      translateY.value = withTiming(100, { duration: 200 });
    }
  }, [shouldShow, translateY]);

  // Handle dismiss
  const handleDismiss = useCallback(() => {
    if (displayUpload) {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
      translateY.value = withTiming(100, { duration: 150 }, () => {
        runOnJS(removeUpload)(displayUpload.id);
        runOnJS(setShowingCompleted)(null);
      });
    }
  }, [displayUpload, removeUpload, translateY]);

  // Animated styles
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!shouldShow) return null;

  const progressPercent = Math.round((displayUpload?.progress ?? 0) * 100);

  return (
    <Animated.View
      style={[
        styles.container,
        { bottom: Math.max(insets.bottom, Spacing.sm) + 90 }, // Above tab bar
        animatedStyle,
      ]}
      pointerEvents="box-none"
    >
      <View style={[
        styles.pill,
        isComplete && styles.pillComplete,
        isError && styles.pillError,
      ]}>
        {/* Status icon or spinner */}
        {isComplete ? (
          <Icon name="checkmark-circle" size={18} color={Colors.semantic.success} />
        ) : isError ? (
          <Icon name="alert-circle" size={18} color={Colors.semantic.error} />
        ) : (
          <ActivityIndicator size="small" color={Colors.accent} />
        )}

        {/* Text */}
        <View style={styles.textContainer}>
          {isComplete ? (
            <Text style={styles.text} numberOfLines={1}>Recipe saved</Text>
          ) : isError ? (
            <Text style={[styles.text, styles.errorText]} numberOfLines={1}>Import failed</Text>
          ) : (
            <Text style={styles.text} numberOfLines={1}>Importing {progressPercent}%</Text>
          )}
        </View>

        {/* Close button */}
        <Pressable
          onPress={handleDismiss}
          hitSlop={8}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        >
          <Icon name="close" size={14} color={Colors.text.tertiary} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.md,
    zIndex: 9999,
    elevation: 9999,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.primary,
    borderRadius: Radius.full,
    paddingLeft: Spacing.sm,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
    ...Shadow.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillComplete: {
    borderColor: Colors.semantic.success,
  },
  pillError: {
    borderColor: Colors.semantic.error,
  },
  textContainer: {
    minWidth: 32,
  },
  text: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  errorText: {
    color: Colors.semantic.error,
  },
  closeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
