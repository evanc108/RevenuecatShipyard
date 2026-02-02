import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { PageTurnButton } from '@/components/onboarding/PageTurnButton';
import { PageIndicator } from '@/components/onboarding/PageIndicator';
import { ONBOARDING_COPY } from '@/constants/onboarding';
import { Colors, Spacing } from '@/constants/theme';

// Illustration: Work illustrations by Storyset (https://storyset.com/work)

export default function WelcomeScreen() {
  const router = useRouter();
  const copy = ONBOARDING_COPY.welcome;
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Animated.View
        entering={FadeInDown.delay(0).duration(400)}
        style={styles.headlineContainer}
      >
        <Text style={styles.headline}>{copy.headline}</Text>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(100).duration(400)}
        style={styles.illustrationContainer}
      >
        <Image
          source={require('@/assets/images/welcome-icon.png')}
          style={styles.illustration}
          contentFit="contain"
        />
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(200).duration(400)}
        style={styles.bottomBar}
      >
        <Animated.View
          style={[styles.bottomLeft, { paddingBottom: insets.bottom + Spacing.sm }]}
        >
          <PageIndicator current={1} />
        </Animated.View>
        <PageTurnButton
          label="Next >"
          onPress={() => router.push('/(onboarding)/info')}
        />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  headlineContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
  },
  headline: {
    fontSize: 36,
    fontWeight: '400',
    color: Colors.text.primary,
    letterSpacing: -0.5,
    lineHeight: 50,
  },
  illustrationContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustration: {
    width: 360,
    height: 360,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingLeft: Spacing.xl,
  },
  bottomLeft: {
    justifyContent: 'flex-end',
  },
});
