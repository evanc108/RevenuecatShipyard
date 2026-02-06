import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { resetAudioMode } from './textToSpeech';

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

// Track audio mode state to avoid redundant switches
let isInRecordingMode = false;

// Lazy-load recording options to avoid issues with Expo Go
function getRecordingOptions(): Audio.RecordingOptions {
  return {
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

let recording: Audio.Recording | null = null;

/**
 * Request microphone permissions
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    const { status } = await Audio.requestPermissionsAsync();
    return status === 'granted';
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
    const { status } = await Audio.getPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.warn('Failed to check microphone permission:', error);
    return false;
  }
}

/**
 * Start recording audio
 */
export async function startRecording(): Promise<void> {
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

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
      isInRecordingMode = true;
      // Reduced delay - only needed for initial mode switch
      await new Promise((resolve) => setTimeout(resolve, 50));
      console.log('[STT] Audio mode set for recording');
    }

    // Create and start recording
    const { recording: newRecording } = await Audio.Recording.createAsync(
      getRecordingOptions()
    );
    recording = newRecording;
  } catch (error) {
    console.error('Failed to start recording:', error);
    isInRecordingMode = false;
    throw error;
  }
}

/**
 * Stop recording and return the audio URI
 */
export async function stopRecording(): Promise<string | null> {
  if (!recording) {
    return null;
  }

  try {
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    recording = null;
    isInRecordingMode = false;

    // Reset audio mode for playback - switch from PlayAndRecord to Playback category
    await Audio.setAudioModeAsync(PLAYBACK_AUDIO_MODE);
    // Reduced delay - iOS speaker routing is faster than previously thought
    await new Promise((resolve) => setTimeout(resolve, 80));
    console.log('[STT] Audio mode reset for speaker playback');

    return uri;
  } catch (error) {
    console.error('Failed to stop recording:', error);
    recording = null;
    isInRecordingMode = false;
    throw error;
  }
}

/**
 * Cancel recording without saving
 */
export async function cancelRecording(): Promise<void> {
  if (recording) {
    try {
      await recording.stopAndUnloadAsync();
      // Reset audio mode for playback
      await Audio.setAudioModeAsync(PLAYBACK_AUDIO_MODE);
      // Reduced delay
      await new Promise((resolve) => setTimeout(resolve, 80));
    } catch {
      // Ignore errors during cancellation
    }
    recording = null;
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
