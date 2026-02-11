import { useState, useCallback, useRef, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAudioRecorder } from 'expo-audio';
import type {
  VoiceState,
  IntentResult,
  VoiceCommandResponse,
} from '@/types/voice';
import type { Ingredient, Instruction } from '@/types/recipe';
import {
  startRecording,
  stopRecording,
  cancelRecording,
  transcribeAudio,
  requestMicrophonePermission,
  speak,
  stopSpeaking,
  detectIntent,
  isTranscriptionAvailable,
  isCached,
  ONE_MOMENT_RESPONSE,
  STT_RECORDING_OPTIONS,
} from '@/utils/voice';
import {
  VOICE_HELP_TEXT,
  FALLBACK_RESPONSES,
  VOICE_RESPONSES,
} from '@/constants/voiceCommands';

/** Timing constants for voice assistant delays (ms) */
const FEEDBACK_PAUSE_MS = 100; // Pause between "One moment" and main response
const AUTO_LISTEN_DELAY_MS = 300; // Delay before auto-listen after speaking
const ERROR_DISPLAY_MS = 1500; // How long to show error state

type RecipeData = {
  title: string;
  ingredients: Ingredient[];
  instructions: Instruction[];
};

type UseVoiceAssistantProps = {
  recipe: RecipeData | null;
  currentStep: number;
  onStepChange: (step: number) => void;
  onTimerStart?: (seconds: number) => void;
  onTimerStop?: () => void;
  enabled?: boolean;
};

type UseVoiceAssistantReturn = {
  voiceState: VoiceState;
  isListening: boolean;
  isSpeakingState: boolean;
  /** Whether TTS is currently loading/fetching audio (before playback starts) */
  isLoadingTTS: boolean;
  lastTranscript: string | null;
  error: string | null;
  hasPermission: boolean;
  /** Whether voice listening is available (requires OpenAI API key) */
  isVoiceListeningAvailable: boolean;

  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  toggleListening: () => Promise<void>;
  speakText: (text: string, skipCache?: boolean) => Promise<void>;
  stopSpeakingNow: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
  speakCurrentStep: () => Promise<void>;
  speakIngredients: () => Promise<void>;
};

