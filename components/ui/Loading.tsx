import { Image } from 'expo-image';
import { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

type LoadingProps = {
  size?: 'small' | 'large';
  color?: string;
  style?: ViewStyle;
};

const SIZE_MAP = {
  small: 24,
  large: 48,
} as const;

export function Loading({ size = 'small', color, style }: LoadingProps) {
  const rotation = useSharedValue(0);
  const iconSize = SIZE_MAP[size];

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, {
        duration: 1000,
        easing: Easing.linear,
      }),
      -1
    );
  }, [rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={[styles.container, style]}>
      <Animated.View style={animatedStyle}>
        <Image
          source={require('@/assets/images/loading_icon.svg')}
          style={{ width: iconSize, height: iconSize }}
          contentFit="contain"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
