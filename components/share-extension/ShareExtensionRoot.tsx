/**
 * Minimal share extension component that redirects to the main app.
 *
 * Runs in the iOS share extension process (no Convex/Clerk auth).
 * Extracts the shared URL, writes it to App Groups as a pending import,
 * then opens the host app and dismisses the extension.
 *
 * The main app picks up the pending import and shows the AddModal
 * for cookbook selection and import.
 *
 * Props come from Swift initialProperties (url, text, etc.).
 */

import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import ShareExtensionBridge from '@/modules/share-extension-bridge';
import { addPendingImport } from '@/lib/appGroups';

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^[\]`]+/gi;

function extractUrlFromText(text: string): string | null {
  const matches = text.match(URL_REGEX);
  return matches?.[0] ?? null;
}

// ---------------------------------------------------------------------------
// Props from Swift initialProperties
// ---------------------------------------------------------------------------

type ShareExtensionProps = {
  url?: string;
  text?: string;
  images?: string[];
  initialViewWidth?: number;
  initialViewHeight?: number;
};

// ---------------------------------------------------------------------------
// Inline theme tokens
// ---------------------------------------------------------------------------

const C = {
  accent: '#ED7935',
  bgPrimary: '#FFFFFF',
  textSecondary: '#6B6B6B',
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShareExtensionRoot(props: ShareExtensionProps): React.ReactElement {
  const { url: rawUrl, text } = props;
  const resolvedUrl = rawUrl ?? (text ? extractUrlFromText(text) : null);
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const redirect = async () => {
      if (resolvedUrl) {
        await addPendingImport({ url: resolvedUrl });
      }

      // Open the host app — the pending import will be picked up on foreground
      ShareExtensionBridge.openHostApp('');

      // Small delay to ensure host app opens before dismissing extension
      setTimeout(() => {
        ShareExtensionBridge.close();
      }, 300);
    };

    redirect();
  }, [resolvedUrl]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={styles.text}>Opening app...</Text>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bgPrimary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  text: {
    fontSize: 16,
    color: C.textSecondary,
    fontWeight: '500',
  },
});
