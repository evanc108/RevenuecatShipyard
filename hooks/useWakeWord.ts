import {
  isTranscriptionAvailable,
  requestMicrophonePermission,
  transcribeAudio,
} from '@/utils/voice';
import {
  useAudioRecorder,
  setAudioModeAsync,
  IOSOutputFormat,
  AudioQuality,
} from 'expo-audio';
import type { RecordingOptions } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

// Audio mode for playback after recording (full volume)
const PLAYBACK_AUDIO_MODE = {
  allowsRecording: false,
  playsInSilentMode: true,
  shouldPlayInBackground: false,
  interruptionMode: 'doNotMix' as const,
  shouldRouteThroughEarpiece: false,
};

// Wake word variations - Whisper often mishears "Nom" in various ways
// Includes both "hey nom" variants and standalone "nom" variants for flexibility
const WAKE_PHRASES = [
  // "Hey Nom" variations
  'hey nom', 'hey nam', 'hey gnome', 'hey norm', 'hey noem', 'hey nome',
  'hey numb', 'hey num', 'hey known', 'hey non', 'hey nohm', 'hey nahm',
  'a nom', 'a]nom', 'heynom', 'hey, nom', 'hey. nom', 'hey no',
  'hey mom', 'hey nah', 'hey na', 'hey nyom', 'haynom', 'hey, nah',
  // Standalone "Nom" variations (without "hey" prefix)
  // These are checked as exact matches or at word boundaries to avoid false positives
];

// Standalone wake words - matched more strictly to avoid false positives
const STANDALONE_WAKE_WORDS = [
  'nom', 'nam', 'gnome', 'nome', 'norm', 'nohm', 'nahm',
  'noem', 'nyom', 'numb', 'num',
];

// Optimized timing for faster wake word detection
const LISTENING_INTERVAL_MS = 1500; // Reduced from 2s for faster detection
const PAUSE_BETWEEN_LISTENS_MS = 150; // Minimal pause - start next listen ASAP
const PAUSE_WHEN_QUIET_MS = 400; // Shorter pause even when quiet
const PAUSE_AFTER_IRRELEVANT_MS = 100; // Very short pause after rejecting non-wake-word
const MIN_AUDIO_FILE_SIZE = 5000; // Lower threshold to catch quieter speech
const MAX_WAKE_WORD_LENGTH = 30; // Slightly longer to catch variations
const MIN_AUDIO_LEVEL_DB = -40; // More sensitive to catch quieter speech
const WAKE_WORD_AUTO_RESTART_DELAY_MS = 300; // Delay before auto-restart after re-enable

// Words/patterns that clearly indicate NOT a wake word - skip immediately
const REJECT_PATTERNS = [
  /^(the|a|an|is|it|this|that|and|or|but|so|if|when|what|how|why|where)\s/i,
  /music|song|playing|audio|video/i,
  /\d{3,}/, // Long numbers (likely background audio)
  /^(um|uh|ah|oh|hmm|huh)\s*$/i, // Filler sounds
];

type UseWakeWordProps = {
  onWakeWordDetected: () => void;
  enabled: boolean;
};

type UseWakeWordReturn = {
  isWakeWordListening: boolean;
  isRecording: boolean;
  startWakeWordListening: () => Promise<void>;
  stopWakeWordListening: () => Promise<void>;
  error: string | null;
};

