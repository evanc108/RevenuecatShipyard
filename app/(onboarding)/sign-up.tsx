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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSSO, useSignIn, useSignUp, useAuth } from '@clerk/clerk-expo';
import { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

export const useWarmUpBrowser = () => {
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
};

WebBrowser.maybeCompleteAuthSession();
import { Image } from 'expo-image';
import { Icon } from '@/components/ui/Icon';
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ONBOARDING_COPY } from '@/constants/onboarding';
import { Colors, FontFamily, NAV_BUTTON_SIZE, Spacing, Radius, Typography } from '@/constants/theme';
import { getClerkErrorMessage } from '@/utils/clerk-error';

type AuthMode = 'signUp' | 'signIn';
type ScreenState = 'form' | 'verify';
const CODE_LENGTH = 6;

export default function AuthScreen() {
  useWarmUpBrowser();
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const copy = ONBOARDING_COPY.auth;
  const { startSSOFlow } = useSSO();
  const { signIn, setActive: setSignInActive, isLoaded: isSignInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: isSignUpLoaded } = useSignUp();
  const { signOut, isSignedIn } = useAuth();
  const insets = useSafeAreaInsets();
  const codeInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const [mode, setMode] = useState<AuthMode>(params.mode === 'signIn' ? 'signIn' : 'signUp');
  const [screenState, setScreenState] = useState<ScreenState>('form');
  const [isLoading, setIsLoading] = useState<'apple' | 'google' | 'email' | null>(null);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [resendSuccess, setResendSuccess] = useState(false);

  const redirectUrl = useMemo(() => Linking.createURL('sso-callback'), []);

  const isSignIn = mode === 'signIn';
  const headline = isSignIn ? copy.signInHeadline : (screenState === 'verify' ? copy.verifyHeadline : copy.signUpHeadline);
  const verifySubhead = `${copy.verifySubhead} ${email}`;

  // Auto-hide resend success
  useEffect(() => {
    if (resendSuccess) {
      const timer = setTimeout(() => setResendSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [resendSuccess]);

  const handleSSO = useCallback(
    async (strategy: 'oauth_apple' | 'oauth_google') => {
      const provider = strategy === 'oauth_apple' ? 'apple' : 'google';
      try {
        setIsLoading(provider);
        setError('');

        if (isSignedIn) {
          await signOut();
        }

        const { createdSessionId, signIn: ssoSignIn, signUp: ssoSignUp, setActive } = await startSSOFlow({
          strategy,
          redirectUrl,
        });

        if (ssoSignUp?.status === 'complete' && ssoSignUp.createdSessionId && setActive) {
          await setActive({ session: ssoSignUp.createdSessionId });
          router.replace('/(onboarding)/profile-setup');
          return;
        }

        if (ssoSignIn?.status === 'complete' && ssoSignIn.createdSessionId && setActive) {
          await setActive({ session: ssoSignIn.createdSessionId });
          router.replace('/(tabs)');
          return;
        }

        if (createdSessionId && setActive) {
          await setActive({ session: createdSessionId });
          router.replace('/(tabs)');
          return;
        }

        setError('Sign in was not completed. Please try again.');
      } catch (err: unknown) {
        setError(getClerkErrorMessage(err, copy.errorFallback));
      } finally {
        setIsLoading(null);
      }
    },
    [startSSOFlow, copy.errorFallback, router, redirectUrl, isSignedIn, signOut],
  );

  const handleEmailSignIn = async () => {
    if (!isSignInLoaded || !signIn || isLoading) {
      if (!isSignInLoaded) setError('Authentication is still loading. Please wait.');
      return;
    }
    setError('');

    try {
      setIsLoading('email');
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === 'complete' && setSignInActive) {
        await setSignInActive({ session: result.createdSessionId });
        router.replace('/(tabs)');
      } else if (result.status === 'needs_first_factor') {
        // Password-based sign-in: attempt first factor
        const firstFactor = await signIn.attemptFirstFactor({
          strategy: 'password',
          password,
        });
        if (firstFactor.status === 'complete' && setSignInActive) {
          await setSignInActive({ session: firstFactor.createdSessionId });
          router.replace('/(tabs)');
        } else {
          setError('Sign in could not be completed. Please try again.');
        }
      } else {
        setError('Sign in could not be completed. Please try again.');
      }
    } catch (err: unknown) {
      setError(getClerkErrorMessage(err, copy.errorFallback));
    } finally {
      setIsLoading(null);
    }
  };

  const handleEmailSignUp = async () => {
    if (!isSignUpLoaded || !signUp || isLoading) return;
    setError('');

    try {
      setIsLoading('email');
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setScreenState('verify');
    } catch (err: unknown) {
      setError(getClerkErrorMessage(err, copy.errorFallback));
    } finally {
      setIsLoading(null);
    }
  };

  const handleVerify = async () => {
    if (!isSignUpLoaded || !signUp || !setSignUpActive || isLoading) return;
    setError('');

    try {
      setIsLoading('email');
      const result = await signUp.attemptEmailAddressVerification({ code });

      if (result.status === 'complete') {
        if (result.createdSessionId) {
          await setSignUpActive({ session: result.createdSessionId });
        }
        router.replace('/(onboarding)/profile-setup');
      } else {
        setError(`Verification incomplete. Status: ${result.status}`);
      }
    } catch (err: unknown) {
      setError(getClerkErrorMessage(err, copy.errorFallback));
    } finally {
      setIsLoading(null);
    }
  };

  const handleResend = async () => {
    if (!isSignUpLoaded || !signUp || isLoading) return;
    try {
      setIsLoading('email');
      setError('');
      setResendSuccess(false);
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setResendSuccess(true);
    } catch (err: unknown) {
      setError(getClerkErrorMessage(err, copy.errorFallback));
    } finally {
      setIsLoading(null);
    }
  };

  const handleCodeChange = (text: string) => {
    setCode(text.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH));
  };

  const toggleMode = () => {
    setMode((prev) => (prev === 'signUp' ? 'signIn' : 'signUp'));
    setScreenState('form');
    setError('');
    setEmail('');
    setPassword('');
    setCode('');
  };

  const handleBack = () => {
    if (screenState === 'verify') {
      setScreenState('form');
      setCode('');
      setError('');
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(onboarding)/welcome');
    }
  };

  const isValidEmail = email.includes('@') && email.includes('.');
  const isValidPassword = password.length >= 8;
  const canSubmit = isValidEmail && (isSignIn || isValidPassword);
  const canSignIn = isValidEmail && password.length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={handleBack}
            hitSlop={8}
            style={styles.backButton}
          >
            <Icon name="arrow-back" size={20} color={Colors.text.inverse} strokeWidth={2} />
          </Pressable>

          <Animated.View
            entering={FadeInDown.delay(0).duration(300)}
          >
            <Image
              source={require('@/assets/images/header_icon.svg')}
              style={styles.headerLogo}
              contentFit="contain"
            />
          </Animated.View>
        </View>

        <KeyboardAwareScrollView
          contentContainerStyle={styles.scrollContent}
        >

          <Animated.View
            key={`headline-${mode}-${screenState}`}
            entering={FadeInDown.delay(0).duration(400)}
            style={styles.headlineContainer}
          >
            <Text style={styles.headline}>{headline}</Text>
            {screenState === 'verify' && (
              <Text style={styles.subhead}>{verifySubhead}</Text>
            )}
          </Animated.View>

          {error ? (
            <Animated.View entering={FadeInDown.duration(200)} style={styles.errorContainer}>
              <Text style={styles.error}>{error}</Text>
            </Animated.View>
          ) : null}

          {screenState === 'verify' ? (
            <Animated.View
              key="verify"
              entering={FadeInDown.delay(50).duration(400)}
              style={styles.formSection}
            >
              <Pressable
                accessibilityRole="button"
                onPress={() => codeInputRef.current?.focus()}
                style={styles.codeContainer}
                accessibilityLabel={copy.codePlaceholder}
              >
                {Array.from({ length: CODE_LENGTH }).map((_, index) => {
                  const isActive = index === code.length && code.length < CODE_LENGTH;
                  const isFilled = index < code.length;
                  return (
                    <View
                      key={index}
                      style={[
                        styles.codeBox,
                        isActive && styles.codeBoxActive,
                        isFilled && styles.codeBoxFilled,
                      ]}
                    >
                      <Text style={styles.codeDigit}>{code[index] ?? ''}</Text>
                    </View>
                  );
                })}
              </Pressable>

              <TextInput
                ref={codeInputRef}
                value={code}
                onChangeText={handleCodeChange}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                maxLength={CODE_LENGTH}
                caretHidden
                autoFocus
                style={styles.hiddenInput}
                accessibilityLabel={copy.codePlaceholder}
              />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.verifyCta}
                style={[styles.primaryButton, code.length < CODE_LENGTH && styles.buttonDisabled]}
                onPress={handleVerify}
                disabled={isLoading !== null || code.length < CODE_LENGTH}
              >
                {isLoading === 'email' ? (
                  <ActivityIndicator color={Colors.text.inverse} />
                ) : (
                  <Text style={styles.primaryButtonText}>{copy.verifyCta}</Text>
                )}
              </Pressable>

              {resendSuccess ? (
                <View style={styles.resendSuccessContainer}>
                  <Icon name="checkmark-circle" size={18} color={Colors.semantic.success} />
                  <Text style={styles.resendSuccessText}>{copy.resendSuccess}</Text>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={copy.resend}
                  onPress={handleResend}
                  hitSlop={8}
                  disabled={isLoading !== null}
                  style={styles.resendButton}
                >
                  <Text style={styles.linkText}>{copy.resend}</Text>
                </Pressable>
              )}
            </Animated.View>
          ) : (
            <Animated.View
              key={`auth-form-${mode}`}
              entering={FadeInDown.delay(100).duration(400)}
              style={styles.formSection}
            >
              {/* OAuth Buttons */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.appleCta}
                style={styles.oauthButton}
                onPress={() => handleSSO('oauth_apple')}
                disabled={isLoading !== null}
              >
                {isLoading === 'apple' ? (
                  <ActivityIndicator color={Colors.text.inverse} />
                ) : (
                  <>
                    <Icon name="logo-apple" size={20} color={Colors.text.inverse} />
                    <Text style={styles.oauthButtonText}>{copy.appleCta}</Text>
                  </>
                )}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.googleCta}
                style={styles.oauthButtonOutline}
                onPress={() => handleSSO('oauth_google')}
                disabled={isLoading !== null}
              >
                {isLoading === 'google' ? (
                  <ActivityIndicator color={Colors.text.primary} />
                ) : (
                  <>
                    <Icon name="logo-google" size={20} color={Colors.text.primary} />
                    <Text style={styles.oauthButtonOutlineText}>{copy.googleCta}</Text>
                  </>
                )}
              </Pressable>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{copy.dividerText}</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Email/Password Form */}
              <TextInput
                style={styles.input}
                placeholder={copy.emailPlaceholder}
                placeholderTextColor={Colors.text.tertiary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="next"
                onSubmitEditing={() => passwordInputRef.current?.focus()}
                accessibilityLabel={copy.emailPlaceholder}
              />

              <TextInput
                ref={passwordInputRef}
                style={styles.input}
                placeholder={isSignIn ? copy.passwordPlaceholder : `${copy.passwordPlaceholder} (${copy.passwordHint})`}
                placeholderTextColor={Colors.text.tertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType={isSignIn ? 'password' : 'newPassword'}
                returnKeyType="done"
                onSubmitEditing={isSignIn ? (canSignIn ? handleEmailSignIn : undefined) : (canSubmit ? handleEmailSignUp : undefined)}
                accessibilityLabel={copy.passwordPlaceholder}
              />

              {isSignIn && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={copy.forgotPassword}
                  style={styles.forgotPasswordButton}
                  onPress={() => router.push('/(auth)/forgot-password')}
                  hitSlop={8}
                >
                  <Text style={styles.forgotPasswordText}>{copy.forgotPassword}</Text>
                </Pressable>
              )}

              {/* Primary CTA */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isSignIn ? copy.signInCta : copy.signUpCta}
                style={[
                  styles.primaryButton,
                  !(isSignIn ? canSignIn : canSubmit) && styles.buttonDisabled,
                ]}
                onPress={isSignIn ? handleEmailSignIn : handleEmailSignUp}
                disabled={isLoading !== null || !(isSignIn ? canSignIn : canSubmit)}
              >
                {isLoading === 'email' ? (
                  <ActivityIndicator color={Colors.text.inverse} />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {isSignIn ? copy.signInCta : copy.signUpCta}
                  </Text>
                )}
              </Pressable>

              {/* Mode Toggle */}
              <View style={styles.toggleRow}>
                <Text style={styles.togglePrompt}>
                  {isSignIn ? copy.signUpTogglePrompt : copy.signInTogglePrompt}
                </Text>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={isSignIn ? copy.signUpToggleCta : copy.signInToggleCta}
                  onPress={toggleMode}
                  hitSlop={8}
                >
                  <Text style={styles.toggleLink}>
                    {isSignIn ? copy.signUpToggleCta : copy.signInToggleCta}
                  </Text>
                </Pressable>
              </View>

              {/* Legal Text (sign-up only) */}
              {!isSignIn && (
                <Text style={styles.legalText}>
                  {copy.legalPrefix}
                  <Text
                    style={styles.legalLink}
                    onPress={() => router.push('/(onboarding)/terms')}
                    accessibilityRole="link"
                  >
                    {copy.terms}
                  </Text>
                  {copy.and}
                  <Text
                    style={styles.legalLink}
                    onPress={() => router.push('/(onboarding)/privacy')}
                    accessibilityRole="link"
                  >
                    {copy.privacy}
                  </Text>
                </Text>
              )}
            </Animated.View>
          )}
        </KeyboardAwareScrollView>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  backButton: {
    width: NAV_BUTTON_SIZE,
    height: NAV_BUTTON_SIZE,
    borderRadius: NAV_BUTTON_SIZE / 2,
    backgroundColor: Colors.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogo: {
    width: 100,
    height: 60,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.xl,
  },
  headlineContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  headline: {
    fontSize: 36,
    fontFamily: FontFamily.regular,
    fontWeight: '400',
    color: Colors.text.primary,
    letterSpacing: -0.5,
    lineHeight: 44,
  },
  subhead: {
    ...Typography.body,
    color: Colors.text.secondary,
    fontSize: 16,
    lineHeight: 24,
  },
  errorContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  error: {
    ...Typography.bodySmall,
    color: Colors.semantic.error,
    textAlign: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  formSection: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  oauthButton: {
    height: 52,
    backgroundColor: Colors.text.primary,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  oauthButtonText: {
    ...Typography.body,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    color: Colors.text.inverse,
  },
  oauthButtonOutline: {
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background.primary,
  },
  oauthButtonOutlineText: {
    ...Typography.body,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
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
  input: {
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.background.secondary,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
    color: Colors.text.primary,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: -Spacing.sm,
  },
  forgotPasswordText: {
    ...Typography.bodySmall,
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    color: Colors.accent,
  },
  primaryButton: {
    height: 52,
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    fontSize: 16,
    color: Colors.text.inverse,
  },
  buttonDisabled: {
    opacity: 0.5,
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
    fontFamily: FontFamily.semibold,
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
    fontFamily: FontFamily.medium,
    fontWeight: '500',
  },
  // Verification code styles
  codeContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  codeBox: {
    flex: 1,
    height: 60,
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  codeBoxActive: {
    borderColor: Colors.accent,
  },
  codeBoxFilled: {
    backgroundColor: Colors.background.tertiary,
  },
  codeDigit: {
    fontSize: 26,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  resendButton: {
    alignSelf: 'center',
  },
  linkText: {
    ...Typography.body,
    color: Colors.accent,
    textAlign: 'center',
  },
  resendSuccessContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  resendSuccessText: {
    ...Typography.body,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    color: Colors.semantic.success,
  },
});
