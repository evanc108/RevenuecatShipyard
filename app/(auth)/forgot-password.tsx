import { useSignIn, useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Text,
  TextInput,
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors, FontFamily, NAV_BUTTON_SIZE, Spacing, Radius, Typography } from '@/constants/theme';
import { getClerkErrorMessage } from '@/utils/clerk-error';

export default function ForgotPasswordScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { signOut, isSignedIn } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [isLoading, setIsLoading] = useState(false);

  const onRequestReset = async () => {
    if (!isLoaded || isLoading) return;
    setError('');
    setSuccessMessage('');

    try {
      setIsLoading(true);
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email,
      });
      setStep('reset');
    } catch (err: unknown) {
      setError(getClerkErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  const onResetPassword = async () => {
    if (!isLoaded || isLoading) return;
    setError('');

    try {
      setIsLoading(true);

      if (isSignedIn) {
        await signOut();
      }

      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code,
        password: newPassword,
      });

      if (result.status === 'complete' && result.createdSessionId && setActive) {
        await setActive({ session: result.createdSessionId });
        setSuccessMessage('Password reset successfully');
        router.replace('/(tabs)');
      } else {
        setError('Password reset could not be completed. Please try again.');
      }
    } catch (err: unknown) {
      setError(getClerkErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'reset') {
      setStep('email');
      setCode('');
      setNewPassword('');
      setError('');
      setSuccessMessage('');
    } else {
      router.back();
    }
  };

  const canRequestReset = email.includes('@') && email.includes('.');
  const canReset = code.length > 0 && newPassword.length >= 8;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={handleBack}
          hitSlop={8}
          style={styles.backButton}
        >
          <Icon name="arrow-back" size={20} color={Colors.text.inverse} strokeWidth={2} />
        </Pressable>

        <KeyboardAwareScrollView contentContainerStyle={styles.scrollContent}>
          <Animated.View
            key={`header-${step}`}
            entering={FadeInDown.duration(400)}
            style={styles.headerContainer}
          >
            <Text style={styles.headline}>
              {step === 'email' ? 'Reset\npassword' : 'Enter new\npassword'}
            </Text>
            <Text style={styles.subhead}>
              {step === 'email'
                ? "Enter your email and we'll send you a reset code"
                : 'Enter the code from your email and your new password'}
            </Text>
          </Animated.View>

          {error ? (
            <Animated.View entering={FadeInDown.duration(200)} style={styles.errorContainer}>
              <Text style={styles.error}>{error}</Text>
            </Animated.View>
          ) : null}

          {successMessage ? (
            <Animated.View entering={FadeInDown.duration(200)} style={styles.successContainer}>
              <Icon name="checkmark-circle" size={18} color={Colors.semantic.success} />
              <Text style={styles.success}>{successMessage}</Text>
            </Animated.View>
          ) : null}

          <Animated.View
            key={`form-${step}`}
            entering={FadeInDown.delay(100).duration(400)}
            style={styles.formSection}
          >
            {step === 'email' ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Email address"
                  placeholderTextColor={Colors.text.tertiary}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={canRequestReset ? onRequestReset : undefined}
                  accessibilityLabel="Email address"
                />

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Send reset code"
                  style={[styles.primaryButton, !canRequestReset && styles.buttonDisabled]}
                  onPress={onRequestReset}
                  disabled={isLoading || !canRequestReset}
                >
                  {isLoading ? (
                    <ActivityIndicator color={Colors.text.inverse} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Send Reset Code</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Reset code"
                  placeholderTextColor={Colors.text.tertiary}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoFocus
                  accessibilityLabel="Reset code"
                />

                <TextInput
                  style={styles.input}
                  placeholder="New password (min 8 characters)"
                  placeholderTextColor={Colors.text.tertiary}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  textContentType="newPassword"
                  returnKeyType="done"
                  onSubmitEditing={canReset ? onResetPassword : undefined}
                  accessibilityLabel="New password"
                />

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Reset password"
                  style={[styles.primaryButton, !canReset && styles.buttonDisabled]}
                  onPress={onResetPassword}
                  disabled={isLoading || !canReset}
                >
                  {isLoading ? (
                    <ActivityIndicator color={Colors.text.inverse} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Reset Password</Text>
                  )}
                </Pressable>
              </>
            )}
          </Animated.View>
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
  backButton: {
    width: NAV_BUTTON_SIZE,
    height: NAV_BUTTON_SIZE,
    borderRadius: NAV_BUTTON_SIZE / 2,
    backgroundColor: Colors.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
    marginTop: Spacing.md,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.xl,
  },
  headerContainer: {
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
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  success: {
    ...Typography.body,
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    color: Colors.semantic.success,
  },
  formSection: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
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
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    fontSize: 16,
    color: Colors.text.inverse,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
