import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Colors, Radius, Typography } from '@/constants/theme';

type GoalCardProps = {
  emoji: string;
  title: string;
  description: string;
  isSelected: boolean;
  onPress: () => void;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function GoalCard({
  emoji,
  title,
  description,
  isSelected,
  onPress,
}: GoalCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <AnimatedPressable
      style={[
        styles.container,
        isSelected && styles.containerSelected,
        animatedStyle,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Text style={styles.emoji}>{emoji}</Text>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      {isSelected && (
        <Ionicons name="checkmark-circle" size={24} color={Colors.accent} />
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  containerSelected: {
    backgroundColor: Colors.accentLight,
    borderColor: Colors.accent,
  },
  emoji: {
    fontSize: 28,
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  description: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
  },
});
