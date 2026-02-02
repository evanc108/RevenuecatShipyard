import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSSO } from '@clerk/clerk-expo';
import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ONBOARDING_COPY } from '@/constants/onboarding';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';

import { getClerkErrorMessage } from '@/utils/clerk-error';

// Illustration: People illustrations by Storyset (https://storyset.com/people)

export default function SignUpScreen() {
  const router = useRouter();
  const copy = ONBOARDING_COPY.signUp;
  const { startSSOFlow } = useSSO();
  const insets = useSafeAreaInsets();

  const [isLoading, setIsLoading] = useState<'apple' | 'google' | null>(null);
  const [error, setError] = useState('');

  const handleSSO = useCallback(
    async (strategy: 'oauth_apple' | 'oauth_google') => {
      const provider = strategy === 'oauth_apple' ? 'apple' : 'google';
      try {
        setIsLoading(provider);
        setError('');

        const { createdSessionId, setActive } = await startSSOFlow({
          strategy,
        });

        if (createdSessionId && setActive) {
          await setActive({ session: createdSessionId });
          // AuthGuard handles post-auth routing
        }
      } catch (err: unknown) {
        setError(getClerkErrorMessage(err, copy.errorFallback));
      } finally {
        setIsLoading(null);
      }
    },
    [startSSOFlow, copy.errorFallback],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => router.back()}
        hitSlop={8}
        style={styles.backButton}
      >
        <Ionicons name="chevron-back" size={28} color={Colors.text.primary} />
      </Pressable>

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
          source={require('@/assets/images/sign-up-icon.png')}
          style={styles.illustration}
          contentFit="contain"
        />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(150).duration(400)}
        style={[
          styles.authSection,
          { paddingBottom: Math.max(insets.bottom, Spacing.md) + Spacing.md },
        ]}
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.appleCta}
          style={styles.authButton}
          onPress={() => handleSSO('oauth_apple')}
          disabled={isLoading !== null}
        >
          {isLoading === 'apple' ? (
            <ActivityIndicator color={Colors.text.inverse} />
          ) : (
            <>
              <Ionicons name="logo-apple" size={20} color={Colors.text.inverse} />
              <Text style={styles.authButtonText}>{copy.appleCta}</Text>
            </>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.googleCta}
          style={styles.authButton}
          onPress={() => handleSSO('oauth_google')}
          disabled={isLoading !== null}
        >
          {isLoading === 'google' ? (
            <ActivityIndicator color={Colors.text.inverse} />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color={Colors.text.inverse} />
              <Text style={styles.authButtonText}>{copy.googleCta}</Text>
            </>
          )}
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{copy.dividerText}</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.emailCta}
          style={styles.ghostButton}
          onPress={() => router.push('/(onboarding)/sign-up-email')}
          disabled={isLoading !== null}
        >
          <Ionicons name="mail-outline" size={20} color={Colors.text.primary} />
          <Text style={styles.ghostButtonText}>{copy.emailCta}</Text>
        </Pressable>

        <View style={styles.signInRow}>
          <Text style={styles.signInPrompt}>{copy.signInPrompt}</Text>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={copy.signInCta}
            onPress={() => router.push('/(auth)/sign-in')}
          >
            <Text style={styles.signInLink}>{copy.signInCta}</Text>
          </Pressable>
        </View>

        <Text style={styles.legalText}>
          {copy.legalPrefix}
          <Text style={styles.legalLink}>{copy.terms}</Text>
          {copy.and}
          <Text style={styles.legalLink}>{copy.privacy}</Text>
        </Text>
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
    width: 340,
    height: 340,
  },
  authSection: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  error: {
    ...Typography.bodySmall,
    color: Colors.semantic.error,
    textAlign: 'center',
  },
  authButton: {
    height: 52,
    backgroundColor: Colors.text.primary,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  authButtonText: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.text.inverse,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  dividerText: {
    ...Typography.bodySmall,
    color: Colors.text.tertiary,
  },
  ghostButton: {
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  ghostButtonText: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  signInRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Spacing.xs,
  },
  signInPrompt: {
    ...Typography.body,
    color: Colors.text.tertiary,
  },
  signInLink: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.accent,
  },
  legalText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
  legalLink: {
    color: Colors.accent,
  },
});
