export {
  speak,
  stopSpeaking,
  isSpeaking,
  isSpeechAvailable,
  clearTTSCache,
  resetAudioMode,
  // Pre-caching for instant playback
  isCached,
  precacheText,
  precacheTexts,
  precacheCommonResponses,
  // Audio session synchronization
  onAudioSessionReleased,
  // Instant feedback constant
  ONE_MOMENT_RESPONSE,
} from './textToSpeech';

export {
  requestMicrophonePermission,
  hasMicrophonePermission,
  startRecording,
  stopRecording,
  cancelRecording,
  transcribeAudio,
  isTranscriptionAvailable,
} from './speechToText';

export { detectIntent, isComplexQuery } from './intentDetection';
