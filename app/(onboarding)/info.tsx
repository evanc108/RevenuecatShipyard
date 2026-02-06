import { PageIndicator } from '@/components/onboarding/PageIndicator';
import { PageTurnButton } from '@/components/onboarding/PageTurnButton';
import { ONBOARDING_COPY } from '@/constants/onboarding';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// Illustration: Information illustrations by Storyset (https://storyset.com/information)

export default function InfoScreen() {
  const router = useRouter();
  const copy = ONBOARDING_COPY.info;
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(onboarding)/welcome');
          }
        }}
        hitSlop={8}
        style={styles.backButton}
      >
        <Icon name="chevron-back" size={28} color={Colors.text.primary} />
      </Pressable>

      <Animated.View
        entering={FadeInDown.delay(0).duration(400)}
        style={styles.headlineContainer}
      >
        <Text style={styles.headline}>{copy.headline}</Text>
        <Text style={styles.subhead}>{copy.subhead}</Text>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(100).duration(400)}
        style={styles.illustrationContainer}
      >
        <Image
          source={require('@/assets/images/info-icon.png')}
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
          <PageIndicator current={2} />
        </Animated.View>
        <PageTurnButton
          label="Next >"
          onPress={() => router.push('/(onboarding)/sign-up')}
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
  backButton: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
    alignSelf: 'flex-start' as const,
  },
  headlineContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
  headline: {
    fontSize: 36,
    fontWeight: '400',
    color: Colors.text.primary,
    letterSpacing: -0.5,
    lineHeight: 50,
  },
  subhead: {
    ...Typography.body,
    color: Colors.text.secondary,
    fontSize: 16,
    lineHeight: 24,
  },
  illustrationContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustration: {
    width: 280,
    height: 280,
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
