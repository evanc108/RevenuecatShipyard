import { Icon } from '@/components/ui/Icon';
import { Loading } from '@/components/ui/Loading';
import { COOK_MODE_COPY } from '@/constants/voiceCommands';
import { Colors, FontFamily, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useVoiceAssistant } from '@/hooks/useVoiceAssistant';
import { useWakeWord } from '@/hooks/useWakeWord';
import { precacheTexts, precacheCommonResponses, isSpeaking } from '@/utils/voice';
import { useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
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

// --- Ingredients Modal ---
const IngredientsModal = memo(function IngredientsModal({
  visible,
  onClose,
  ingredients,
  onReadIngredients,
  maxHeight,
}: {
  visible: boolean;
  onClose: () => void;
  ingredients: Array<{
    name: string;
    rawText: string;
    quantity: number;
    unit: string;
  }>;
  onReadIngredients: () => void;
  maxHeight: number;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={[styles.modalSheet, { maxHeight }]}>
        <View style={styles.modalHandle} />
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{copy.ingredients}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Read ingredients aloud"
            style={styles.readButton}
            onPress={onReadIngredients}
          >
            <Icon name="volume-2" size={18} color={Colors.accent} />
            <Text style={styles.readButtonText}>{copy.readIngredients}</Text>
          </Pressable>
        </View>
        <ScrollView style={styles.ingredientsList} showsVerticalScrollIndicator={false}>
          {ingredients.map((ing, idx) => (
            <View key={`${ing.name}-${idx}`} style={styles.ingredientRow}>
              <View style={styles.ingredientBullet} />
              <Text style={styles.ingredientText}>{ing.rawText}</Text>
            </View>
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

  const [currentStep, setCurrentStep] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const [precacheProgress, setPrecacheProgress] = useState<{ cached: number; total: number } | null>(null);
  const heyNomEnabled = true; // Hey Nom is always enabled
  const precacheStartedRef = useRef(false);

  const translateX = useSharedValue(0);
  const cardScale = useSharedValue(1);

  const {
    voiceState,
    isSpeakingState,
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

  // Wake word detection - "Hey Nom"
  const handleWakeWordDetected = useCallback(async () => {
    console.log('[CookMode] Hey Nom detected! Activating listening mode');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      // Use cached "Yes?" audio for instant response (pre-cached on mount)
      console.log('[CookMode] Speaking confirmation...');
      await speakText('Yes?'); // Uses cache - instant playback!
      console.log('[CookMode] Confirmation done, starting listening...');

      // Minimal delay then start listening
      await new Promise((resolve) => setTimeout(resolve, 20));
      startListening();
    } catch (error) {
      console.error('[CookMode] Error in wake word handler:', error);
      startListening();
    }
  }, [startListening, speakText]);

  // Check if TTS is actually playing (not just React state)
  const isTTSPlaying = isSpeakingState || isSpeaking();

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
      console.log('[CookMode] Cleaning up - stopping all voice features');
      stopSpeakingNow();
      stopWakeWordListening();
    };
  }, [stopSpeakingNow, stopWakeWordListening]);

  // Pre-cache common responses on mount (for instant "Yes?" playback)
  useEffect(() => {
    precacheCommonResponses();
  }, []);

  // Pre-cache all recipe step TTS audio in background when recipe loads
  // This makes "Read Step" instant after the first load
  useEffect(() => {
    if (!recipe || precacheStartedRef.current) return;
    precacheStartedRef.current = true;

    const stepTexts = recipe.instructions.map(
      (instruction, index) => `Step ${index + 1}: ${instruction.text}`
    );

    // Also cache ingredients reading
    const ingredientsList = recipe.ingredients
      .map((ing) => `${ing.quantity} ${ing.unit} ${ing.name}`)
      .join('. ');
    const ingredientsText = `Ingredients: ${ingredientsList}`;

    const allTexts = [...stepTexts, ingredientsText];

    console.log(`[CookMode] Pre-caching ${allTexts.length} TTS audio files...`);

    // Pre-cache in background with progress tracking
    precacheTexts(allTexts, {
      maxConcurrent: 2, // Conservative to avoid rate limits
      onProgress: (cached, total) => {
        setPrecacheProgress({ cached, total });
        if (cached === total) {
          console.log('[CookMode] All TTS audio pre-cached!');
        }
      },
    });
  }, [recipe]);

  // CRITICAL: Force stop wake word when speaking starts
  // This catches React state batching delays where enabled prop doesn't update instantly
  useEffect(() => {
    if (isTTSPlaying || voiceState === 'speaking') {
      if (isWakeWordListening || isWakeWordRecording) {
        console.log('[CookMode] Force stopping wake word - TTS is playing');
        stopWakeWordListening();
      }
    }
  }, [isTTSPlaying, voiceState, isWakeWordListening, isWakeWordRecording, stopWakeWordListening]);

  // Restart wake word listening after voice interaction completes
  useEffect(() => {
    // Only restart if truly idle and not speaking
    if (heyNomEnabled && voiceState === 'idle' && !isListening && !isSpeakingState && !isWakeWordRecording) {
      // Longer delay to ensure TTS has fully finished
      const timer = setTimeout(() => {
        // Double-check using TTS module's actual state, not just React state
        if (!isWakeWordListening && voiceState === 'idle' && !isSpeaking()) {
          startWakeWordListening();
        }
      }, 500); // Increased from 250ms to 500ms for safety
      return () => clearTimeout(timer);
    }
  }, [heyNomEnabled, voiceState, isListening, isSpeakingState, isWakeWordListening, isWakeWordRecording, startWakeWordListening]);

  const totalSteps = recipe?.instructions.length ?? 0;
  const canGoNext = currentStep < totalSteps - 1;
  const canGoPrev = currentStep > 0;

  // Stop speaking when step changes
  useEffect(() => {
    if (isSpeakingState) {
      stopSpeakingNow();
    }
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
    // If speaking, stop it first
    if (isSpeakingState) {
      await stopSpeakingNow();
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
      // Reduced delay - stopWakeWordListening now handles cleanup faster
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    // Toggle listening with single tap
    await toggleListening();
  }, [isSpeakingState, stopSpeakingNow, hasPermission, requestPermission, toggleListening, isWakeWordRecording, isWakeWordListening, stopWakeWordListening]);

  const handleReadStep = useCallback(async () => {
    // Toggle: if speaking, stop; otherwise start speaking
    if (isSpeakingState) {
      await stopSpeakingNow();
    } else {
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

      // Start speaking immediately - no extra delay needed
      await speakCurrentStep();
    }
  }, [isSpeakingState, stopSpeakingNow, speakCurrentStep, voiceState, toggleListening, isWakeWordRecording, isWakeWordListening, stopWakeWordListening]);

  const handleReadIngredients = useCallback(async () => {
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

    // Start speaking immediately
    await speakIngredients();
    setShowIngredients(false);
  }, [speakIngredients, voiceState, toggleListening, isWakeWordRecording, isWakeWordListening, stopWakeWordListening]);

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
            <VoiceButton
              voiceState={voiceState}
              onPress={handleVoiceToggle}
              size={72}
            />

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
            {voiceState === 'listening'
              ? copy.listening
              : voiceState === 'processing'
                ? copy.processing
                : voiceState === 'speaking'
                  ? copy.speaking
                  : 'Say "Hey Nom" or tap mic'}
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
              accessibilityLabel={isSpeakingState ? 'Stop reading' : 'Read current step'}
              style={[
                styles.actionButton,
                isSpeakingState && styles.actionButtonActive,
              ]}
              onPress={handleReadStep}
            >
              <Icon
                name={isSpeakingState ? 'close' : 'volume-2'}
                size={20}
                color={isSpeakingState ? Colors.text.inverse : Colors.accent}
              />
              <Text
                style={[
                  styles.actionButtonText,
                  isSpeakingState && styles.actionButtonTextActive,
                ]}
              >
                {isSpeakingState ? 'Stop' : 'Read Step'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Ingredients Modal */}
        <IngredientsModal
          visible={showIngredients}
          onClose={() => setShowIngredients(false)}
          ingredients={recipe.ingredients}
          onReadIngredients={handleReadIngredients}
          maxHeight={screenHeight * 0.7}
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
  voicePulse: {
    position: 'absolute',
  },
  voiceButton: {
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.surface,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: Colors.background.overlay,
  },
  modalSheet: {
    backgroundColor: Colors.background.primary,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    // maxHeight set dynamically via inline styles
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
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  readButtonText: {
    ...Typography.label,
    color: Colors.accent,
  },
  ingredientsList: {
    flex: 1,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  ingredientBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
    marginTop: 8,
  },
  ingredientText: {
    ...Typography.body,
    color: Colors.text.primary,
    flex: 1,
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
