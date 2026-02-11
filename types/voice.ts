/**
 * Voice assistant types for the cooking mode.
 */

export type VoiceState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'error';

export type VoiceIntent =
  | 'NEXT_STEP'
  | 'PREVIOUS_STEP'
  | 'REPEAT'
  | 'RESTART'
  | 'READ_INGREDIENTS'
  | 'READ_CURRENT_STEP'
  | 'WHAT_STEP'
  | 'INGREDIENT_QUERY'
  | 'TEMPERATURE_QUERY'
  | 'SET_TIMER'
  | 'CHECK_TIMER'
  | 'STOP_TIMER'
  | 'PAUSE'
  | 'HELP'
  | 'STOP_SPEAKING'
  | 'UNKNOWN';

export type IntentResult = {
  intent: VoiceIntent;
  confidence: number;
  params?: {
    timerMinutes?: number;
    timerSeconds?: number;
    stepNumber?: number;
    query?: string;
    ingredientName?: string;
  };
  rawTranscript: string;
};

export type VoiceCommandResponse = {
  text: string;
  action?: 'SET_STEP' | 'START_TIMER' | 'STOP_TIMER' | 'NONE';
  payload?: Record<string, unknown>;
};

export type VoiceAssistantConfig = {
  enabled: boolean;
  autoListen: boolean;
  speakingRate: number;
  language: string;
};
