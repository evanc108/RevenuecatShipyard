import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { PlaceholderAsset } from '@/components/onboarding/PlaceholderAsset';
import { Colors, Typography } from '@/constants/theme';

/**
 * Splash screen that shows briefly, then redirects.
 * AuthGuard in _layout.tsx handles all routing logic - we just redirect to welcome
 * and let AuthGuard decide where to actually go based on auth state.
 */
export default function SplashScreen() {
  const { isLoaded } = useAuth();

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 400 });
    scale.value = withTiming(1, { duration: 400 });
  }, []);

  // Once Clerk is loaded, redirect to welcome - AuthGuard will handle actual routing
  if (isLoaded) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoContainer, animatedStyle]}>
        <PlaceholderAsset width={100} height={100} label="Logo" borderRadius={20} />
        <Text style={styles.appName}>Nom</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    gap: 16,
  },
  appName: {
    ...Typography.h2,
    color: Colors.text.primary,
  },
});
