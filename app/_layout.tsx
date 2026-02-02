import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import 'react-native-reanimated';

import { ClerkProvider, ClerkLoaded, useAuth, useUser } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient } from 'convex/react';

import { useColorScheme } from '@/hooks/use-color-scheme';

import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import '@/global.css';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const segments = useSegments();
  const router = useRouter();
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;

    const firstSegment = segments[0];
    const inAuthGroup = firstSegment === '(auth)';
    const inTabsGroup = firstSegment === '(tabs)';

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
      // Signed in
      const hasOnboarded = user?.unsafeMetadata?.hasCompletedOnboarding;

      if (inAuthGroup) {
        // Redirect away from auth screens
        if (!hasNavigated.current) {
          hasNavigated.current = true;
          if (hasOnboarded) {
            router.replace('/(tabs)');
          } else {
            router.replace('/(onboarding)/goals');
          }
        }
      } else if (!hasOnboarded && inTabsGroup) {
        // Not onboarded but trying to access tabs
        if (!hasNavigated.current) {
          hasNavigated.current = true;
          router.replace('/(onboarding)/goals');
        }
      } else {
        hasNavigated.current = false;
      }
    }
  }, [isSignedIn, isLoaded, user]);

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
