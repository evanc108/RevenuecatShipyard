import { Icon } from '@/components/ui/Icon';
import { Loading } from '@/components/ui/Loading';
import { PaywallModal } from '@/components/ui/PaywallModal';
import { Colors, FontFamily, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { COOK_MODE_COPY } from '@/constants/voiceCommands';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useSubscription } from '@/hooks/useSubscription';
import { useVoiceAssistant } from '@/hooks/useVoiceAssistant';
import { useWakeWord } from '@/hooks/useWakeWord';
import { getIngredientImageUrl } from '@/utils/ingredientImage';
import { isSpeaking, onAudioSessionReleased, precacheCommonResponses, precacheTexts } from '@/utils/voice';
import { useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Card dimensions calculated inside component using useWindowDimensions

const copy = COOK_MODE_COPY;

/** Timing constants for wake word restart delays (ms) */
const WAKE_WORD_RESTART_DELAY_MS = 200;
const AUDIO_SESSION_RELEASE_DELAY_MS = 50;

// --- Ingredient Helpers ---
const INGREDIENT_IMAGE_SIZE = 44;

const CATEGORY_COLORS = {
  protein: '#FFE0E0',
  vegetable: '#E0F5E0',
  fruit: '#FFF5D6',
  dairy: '#DEE8FF',
  other: '#F5F5F7',
} as const;

type IngredientCategory = keyof typeof CATEGORY_COLORS;

function getIngredientCategory(category?: string, name?: string): IngredientCategory {
  const has = (text: string, keys: string[]): boolean =>
    keys.some((k) => text.includes(k));

  if (category) {
    const cat = category.toLowerCase();
    if (has(cat, ['protein', 'meat', 'poultry', 'seafood', 'fish', 'egg'])) return 'protein';
    if (has(cat, ['vegetable', 'produce', 'veg'])) return 'vegetable';
    if (has(cat, ['fruit'])) return 'fruit';
    if (has(cat, ['dairy', 'milk', 'cheese'])) return 'dairy';
    return 'other';
  }

  if (name) {
    const lower = name.toLowerCase();
    if (has(lower, ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'fish', 'salmon', 'tuna', 'shrimp', 'egg', 'bacon', 'sausage', 'steak', 'tofu'])) return 'protein';
    if (has(lower, ['onion', 'garlic', 'tomato', 'pepper', 'carrot', 'celery', 'broccoli', 'spinach', 'potato', 'mushroom', 'zucchini', 'cucumber', 'corn', 'peas'])) return 'vegetable';
    if (has(lower, ['lemon', 'lime', 'orange', 'apple', 'banana', 'berry', 'mango', 'avocado', 'coconut'])) return 'fruit';
    if (has(lower, ['milk', 'cream', 'cheese', 'yogurt', 'butter'])) return 'dairy';
  }

  return 'other';
}


// --- Voice Button Component ---
const VoiceButton = memo(function VoiceButton({
  voiceState,
  onPress,
  size = 72,
}: {
  voiceState: 'idle' | 'listening' | 'processing' | 'speaking' | 'error';
  onPress: () => void;
  size?: number;
}) {
  const scale = useSharedValue(1);
  const pulseScale = useSharedValue(1);

  // Pulse animation for listening state
  useEffect(() => {
    if (voiceState === 'listening') {
      pulseScale.value = withSpring(1.15, { damping: 8 });
    } else {
      pulseScale.value = withSpring(1);
    }
  }, [voiceState, pulseScale]);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: voiceState === 'listening' ? 0.3 : 0,
  }));

  const getIcon = () => {
    switch (voiceState) {
      case 'listening':
        return 'mic';
      case 'processing':
        return 'loader';
      case 'speaking':
        return 'volume-2';
      case 'error':
        return 'mic-off';
      default:
        return 'mic';
    }
  };

  const getBackgroundColor = () => {
    switch (voiceState) {
      case 'listening':
        return Colors.accent;
      case 'error':
        return Colors.semantic.error;
      default:
        // Keep default grey/inactive state
        return Colors.background.secondary;
    }
  };

  const getIconColor = () => {
    switch (voiceState) {
      case 'listening':
      case 'error':
        return Colors.text.inverse;
      default:
        return Colors.accent;
    }
  };

  return (
    <View style={[styles.voiceButtonContainer, { width: size, height: size }]}>
      {/* Active listening pulse */}
      <Animated.View
        style={[
          styles.voicePulse,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: Colors.accent },
          pulseStyle,
        ]}
      />
      <Animated.View style={buttonStyle}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={voiceState === 'listening' ? 'Stop listening' : 'Start listening'}
          onPress={onPress}
          onPressIn={() => {
            scale.value = withSpring(0.95);
          }}
          onPressOut={() => {
            scale.value = withSpring(1);
          }}
          style={[
            styles.voiceButton,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: getBackgroundColor(),
            },
          ]}
        >
          <Icon name={getIcon()} size={size * 0.4} color={getIconColor()} strokeWidth={2} />
        </Pressable>
      </Animated.View>
    </View>
  );
});

