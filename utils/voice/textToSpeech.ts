import * as Speech from 'expo-speech';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';

type TTSOptions = {
  language?: string;
  pitch?: number;
  rate?: number;
  onStart?: () => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
  skipCache?: boolean; // For short confirmations like "Yes?"
};

const DEFAULT_OPTIONS: TTSOptions = {
  language: 'en-US',
  pitch: 1.0,
  rate: 0.9, // Slightly slower for cooking instructions
};

// Audio mode for TTS playback
const PLAYBACK_AUDIO_MODE = {
  allowsRecordingIOS: false,
  playsInSilentModeIOS: true,
  staysActiveInBackground: false,
  interruptionModeIOS: InterruptionModeIOS.DoNotMix,
  shouldDuckAndroid: false,
  interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
  playThroughEarpieceAndroid: false,
};

// --- TTS Audio Cache ---
// LRU cache for TTS audio files to avoid repeated API calls
const TTS_CACHE_DIR = `${LegacyFileSystem.cacheDirectory}tts_cache/`;
const MAX_CACHE_SIZE = 50; // Max cached audio files
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

type CacheEntry = {
  uri: string;
  timestamp: number;
  hash: string;
};

// In-memory cache index (persisted entries stored on disk)
const cacheIndex = new Map<string, CacheEntry>();
let cacheInitialized = false;

// Simple hash function for cache keys
function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// Initialize cache directory
async function initCache(): Promise<void> {
  if (cacheInitialized) return;
  try {
    const dirInfo = await LegacyFileSystem.getInfoAsync(TTS_CACHE_DIR);
    if (!dirInfo.exists) {
      await LegacyFileSystem.makeDirectoryAsync(TTS_CACHE_DIR, { intermediates: true });
    }
    cacheInitialized = true;
  } catch (error) {
    console.warn('[TTS Cache] Failed to initialize cache directory:', error);
  }
}

// Get cached audio if available and not expired
async function getCachedAudio(text: string): Promise<string | null> {
  const hash = hashText(text);
  const entry = cacheIndex.get(hash);

  if (!entry) return null;

  // Check if expired
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cacheIndex.delete(hash);
    LegacyFileSystem.deleteAsync(entry.uri, { idempotent: true }).catch(() => {});
    return null;
  }

  // Verify file exists
  try {
    const info = await LegacyFileSystem.getInfoAsync(entry.uri);
    if (info.exists) {
      console.log('[TTS Cache] Cache hit for:', text.substring(0, 30));
      return entry.uri;
    }
  } catch {
    // File doesn't exist, remove from index
  }

  cacheIndex.delete(hash);
  return null;
}

// Cache audio file
async function cacheAudio(text: string, uri: string): Promise<void> {
  await initCache();
  const hash = hashText(text);
  const cachedUri = `${TTS_CACHE_DIR}${hash}.mp3`;

  try {
    // Copy to cache directory with stable name
    await LegacyFileSystem.copyAsync({ from: uri, to: cachedUri });

    // Add to index
    cacheIndex.set(hash, {
      uri: cachedUri,
      timestamp: Date.now(),
      hash,
    });

    // Evict old entries if cache is too large
    if (cacheIndex.size > MAX_CACHE_SIZE) {
      const entries = Array.from(cacheIndex.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

      // Remove oldest 10 entries
      for (let i = 0; i < 10 && i < entries.length; i++) {
        const [key, entry] = entries[i] ?? [];
        if (key && entry) {
          cacheIndex.delete(key);
          LegacyFileSystem.deleteAsync(entry.uri, { idempotent: true }).catch(() => {});
        }
      }
    }

    console.log('[TTS Cache] Cached audio for:', text.substring(0, 30));
  } catch (error) {
    console.warn('[TTS Cache] Failed to cache audio:', error);
  }
}

// Clear all cache (call on app termination or when needed)
export async function clearTTSCache(): Promise<void> {
  try {
    await LegacyFileSystem.deleteAsync(TTS_CACHE_DIR, { idempotent: true });
    cacheIndex.clear();
    cacheInitialized = false;
    console.log('[TTS Cache] Cache cleared');
  } catch (error) {
    console.warn('[TTS Cache] Failed to clear cache:', error);
  }
}

/**
 * Check if text is already cached (instant check)
 */
export function isCached(text: string): boolean {
  const hash = hashText(text);
  const entry = cacheIndex.get(hash);
  if (!entry) return false;
  // Check if expired
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    return false;
  }
  return true;
}

