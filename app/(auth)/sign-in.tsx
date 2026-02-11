import { useSSO, useSignIn, useAuth } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';
import { useCallback, useState, useMemo } from 'react';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { COPY } from '@/constants/copy';

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startSSOFlow } = useSSO();
  const { signOut, isSignedIn } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Generate redirect URL for OAuth - needed for Expo Go on physical devices
  const redirectUrl = useMemo(() => Linking.createURL('sso-callback'), []);

  const onSignIn = async () => {
    if (!isLoaded) return;
    setError('');

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(tabs)');
      }
    } catch (err: unknown) {
      const clerkError = err as { errors?: Array<{ message: string }> };
      setError(clerkError.errors?.[0]?.message ?? COPY.auth.errors.generic);
    }
  };

  const onSSOSignIn = useCallback(
    async (strategy: 'oauth_apple' | 'oauth_google') => {
      setError('');
      try {
        // Clear any existing session before starting OAuth
        if (isSignedIn) {
          await signOut();
        }

        const { createdSessionId, signIn: ssoSignIn, signUp: ssoSignUp, setActive: setOAuthActive } = await startSSOFlow({
          strategy,
          redirectUrl,
        });

        // Handle completed sign-up (new user via SSO) - redirect to onboarding
        // Check this FIRST since createdSessionId can be set for new users too
        if (ssoSignUp?.status === 'complete' && ssoSignUp.createdSessionId && setOAuthActive) {
          await setOAuthActive({ session: ssoSignUp.createdSessionId });
          router.replace('/(onboarding)/profile-setup');
          return;
        }

        // Handle completed sign-in (existing user via SSO)
        if (ssoSignIn?.status === 'complete' && ssoSignIn.createdSessionId && setOAuthActive) {
          await setOAuthActive({ session: ssoSignIn.createdSessionId });
          router.replace('/(tabs)');
          return;
        }

        // Handle direct session creation (fallback - AuthGuard will redirect if needed)
        if (createdSessionId && setOAuthActive) {
          await setOAuthActive({ session: createdSessionId });
          router.replace('/(tabs)');
          return;
        }

        // If we get here, something unexpected happened
        setError('Sign in was not completed. Please try again.');
      } catch (err: unknown) {
        const clerkError = err as { errors?: Array<{ message: string }> };
        setError(clerkError.errors?.[0]?.message ?? COPY.auth.errors.generic);
      }
    },
    [startSSOFlow, router, redirectUrl, isSignedIn, signOut],
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{COPY.auth.signInTitle}</Text>
          <Text style={styles.subtitle}>{COPY.auth.signInSubtitle}</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.oauthSection}>
          <TouchableOpacity
            style={styles.oauthButton}
            onPress={() => onSSOSignIn('oauth_apple')}
            activeOpacity={0.7}
          >
            <Icon name="logo-apple" size={20} color={Colors.text.primary} />
            <Text style={styles.oauthButtonText}>{COPY.auth.continueWithApple}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.oauthButton}
            onPress={() => onSSOSignIn('oauth_google')}
            activeOpacity={0.7}
          >
            <Icon name="logo-google" size={20} color={Colors.text.primary} />
            <Text style={styles.oauthButtonText}>{COPY.auth.continueWithGoogle}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{COPY.auth.orContinueWithEmail}</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder={COPY.auth.email}
            placeholderTextColor={Colors.text.tertiary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            style={styles.input}
            placeholder={COPY.auth.password}
            placeholderTextColor={Colors.text.tertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.forgotPasswordButton}
            onPress={() => router.push('/(auth)/forgot-password')}
            activeOpacity={0.7}
          >
            <Text style={styles.forgotPasswordText}>{COPY.auth.forgotPassword}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryButton} onPress={onSignIn} activeOpacity={0.8}>
            <Text style={styles.primaryButtonText}>{COPY.auth.signIn}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{COPY.auth.noAccount}</Text>
          <Link href="/(auth)/sign-up" asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>{COPY.auth.signUp}</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: Spacing.xxl,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.h1,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.text.secondary,
  },
  error: {
    ...Typography.bodySmall,
    color: Colors.semantic.error,
    marginBottom: Spacing.md,
  },
  oauthSection: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  oauthButton: {
    height: 52,
    borderRadius: Radius.lg,
    backgroundColor: Colors.background.primary,
    borderWidth: 1.5,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  oauthButtonText: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    marginHorizontal: Spacing.md,
  },
  form: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
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
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  primaryButtonText: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.text.inverse,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    ...Typography.body,
    color: Colors.text.secondary,
  },
  footerLink: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.accent,
  },
});