export function useVoiceAssistant({
  recipe,
  currentStep,
  onStepChange,
  onTimerStart,
  onTimerStop,
  enabled = true,
}: UseVoiceAssistantProps): UseVoiceAssistantReturn {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoadingTTS, setIsLoadingTTS] = useState(false);

  // Audio recorder for STT command recording
  const sttRecorder = useAudioRecorder(STT_RECORDING_OPTIONS);
  const sttRecorderRef = useRef(sttRecorder);
  sttRecorderRef.current = sttRecorder;

  const isProcessingRef = useRef(false);
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const autoListenRef = useRef(false);
  // Use ref for currentStep to avoid stale closures in callbacks
  const currentStepRef = useRef(currentStep);
  currentStepRef.current = currentStep;

  const isListening = voiceState === 'listening';
  const isSpeakingState = voiceState === 'speaking';

  // Don't check permissions on mount - only when user enables voice
  // This prevents issues with Expo Go on physical devices

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    );
    return () => subscription.remove();
  }, []);

  const handleAppStateChange = useCallback((state: AppStateStatus) => {
    if (state !== 'active') {
      cancelRecording(sttRecorderRef.current);
      stopSpeaking();
      setVoiceState('idle');
    }
  }, []);

  const checkPermission = useCallback(async () => {
    const granted = await requestMicrophonePermission();
    setHasPermission(granted);
    return granted;
  }, []);

  const requestPermissionHandler = useCallback(async () => {
    const granted = await requestMicrophonePermission();
    setHasPermission(granted);
    return granted;
  }, []);

  const startListening = useCallback(async () => {
    if (!enabled || !recipe || isProcessingRef.current) {
      return;
    }

    // Check if OpenAI API key is configured - don't make unnecessary recordings
    if (!isTranscriptionAvailable()) {
      setError('Voice commands require OpenAI API key configuration');
      return;
    }

    if (!hasPermission) {
      const granted = await requestPermissionHandler();
      if (!granted) {
        setError('Microphone permission is required');
        return;
      }
    }

    try {
      setError(null);
      setVoiceState('listening');

      await startRecording(sttRecorderRef.current);

      // Auto-stop after 5 seconds of recording
      recordingTimeoutRef.current = setTimeout(async () => {
        await processRecording();
      }, 5000);
    } catch {
      setError('Failed to start listening');
      setVoiceState('error');
    }
  }, [enabled, recipe, hasPermission, requestPermissionHandler]);

  const stopListening = useCallback(async () => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }

    if (voiceState === 'listening') {
      await processRecording();
    }
  }, [voiceState]);

  const toggleListening = useCallback(async () => {
    if (isListening) {
      await stopListening();
    } else if (isSpeakingState) {
      await stopSpeakingNow();
    } else {
      await startListening();
    }
  }, [isListening, isSpeakingState, startListening, stopListening]);

  const processRecording = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      setVoiceState('processing');

      const audioUri = await stopRecording(sttRecorderRef.current);
      if (!audioUri) {
        throw new Error('No audio recorded');
      }

      // Reduced delay - audio mode switch is now faster
      await new Promise((resolve) => setTimeout(resolve, 30));

      const transcript = await transcribeAudio(audioUri);
      setLastTranscript(transcript);

      if (!transcript || transcript.length < 2) {
        setVoiceState('idle');
        return;
      }

      const intentResult = detectIntent(transcript);

      const response = await handleCommand(intentResult);

      if (response.text) {
        // Check if response is cached - if not, play instant feedback first
        const responseIsCached = isCached(response.text);

        if (!responseIsCached) {
          // Uncached response - give instant "One moment" feedback while we fetch audio
          setVoiceState('speaking');
          await speak(ONE_MOMENT_RESPONSE, {
            onDone: () => {
              // Intentionally empty - we'll continue to the main response
            },
            onError: () => {
              // Continue anyway
            },
          });
          // Small pause between feedback and response
          await new Promise((resolve) => setTimeout(resolve, FEEDBACK_PAUSE_MS));
        }

        setVoiceState('speaking');
        await speak(response.text, {
          onDone: () => {
            setVoiceState('idle');
            if (autoListenRef.current && enabled) {
              setTimeout(() => startListening(), AUTO_LISTEN_DELAY_MS);
            }
          },
          onError: () => {
            setVoiceState('idle');
          },
        });
      } else {
        setVoiceState('idle');
      }
    } catch {
      setError('Failed to process voice command');
      setVoiceState('error');

      setTimeout(() => setVoiceState('idle'), ERROR_DISPLAY_MS);
    } finally {
      isProcessingRef.current = false;
    }
  }, [recipe, currentStep, enabled, startListening]);

  const handleCommand = useCallback(
    async (intentResult: IntentResult): Promise<VoiceCommandResponse> => {
      if (!recipe) {
        return { text: FALLBACK_RESPONSES.noRecipe };
      }

      const { intent, params } = intentResult;
      const totalSteps = recipe.instructions.length;

      switch (intent) {
        case 'NEXT_STEP': {
          if (currentStep >= totalSteps - 1) {
            return { text: FALLBACK_RESPONSES.lastStep };
          }
          const newStep = currentStep + 1;
          onStepChange(newStep);
          return {
            text: VOICE_RESPONSES.step(newStep + 1, recipe.instructions[newStep]?.text ?? ''),
            action: 'SET_STEP',
            payload: { step: newStep },
          };
        }

        case 'PREVIOUS_STEP': {
          if (currentStep <= 0) {
            return { text: FALLBACK_RESPONSES.firstStep };
          }
          const newStep = currentStep - 1;
          onStepChange(newStep);
          return {
            text: VOICE_RESPONSES.goingBack(newStep + 1, recipe.instructions[newStep]?.text ?? ''),
            action: 'SET_STEP',
            payload: { step: newStep },
          };
        }

        case 'REPEAT':
        case 'READ_CURRENT_STEP': {
          return {
            text: VOICE_RESPONSES.step(currentStep + 1, recipe.instructions[currentStep]?.text ?? ''),
          };
        }

        case 'RESTART': {
          onStepChange(0);
          return {
            text: VOICE_RESPONSES.startingOver(recipe.instructions[0]?.text ?? ''),
            action: 'SET_STEP',
            payload: { step: 0 },
          };
        }

        case 'WHAT_STEP': {
          return {
            text: VOICE_RESPONSES.currentStep(currentStep + 1, totalSteps, recipe.instructions[currentStep]?.text ?? ''),
          };
        }

        case 'READ_INGREDIENTS': {
          const ingredientsList = recipe.ingredients
            .map((ing) => `${ing.quantity} ${ing.unit} ${ing.name}`)
            .join(', ');
          return {
            text: VOICE_RESPONSES.ingredientsList(ingredientsList),
          };
        }

        case 'INGREDIENT_QUERY': {
          const queryName = params?.ingredientName ?? '';
          if (!queryName) {
            return { text: VOICE_RESPONSES.ingredientNotHeard };
          }

          // Search for matching ingredient (fuzzy match)
          const matchingIngredient = recipe.ingredients.find((ing) => {
            const ingName = ing.name.toLowerCase();
            const query = queryName.toLowerCase();
            return ingName.includes(query) || query.includes(ingName);
          });

          if (matchingIngredient) {
            const amount = `${matchingIngredient.quantity} ${matchingIngredient.unit}`.trim();
            return {
              text: VOICE_RESPONSES.ingredientAmount(amount, matchingIngredient.name),
            };
          }

          // No match found - try partial matches
          const partialMatches = recipe.ingredients.filter((ing) => {
            const ingName = ing.name.toLowerCase();
            const query = queryName.toLowerCase();
            const queryWords = query.split(/\s+/);
            const ingWords = ingName.split(/\s+/);
            return queryWords.some((qw) =>
              ingWords.some((iw) => iw.includes(qw) || qw.includes(iw))
            );
          });

          if (partialMatches.length === 1 && partialMatches[0]) {
            const match = partialMatches[0];
            const amount = `${match.quantity} ${match.unit}`.trim();
            return {
              text: VOICE_RESPONSES.ingredientAmount(amount, match.name),
            };
          } else if (partialMatches.length > 1) {
            const names = partialMatches.map((m) => m.name).join(', ');
            return {
              text: VOICE_RESPONSES.ingredientMultipleMatches(names),
            };
          }

          return {
            text: VOICE_RESPONSES.ingredientNotFound(queryName),
          };
        }

        case 'TEMPERATURE_QUERY': {
          // Look for temperature/heat info in current step and nearby steps
          const currentInstruction = recipe.instructions[currentStep]?.text ?? '';

          // Patterns to extract temperature info
          const tempPatterns = [
            /(\d+)\s*°?\s*([FCfc]|degrees?\s*(?:fahrenheit|celsius)?)/i,
            /(?:over|on|at|use)?\s*(low|medium-low|medium|medium-high|high)\s*heat/i,
            /(?:preheat|bake|roast|cook)\s*(?:oven\s*)?(?:to|at)\s*(\d+)/i,
            /(simmer|boil|gentle\s+boil|rolling\s+boil)/i,
          ];

          const formatTempUnit = (raw: string): string =>
            raw.toLowerCase().startsWith('c') ? '°C' : '°F';

          // Check current step first
          for (const pattern of tempPatterns) {
            const match = currentInstruction.match(pattern);
            if (match) {
              if (match[0].match(/\d+/)) {
                const degrees = match[0].match(/\d+/)?.[0] ?? '';
                const unit = match[0].match(/[FCfc]|fahrenheit|celsius/i)?.[0] ?? '';
                return { text: VOICE_RESPONSES.tempCurrentStep(degrees, formatTempUnit(unit)) };
              }
              return { text: VOICE_RESPONSES.tempCurrentStepHeat(match[0].toLowerCase().trim()) };
            }
          }

          // Check all instructions for temperature info
          for (let i = 0; i < recipe.instructions.length; i++) {
            const instruction = recipe.instructions[i]?.text ?? '';
            for (const pattern of tempPatterns) {
              const match = instruction.match(pattern);
              if (match) {
                const stepNum = i + 1;
                if (match[0].match(/\d+/)) {
                  const degrees = match[0].match(/\d+/)?.[0] ?? '';
                  const unit = match[0].match(/[FCfc]|fahrenheit|celsius/i)?.[0] ?? '';
                  return { text: VOICE_RESPONSES.tempOtherStep(stepNum, degrees, formatTempUnit(unit)) };
                }
                return { text: VOICE_RESPONSES.tempOtherStepHeat(stepNum, match[0].toLowerCase().trim()) };
              }
            }
          }

          return { text: VOICE_RESPONSES.tempNotFound };
        }

        case 'SET_TIMER': {
          const minutes = params?.timerMinutes ?? 0;
          const seconds = params?.timerSeconds ?? 0;
          const totalSeconds = minutes * 60 + seconds;

          if (totalSeconds > 0) {
            onTimerStart?.(totalSeconds);
            const timeText =
              minutes > 0
                ? `${minutes} minute${minutes > 1 ? 's' : ''}`
                : `${seconds} second${seconds > 1 ? 's' : ''}`;
            return {
              text: VOICE_RESPONSES.timerSet(timeText),
              action: 'START_TIMER',
              payload: { seconds: totalSeconds },
            };
          }
          return { text: VOICE_RESPONSES.timerNotHeard };
        }

        case 'STOP_TIMER': {
          onTimerStop?.();
          return {
            text: VOICE_RESPONSES.timerStopped,
            action: 'STOP_TIMER',
          };
        }

        case 'STOP_SPEAKING': {
          await stopSpeaking();
          return { text: '' };
        }

        case 'PAUSE': {
          autoListenRef.current = false;
          return { text: VOICE_RESPONSES.paused };
        }

        case 'HELP': {
          return {
            text: VOICE_HELP_TEXT,
          };
        }

        case 'UNKNOWN':
        default:
          return { text: FALLBACK_RESPONSES.notUnderstood };
      }
    },
    [recipe, currentStep, onStepChange, onTimerStart, onTimerStop]
  );

  const speakText = useCallback(async (text: string, skipCache = false) => {
    setIsLoadingTTS(true);
    setVoiceState('speaking');
    try {
      // Check if text is cached - if not, play "One moment" first for instant feedback
      const textIsCached = isCached(text);
      if (!textIsCached && !skipCache) {
        await speak(ONE_MOMENT_RESPONSE, {
          onDone: () => {
            // Continue to main audio
          },
          onError: () => {
            // Continue anyway
          },
        });
        await new Promise((resolve) => setTimeout(resolve, FEEDBACK_PAUSE_MS));
      }

      await speak(text, {
        skipCache,
        onStart: () => {
          setIsLoadingTTS(false);
        },
        onDone: () => {
          setIsLoadingTTS(false);
          setVoiceState('idle');
        },
        onError: () => {
          setIsLoadingTTS(false);
          setVoiceState('idle');
        },
      });
    } catch {
      setIsLoadingTTS(false);
      setVoiceState('idle');
    }
  }, []);

  const stopSpeakingNow = useCallback(async () => {
    await stopSpeaking();
    setIsLoadingTTS(false);
    setVoiceState('idle');
  }, []);

  const speakCurrentStep = useCallback(async () => {
    const step = currentStepRef.current;
    if (!recipe || !recipe.instructions[step]) return;
    const stepText = VOICE_RESPONSES.step(step + 1, recipe.instructions[step].text);
    await speakText(stepText);
  }, [recipe, speakText]);

  const speakIngredients = useCallback(async () => {
    if (!recipe) return;
    const ingredientsList = recipe.ingredients
      .map((ing) => `${ing.quantity} ${ing.unit} ${ing.name}`)
      .join('. ');
    await speakText(VOICE_RESPONSES.ingredientsAudio(ingredientsList));
  }, [recipe, speakText]);

  return {
    voiceState,
    isListening,
    isSpeakingState,
    isLoadingTTS,
    lastTranscript,
    error,
    hasPermission,
    isVoiceListeningAvailable: isTranscriptionAvailable(),

    startListening,
    stopListening,
    toggleListening,
    speakText,
    stopSpeakingNow,
    requestPermission: requestPermissionHandler,
    speakCurrentStep,
    speakIngredients,
  };
}
