import {
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
  IOSOutputFormat,
  AudioQuality,
} from 'expo-audio';
import type { AudioRecorder, RecordingOptions } from 'expo-audio';
import { resetAudioMode } from './textToSpeech';

// Audio mode for playback after recording (full volume)
const PLAYBACK_AUDIO_MODE = {
  allowsRecording: false,
  playsInSilentMode: true,
  shouldPlayInBackground: false,
  interruptionMode: 'doNotMix' as const,
  shouldRouteThroughEarpiece: false,
};

// Track audio mode state to avoid redundant switches
let isInRecordingMode = false;

/**
 * Recording options for STT - WAV 16kHz mono for Whisper API compatibility
 * Exported so hooks can create their own AudioRecorder with these options
 */
export const STT_RECORDING_OPTIONS: RecordingOptions = {
  extension: '.wav',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 128000,
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

/**
 * Request microphone permissions
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    const { granted } = await requestRecordingPermissionsAsync();
    return granted;
  } catch (error) {
    console.warn('Failed to request microphone permission:', error);
    return false;
  }
}

/**
 * Check if microphone permission is granted
 */
export async function hasMicrophonePermission(): Promise<boolean> {
  try {
    const { granted } = await getRecordingPermissionsAsync();
    return granted;
  } catch (error) {
    console.warn('Failed to check microphone permission:', error);
    return false;
  }
}

/**
 * Start recording audio using a recorder instance from the calling hook
 */
export async function startRecording(recorder: AudioRecorder): Promise<void> {
  try {
    // Ensure permissions
    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission) {
      throw new Error('Microphone permission denied');
    }

    // Configure audio mode for recording (only if not already in recording mode)
    if (!isInRecordingMode) {
      // Reset TTS audio mode tracking since we're switching to recording
      resetAudioMode();

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'duckOthers',
      });
      isInRecordingMode = true;
      // Reduced delay - only needed for initial mode switch
      await new Promise((resolve) => setTimeout(resolve, 50));
      console.log('[STT] Audio mode set for recording');
    }

    // Prepare and start recording
    await recorder.prepareToRecordAsync();
    recorder.record();
  } catch (error) {
    console.error('Failed to start recording:', error);
    isInRecordingMode = false;
    throw error;
  }
}

/**
 * Stop recording and return the audio URI
 */
export async function stopRecording(recorder: AudioRecorder): Promise<string | null> {
  if (!recorder.isRecording) {
    return null;
  }

  try {
    await recorder.stop();
    const uri = recorder.uri;
    isInRecordingMode = false;

    // Reset audio mode for playback - switch from PlayAndRecord to Playback category
    await setAudioModeAsync(PLAYBACK_AUDIO_MODE);
    // Reduced delay - iOS speaker routing is faster than previously thought
    await new Promise((resolve) => setTimeout(resolve, 80));
    console.log('[STT] Audio mode reset for speaker playback');

    return uri ?? null;
  } catch (error) {
    console.error('Failed to stop recording:', error);
    isInRecordingMode = false;
    throw error;
  }
}

/**
 * Cancel recording without saving
 */
export async function cancelRecording(recorder: AudioRecorder): Promise<void> {
  if (recorder.isRecording) {
    try {
      await recorder.stop();
      // Reset audio mode for playback
      await setAudioModeAsync(PLAYBACK_AUDIO_MODE);
      // Reduced delay
      await new Promise((resolve) => setTimeout(resolve, 80));
    } catch {
      // Ignore errors during cancellation
    }
    isInRecordingMode = false;
  }
}

/**
 * Check if OpenAI API key is configured
 */
export function isTranscriptionAvailable(): boolean {
  return !!process.env.EXPO_PUBLIC_OPENAI_API_KEY;
}

/**
 * Transcribe audio using OpenAI Whisper API
 */
export async function transcribeAudio(audioUri: string): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OpenAI API key not configured. Set EXPO_PUBLIC_OPENAI_API_KEY in your .env file.'
    );
  }

  console.log('[OpenAI] Calling Whisper API for transcription...');

  // Create form data with audio file
  const formData = new FormData();
  formData.append('file', {
    uri: audioUri,
    type: 'audio/wav',
    name: 'recording.wav',
  } as unknown as Blob);
  formData.append('model', 'whisper-1');
  formData.append('language', 'en');
  formData.append('response_format', 'text');

  const response = await fetch(
    'https://api.openai.com/v1/audio/transcriptions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('[OpenAI] Whisper API error:', error);
    throw new Error(`Whisper API error: ${error}`);
  }

  const transcript = await response.text();
  console.log('[OpenAI] Transcription complete:', transcript.substring(0, 50));
  return transcript.trim();
}
