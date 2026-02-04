/**
 * Inline prompt shown when a recipe URL is detected in the clipboard.
 *
 * Appears at the top of the home screen (non-modal, non-intrusive).
 * Shows domain icon + "Import recipe from tiktok.com?"
 * Import and Dismiss buttons.
 */

import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Icon } from '@/components/ui/Icon';
import { Colors, Spacing, Radius, Typography, Shadow } from '@/constants/theme';
import { COPY } from '@/constants/copy';

const SPRING_CONFIG = { damping: 20, stiffness: 300 };
const SWIPE_THRESHOLD = 50;

const copy = COPY.shareIntent.clipboard;

type ClipboardPromptProps = {
  domain: string;
  onImport: () => void;
  onDismiss: () => void;
};

export function ClipboardPrompt({
  domain,
  onImport,
  onDismiss,
}: ClipboardPromptProps): React.ReactElement {
  // Animation values
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  // Animate in on mount
  useEffect(() => {
    translateY.value = withSpring(0, SPRING_CONFIG);
    opacity.value = withTiming(1, { duration: 200 });
  }, [translateY, opacity]);

  // Animate out and call callback
  const animateOut = (callback: () => void) => {
    translateY.value = withTiming(-100, { duration: 150 });
    opacity.value = withTiming(0, { duration: 150 }, () => {
      runOnJS(callback)();
    });
  };

  const handleImport = () => {
    animateOut(onImport);
  };

  const handleDismiss = () => {
    animateOut(onDismiss);
  };

  // Swipe gesture to dismiss
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY < 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY < -SWIPE_THRESHOLD) {
        animateOut(onDismiss);
      } else {
        translateY.value = withSpring(0, SPRING_CONFIG);
      }
    });

  // Animated styles
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <View style={styles.prompt}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Icon name="copy" size={24} color={Colors.accent} />
          </View>

          {/* Text */}
          <View style={styles.textContainer}>
            <Text style={styles.promptText}>{copy.prompt(domain)}</Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttons}>
            <Pressable
              style={styles.dismissButton}
              onPress={handleDismiss}
              accessibilityRole="button"
              accessibilityLabel={copy.dismiss}
            >
              <Text style={styles.dismissButtonText}>{copy.dismiss}</Text>
            </Pressable>
            <Pressable
              style={styles.importButton}
              onPress={handleImport}
              accessibilityRole="button"
              accessibilityLabel={copy.import}
            >
              <Text style={styles.importButtonText}>{copy.import}</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  prompt: {
    backgroundColor: Colors.background.primary,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadow.elevated,
    borderWidth: 1,
    borderColor: Colors.accentLight,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    marginHorizontal: Spacing.sm,
  },
  promptText: {
    ...Typography.body,
    color: Colors.text.primary,
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  dismissButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  dismissButtonText: {
    ...Typography.label,
    color: Colors.text.secondary,
  },
  importButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  importButtonText: {
    ...Typography.label,
    color: Colors.text.inverse,
  },
});
