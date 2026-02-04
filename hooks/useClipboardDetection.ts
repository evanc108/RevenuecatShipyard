/**
 * Hook for detecting recipe URLs in the clipboard on app foreground.
 *
 * Features:
 * - Reads clipboard when app becomes active
 * - Checks for known recipe domains
 * - Tracks already-prompted URLs to avoid repeat prompts
 * - Returns detected URL and dismiss function
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { isRecipeUrl, getDomainFromUrl } from './useShareHandler';

/** Storage key for tracking prompted URLs */
const PROMPTED_URLS_KEY = 'clipboard_prompted_urls';

/** Maximum number of URLs to track (to prevent unbounded growth) */
const MAX_TRACKED_URLS = 50;

type UseClipboardDetectionResult = {
  /** Detected recipe URL from clipboard, or null */
  detectedUrl: string | null;
  /** Domain name for display (e.g., "tiktok.com") */
  detectedDomain: string | null;
  /** Dismiss the current detection (marks as prompted) */
  dismissDetection: () => void;
  /** Clear detected URL (e.g., after import) */
  clearDetection: () => void;
};

/**
 * In-memory storage for prompted URLs.
 * Using in-memory for simplicity; could use AsyncStorage for persistence.
 */
const promptedUrls = new Set<string>();

/**
 * Mark a URL as already prompted (won't show again).
 */
function markAsPrompted(url: string): void {
  promptedUrls.add(url);
  // Prevent unbounded growth
  if (promptedUrls.size > MAX_TRACKED_URLS) {
    const iterator = promptedUrls.values();
    const firstValue = iterator.next().value;
    if (firstValue !== undefined) {
      promptedUrls.delete(firstValue);
    }
  }
}

/**
 * Check if a URL has been prompted before.
 */
function hasBeenPrompted(url: string): boolean {
  return promptedUrls.has(url);
}

/**
 * Hook for detecting recipe URLs in the clipboard.
 *
 * @example
 * ```tsx
 * function HomeScreen() {
 *   const { detectedUrl, detectedDomain, dismissDetection, clearDetection } = useClipboardDetection();
 *
 *   if (detectedUrl) {
 *     return (
 *       <ClipboardPrompt
 *         domain={detectedDomain}
 *         onImport={() => {
 *           clearDetection();
 *           openImportSheet(detectedUrl);
 *         }}
 *         onDismiss={dismissDetection}
 *       />
 *     );
 *   }
 * }
 * ```
 */
export function useClipboardDetection(): UseClipboardDetectionResult {
  const [detectedUrl, setDetectedUrl] = useState<string | null>(null);
  const isCheckingRef = useRef(false);
  const lastCheckRef = useRef<number>(0);

  // Minimum time between checks (ms)
  const CHECK_DEBOUNCE = 2000;

  const checkClipboard = useCallback(async () => {
    // Debounce checks
    const now = Date.now();
    if (now - lastCheckRef.current < CHECK_DEBOUNCE) return;
    if (isCheckingRef.current) return;

    isCheckingRef.current = true;
    lastCheckRef.current = now;

    try {
      // Check if clipboard has text
      const hasString = await Clipboard.hasStringAsync();
      if (!hasString) {
        isCheckingRef.current = false;
        return;
      }

      // Get clipboard content
      const content = await Clipboard.getStringAsync();
      if (!content) {
        isCheckingRef.current = false;
        return;
      }

      // Clean up the content (trim whitespace)
      const trimmed = content.trim();

      // Check if it's a URL
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        isCheckingRef.current = false;
        return;
      }

      // Check if it's a recipe URL
      if (!isRecipeUrl(trimmed)) {
        isCheckingRef.current = false;
        return;
      }

      // Check if already prompted
      if (hasBeenPrompted(trimmed)) {
        isCheckingRef.current = false;
        return;
      }

      // Valid recipe URL that hasn't been prompted
      setDetectedUrl(trimmed);
    } catch (error) {
      console.warn('Error checking clipboard:', error);
    } finally {
      isCheckingRef.current = false;
    }
  }, []);

  // Check clipboard when app becomes active
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        checkClipboard();
      }
    };

    // Check on mount
    checkClipboard();

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [checkClipboard]);

  const dismissDetection = useCallback(() => {
    if (detectedUrl) {
      markAsPrompted(detectedUrl);
      setDetectedUrl(null);
    }
  }, [detectedUrl]);

  const clearDetection = useCallback(() => {
    if (detectedUrl) {
      markAsPrompted(detectedUrl);
    }
    setDetectedUrl(null);
  }, [detectedUrl]);

  const detectedDomain = detectedUrl ? getDomainFromUrl(detectedUrl) : null;

  return {
    detectedUrl,
    detectedDomain,
    dismissDetection,
    clearDetection,
  };
}