// --- Instruction Card Component ---
const InstructionCard = memo(function InstructionCard({
  stepNumber,
  totalSteps,
  instruction,
  isActive,
}: {
  stepNumber: number;
  totalSteps: number;
  instruction: string;
  isActive: boolean;
}) {
  return (
    <View style={[styles.card, isActive && styles.cardActive]}>
      <View style={styles.cardHeader}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>
            {copy.step} {stepNumber}
          </Text>
        </View>
        <Text style={styles.stepCounter}>
          {stepNumber} {copy.of} {totalSteps}
        </Text>
      </View>
      <ScrollView
        style={styles.cardContent}
        contentContainerStyle={styles.cardContentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.instructionText}>{instruction}</Text>
      </ScrollView>
    </View>
  );
});

// --- Ingredient Card for Modal ---
const IngredientCard = memo(function IngredientCard({
  name,
  rawText,
  category,
}: {
  name: string;
  rawText: string;
  category?: string;
}) {
  const ingredientCategory = getIngredientCategory(category, name);
  const bgColor = CATEGORY_COLORS[ingredientCategory];
  const imageUrl = getIngredientImageUrl(name);

  return (
    <View style={[ingStyles.card, { backgroundColor: bgColor }]}>
      <View style={ingStyles.imageCircle}>
        <Text style={ingStyles.imageFallback}>{name.charAt(0).toUpperCase()}</Text>
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFillObject}
          contentFit="contain"
          cachePolicy="memory-disk"
        />
      </View>
      <View style={ingStyles.info}>
        <Text style={ingStyles.name} numberOfLines={1}>{name}</Text>
        <Text style={ingStyles.detail} numberOfLines={1}>{rawText}</Text>
      </View>
    </View>
  );
});

const ingStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 4,
    paddingHorizontal: Spacing.sm + 2,
    borderRadius: Radius.lg,
    marginBottom: Spacing.sm,
  },
  imageCircle: {
    width: INGREDIENT_IMAGE_SIZE,
    height: INGREDIENT_IMAGE_SIZE,
    borderRadius: INGREDIENT_IMAGE_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: Spacing.sm,
  },
  imageFallback: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...Typography.label,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  detail: {
    ...Typography.bodySmall,
    color: Colors.text.primary,
  },
});

// --- Ingredients Modal ---
const IngredientsModal = memo(function IngredientsModal({
  visible,
  onClose,
  ingredients,
  onToggleRead,
  isSpeaking,
  isLoading,
  maxHeight,
  bottomInset,
}: {
  visible: boolean;
  onClose: () => void;
  ingredients: Array<{
    name: string;
    rawText: string;
    quantity: number;
    unit: string;
    category?: string;
  }>;
  onToggleRead: () => void;
  isSpeaking: boolean;
  isLoading: boolean;
  maxHeight: number;
  bottomInset: number;
}) {
  // Animate sheet slide up independently from backdrop
  const translateY = useSharedValue(maxHeight);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 300 });
    } else {
      translateY.value = maxHeight;
    }
  }, [visible, maxHeight, translateY]);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <Animated.View
          style={[
            styles.modalSheet,
            {
              height: maxHeight,
              paddingBottom: bottomInset + Spacing.lg,
            },
            sheetAnimatedStyle,
          ]}
        >
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{copy.ingredients}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isSpeaking ? 'Stop reading' : 'Read ingredients aloud'}
              style={[styles.readButton, isSpeaking && styles.readButtonSpeaking]}
              onPress={onToggleRead}
            >
              {isLoading ? (
                <Loading size="button" />
              ) : (
                <Icon
                  name={isSpeaking ? 'close' : 'volume-2'}
                  size={18}
                  color={isSpeaking ? Colors.text.inverse : Colors.accent}
                />
              )}
              <Text style={[styles.readButtonText, isSpeaking && styles.readButtonTextSpeaking]}>
                {isLoading ? 'Loading...' : isSpeaking ? 'Stop' : 'Read'}
              </Text>
            </Pressable>
          </View>
          <ScrollView
            style={styles.ingredientsList}
            contentContainerStyle={styles.ingredientsListContent}
            showsVerticalScrollIndicator={true}
          >
            {ingredients.map((ing, idx) => (
              <IngredientCard
                key={`${ing.name}-${idx}`}
                name={ing.name}
                rawText={ing.rawText}
                category={ing.category}
              />
            ))}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close ingredients"
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>Done</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
});

