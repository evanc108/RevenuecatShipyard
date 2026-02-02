import { Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/theme';

type PageTurnButtonProps = {
  label?: string;
  onPress: () => void;
  disabled?: boolean;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PageTurnButton({
  label = 'Next >',
  onPress,
  disabled = false,
}: PageTurnButtonProps) {
  const opacity = useSharedValue(1);
  const insets = useSafeAreaInsets();

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom + Spacing.md, Spacing.xl) },
        disabled && styles.disabled,
        animatedStyle,
      ]}
      onPress={onPress}
      onPressIn={() => {
        opacity.value = withTiming(0.7, { duration: 100 });
      }}
      onPressOut={() => {
        opacity.value = withTiming(1, { duration: 150 });
      }}
      disabled={disabled}
    >
      <Text style={[styles.label, disabled && styles.labelDisabled]}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 170,
    paddingTop: Spacing.xl,
    backgroundColor: Colors.text.primary,
    borderTopLeftRadius: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: Spacing.sm + Spacing.xs,
    shadowColor: Colors.text.primary,
    shadowOffset: { width: -2, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  disabled: {
    backgroundColor: Colors.text.disabled,
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text.inverse,
    letterSpacing: 0.3,
  },
  labelDisabled: {
    color: Colors.background.secondary,
  },
});
