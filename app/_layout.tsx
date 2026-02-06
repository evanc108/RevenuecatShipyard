import '@/components/share-extension'; // side-effect: registers AppRegistry component for share extension

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { useFonts, Lora_400Regular, Lora_500Medium, Lora_600SemiBold, Lora_700Bold } from '@expo-google-fonts/lora';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

import { api } from '@/convex/_generated/api';
import { ClerkLoaded, ClerkProvider, useAuth, useUser } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { ConvexReactClient, useMutation, useQuery } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';

import { useColorScheme } from '@/hooks/use-color-scheme';

import { AddModal } from '@/components/ui/AddModal';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { AddModalProvider } from '@/context/AddModalContext';
import { ShareIntentProvider } from '@/context/ShareIntentContext';
import { AddPantryItemModal } from '@/components/features/pantry/AddPantryItemModal';
import { GenerateMealPlanModal } from '@/components/features/pantry/GenerateMealPlanModal';
import { useCookbookCacheSync } from '@/hooks/useCookbookCacheSync';
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
  const createAttempts = useRef(0);

  // Ensure a Convex user record exists when signed in
  useEffect(() => {
    // convexUser: undefined = loading, null = not found, object = exists
    // Only proceed if: signed in, have clerk user, convexUser is null (not found), not already creating
    if (!isSignedIn || !clerkUser || convexUser !== null || isCreatingUser.current) return;

    // Limit retry attempts to prevent rate limiting - only try once per session
    if (createAttempts.current >= 1) {
      return;
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) return;

    isCreatingUser.current = true;
    createAttempts.current += 1;

    createOrGet({
      email,
      firstName: clerkUser.firstName ?? undefined,
      lastName: clerkUser.lastName ?? undefined,
      imageUrl: clerkUser.imageUrl ?? undefined,
    })
      .then(() => {
        // Success - the query should update automatically
        isCreatingUser.current = false;
      })
      .catch(() => {
        // Failed - don't retry automatically, let timeout fallback handle it
        isCreatingUser.current = false;
      });
    // Note: createOrGet intentionally not in deps - we only want to trigger on auth state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, clerkUser?.id, convexUser]);

  // Reset refs on sign out
  useEffect(() => {
    if (!isSignedIn) {
      isCreatingUser.current = false;
      hasNavigated.current = false;
      createAttempts.current = 0;
    }
  }, [isSignedIn]);

  // Timeout fallback: if signed in but convexUser never resolves, force navigation
  useEffect(() => {
    if (!isSignedIn || !isLoaded || convexUser || hasNavigated.current) return;

    const timeout = setTimeout(() => {
      if (isSignedIn && !convexUser && !hasNavigated.current) {
        console.warn('AuthGuard: Timeout waiting for Convex user, forcing navigation');
        hasNavigated.current = true;
        router.replace('/(onboarding)/profile-setup');
      }
    }, 5000); // 5 second timeout

    return () => clearTimeout(timeout);
  }, [isSignedIn, isLoaded, convexUser, router]);

  // Sync cookbooks to App Groups for the share extension
  useCookbookCacheSync();

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

  const [fontsLoaded, fontError] = useFonts({
    Lora_400Regular,
    Lora_500Medium,
    Lora_600SemiBold,
    Lora_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ClerkProvider
        tokenCache={tokenCache}
        publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      >
        <ClerkLoaded>
          <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
            <GluestackUIProvider mode="dark">
              <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <AuthGuard>
                  <ShareIntentProvider>
                    <AddModalProvider>
                      <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="index" />
                        <Stack.Screen name="(onboarding)" />
                        <Stack.Screen name="(auth)" />
                        <Stack.Screen name="(tabs)" />
                        <Stack.Screen name="cookbook/[cookbookId]" />
                        <Stack.Screen name="recipe/[id]" />
                        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', headerShown: true }} />
                      </Stack>
                      <AddModal />
                      <AddPantryItemModal />
                      <GenerateMealPlanModal />
                    </AddModalProvider>
                  </ShareIntentProvider>
                </AuthGuard>
                <StatusBar style="auto" />
              </ThemeProvider>
            </GluestackUIProvider>
          </ConvexProviderWithClerk>
        </ClerkLoaded>
      </ClerkProvider>
    </GestureHandlerRootView>
  );
}