/**
 * Pre-cache a single text without playing it
 * Use this to prepare TTS audio in advance for instant playback later
 */
export async function precacheText(text: string, rate = 0.9): Promise<boolean> {
  if (!text || text.trim().length === 0) return false;

  // Already cached?
  if (isCached(text)) {
    console.log('[TTS Precache] Already cached:', text.substring(0, 30));
    return true;
  }

  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) return false;

  try {
    await fetchAndCacheTTSAudio(text, apiKey, rate);
    return true;
  } catch (error) {
    console.warn('[TTS Precache] Failed to precache:', text.substring(0, 30), error);
    return false;
  }
}

// Track ongoing precache operations to avoid duplicates
const precacheInProgress = new Set<string>();

/**
 * Pre-cache multiple texts in parallel with rate limiting
 * Returns when all texts are cached (or failed)
 */
export async function precacheTexts(
  texts: string[],
  options: { rate?: number; maxConcurrent?: number; onProgress?: (cached: number, total: number) => void } = {}
): Promise<{ cached: number; failed: number }> {
  const { rate = 0.9, maxConcurrent = 3, onProgress } = options;
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) return { cached: 0, failed: texts.length };

  // Filter out already cached and empty texts
  const textsToCache = texts.filter((text) => {
    if (!text || text.trim().length === 0) return false;
    if (isCached(text)) return false;
    const hash = hashText(text);
    if (precacheInProgress.has(hash)) return false;
    return true;
  });

  if (textsToCache.length === 0) {
    console.log('[TTS Precache] All texts already cached');
    onProgress?.(texts.length, texts.length);
    return { cached: texts.length, failed: 0 };
  }

  console.log(`[TTS Precache] Precaching ${textsToCache.length} texts...`);

  let cached = texts.length - textsToCache.length;
  let failed = 0;

  // Process in batches to avoid rate limits
  for (let i = 0; i < textsToCache.length; i += maxConcurrent) {
    const batch = textsToCache.slice(i, i + maxConcurrent);

    const results = await Promise.allSettled(
      batch.map(async (text) => {
        const hash = hashText(text);
        precacheInProgress.add(hash);
        try {
          await fetchAndCacheTTSAudio(text, apiKey, rate);
          return true;
        } finally {
          precacheInProgress.delete(hash);
        }
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        cached++;
      } else {
        failed++;
      }
    }

    onProgress?.(cached, texts.length);

    // Small delay between batches to avoid rate limits
    if (i + maxConcurrent < textsToCache.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  console.log(`[TTS Precache] Done: ${cached} cached, ${failed} failed`);
  return { cached, failed };
}

// Common responses to pre-cache on init
// Must match exact strings used in FALLBACK_RESPONSES and wake word handler
const COMMON_RESPONSES = [
  'Yes?', // Wake word confirmation - ONLY response for "Hey Nom"
  "Sorry, I didn't catch that. Try saying 'next step' or 'repeat'.", // notUnderstood
  "You're already at the first step.", // firstStep
  "That's the last step! Your dish should be ready.", // lastStep
  'Sorry, something went wrong. Please try again.', // error
];

let commonResponsesCached = false;

/**
 * Pre-cache common voice responses for instant playback
 * Call this once on app/screen init
 */
export async function precacheCommonResponses(): Promise<void> {
  if (commonResponsesCached) return;

  console.log('[TTS Precache] Caching common responses...');
  await precacheTexts(COMMON_RESPONSES, { maxConcurrent: 5 });
  commonResponsesCached = true;
}

// --- State Management ---
// Use mutex pattern to prevent race conditions
let isSpeakingState = false;
let currentSound: Audio.Sound | null = null;
let speakingMutex = false; // Prevent concurrent speak operations
let audioModeConfigured = false; // Track if audio mode is already set
let manuallyStoppedFlag = false; // Track if audio was manually stopped to prevent callback race
let currentSpeakPromiseResolve: (() => void) | null = null; // Track current speak promise for manual stop
let onAudioSessionReleasedCallback: (() => void) | null = null; // Callback when audio session is fully released

/**
 * Speak text using OpenAI TTS API with expo-av playback
 * Falls back to expo-speech if OpenAI API is not available
 */
export async function speak(
  text: string,
  options?: TTSOptions
): Promise<void> {
  if (!text || text.trim().length === 0) {
    console.warn('[TTS] Empty text provided, skipping');
    return;
  }

  // Acquire mutex - if already speaking, stop and take over
  // This prevents race conditions where multiple speak calls overlap
  const wasAlreadySpeaking = speakingMutex || isSpeakingState || currentSound !== null;
  if (wasAlreadySpeaking) {
    console.log('[TTS] Already speaking, stopping previous before new audio');
  }

  // Immediately claim the mutex to prevent other calls from starting
  speakingMutex = true;

  // Stop any current speech (using internal to not reset our mutex)
  await stopSpeakingInternal();

  // Small delay to ensure audio system is fully released
  if (wasAlreadySpeaking) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  try {
    // Try OpenAI TTS first for reliable speaker output
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    if (apiKey) {
      try {
        await speakWithOpenAI(text, apiKey, mergedOptions);
        return;
      } catch (error) {
        console.warn('[TTS] OpenAI TTS failed, falling back to expo-speech:', error);
      }
    }

    // Fallback to expo-speech
    await speakWithExpoSpeech(text, mergedOptions);
  } finally {
    speakingMutex = false;
  }
}

/**
 * Speak using OpenAI TTS API - plays through expo-av for full audio control
 * Includes caching for repeated content
 */
async function speakWithOpenAI(
  text: string,
  apiKey: string,
  options: TTSOptions
): Promise<void> {
  console.log('[TTS] Using OpenAI TTS for:', text.substring(0, 30));

  // Configure audio mode for playback (only if not already configured)
  if (!audioModeConfigured) {
    await Audio.setAudioModeAsync(PLAYBACK_AUDIO_MODE);
    audioModeConfigured = true;
    // Only delay on first audio mode switch - iOS needs time to route to speaker
    await new Promise((resolve) => setTimeout(resolve, 80));
    console.log('[TTS] Audio mode configured for speaker');
  }

  let audioUri: string;
  let shouldCleanup = true; // Whether to delete the file after playback
  const skipCache = options.skipCache ?? false;

  // Check cache first (unless skipCache is set for short confirmations)
  if (!skipCache) {
    const cachedUri = await getCachedAudio(text);
    if (cachedUri) {
      audioUri = cachedUri;
      shouldCleanup = false; // Don't delete cached files
    } else {
      // Fetch from API and cache
      audioUri = await fetchAndCacheTTSAudio(text, apiKey, options.rate ?? 1.0);
    }
  } else {
    // Short confirmations - fetch without caching
    audioUri = await fetchTTSAudio(text, apiKey, options.rate ?? 1.0);
  }

  // Create and play sound with expo-av
  isSpeakingState = true;
  manuallyStoppedFlag = false; // Reset flag for new audio
  options.onStart?.();

  return new Promise((resolve, reject) => {
    // Store resolve so we can call it from stopSpeaking if manually stopped
    currentSpeakPromiseResolve = resolve;

    Audio.Sound.createAsync(
      { uri: audioUri },
      { shouldPlay: true, volume: 1.0 }
    ).then(({ sound }) => {
      currentSound = sound;
      console.log('[TTS] Playing audio...');

      sound.setOnPlaybackStatusUpdate(async (status) => {
        // Skip callback if audio was manually stopped - prevents race condition
        if (manuallyStoppedFlag) {
          return;
        }

        if (status.isLoaded && status.didJustFinish) {
          console.log('[TTS] Audio finished naturally');
          isSpeakingState = false;
          currentSpeakPromiseResolve = null;
          const soundToUnload = currentSound;
          currentSound = null;

          // Unload sound
          if (soundToUnload) {
            try {
              await soundToUnload.unloadAsync();
            } catch {
              // Ignore unload errors
            }
          }

          // Only cleanup non-cached temp files
          if (shouldCleanup) {
            LegacyFileSystem.deleteAsync(audioUri, { idempotent: true }).catch(() => {});
          }

          // Delay to ensure audio session is fully released before wake word can restart
          await new Promise((r) => setTimeout(r, 100));
          options.onDone?.();
          notifyAudioSessionReleased();
          resolve();
        }
      });
    }).catch((playError) => {
      console.error('[TTS] Play error:', playError);
      isSpeakingState = false;
      currentSpeakPromiseResolve = null;
      if (shouldCleanup) {
        LegacyFileSystem.deleteAsync(audioUri, { idempotent: true }).catch(() => {});
      }
      options.onError?.(playError as Error);
      reject(playError);
    });
  });
}

/**
 * Fetch TTS audio from OpenAI API (without caching)
 */
async function fetchTTSAudio(text: string, apiKey: string, rate: number): Promise<string> {
  const tempUri = `${LegacyFileSystem.cacheDirectory}tts_${Date.now()}.mp3`;

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice: 'nova',
      speed: rate,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI TTS error: ${error}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i] as number);
  }
  const base64Audio = btoa(binary);

  await LegacyFileSystem.writeAsStringAsync(tempUri, base64Audio, {
    encoding: LegacyFileSystem.EncodingType.Base64,
  });
  console.log('[TTS] Audio fetched, size:', bytes.byteLength, 'bytes');

  return tempUri;
}

