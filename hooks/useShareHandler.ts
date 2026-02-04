/**
 * Hook for handling incoming share intents and deep links.
 *
 * Listens to Linking events for:
 * - Android SEND intents (text/plain with URL)
 * - Deep links: revenuecatshipyard://import?url=...
 *
 * Extracts URLs from shared text and exposes pending share state.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import * as Linking from 'expo-linking';
import { AppState, AppStateStatus } from 'react-native';

/** Domains known to contain recipe content */
const RECIPE_DOMAINS = [
  'tiktok.com',
  'vm.tiktok.com',
  'instagram.com',
  'youtube.com',
  'youtu.be',
  'pinterest.com',
  'pin.it',
  'facebook.com',
  'fb.watch',
  'twitter.com',
  'x.com',
  // Recipe websites
  'allrecipes.com',
  'food.com',
  'tasty.co',
  'delish.com',
  'epicurious.com',
  'bonappetit.com',
  'seriouseats.com',
  'foodnetwork.com',
  'simplyrecipes.com',
  'budgetbytes.com',
  'minimalistbaker.com',
  'halfbakedharvest.com',
  'cookieandkate.com',
  'loveandlemons.com',
];

/** URL regex pattern */
const URL_REGEX = /https?:\/\/[^\s<>"\{\}\|\\\^\[\]`]+/gi;

type UseShareHandlerResult = {
  /** Pending URL from share intent or deep link */
  pendingUrl: string | null;
  /** Clear the pending URL (after handling) */
  clearPendingUrl: () => void;
  /** Manually trigger an import with a URL */
  triggerImport: (url: string) => void;
};

/**
 * Extract the first valid URL from text content.
 */
function extractUrl(text: string): string | null {
  const matches = text.match(URL_REGEX);
  if (!matches) return null;

  // Return the first URL that looks like a recipe source
  for (const url of matches) {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      // Check if it's from a known recipe domain
      if (RECIPE_DOMAINS.some((domain) => hostname.includes(domain))) {
        return url;
      }
    } catch {
      // Invalid URL, skip
    }
  }

  // If no known recipe domain, return the first valid URL
  try {
    new URL(matches[0]);
    return matches[0];
  } catch {
    return null;
  }
}

/**
 * Check if a URL is a valid recipe URL (has known domain or looks like a recipe link).
 */
export function isRecipeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return RECIPE_DOMAINS.some((domain) => hostname.includes(domain));
  } catch {
    return false;
  }
}

/**
 * Get the domain name for display purposes.
 */
export function getDomainFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove www. prefix if present
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'link';
  }
}

/**
 * Hook for handling incoming share intents and deep links.
 *
 * @example
 * ```tsx
 * function App() {
 *   const { pendingUrl, clearPendingUrl } = useShareHandler();
 *
 *   useEffect(() => {
 *     if (pendingUrl) {
 *       // Show cookbook selection sheet
 *       showImportSheet(pendingUrl);
 *       clearPendingUrl();
 *     }
 *   }, [pendingUrl]);
 * }
 * ```
 */
export function useShareHandler(): UseShareHandlerResult {
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const processedUrlsRef = useRef<Set<string>>(new Set());

  const clearPendingUrl = useCallback(() => {
    setPendingUrl(null);
  }, []);

  const triggerImport = useCallback((url: string) => {
    setPendingUrl(url);
  }, []);

  // Process incoming URL
  const processIncomingUrl = useCallback((url: string | null) => {
    if (!url) return;

    // Avoid processing the same URL multiple times
    if (processedUrlsRef.current.has(url)) return;
    processedUrlsRef.current.add(url);

    // Clear old processed URLs after some time to prevent memory leak
    setTimeout(() => {
      processedUrlsRef.current.delete(url);
    }, 5000);

    try {
      const parsed = Linking.parse(url);

      // Handle deep link: revenuecatshipyard://import?url=...
      if (parsed.path === 'import' && parsed.queryParams?.url) {
        const importUrl = parsed.queryParams.url as string;
        setPendingUrl(importUrl);
        return;
      }

      // Handle shared URL (might be the full URL in scheme format)
      // Android share intents send the shared text as the URL
      if (parsed.scheme === 'http' || parsed.scheme === 'https') {
        // This is a direct URL
        if (isRecipeUrl(url)) {
          setPendingUrl(url);
        }
        return;
      }

      // Check if the URL itself contains a recipe URL (from Android SEND intent)
      const extractedUrl = extractUrl(url);
      if (extractedUrl) {
        setPendingUrl(extractedUrl);
      }
    } catch (error) {
      console.warn('Error processing incoming URL:', error);
    }
  }, []);

  // Handle initial URL (app launched via deep link or share)
  useEffect(() => {
    let isMounted = true;

    const handleInitialUrl = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (isMounted && initialUrl) {
          processIncomingUrl(initialUrl);
        }
      } catch (error) {
        console.warn('Error getting initial URL:', error);
      }
    };

    handleInitialUrl();

    return () => {
      isMounted = false;
    };
  }, [processIncomingUrl]);

  // Listen for incoming URLs while app is running
  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      processIncomingUrl(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, [processIncomingUrl]);

  // Re-check for initial URL when app returns to foreground
  // (some intents may not trigger the URL listener)
  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        try {
          const url = await Linking.getInitialURL();
          if (url) {
            processIncomingUrl(url);
          }
        } catch {
          // Ignore errors
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [processIncomingUrl]);

  return {
    pendingUrl,
    clearPendingUrl,
    triggerImport,
  };
}
