import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/clerk-expo';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { PlaceholderAsset } from '@/components/onboarding/PlaceholderAsset';
import { Colors, Typography } from '@/constants/theme';

export default function SplashScreen() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 400 });
    scale.value = withTiming(1, { duration: 400 });
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    const navigate = () => {
      if (isSignedIn) {
        const hasOnboarded = user?.unsafeMetadata?.hasCompletedOnboarding;
        if (hasOnboarded) {
          router.replace('/(tabs)');
        } else {
          router.replace('/(onboarding)/goals');
        }
      } else {
        router.replace('/(onboarding)/welcome');
      }
    };

    const timer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 300 }, () => {
        runOnJS(navigate)();
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, [isLoaded, isSignedIn, user]);

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