/**
 * Fetch TTS audio and cache it for reuse
 */
async function fetchAndCacheTTSAudio(text: string, apiKey: string, rate: number): Promise<string> {
  const tempUri = await fetchTTSAudio(text, apiKey, rate);

  // Cache the audio for future use
  await cacheAudio(text, tempUri);

  // Return cached URI (cacheAudio copies to cache dir)
  const hash = hashText(text);
  const cachedUri = `${TTS_CACHE_DIR}${hash}.mp3`;

  // Delete temp file since we have the cached version
  LegacyFileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => {});

  return cachedUri;
}

/**
 * Speak using expo-speech (fallback)
 */
async function speakWithExpoSpeech(
  text: string,
  options: TTSOptions
): Promise<void> {
  console.log('[TTS] Using expo-speech fallback...');

  // Configure audio session (only if needed)
  if (!audioModeConfigured) {
    try {
      await Audio.setAudioModeAsync(PLAYBACK_AUDIO_MODE);
      audioModeConfigured = true;
      // Reduced delay - expo-speech is more tolerant
      await new Promise((resolve) => setTimeout(resolve, 100));
      console.log('[TTS] Audio mode set for speaker playback');
    } catch (audioError) {
      console.warn('[TTS] Failed to set audio mode:', audioError);
    }
  }

  return new Promise((resolve, reject) => {
    isSpeakingState = true;
    manuallyStoppedFlag = false;
    currentSpeakPromiseResolve = resolve;
    console.log('[TTS] Speaking:', text.substring(0, 50) + '...');

    Speech.speak(text, {
      language: options.language,
      pitch: options.pitch,
      rate: options.rate,
      onStart: () => {
        console.log('[TTS] Speech started');
        options.onStart?.();
      },
      onDone: () => {
        // Skip if manually stopped
        if (manuallyStoppedFlag) return;

        console.log('[TTS] Speech done');
        isSpeakingState = false;
        currentSpeakPromiseResolve = null;
        // Delay to ensure audio session release
        setTimeout(() => {
          options.onDone?.();
          notifyAudioSessionReleased();
          resolve();
        }, 100);
      },
      onError: (error) => {
        console.error('[TTS] Speech error:', error);
        isSpeakingState = false;
        currentSpeakPromiseResolve = null;
        options.onError?.(error as Error);
        reject(error);
      },
      onStopped: () => {
        // This is called when manually stopped
        if (manuallyStoppedFlag) return; // Already handled by stopSpeakingInternal
        console.log('[TTS] Speech stopped');
        isSpeakingState = false;
        currentSpeakPromiseResolve = null;
        resolve();
      },
    });
  });
}

