import {
  isTranscriptionAvailable,
  requestMicrophonePermission,
  transcribeAudio,
} from '@/utils/voice';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

// Audio mode for playback after recording (full volume)
const PLAYBACK_AUDIO_MODE = {
  allowsRecordingIOS: false,
  playsInSilentModeIOS: true,
  staysActiveInBackground: false,
  interruptionModeIOS: InterruptionModeIOS.DoNotMix,
  shouldDuckAndroid: false,
  interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
  playThroughEarpieceAndroid: false,
};

// Wake word variations - Whisper often mishears "Nom" in various ways
const WAKE_PHRASES = [
  'hey nom', 'hey nam', 'hey gnome', 'hey norm', 'hey noem', 'hey nome',
  'hey numb', 'hey num', 'hey known', 'hey non', 'hey nohm', 'hey nahm',
  'a nom', 'a]nom', 'heynom', 'hey, nom', 'hey. nom', 'hey no',
  'hey mom', 'hey nah', 'hey na', 'hey nyom', 'haynom', 'hey, nah',
];

// Optimized timing for faster wake word detection
const LISTENING_INTERVAL_MS = 1500; // Reduced from 2s for faster detection
const PAUSE_BETWEEN_LISTENS_MS = 150; // Minimal pause - start next listen ASAP
const PAUSE_WHEN_QUIET_MS = 400; // Shorter pause even when quiet
const PAUSE_AFTER_IRRELEVANT_MS = 100; // Very short pause after rejecting non-wake-word
const MIN_AUDIO_FILE_SIZE = 5000; // Lower threshold to catch quieter speech
const MAX_WAKE_WORD_LENGTH = 30; // Slightly longer to catch variations
const MIN_AUDIO_LEVEL_DB = -40; // More sensitive to catch quieter speech

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

