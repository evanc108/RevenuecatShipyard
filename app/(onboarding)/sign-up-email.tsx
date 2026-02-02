import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSignUp } from '@clerk/clerk-expo';
import { useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ONBOARDING_COPY } from '@/constants/onboarding';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';

// Illustration: Nature illustrations by Storyset (https://storyset.com/nature)

type ScreenMode = 'email' | 'verify';

const CODE_LENGTH = 6;

function getClerkErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null && 'errors' in err) {
    const errors = err.errors;
    if (Array.isArray(errors) && errors.length > 0) {
      const first: unknown = errors[0];
      if (typeof first === 'object' && first !== null && 'message' in first) {
        if (typeof first.message === 'string') {
          return first.message;
        }
      }
    }
  }
  return fallback;
}

export default function SignUpEmailScreen() {
  const router = useRouter();
  const copy = ONBOARDING_COPY.signUp;
  const { signUp, setActive, isLoaded } = useSignUp();
  const insets = useSafeAreaInsets();
  const codeInputRef = useRef<TextInput>(null);

  const [mode, setMode] = useState<ScreenMode>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState<'email' | 'verify' | null>(null);
  const [error, setError] = useState('');

  const handleEmailSubmit = async () => {
    if (!isLoaded || !signUp) return;
    try {
      setIsLoading('email');
      setError('');
      await signUp.create({ emailAddress: email });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setMode('verify');
    } catch (err: unknown) {
      setError(getClerkErrorMessage(err, copy.errorFallback));
    } finally {
      setIsLoading(null);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded || !signUp || !setActive) return;
    try {
      setIsLoading('verify');
      setError('');
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === 'complete' && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        router.replace('/(onboarding)/goals');
      }
    } catch (err: unknown) {
      setError(getClerkErrorMessage(err, copy.errorFallback));
    } finally {
      setIsLoading(null);
    }
  };

  const handleResend = async () => {
    if (!isLoaded || !signUp) return;
    try {
      setError('');
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
    } catch (err: unknown) {
      setError(getClerkErrorMessage(err, copy.errorFallback));
    }
  };

  const handleBack = () => {
    if (mode === 'verify') {
      setMode('email');
      setCode('');
      setError('');
    } else {
      router.back();
    }
  };

  const handleCodeChange = (text: string) => {
    setCode(text.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH));
  };

  const isValidEmail = email.includes('@') && email.includes('.');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={handleBack}
        hitSlop={8}
        style={styles.backButton}
      >
        <Ionicons name="chevron-back" size={28} color={Colors.text.primary} />
      </Pressable>

      <Animated.View
        entering={FadeInDown.delay(0).duration(400)}
        style={styles.headlineContainer}
      >
        <Text style={styles.headline}>
          {mode === 'verify' ? copy.verifyHeadline : copy.headline}
        </Text>
        {mode === 'verify' && (
          <Text style={styles.subhead}>
            {copy.verifySubtitle} {email}
          </Text>
        )}
      </Animated.View>

      {mode === 'email' && (
        <Animated.View
          key="email"
          entering={FadeInDown.delay(50).duration(400)}
          style={styles.formSection}
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TextInput
            style={styles.textInput}
            placeholder={copy.emailPlaceholder}
            placeholderTextColor={Colors.text.tertiary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoFocus
            accessibilityLabel={copy.emailPlaceholder}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.sendCode}
            style={[styles.primaryButton, !isValidEmail && styles.buttonDisabled]}
            onPress={handleEmailSubmit}
            disabled={isLoading !== null || !isValidEmail}
          >
            {isLoading === 'email' ? (
              <ActivityIndicator color={Colors.text.inverse} />
            ) : (
              <Text style={styles.primaryButtonText}>{copy.sendCode}</Text>
            )}
          </Pressable>
        </Animated.View>
      )}

      {mode === 'verify' && (
        <Animated.View
          key="verify"
          entering={FadeInDown.delay(50).duration(400)}
          style={styles.formSection}
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
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
            accessibilityLabel={copy.verify}
            style={[
              styles.primaryButton,
              code.length < CODE_LENGTH && styles.buttonDisabled,
            ]}
            onPress={handleVerify}
            disabled={isLoading !== null || code.length < CODE_LENGTH}
          >
            {isLoading === 'verify' ? (
              <ActivityIndicator color={Colors.text.inverse} />
            ) : (
              <Text style={styles.primaryButtonText}>{copy.verify}</Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.resend}
            onPress={handleResend}
            hitSlop={8}
          >
            <Text style={styles.linkText}>{copy.resend}</Text>
          </Pressable>
        </Animated.View>
      )}

      <Animated.View
        entering={FadeInDown.delay(100).duration(400)}
        style={styles.illustrationContainer}
      >
        <Image
          source={require('@/assets/images/sign-up-email-icon.png')}
          style={styles.illustration}
          contentFit="contain"
        />
      </Animated.View>

      <View
        style={[
          styles.legalContainer,
          { paddingBottom: Math.max(insets.bottom, Spacing.md) },
        ]}
      >
        <Text style={styles.legalText}>
          {copy.legalPrefix}
          <Text style={styles.legalLink}>{copy.terms}</Text>
          {copy.and}
          <Text style={styles.legalLink}>{copy.privacy}</Text>
        </Text>
      </View>
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
    gap: Spacing.sm,
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
  },
  formSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },
  error: {
    ...Typography.bodySmall,
    color: Colors.semantic.error,
    textAlign: 'center' as const,
  },
  textInput: {
    height: 52,
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
    color: Colors.text.primary,
  },
  primaryButton: {
    height: 52,
    backgroundColor: Colors.text.primary,
    borderRadius: Radius.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.text.inverse,
  },
  codeContainer: {
    flexDirection: 'row' as const,
    gap: Spacing.sm,
  },
  codeBox: {
    flex: 1,
    height: 60,
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  codeBoxActive: {
    borderColor: Colors.text.primary,
  },
  codeBoxFilled: {
    backgroundColor: Colors.background.tertiary,
  },
  codeDigit: {
    fontSize: 26,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  hiddenInput: {
    position: 'absolute' as const,
    width: 1,
    height: 1,
    opacity: 0,
  },
  linkText: {
    ...Typography.body,
    color: Colors.accent,
    textAlign: 'center' as const,
  },
  illustrationContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  illustration: {
    width: 280,
    height: 280,
  },
  legalContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  legalText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    textAlign: 'center' as const,
    lineHeight: 18,
  },
  legalLink: {
    color: Colors.accent,
  },
});