/**
 * Stop current speech (internal - doesn't reset mutex)
 */
async function stopSpeakingInternal(): Promise<void> {
  // Set flag FIRST to prevent callback race condition
  manuallyStoppedFlag = true;

  const soundToStop = currentSound;
  currentSound = null;

  // Resolve any pending speak promise before stopping
  const pendingResolve = currentSpeakPromiseResolve;
  currentSpeakPromiseResolve = null;

  if (soundToStop) {
    try {
      await soundToStop.stopAsync();
      await soundToStop.unloadAsync();
    } catch {
      // Ignore errors - sound may already be unloaded
    }
  }

  if (isSpeakingState) {
    try {
      await Speech.stop();
    } catch {
      // Ignore errors
    }
    isSpeakingState = false;
  }

  // Wait for audio session to fully release before resolving
  // This ensures wake word can properly acquire the audio session
  await new Promise((r) => setTimeout(r, 150));

  // Resolve the pending promise after cleanup is complete
  if (pendingResolve) {
    console.log('[TTS] Audio stopped manually, resolving promise');
    pendingResolve();
  }
}

/**
 * Stop current speech (public API)
 * Returns only after audio session is fully released and safe for wake word to start
 */
export async function stopSpeaking(): Promise<void> {
  const wasPlaying = isSpeakingState || currentSound !== null || speakingMutex;
  console.log('[TTS] stopSpeaking called, wasPlaying:', wasPlaying);

  await stopSpeakingInternal();
  speakingMutex = false;
  // Reset audio mode flag so next recording can reconfigure the audio session
  audioModeConfigured = false;

  // Only delay and notify if something was actually playing
  // This prevents false notifications when stopSpeaking is called defensively
  if (wasPlaying) {
    // Additional delay to ensure iOS audio session is fully released
    await new Promise((r) => setTimeout(r, 100));
    console.log('[TTS] stopSpeaking complete - audio session released');
    notifyAudioSessionReleased();
  } else {
    console.log('[TTS] stopSpeaking complete - nothing was playing');
  }
}

/**
 * Reset audio mode flag (call when switching to recording mode)
 */
export function resetAudioMode(): void {
  audioModeConfigured = false;
}

/**
 * Check if currently speaking
 */
export function isSpeaking(): boolean {
  return isSpeakingState;
}

/**
 * Check if speech is available
 */
export async function isSpeechAvailable(): Promise<boolean> {
  return await Speech.isSpeakingAsync()
    .then(() => true)
    .catch(() => false);
}

/**
 * Register a callback to be called when audio session is fully released
 * This is the safe point to restart wake word listening
 */
export function onAudioSessionReleased(callback: (() => void) | null): void {
  onAudioSessionReleasedCallback = callback;
}

/**
 * Internal: Notify that audio session is released
 */
function notifyAudioSessionReleased(): void {
  if (onAudioSessionReleasedCallback) {
    console.log('[TTS] Notifying audio session released');
    // Use setTimeout to ensure this runs after current call stack
    setTimeout(() => {
      onAudioSessionReleasedCallback?.();
    }, 0);
  }
}
