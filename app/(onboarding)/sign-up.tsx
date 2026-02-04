import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSSO, useSignIn } from '@clerk/clerk-expo';
import { useCallback, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ONBOARDING_COPY } from '@/constants/onboarding';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { getClerkErrorMessage } from '@/utils/clerk-error';

type AuthMode = 'signUp' | 'signIn';

export default function AuthScreen() {
  const router = useRouter();
  const copy = ONBOARDING_COPY.signUp;
  const { startSSOFlow } = useSSO();
  const { signIn, setActive: setSignInActive, isLoaded: isSignInLoaded } = useSignIn();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<AuthMode>('signUp');
  const [isLoading, setIsLoading] = useState<'apple' | 'google' | 'email' | null>(null);
  const [error, setError] = useState('');

  // Sign-in form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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
          // Navigate based on mode - sign in goes to tabs, sign up goes to onboarding
          if (mode === 'signIn') {
            router.replace('/(tabs)');
          } else {
            router.replace('/(onboarding)/profile-setup');
          }
        }
      } catch (err: unknown) {
        setError(getClerkErrorMessage(err, copy.errorFallback));
      } finally {
        setIsLoading(null);
      }
    },
    [startSSOFlow, copy.errorFallback, router, mode],
  );

  const handleEmailSignIn = async () => {
    if (!isSignInLoaded || !signIn) return;
    setError('');

    try {
      setIsLoading('email');
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === 'complete' && setSignInActive) {
        await setSignInActive({ session: result.createdSessionId });
        // Navigate to tabs for returning users
        router.replace('/(tabs)');
      }
    } catch (err: unknown) {
      setError(getClerkErrorMessage(err, copy.errorFallback));
    } finally {
      setIsLoading(null);
    }
  };

  const toggleMode = () => {
    setMode((prev) => (prev === 'signUp' ? 'signIn' : 'signUp'));
    setError('');
    setEmail('');
    setPassword('');
  };

  const isSignIn = mode === 'signIn';
  const headline = isSignIn ? 'Welcome\nback!' : copy.headline;
  const togglePrompt = isSignIn ? 'Need an account? ' : copy.signInPrompt;
  const toggleCta = isSignIn ? 'Sign up' : copy.signInCta;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.backButton}
        >
          <Icon name="chevron-back" size={28} color={Colors.text.primary} />
        </Pressable>

        <Animated.View
          key={`headline-${mode}`}
          entering={FadeInDown.delay(0).duration(400)}
          style={styles.headlineContainer}
        >
          <Text style={styles.headline}>{headline}</Text>
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
          key={`auth-${mode}`}
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
                <Icon name="logo-apple" size={20} color={Colors.text.inverse} />
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
                <Icon name="logo-google" size={20} color={Colors.text.inverse} />
                <Text style={styles.authButtonText}>{copy.googleCta}</Text>
              </>
            )}
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{copy.dividerText}</Text>
            <View style={styles.dividerLine} />
          </View>

          {isSignIn ? (
            <View style={styles.emailForm}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={Colors.text.tertiary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={Colors.text.tertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="password"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Forgot Password"
                style={styles.forgotPasswordButton}
                onPress={() => router.push('/(auth)/forgot-password')}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign in"
                style={[styles.primaryButton, (!email || !password) && styles.buttonDisabled]}
                onPress={handleEmailSignIn}
                disabled={isLoading !== null || !email || !password}
              >
                {isLoading === 'email' ? (
                  <ActivityIndicator color={Colors.text.inverse} />
                ) : (
                  <Text style={styles.primaryButtonText}>Sign in</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.emailCta}
              style={styles.ghostButton}
              onPress={() => router.push('/(onboarding)/sign-up-email')}
              disabled={isLoading !== null}
            >
              <Icon name="mail-outline" size={20} color={Colors.text.primary} />
              <Text style={styles.ghostButtonText}>{copy.emailCta}</Text>
            </Pressable>
          )}

          <View style={styles.toggleRow}>
            <Text style={styles.togglePrompt}>{togglePrompt}</Text>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={toggleCta}
              onPress={toggleMode}
            >
              <Text style={styles.toggleLink}>{toggleCta}</Text>
            </Pressable>
          </View>

          {!isSignIn && (
            <Text style={styles.legalText}>
              {copy.legalPrefix}
              <Text style={styles.legalLink}>{copy.terms}</Text>
              {copy.and}
              <Text style={styles.legalLink}>{copy.privacy}</Text>
            </Text>
          )}
        </Animated.View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
    width: 280,
    height: 280,
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
  emailForm: {
    gap: Spacing.sm,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    ...Typography.bodySmall,
    color: Colors.accent,
    fontWeight: '500',
  },
  input: {
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.background.secondary,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
    color: Colors.text.primary,
  },
  primaryButton: {
    height: 52,
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.text.inverse,
  },
  buttonDisabled: {
    opacity: 0.5,
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
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Spacing.xs,
  },
  togglePrompt: {
    ...Typography.body,
    color: Colors.text.tertiary,
  },
  toggleLink: {
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
