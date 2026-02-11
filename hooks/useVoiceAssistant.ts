import { useState, useCallback, useRef, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
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
} from '@/utils/voice';
import {
  VOICE_HELP_TEXT,
  FALLBACK_RESPONSES,
} from '@/constants/voiceCommands';

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
      cancelRecording();
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

      await startRecording();

      // Auto-stop after 5 seconds of recording
      recordingTimeoutRef.current = setTimeout(async () => {
        await processRecording();
      }, 5000);
    } catch (err) {
      console.error('Start listening error:', err);
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

      const audioUri = await stopRecording();
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

      console.log('Transcript:', transcript);

      const intentResult = detectIntent(transcript);
      console.log('Intent:', intentResult.intent);

      const response = await handleCommand(intentResult);

      if (response.text) {
        // Check if response is cached - if not, play instant feedback first
        const responseIsCached = isCached(response.text);

        if (!responseIsCached) {
          // Uncached response - give instant "One moment" feedback while we fetch audio
          // This provides immediate user feedback so they know we heard them
          console.log('[Voice] Response not cached, playing "One moment" first');
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
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        setVoiceState('speaking');
        await speak(response.text, {
          onDone: () => {
            setVoiceState('idle');
            if (autoListenRef.current && enabled) {
              // Reduced delay for auto-listen
              setTimeout(() => startListening(), 300);
            }
          },
          onError: () => {
            setVoiceState('idle');
          },
        });
      } else {
        setVoiceState('idle');
      }
    } catch (err) {
      console.error('Process recording error:', err);
      setError('Failed to process voice command');
      setVoiceState('error');

      setTimeout(() => setVoiceState('idle'), 1500);
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
            text: `Step ${newStep + 1}: ${recipe.instructions[newStep]?.text ?? ''}`,
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
            text: `Going back. Step ${newStep + 1}: ${recipe.instructions[newStep]?.text ?? ''}`,
            action: 'SET_STEP',
            payload: { step: newStep },
          };
        }

        case 'REPEAT':
        case 'READ_CURRENT_STEP': {
          return {
            text: `Step ${currentStep + 1}: ${recipe.instructions[currentStep]?.text ?? ''}`,
          };
        }

        case 'RESTART': {
          onStepChange(0);
          return {
            text: `Starting over. Step 1: ${recipe.instructions[0]?.text ?? ''}`,
            action: 'SET_STEP',
            payload: { step: 0 },
          };
        }

        case 'WHAT_STEP': {
          return {
            text: `You're on step ${currentStep + 1} of ${totalSteps}. ${recipe.instructions[currentStep]?.text ?? ''}`,
          };
        }

        case 'READ_INGREDIENTS': {
          const ingredientsList = recipe.ingredients
            .map((ing) => `${ing.quantity} ${ing.unit} ${ing.name}`)
            .join(', ');
          return {
            text: `You'll need: ${ingredientsList}`,
          };
        }

        case 'INGREDIENT_QUERY': {
          const queryName = params?.ingredientName ?? '';
          if (!queryName) {
            return { text: "I didn't catch which ingredient you're asking about." };
          }

          // Search for matching ingredient (fuzzy match)
          const matchingIngredient = recipe.ingredients.find((ing) => {
            const ingName = ing.name.toLowerCase();
            const query = queryName.toLowerCase();
            // Exact match or contains
            return ingName.includes(query) || query.includes(ingName);
          });

          if (matchingIngredient) {
            const amount = `${matchingIngredient.quantity} ${matchingIngredient.unit}`.trim();
            return {
              text: `You need ${amount} of ${matchingIngredient.name}.`,
            };
          }

          // No match found - try partial matches
          const partialMatches = recipe.ingredients.filter((ing) => {
            const ingName = ing.name.toLowerCase();
            const query = queryName.toLowerCase();
            // Check if any word matches
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
              text: `You need ${amount} of ${match.name}.`,
            };
          } else if (partialMatches.length > 1) {
            const names = partialMatches.map((m) => m.name).join(', ');
            return {
              text: `I found several ingredients that might match: ${names}. Which one do you mean?`,
            };
          }

          return {
            text: `I couldn't find ${queryName} in this recipe's ingredients. Try saying "read ingredients" to hear the full list.`,
          };
        }

        case 'TEMPERATURE_QUERY': {
          // Look for temperature/heat info in current step and nearby steps
          const currentInstruction = recipe.instructions[currentStep]?.text ?? '';

          // Patterns to extract temperature info
          const tempPatterns = [
            // Degrees: "350°F", "180°C", "400 degrees"
            /(\d+)\s*°?\s*([FCfc]|degrees?\s*(?:fahrenheit|celsius)?)/i,
            // Heat levels: "medium heat", "low heat", "high heat", "medium-high"
            /(?:over|on|at|use)?\s*(low|medium-low|medium|medium-high|high)\s*heat/i,
            // Oven: "preheat to 350", "bake at 400"
            /(?:preheat|bake|roast|cook)\s*(?:oven\s*)?(?:to|at)\s*(\d+)/i,
            // Simmer/boil
            /(simmer|boil|gentle\s+boil|rolling\s+boil)/i,
          ];

          // Check current step first
          for (const pattern of tempPatterns) {
            const match = currentInstruction.match(pattern);
            if (match) {
              // Found temperature info in current step
              if (match[0].match(/\d+/)) {
                // Has a number (degrees)
                const degrees = match[0].match(/\d+/)?.[0];
                const unit = match[0].match(/[FCfc]|fahrenheit|celsius/i)?.[0] ?? '';
                const unitDisplay = unit.toLowerCase().startsWith('c') ? '°C' : '°F';
                return {
                  text: `This step says ${degrees}${unitDisplay}.`,
                };
              } else {
                // Heat level like "medium heat"
                return {
                  text: `This step says to use ${match[0].toLowerCase().trim()}.`,
                };
              }
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
                  const degrees = match[0].match(/\d+/)?.[0];
                  const unit = match[0].match(/[FCfc]|fahrenheit|celsius/i)?.[0] ?? '';
                  const unitDisplay = unit.toLowerCase().startsWith('c') ? '°C' : '°F';
                  return {
                    text: `Step ${stepNum} mentions ${degrees}${unitDisplay}.`,
                  };
                } else {
                  return {
                    text: `Step ${stepNum} says to use ${match[0].toLowerCase().trim()}.`,
                  };
                }
              }
            }
          }

          // No temperature info found
          return {
            text: "I couldn't find specific temperature information in this recipe. Check the current step for cooking instructions.",
          };
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
              text: `Setting a timer for ${timeText}.`,
              action: 'START_TIMER',
              payload: { seconds: totalSeconds },
            };
          }
          return {
            text: "I didn't catch the time. Try saying 'set timer for 5 minutes'.",
          };
        }

        case 'STOP_TIMER': {
          onTimerStop?.();
          return {
            text: 'Timer stopped.',
            action: 'STOP_TIMER',
          };
        }

        case 'STOP_SPEAKING': {
          await stopSpeaking();
          return { text: '' };
        }

        case 'PAUSE': {
          autoListenRef.current = false;
          return {
            text: "Pausing voice assistant. Tap the microphone when you're ready to continue.",
          };
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
      console.log('[Voice] speakText starting...');

      // Check if text is cached - if not, play "One moment" first for instant feedback
      const textIsCached = isCached(text);
      if (!textIsCached && !skipCache) {
        console.log('[Voice] Text not cached, playing "One moment" first');
        await speak(ONE_MOMENT_RESPONSE, {
          onDone: () => {
            // Continue to main audio
          },
          onError: () => {
            // Continue anyway
          },
        });
        // Small pause between feedback and response
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      await speak(text, {
        skipCache, // Skip cache for short confirmations like "Yes?"
        onStart: () => {
          console.log('[Voice] speakText audio started playing');
          setIsLoadingTTS(false);
        },
        onDone: () => {
          console.log('[Voice] speakText done');
          setIsLoadingTTS(false);
          setVoiceState('idle');
        },
        onError: (error) => {
          console.error('[Voice] speakText error:', error);
          setIsLoadingTTS(false);
          setVoiceState('idle');
        },
      });
    } catch (error) {
      console.error('[Voice] speakText catch error:', error);
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
    // Use ref to get the most current step value (avoids stale closure)
    const step = currentStepRef.current;
    console.log('[Voice] speakCurrentStep called, recipe:', !!recipe, 'step:', step);
    if (!recipe || !recipe.instructions[step]) {
      console.log('[Voice] No recipe or instruction to speak');
      return;
    }
    const stepText = `Step ${step + 1}: ${recipe.instructions[step].text}`;
    console.log('[Voice] Speaking step:', stepText.substring(0, 50));
    await speakText(stepText);
  }, [recipe, speakText]);

  const speakIngredients = useCallback(async () => {
    if (!recipe) return;
    const ingredientsList = recipe.ingredients
      .map((ing) => `${ing.quantity} ${ing.unit} ${ing.name}`)
      .join('. ');
    await speakText(`Ingredients: ${ingredientsList}`);
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
