import { Text, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ONBOARDING_COPY } from '@/constants/onboarding';
import { Colors, FontFamily, Spacing, Typography } from '@/constants/theme';
import { PageIndicator } from '@/components/onboarding/PageIndicator';
import { PageTurnButton } from '@/components/onboarding/PageTurnButton';

export default function WelcomeScreen() {
  const router = useRouter();
  const copy = ONBOARDING_COPY.welcome;

  const handleNext = () => {
    router.push('/(onboarding)/info');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Animated.View
        entering={FadeInDown.delay(100).duration(500)}
        style={styles.indicatorContainer}
      >
        <PageIndicator current={1} total={2} />
      </Animated.View>

      <View style={styles.content}>
        <Animated.View
          entering={FadeInDown.delay(200).duration(500)}
          style={styles.imageContainer}
        >
          <Image
            source={require('@/assets/images/welcome-icon.png')}
            style={styles.illustration}
            contentFit="contain"
          />
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(350).duration(500)}
          style={styles.textContainer}
        >
          <Text style={styles.headline}>{copy.headline}</Text>
          <Text style={styles.subhead}>{copy.subhead}</Text>
        </Animated.View>
      </View>

      <Animated.View
        entering={FadeInUp.delay(400).duration(500)}
        style={styles.bottomSection}
      >
        <PageTurnButton label="Next >" onPress={handleNext} />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  indicatorContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  imageContainer: {
    marginBottom: Spacing.xl,
  },
  illustration: {
    width: 320,
    height: 320,
  },
  textContainer: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headline: {
    fontSize: 40,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.5,
    lineHeight: 48,
    textAlign: 'center',
  },
  subhead: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 280,
  },
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