// --- Main Cook Mode Screen ---
export default function CookModeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const recipeId = id as Id<'recipes'>;
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Calculate card dimensions dynamically
  const cardWidth = screenWidth - Spacing.lg * 2;
  const cardHeight = screenHeight * 0.55;
  const swipeThreshold = screenWidth * 0.25;

  const recipe = useQuery(api.recipes.get, recipeId ? { id: recipeId } : 'skip');
  const { isPro } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);

  const [currentStep, setCurrentStep] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const [precacheProgress, setPrecacheProgress] = useState<{ cached: number; total: number } | null>(null);
  const heyNomEnabled = isPro; // Hey Nom only enabled for pro users
  const precacheStartedRef = useRef(false);

  const translateX = useSharedValue(0);
  const cardScale = useSharedValue(1);

  const {
    voiceState,
    isSpeakingState,
    isLoadingTTS,
    isListening,
    toggleListening,
    startListening,
    speakText,
    speakCurrentStep,
    speakIngredients,
    stopSpeakingNow,
    hasPermission,
    requestPermission,
  } = useVoiceAssistant({
    recipe: recipe
      ? {
        title: recipe.title,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
      }
      : null,
    currentStep,
    onStepChange: setCurrentStep,
    enabled: true,
  });

  // Check if TTS is actually playing - combines React state AND TTS module state
  // This ensures accurate detection whether TTS was triggered by voice command or button
  const isTTSPlaying = isSpeakingState || isSpeaking();

  // Wake word detection - "Hey Nom"
  const handleWakeWordDetected = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Mark that we're in a voice interaction to prevent premature wake word restart
    isInVoiceInteractionRef.current = true;

    try {
      // FIRST: Stop any currently playing audio immediately
      await stopSpeakingNow();

      // Use cached "Yes?" audio for instant response (pre-cached on mount)
      await speakText('Yes?');

      // Minimal delay then start listening
      await new Promise((resolve) => setTimeout(resolve, 20));
      startListening();
    } catch {
      startListening();
    } finally {
      // Clear the interaction flag after a delay to allow listening to start
      setTimeout(() => {
        isInVoiceInteractionRef.current = false;
      }, 500);
    }
  }, [startListening, speakText, stopSpeakingNow]);

  const {
    isWakeWordListening,
    isRecording: isWakeWordRecording,
    startWakeWordListening,
    stopWakeWordListening,
  } = useWakeWord({
    onWakeWordDetected: handleWakeWordDetected,
    // Use both React state AND actual TTS module state for reliability
    enabled: heyNomEnabled && !isListening && !isTTSPlaying,
  });

  // Cleanup all voice features on unmount (stop TTS and wake word)
  useEffect(() => {
    return () => {
      stopSpeakingNow();
      stopWakeWordListening();
    };
  }, [stopSpeakingNow, stopWakeWordListening]);

  // Pre-cache common responses on mount (for instant "Yes?" playback)
  useEffect(() => {
    precacheCommonResponses();
  }, []);

  // Pre-cache recipe step TTS audio in background when recipe loads
  // This makes "Read Step" instant after the first load
  // Note: Ingredients audio is NOT pre-cached - only fetched when user presses "Read Ingredients"
  useEffect(() => {
    if (!recipe || precacheStartedRef.current) return;
    precacheStartedRef.current = true;

    const stepTexts = recipe.instructions.map(
      (instruction, index) => `Step ${index + 1}: ${instruction.text}`
    );

    // Pre-cache steps only (not ingredients) in background with progress tracking
    precacheTexts(stepTexts, {
      maxConcurrent: 2,
      onProgress: (cached, total) => {
        setPrecacheProgress({ cached, total });
      },
    });
  }, [recipe]);

  // CRITICAL: Force stop wake word when speaking starts
  // This catches React state batching delays where enabled prop doesn't update instantly
  useEffect(() => {
    if (isTTSPlaying || voiceState === 'speaking') {
      if (isWakeWordListening || isWakeWordRecording) {
        stopWakeWordListening();
      }
    }
  }, [isTTSPlaying, voiceState, isWakeWordListening, isWakeWordRecording, stopWakeWordListening]);

  // Track if we're in the middle of a voice interaction to prevent premature wake word restart
  const isInVoiceInteractionRef = useRef(false);

  // Register callback for when audio session is released - this is the reliable trigger for wake word restart
  useEffect(() => {
    const handleAudioSessionReleased = () => {
      // Don't restart if we're in the middle of a voice interaction (e.g., just detected wake word)
      if (isInVoiceInteractionRef.current) {
        return;
      }

      // Only restart if conditions are right - use small delay to let state settle
      setTimeout(() => {
        if (heyNomEnabled && !isListening && !isSpeaking() && !isInVoiceInteractionRef.current) {
          startWakeWordListening();
        }
      }, AUDIO_SESSION_RELEASE_DELAY_MS);
    };

    onAudioSessionReleased(handleAudioSessionReleased);

    return () => {
      onAudioSessionReleased(null);
    };
  }, [heyNomEnabled, isListening, startWakeWordListening]);

  // Fallback: Restart wake word listening after voice interaction completes (backup if callback doesn't fire)
  useEffect(() => {
    // Only restart if truly idle and not speaking
    // Also check isTTSPlaying which uses the actual TTS module state
    if (heyNomEnabled && voiceState === 'idle' && !isListening && !isSpeakingState && !isWakeWordRecording && !isTTSPlaying) {
      // Longer delay as fallback - the callback approach is primary
      const timer = setTimeout(() => {
        // Skip if we're in the middle of a voice interaction
        if (isInVoiceInteractionRef.current) {
          return;
        }
        // Triple-check using TTS module's actual state before restarting
        if (!isWakeWordListening && voiceState === 'idle' && !isSpeaking()) {
          startWakeWordListening();
        }
      }, 1000); // Increased to 1000ms as fallback
      return () => clearTimeout(timer);
    }
  }, [heyNomEnabled, voiceState, isListening, isSpeakingState, isWakeWordListening, isWakeWordRecording, isTTSPlaying, startWakeWordListening]);

  const totalSteps = recipe?.instructions.length ?? 0;
  const canGoNext = currentStep < totalSteps - 1;
  const canGoPrev = currentStep > 0;

  // Stop speaking when step changes and restart wake word
  useEffect(() => {
    let restartTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    if (isSpeakingState || isSpeaking()) {
      stopSpeakingNow().then(() => {
        if (cancelled) return;
        // Restart wake word after step change stops audio
        if (heyNomEnabled && !isListening) {
          restartTimer = setTimeout(() => {
            if (!isSpeaking()) {
              startWakeWordListening();
            }
          }, WAKE_WORD_RESTART_DELAY_MS);
        }
      });
    }

    return () => {
      cancelled = true;
      if (restartTimer) clearTimeout(restartTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  // Animate to next step with swipe animation
  const goToNextStep = useCallback(() => {
    if (canGoNext) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Animate card off screen to the left
      translateX.value = withTiming(-screenWidth, { duration: 200 }, () => {
        runOnJS(setCurrentStep)(currentStep + 1);
        translateX.value = 0;
      });
      cardScale.value = withTiming(0.95, { duration: 100 }, () => {
        cardScale.value = withSpring(1);
      });
    }
  }, [canGoNext, screenWidth, translateX, cardScale, currentStep]);

  // Animate to previous step with swipe animation
  const goToPrevStep = useCallback(() => {
    if (canGoPrev) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Animate card off screen to the right
      translateX.value = withTiming(screenWidth, { duration: 200 }, () => {
        runOnJS(setCurrentStep)(currentStep - 1);
        translateX.value = 0;
      });
      cardScale.value = withTiming(0.95, { duration: 100 }, () => {
        cardScale.value = withSpring(1);
      });
    }
  }, [canGoPrev, screenWidth, translateX, cardScale, currentStep]);

  const handleVoiceToggle = useCallback(async () => {
    if (!isPro) {
      setShowPaywall(true);
      return;
    }
    // If speaking (check both React state AND TTS module state), stop it first
    if (isSpeakingState || isTTSPlaying) {
      await stopSpeakingNow();

      // Restart wake word after stopping audio via mic button
      if (heyNomEnabled) {
        setTimeout(() => {
          if (!isSpeaking() && !isListening) {
            startWakeWordListening();
          }
        }, WAKE_WORD_RESTART_DELAY_MS);
      }
      return;
    }
    // Check permission if needed
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) return;
    }
    // Stop wake word recording before starting manual recording
    if (isWakeWordRecording || isWakeWordListening) {
      await stopWakeWordListening();
      // Wait for audio session to be released
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    // Toggle listening with single tap
    await toggleListening();
  }, [isPro, isSpeakingState, isTTSPlaying, stopSpeakingNow, hasPermission, requestPermission, toggleListening, isWakeWordRecording, isWakeWordListening, stopWakeWordListening, heyNomEnabled, isListening, startWakeWordListening]);

  const handleReadStep = useCallback(async () => {
    if (!isPro) {
      setShowPaywall(true);
      return;
    }
    // Toggle: if speaking, stop; otherwise start speaking
    // Use isTTSPlaying for accurate detection (not just React state)
    if (isSpeakingState || isTTSPlaying) {
      await stopSpeakingNow();

      // Explicitly restart wake word listening after stopping audio via button
      if (heyNomEnabled) {
        setTimeout(() => {
          if (!isSpeaking() && !isListening) {
            startWakeWordListening();
          }
        }, WAKE_WORD_RESTART_DELAY_MS);
      }
      return; // Just stop, don't start new audio
    }

    // Stop listening and wake word in parallel if needed
    const stopPromises: Promise<void>[] = [];
    if (voiceState === 'listening') {
      stopPromises.push(toggleListening());
    }
    if (isWakeWordRecording || isWakeWordListening) {
      stopPromises.push(stopWakeWordListening());
    }

    // Wait for all stop operations in parallel
    if (stopPromises.length > 0) {
      await Promise.all(stopPromises);
    }

    // Start speaking the current step
    await speakCurrentStep();
  }, [isPro, isSpeakingState, isTTSPlaying, stopSpeakingNow, speakCurrentStep, voiceState, toggleListening, isWakeWordRecording, isWakeWordListening, stopWakeWordListening, heyNomEnabled, isListening, startWakeWordListening]);

  const handleReadIngredients = useCallback(async () => {
    if (!isPro) {
      setShowPaywall(true);
      return;
    }
    // Toggle: if speaking, stop; otherwise start speaking
    // Check both React state AND TTS module state for accuracy
    if (isSpeakingState || isTTSPlaying) {
      await stopSpeakingNow();

      // Explicitly restart wake word listening after stopping audio via button
      if (heyNomEnabled) {
        setTimeout(() => {
          if (!isSpeaking() && !isListening) {
            startWakeWordListening();
          }
        }, WAKE_WORD_RESTART_DELAY_MS);
      }
      return;
    }

    // Stop listening and wake word in parallel if needed
    const stopPromises: Promise<void>[] = [];
    if (voiceState === 'listening') {
      stopPromises.push(toggleListening());
    }
    if (isWakeWordRecording || isWakeWordListening) {
      stopPromises.push(stopWakeWordListening());
    }

    // Wait for all stop operations in parallel
    if (stopPromises.length > 0) {
      await Promise.all(stopPromises);
    }

    // Start speaking ingredients (don't close modal - let user close it)
    await speakIngredients();
  }, [isPro, isSpeakingState, isTTSPlaying, stopSpeakingNow, speakIngredients, voiceState, toggleListening, isWakeWordRecording, isWakeWordListening, stopWakeWordListening, heyNomEnabled, isListening, startWakeWordListening]);

  // Helper functions for pan gesture (to avoid animation inside animation)
  const incrementStep = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentStep((prev) => prev + 1);
  }, []);

  const decrementStep = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentStep((prev) => prev - 1);
  }, []);

  // Swipe gesture for card navigation
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      cardScale.value = interpolate(
        Math.abs(event.translationX),
        [0, screenWidth / 2],
        [1, 0.95],
        Extrapolation.CLAMP
      );
    })
    .onEnd((event) => {
      if (event.translationX < -swipeThreshold && canGoNext) {
        translateX.value = withTiming(-screenWidth, { duration: 200 }, () => {
          runOnJS(incrementStep)();
          translateX.value = 0;
        });
      } else if (event.translationX > swipeThreshold && canGoPrev) {
        translateX.value = withTiming(screenWidth, { duration: 200 }, () => {
          runOnJS(decrementStep)();
          translateX.value = 0;
        });
      } else {
        translateX.value = withSpring(0);
      }
      cardScale.value = withSpring(1);
    });

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { scale: cardScale.value }],
  }));

  // --- Early returns ---
  if (!recipeId) {
    return (
      <View style={styles.container}>
        <View style={styles.centeredContainer}>
          <Text style={styles.errorText}>Recipe not found</Text>
        </View>
      </View>
    );
  }

  if (recipe === undefined) {
    return (
      <View style={styles.container}>
        <View style={styles.centeredContainer}>
          <Loading size="large" />
        </View>
      </View>
    );
  }

  if (recipe === null) {
    return (
      <View style={styles.container}>
        <View style={styles.centeredContainer}>
          <Text style={styles.errorText}>Recipe not found</Text>
        </View>
      </View>
    );
  }

  const currentInstruction = recipe.instructions[currentStep];

  return (
    <View style={styles.container}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Exit cook mode"
            onPress={() => router.back()}
            hitSlop={12}
            style={styles.backButton}
          >
            <Icon name="close" size={24} color={Colors.text.primary} strokeWidth={2} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {recipe.title}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${((currentStep + 1) / totalSteps) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {currentStep + 1} / {totalSteps}
          </Text>
        </View>

        {/* Card Stack */}
        <View style={styles.cardContainer}>
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.cardWrapper, { width: cardWidth, height: cardHeight }, cardAnimatedStyle]}>
              <InstructionCard
                stepNumber={currentStep + 1}
                totalSteps={totalSteps}
                instruction={currentInstruction?.text ?? ''}
                isActive
              />
            </Animated.View>
          </GestureDetector>

          {/* Swipe hint */}
          <Text style={styles.swipeHint}>{copy.swipeHint}</Text>
        </View>

        {/* Bottom Controls */}
        <View style={[styles.bottomControls, { paddingBottom: insets.bottom + Spacing.md }]}>
          {/* Navigation buttons */}
          <View style={styles.navRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous step"
              style={[styles.navButton, !canGoPrev && styles.navButtonDisabled]}
              onPress={goToPrevStep}
              disabled={!canGoPrev}
            >
              <Icon
                name="chevron-left"
                size={28}
                color={canGoPrev ? Colors.text.primary : Colors.text.disabled}
                strokeWidth={2.5}
              />
            </Pressable>

            {/* Voice button */}
            <View>
              <VoiceButton
                voiceState={isPro ? voiceState : 'idle'}
                onPress={handleVoiceToggle}
                size={72}
              />
              {!isPro && (
                <View style={styles.voiceLockBadge}>
                  <Icon name="lock" size={14} color={Colors.text.inverse} />
                </View>
              )}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next step"
              style={[styles.navButton, !canGoNext && styles.navButtonDisabled]}
              onPress={goToNextStep}
              disabled={!canGoNext}
            >
              <Icon
                name="chevron-right"
                size={28}
                color={canGoNext ? Colors.text.primary : Colors.text.disabled}
                strokeWidth={2.5}
              />
            </Pressable>
          </View>

          {/* Voice status */}
          <Text style={styles.voiceStatus}>
            {!isPro
              ? 'Upgrade to Pro for voice features'
              : voiceState === 'listening'
                ? copy.listening
                : voiceState === 'processing'
                  ? copy.processing
                  : voiceState === 'speaking'
                    ? copy.speaking
                    : 'Say "Hey Nom" or Tap Mic'}
          </Text>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View ingredients"
              style={styles.actionButton}
              onPress={() => setShowIngredients(true)}
            >
              <Icon name="apple" size={20} color={Colors.accent} />
              <Text style={styles.actionButtonText}>{copy.ingredients}</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={!isPro ? 'Pro feature: Read current step' : isTTSPlaying ? 'Stop reading' : 'Read current step'}
              style={[
                styles.actionButton,
                isTTSPlaying && isPro && styles.actionButtonActive,
              ]}
              onPress={handleReadStep}
            >
              {isLoadingTTS ? (
                <Loading size="button" />
              ) : !isPro ? (
                <Icon name="lock" size={16} color={Colors.accent} />
              ) : (
                <Icon
                  name={isTTSPlaying ? 'close' : 'volume-2'}
                  size={20}
                  color={isTTSPlaying ? Colors.text.inverse : Colors.accent}
                />
              )}
              <Text
                style={[
                  styles.actionButtonText,
                  isTTSPlaying && isPro && styles.actionButtonTextActive,
                ]}
              >
                {!isPro ? 'Read Step (Pro)' : isLoadingTTS ? 'Loading...' : isTTSPlaying ? 'Stop' : 'Read Step'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Ingredients Modal */}
        <IngredientsModal
          visible={showIngredients}
          onClose={() => setShowIngredients(false)}
          ingredients={recipe.ingredients}
          onToggleRead={handleReadIngredients}
          isSpeaking={isTTSPlaying}
          isLoading={isLoadingTTS}
          maxHeight={screenHeight * 0.8}
          bottomInset={insets.bottom}
        />

        {/* Paywall Modal */}
        <PaywallModal
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          feature="cook"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  errorText: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },

  // Progress
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
  progressText: {
    ...Typography.caption,
    color: Colors.text.secondary,
    minWidth: 40,
    textAlign: 'right',
  },

  // Card
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  cardWrapper: {
    // width and height set dynamically via inline styles
  },
  card: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.background.primary,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    ...Shadow.elevated,
  },
  cardActive: {
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  stepBadge: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  stepBadgeText: {
    ...Typography.label,
    color: Colors.text.inverse,
    fontWeight: '700',
  },
  stepCounter: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
  cardContent: {
    flex: 1,
  },
  cardContentContainer: {
    paddingBottom: Spacing.md,
  },
  instructionText: {
    fontSize: 20,
    lineHeight: 30,
    fontFamily: FontFamily.regular,
    color: Colors.text.primary,
  },
  swipeHint: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    marginTop: Spacing.md,
    textAlign: 'center',
  },

  // Bottom Controls
  bottomControls: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  navButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  voiceStatus: {
    ...Typography.caption,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.full,
  },
  actionButtonText: {
    ...Typography.label,
    color: Colors.accent,
  },
  actionButtonActive: {
    backgroundColor: Colors.accent,
  },
  actionButtonTextActive: {
    color: Colors.text.inverse,
  },

  // Voice Button
  voiceButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceLockBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background.primary,
  },
  voicePulse: {
    position: 'absolute',
  },
  voiceButton: {
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.surface,
  },

  // Modal
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background.overlay,
  },
  modalSheet: {
    backgroundColor: Colors.background.primary,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    // maxHeight and paddingBottom set dynamically via inline styles
    // Flex properties for proper ScrollView sizing
    flexShrink: 1,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.text.tertiary,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    opacity: 0.4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    ...Typography.h2,
    color: Colors.text.primary,
  },
  readButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  readButtonSpeaking: {
    backgroundColor: Colors.accent,
  },
  readButtonText: {
    ...Typography.label,
    color: Colors.accent,
  },
  readButtonTextSpeaking: {
    color: Colors.text.inverse,
  },
  ingredientsList: {
    flex: 1,
    flexShrink: 1,
    minHeight: 100,
  },
  ingredientsListContent: {
    paddingBottom: Spacing.sm,
    flexGrow: 1,
  },
  closeButton: {
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  closeButtonText: {
    ...Typography.label,
    color: Colors.text.inverse,
    fontWeight: '700',
  },
});