function getRecordingOptions(): Audio.RecordingOptions {
  return {
    isMeteringEnabled: true, // Enable audio level metering
    android: {
      extension: '.wav',
      outputFormat: Audio.AndroidOutputFormat.DEFAULT,
      audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
      sampleRate: 16000,
      numberOfChannels: 1,
      bitRate: 128000,
    },
    ios: {
      extension: '.wav',
      audioQuality: Audio.IOSAudioQuality.HIGH,
      sampleRate: 16000,
      numberOfChannels: 1,
      bitRate: 128000,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
    web: {},
  };
}

export function useWakeWord({
  onWakeWordDetected,
  enabled,
}: UseWakeWordProps): UseWakeWordReturn {
  const [isWakeWordListening, setIsWakeWordListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
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

  // Stop listening IMMEDIATELY when disabled (e.g., when TTS starts)
  useEffect(() => {
    if (!enabled) {
      // Immediately stop any ongoing recording cycle
      shouldContinueRef.current = false;

      // Clear any pending timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Stop recording if in progress
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }

      if (isWakeWordListening) {
        setIsWakeWordListening(false);
        setIsRecording(false);
        isListeningRef.current = false;
      }
    }
  }, [enabled, isWakeWordListening]);

  const checkForWakeWord = (transcript: string): boolean => {
    const normalizedTranscript = transcript.toLowerCase().trim();
    return WAKE_PHRASES.some((phrase) => normalizedTranscript.includes(phrase));
  };

  // Check if transcript should be skipped (noise, music, or too long to be wake word)
  // Returns: { skip: boolean, fastReject: boolean } - fastReject means use shorter pause
  const shouldSkipTranscript = (transcript: string): { skip: boolean; fastReject: boolean } => {
    const trimmed = transcript.trim();

    // Too short to be meaningful
    if (trimmed.length < 3) {
      console.log('[WakeWord] Skipping: too short');
      return { skip: true, fastReject: true };
    }

    // Check reject patterns first (clearly not wake words)
    for (const pattern of REJECT_PATTERNS) {
      if (pattern.test(trimmed)) {
        console.log('[WakeWord] Fast reject: matches reject pattern');
        return { skip: true, fastReject: true };
      }
    }

    // Too long to be a wake word
    if (trimmed.length > MAX_WAKE_WORD_LENGTH && !checkForWakeWord(trimmed)) {
      console.log('[WakeWord] Skipping: too long for wake word');
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
      console.log('[WakeWord] Already processing, skipping this cycle');
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
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
          });
          // Wait for iOS audio session to fully switch
          await new Promise((resolve) => setTimeout(resolve, 100));
          audioModeSet = true;
          break;
        } catch (audioModeError) {
          console.log(`[WakeWord] Audio mode attempt ${attempt + 1} failed, retrying...`);
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      }

      if (!audioModeSet) {
        console.error('[WakeWord] Failed to set audio mode after retries');
        setIsRecording(false);
        isProcessingRef.current = false;
        // Retry the whole cycle after a delay
        if (shouldContinueRef.current && enabledRef.current) {
          timeoutRef.current = setTimeout(recordAndCheck, 500);
        }
        return;
      }

      // Create recording with metering enabled
      const { recording } = await Audio.Recording.createAsync(
        getRecordingOptions(),
        undefined,
        100 // Update status every 100ms for metering
      );
      recordingRef.current = recording;

      // Track max audio level during recording
      let maxAudioLevel = -160; // Start with silence
      const checkAudioLevel = async () => {
        if (recordingRef.current) {
          try {
            const status = await recordingRef.current.getStatusAsync();
            if (status.isRecording && status.metering !== undefined) {
              maxAudioLevel = Math.max(maxAudioLevel, status.metering);
            }
          } catch {
            // Ignore metering errors
          }
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
        console.log('[WakeWord] Aborting - disabled or should not continue');
        await cleanupRecording();
        setIsRecording(false);
        return;
      }

      // Stop recording and get URI - guard against already stopped recording
      if (!recordingRef.current) {
        setIsRecording(false);
        return;
      }
      try {
        await recording.stopAndUnloadAsync();
      } catch (stopError) {
        console.log('[WakeWord] Recording already stopped');
      }
      const uri = recording.getURI();
      recordingRef.current = null;
      setIsRecording(false);

      // Reset audio mode for speaker playback
      await Audio.setAudioModeAsync(PLAYBACK_AUDIO_MODE);
      // Reduced delay - iOS speaker routing is faster
      await new Promise((resolve) => setTimeout(resolve, 80));

      // Skip API call if audio level is too low (silence/background noise)
      if (maxAudioLevel < MIN_AUDIO_LEVEL_DB) {
        console.log(`[WakeWord] Audio too quiet (${maxAudioLevel.toFixed(1)}dB), skipping API call`);
        if (shouldContinueRef.current && enabledRef.current) {
          // Use longer pause when quiet to save resources
          timeoutRef.current = setTimeout(recordAndCheck, PAUSE_WHEN_QUIET_MS);
        }
        return;
      }

      console.log(`[WakeWord] Audio level: ${maxAudioLevel.toFixed(1)}dB - processing...`);

      if (!uri) {
        throw new Error('No audio recorded');
      }

      // Check audio file size - skip API call for silence/very short recordings
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        if (blob.size < MIN_AUDIO_FILE_SIZE) {
          console.log('[WakeWord] Audio too short/quiet, skipping API call');
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
      console.log('[WakeWord] Transcript:', transcript);

      // Check for wake word FIRST (before filtering)
      if (checkForWakeWord(transcript)) {
        console.log('[WakeWord] Wake word detected! Stopping listener...');
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
    } catch (err) {
      console.error('[WakeWord] Error:', err);
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
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {
        // Ignore errors during cleanup
      }
      recordingRef.current = null;
    }

    // Reset audio mode for speaker playback
    try {
      await Audio.setAudioModeAsync(PLAYBACK_AUDIO_MODE);
      // Minimal delay for cleanup
      await new Promise((resolve) => setTimeout(resolve, 50));
    } catch {
      // Ignore audio mode errors
    }
  };

  const startWakeWordListening = useCallback(async () => {
    if (isListeningRef.current || !enabledRef.current) {
      return;
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

    console.log('[WakeWord] Starting wake word listening');
    recordAndCheck();
  }, [recordAndCheck]); // enabledRef.current is used instead of enabled prop

  const stopWakeWordListening = useCallback(async () => {
    console.log('[WakeWord] Stopping wake word listening');
    shouldContinueRef.current = false;
    isListeningRef.current = false;

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
