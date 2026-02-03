import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import 'react-native-reanimated';

import { ClerkProvider, ClerkLoaded, useAuth, useUser } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient, useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

import { useColorScheme } from '@/hooks/use-color-scheme';

import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import '@/global.css';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const { user: clerkUser } = useUser();
  const convexUser = useQuery(api.users.current);
  const createOrGet = useMutation(api.users.createOrGet);
  const segments = useSegments();
  const router = useRouter();
  const hasNavigated = useRef(false);
  const isCreatingUser = useRef(false);

  // Ensure a Convex user record exists when signed in
  useEffect(() => {
    // convexUser: undefined = loading, null = not found, object = exists
    // undefined !== null → true, so loading is skipped
    // object !== null → true, so existing user is skipped
    // null !== null → false, so we proceed to create
    if (!isSignedIn || !clerkUser || convexUser !== null || isCreatingUser.current) return;

    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) return;

    isCreatingUser.current = true;
    createOrGet({
      email,
      firstName: clerkUser.firstName ?? undefined,
      lastName: clerkUser.lastName ?? undefined,
      imageUrl: clerkUser.imageUrl ?? undefined,
    }).catch(() => {
      // May fail if Convex token hasn't arrived yet; will retry on next query update
      isCreatingUser.current = false;
    });
  }, [isSignedIn, clerkUser?.id, convexUser]);

  // Reset refs on sign out
  useEffect(() => {
    if (!isSignedIn) {
      isCreatingUser.current = false;
      hasNavigated.current = false;
    }
  }, [isSignedIn]);

  // Auth routing — reads segments inside effect, not in deps (avoids redirect loops)
  useEffect(() => {
    if (!isLoaded) return;
    // When signed in, wait for Convex user record to load before routing.
    // convexUser can be undefined (loading) or null (token not yet propagated)
    // before resolving to the actual user object — don't route until we have it.
    if (isSignedIn && !convexUser) return;

    const firstSegment = segments[0];
    const inAuthGroup = firstSegment === '(auth)';
    const inTabsGroup = firstSegment === '(tabs)';
    const inOnboardingGroup = firstSegment === '(onboarding)';

    if (!isSignedIn) {
      // Not signed in — only block access to (tabs)
      if (inTabsGroup) {
        if (!hasNavigated.current) {
          hasNavigated.current = true;
          router.replace('/(onboarding)/welcome');
        }
      } else {
        hasNavigated.current = false;
      }
    } else {
      // Signed in — use Convex for onboarding status
      const hasOnboarded = convexUser?.hasCompletedOnboarding ?? false;

      if (inAuthGroup) {
        // Redirect away from auth screens
        if (!hasNavigated.current) {
          hasNavigated.current = true;
          if (hasOnboarded) {
            router.replace('/(tabs)');
          } else {
            router.replace('/(onboarding)/profile-setup');
          }
        }
      } else if (inOnboardingGroup) {
        // Signed in and in onboarding group
        const screen = segments[1];
        const preAuthScreens = ['welcome', 'info', 'sign-up', 'sign-up-email'];
        const onPreAuthScreen = typeof screen === 'string' && preAuthScreens.includes(screen);

        if (hasOnboarded) {
          // Returning user — skip straight to tabs
          if (!hasNavigated.current) {
            hasNavigated.current = true;
            router.replace('/(tabs)');
          }
        } else if (onPreAuthScreen) {
          // New user still on a sign-up/intro screen — advance to goals
          if (!hasNavigated.current) {
            hasNavigated.current = true;
            router.replace('/(onboarding)/profile-setup');
          }
        } else {
          hasNavigated.current = false;
        }
      } else if (!hasOnboarded && inTabsGroup) {
        // Not onboarded but trying to access tabs
        if (!hasNavigated.current) {
          hasNavigated.current = true;
          router.replace('/(onboarding)/profile-setup');
        }
      } else {
        hasNavigated.current = false;
      }
    }
  }, [isSignedIn, isLoaded, convexUser]);

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ClerkProvider
      tokenCache={tokenCache}
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
    >
      <ClerkLoaded>
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <GluestackUIProvider mode="dark">
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <AuthGuard>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="(onboarding)" />
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', headerShown: true }} />
                </Stack>
              </AuthGuard>
              <StatusBar style="auto" />
            </ThemeProvider>
          </GluestackUIProvider>
        </ConvexProviderWithClerk>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
