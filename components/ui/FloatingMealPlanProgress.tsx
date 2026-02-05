/**
 * Floating card to display ongoing/completed meal plan generation progress.
 *
 * - Shows a compact progress indicator in the bottom-left corner.
 * - Persists across all tabs while generation is in progress.
 * - Shows completion state when recipes are ready.
 * - Can be dismissed after completion or on error.
 */

import { useEffect, useState } from 'react';
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
import { useMealPlanGenerationStore } from '@/stores/useMealPlanGenerationStore';

export function FloatingMealPlanProgress(): React.ReactElement | null {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [slideAnim] = useState(() => new Animated.Value(300));

  const status = useMealPlanGenerationStore((s) => s.status);
  const isModalVisible = useMealPlanGenerationStore((s) => s.isGenerateModalVisible);
  const openReviewSheet = useMealPlanGenerationStore((s) => s.openReviewSheet);
  const dismissFloatingProgress = useMealPlanGenerationStore((s) => s.dismissFloatingProgress);

  // Only show when generating/success/error AND modal is closed
  const shouldShow = !isModalVisible && (status === 'generating' || status === 'success' || status === 'error');

  // Animate in/out
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: shouldShow ? 0 : 300,
      useNativeDriver: true,
      tension: 50,
      friction: 10,
    }).start();
  }, [shouldShow, slideAnim]);

  // Auto-dismiss success state after 10 seconds
  useEffect(() => {
    if (status === 'success' && !isModalVisible) {
      const timer = setTimeout(() => {
        dismissFloatingProgress();
      }, 10000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [status, isModalVisible, dismissFloatingProgress]);

  if (!shouldShow) return null;

  const isComplete = status === 'success';
  const isError = status === 'error';
  const isGenerating = status === 'generating';

  const handlePress = () => {
    if (isComplete) {
      openReviewSheet();
      dismissFloatingProgress();
    }
  };

  const handleDismiss = () => {
    dismissFloatingProgress();
  };

  // Calculate card width
  const cardWidth = Math.min(screenWidth - 2 * Spacing.lg, 260);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: insets.bottom + 100, // Position above navbar
          left: Spacing.lg,
          maxWidth: cardWidth,
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
        disabled={isGenerating}
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
              Recipes ready!
            </Text>
          ) : isError ? (
            <Text style={styles.title} numberOfLines={1}>
              Generation failed
            </Text>
          ) : (
            <Text style={styles.title} numberOfLines={1}>
              Generating recipes...
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
    borderRadius: Radius.full,
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