// Recording options for wake word - WAV 16kHz mono with metering
const WAKE_WORD_RECORDING_OPTIONS: RecordingOptions = {
  extension: '.wav',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 128000,
  isMeteringEnabled: true,
  android: {
    outputFormat: 'default',
    audioEncoder: 'default',
  },
  ios: {
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
};

export function useWakeWord({
  onWakeWordDetected,
  enabled,
}: UseWakeWordProps): UseWakeWordReturn {
  const [isWakeWordListening, setIsWakeWordListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorder = useAudioRecorder(WAKE_WORD_RECORDING_OPTIONS);
  const recorderRef = useRef(recorder); // Ref for access in async callbacks
  recorderRef.current = recorder;

  const isListeningRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldContinueRef = useRef(false);
  const isProcessingRef = useRef(false); // Mutex to prevent race conditions
  const enabledRef = useRef(enabled); // Track enabled state for immediate access in async code

  // Keep enabledRef in sync
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  const handleAppStateChange = useCallback((state: AppStateStatus) => {
    if (state !== 'active') {
      stopWakeWordListening();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopWakeWordListening();
    };
  }, []);

  // Track previous enabled state for detecting transitions
  const prevEnabledRef = useRef(enabled);
  // Ref to hold startWakeWordListening for use in effects (avoids circular dependency)
  const startWakeWordListeningRef = useRef<(() => Promise<void>) | null>(null);

  // Stop listening IMMEDIATELY when disabled (e.g., when TTS starts)
  // And restart when enabled becomes true again
  useEffect(() => {
    const wasEnabled = prevEnabledRef.current;
    prevEnabledRef.current = enabled;

    if (!enabled) {
      // Immediately stop any ongoing recording cycle
      shouldContinueRef.current = false;
      isProcessingRef.current = false; // Reset mutex to prevent stuck state

      // Clear any pending timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Stop recording if in progress
      try {
        if (recorderRef.current.isRecording) {
          recorderRef.current.stop().catch(() => {});
        }
      } catch {
        // Ignore errors
      }

      // ALWAYS reset refs when disabled (not just when React state is true)
      // This prevents stuck state from ref/state mismatch
      setIsWakeWordListening(false);
      setIsRecording(false);
      isListeningRef.current = false;

    } else if (!wasEnabled && enabled) {
      // Enabled just became true - auto-restart after a short delay
      // This handles the case where TTS stops and we need to resume listening

      // Reset any stuck refs before restarting
      isListeningRef.current = false;
      isProcessingRef.current = false;

      // Small delay to ensure audio session is ready
      const restartTimer = setTimeout(() => {
        if (enabledRef.current && !isListeningRef.current && startWakeWordListeningRef.current) {
          startWakeWordListeningRef.current();
        }
      }, WAKE_WORD_AUTO_RESTART_DELAY_MS);

      return () => clearTimeout(restartTimer);
    }
  }, [enabled]);

  const checkForWakeWord = (transcript: string): boolean => {
    const normalizedTranscript = transcript.toLowerCase().trim();

    // Check for "hey nom" style phrases (can be anywhere in transcript)
    if (WAKE_PHRASES.some((phrase) => normalizedTranscript.includes(phrase))) {
      return true;
    }

    // Check for standalone wake words - must be exact match or at word boundary
    // to avoid false positives (e.g., "gnome" in "genome")
    for (const word of STANDALONE_WAKE_WORDS) {
      // Exact match (just the wake word alone)
      if (normalizedTranscript === word) {
        return true;
      }
      // Word boundary match - wake word at start, end, or surrounded by spaces/punctuation
      const wordBoundaryRegex = new RegExp(`(^|[\\s,.!?])${word}([\\s,.!?]|$)`, 'i');
      if (wordBoundaryRegex.test(normalizedTranscript)) {
        return true;
      }
    }

    return false;
  };

  // Check if transcript should be skipped (noise, music, or too long to be wake word)
  // Returns: { skip: boolean, fastReject: boolean } - fastReject means use shorter pause
  const shouldSkipTranscript = (transcript: string): { skip: boolean; fastReject: boolean } => {
    const trimmed = transcript.trim();

    // Too short to be meaningful
    if (trimmed.length < 3) {
      return { skip: true, fastReject: true };
    }

    // Check reject patterns first (clearly not wake words)
    for (const pattern of REJECT_PATTERNS) {
      if (pattern.test(trimmed)) {
        return { skip: true, fastReject: true };
      }
    }

    // Too long to be a wake word
    if (trimmed.length > MAX_WAKE_WORD_LENGTH && !checkForWakeWord(trimmed)) {
      return { skip: true, fastReject: true };
    }

    return { skip: false, fastReject: false };
  };

  const recordAndCheck = useCallback(async () => {
    if (!shouldContinueRef.current || !enabledRef.current) {
      return;
    }

    // Mutex: prevent concurrent recording cycles
    if (isProcessingRef.current) {
      return;
    }
    isProcessingRef.current = true;

    try {
      setIsRecording(true);

      // Configure audio mode for recording with retry
      // iOS needs time to switch audio session from playback to recording
      let audioModeSet = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await setAudioModeAsync({
            allowsRecording: true,
            playsInSilentMode: true,
            shouldPlayInBackground: false,
            interruptionMode: 'duckOthers',
          });
          // Wait for iOS audio session to fully switch
          await new Promise((resolve) => setTimeout(resolve, 100));
          audioModeSet = true;
          break;
        } catch (_audioModeError) {
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      }

      if (!audioModeSet) {
        setIsRecording(false);
        isProcessingRef.current = false;
        // Retry the whole cycle after a delay
        if (shouldContinueRef.current && enabledRef.current) {
          timeoutRef.current = setTimeout(recordAndCheck, 500);
        }
        return;
      }

      // Prepare and start recording using the hook-managed recorder
      await recorderRef.current.prepareToRecordAsync();
      recorderRef.current.record();

      // Track max audio level during recording
      let maxAudioLevel = -160; // Start with silence
      const checkAudioLevel = () => {
        try {
          const status = recorderRef.current.getStatus();
          if (status.isRecording && status.metering !== undefined) {
            maxAudioLevel = Math.max(maxAudioLevel, status.metering);
          }
        } catch {
          // Ignore metering errors
        }
      };

      // Check audio levels periodically during recording AND check if we should abort
      let aborted = false;
      const meteringInterval = setInterval(() => {
        checkAudioLevel();
        // Check if we should abort immediately (TTS started, etc.)
        if (!shouldContinueRef.current || !enabledRef.current) {
          aborted = true;
        }
      }, 200);

      // Wait for the listening interval, but allow early abort
      const startTime = Date.now();
      while (Date.now() - startTime < LISTENING_INTERVAL_MS) {
        if (!shouldContinueRef.current || !enabledRef.current) {
          aborted = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      clearInterval(meteringInterval);

      // Check if we should abort
      if (aborted || !shouldContinueRef.current || !enabledRef.current) {
        await cleanupRecording();
        setIsRecording(false);
        return;
      }

      // Stop recording and get URI
      try {
        await recorderRef.current.stop();
      } catch {
        // Recording may already be stopped
      }
      const uri = recorderRef.current.uri;
      setIsRecording(false);

      // Reset audio mode for speaker playback
      await setAudioModeAsync(PLAYBACK_AUDIO_MODE);
      // Reduced delay - iOS speaker routing is faster
      await new Promise((resolve) => setTimeout(resolve, 80));

      // Skip API call if audio level is too low (silence/background noise)
      if (maxAudioLevel < MIN_AUDIO_LEVEL_DB) {
        if (shouldContinueRef.current && enabledRef.current) {
          // Use longer pause when quiet to save resources
          timeoutRef.current = setTimeout(recordAndCheck, PAUSE_WHEN_QUIET_MS);
        }
        return;
      }

      if (!uri) {
        throw new Error('No audio recorded');
      }

      // Check audio file size - skip API call for silence/very short recordings
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        if (blob.size < MIN_AUDIO_FILE_SIZE) {
          if (shouldContinueRef.current && enabledRef.current) {
            timeoutRef.current = setTimeout(recordAndCheck, PAUSE_BETWEEN_LISTENS_MS);
          }
          return;
        }
      } catch {
        // If we can't check size, continue with transcription
      }

      // Transcribe the audio
      const transcript = await transcribeAudio(uri);

      if (checkForWakeWord(transcript)) {
        // Stop listening immediately
        shouldContinueRef.current = false;
        isListeningRef.current = false;
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setIsWakeWordListening(false);

        // Trigger callback - let the handler deal with audio mode
        onWakeWordDetected();
        return;
      }

      // Skip if transcript should be filtered (too short, too long, noise)
      const skipResult = shouldSkipTranscript(transcript);
      if (skipResult.skip) {
        if (shouldContinueRef.current && enabledRef.current) {
          // Use faster restart for obvious non-wake-words
          const pauseTime = skipResult.fastReject ? PAUSE_AFTER_IRRELEVANT_MS : PAUSE_BETWEEN_LISTENS_MS;
          timeoutRef.current = setTimeout(recordAndCheck, pauseTime);
        }
        return;
      }

      // Continue listening if still enabled (transcript was processed but no wake word)
      if (shouldContinueRef.current && enabledRef.current) {
        timeoutRef.current = setTimeout(recordAndCheck, PAUSE_AFTER_IRRELEVANT_MS);
      }
    } catch {
      await cleanupRecording();
      setIsRecording(false);

      // Continue trying if still enabled (unless it's a critical error)
      if (shouldContinueRef.current && enabledRef.current) {
        timeoutRef.current = setTimeout(recordAndCheck, PAUSE_BETWEEN_LISTENS_MS * 2);
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [onWakeWordDetected]); // enabledRef.current is used instead of enabled prop

  const cleanupRecording = async () => {
    try {
      if (recorderRef.current.isRecording) {
        await recorderRef.current.stop();
      }
    } catch {
      // Ignore errors during cleanup
    }

    // Reset audio mode for speaker playback
    try {
      await setAudioModeAsync(PLAYBACK_AUDIO_MODE);
      // Minimal delay for cleanup
      await new Promise((resolve) => setTimeout(resolve, 50));
    } catch {
      // Ignore audio mode errors
    }
  };

  const startWakeWordListening = useCallback(async () => {
    if (!enabledRef.current) return;
    if (isListeningRef.current) return;

    // Reset processing mutex in case it's stuck
    if (isProcessingRef.current) {
      isProcessingRef.current = false;
    }

    // Check if API key is configured
    if (!isTranscriptionAvailable()) {
      setError('Voice commands require OpenAI API key');
      return;
    }

    // Request permission
    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission) {
      setError('Microphone permission required');
      return;
    }

    setError(null);
    isListeningRef.current = true;
    shouldContinueRef.current = true;
    setIsWakeWordListening(true);
    recordAndCheck();
  }, [recordAndCheck]); // enabledRef.current is used instead of enabled prop

  // Keep the ref in sync with the callback
  useEffect(() => {
    startWakeWordListeningRef.current = startWakeWordListening;
  }, [startWakeWordListening]);

  const stopWakeWordListening = useCallback(async () => {
    shouldContinueRef.current = false;
    isListeningRef.current = false;
    isProcessingRef.current = false; // Reset mutex to prevent stuck state

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    await cleanupRecording();
    setIsRecording(false);
    setIsWakeWordListening(false);

    // Minimal delay - audio session cleanup is handled in cleanupRecording
    await new Promise((resolve) => setTimeout(resolve, 30));
  }, []);

  return {
    isWakeWordListening,
    isRecording,
    startWakeWordListening,
    stopWakeWordListening,
    error,
  };
}
