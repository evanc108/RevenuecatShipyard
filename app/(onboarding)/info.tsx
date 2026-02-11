import { Text, StyleSheet, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '@/components/ui/Icon';
import { NAV_BUTTON_SIZE } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ONBOARDING_COPY } from '@/constants/onboarding';
import { Colors, FontFamily, Spacing, Typography } from '@/constants/theme';
import { PageIndicator } from '@/components/onboarding/PageIndicator';
import { PageTurnButton } from '@/components/onboarding/PageTurnButton';

export default function InfoScreen() {
  const router = useRouter();
  const copy = ONBOARDING_COPY.info;

  const handleBack = () => {
    router.back();
  };

  const handleNext = () => {
    router.push('/(onboarding)/sign-up');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Animated.View
        entering={FadeInDown.delay(100).duration(500)}
        style={styles.indicatorContainer}
      >
        <PageIndicator current={2} total={2} />
      </Animated.View>

      <View style={styles.content}>
        <Animated.View
          entering={FadeInDown.delay(200).duration(500)}
          style={styles.imageContainer}
        >
          <Image
            source={require('@/assets/images/info-icon.png')}
            style={styles.illustration}
            contentFit="contain"
          />
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(350).duration(500)}
          style={styles.textContainer}
        >
          <Text style={styles.headline}>{copy.headline}</Text>

          <View style={styles.featureList}>
            {copy.features.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <View style={styles.bullet} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      </View>

      <Animated.View
        entering={FadeInUp.delay(400).duration(500)}
        style={styles.bottomSection}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={handleBack}
          hitSlop={8}
          style={styles.backButton}
        >
          <Icon name="arrow-back" size={20} color={Colors.text.inverse} strokeWidth={2} />
        </Pressable>

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
    width: 240,
    height: 240,
  },
  textContainer: {
    alignItems: 'center',
    gap: Spacing.lg,
  },
  headline: {
    fontSize: 36,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.5,
    lineHeight: 44,
    textAlign: 'center',
  },
  featureList: {
    gap: Spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  featureText: {
    ...Typography.body,
    color: Colors.text.secondary,
    fontSize: 16,
    lineHeight: 24,
  },
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  backButton: {
    width: NAV_BUTTON_SIZE,
    height: NAV_BUTTON_SIZE,
    borderRadius: NAV_BUTTON_SIZE / 2,
    backgroundColor: Colors.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
    marginBottom: Spacing.xl,
  },
});
