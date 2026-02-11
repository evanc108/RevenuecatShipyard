import { useCallback, useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Icon } from '@/components/ui/Icon';
import { PaywallModal } from '@/components/ui/PaywallModal';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import { useModalAnimation } from '@/hooks/useModalAnimation';
import { useSubscription } from '@/hooks/useSubscription';
import { useMealPlanGenerationStore } from '@/stores/useMealPlanGenerationStore';

const copy = COPY.pantry.generate;

export function GenerateMealPlanModal(): React.ReactElement | null {
  const insets = useSafeAreaInsets();
  const vibeInputRef = useRef<TextInput>(null);
  const { isPro } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);

  const isVisible = useMealPlanGenerationStore((s) => s.isGenerateModalVisible);
  const status = useMealPlanGenerationStore((s) => s.status);
  const vibe = useMealPlanGenerationStore((s) => s.vibe);
  const cuisine = useMealPlanGenerationStore((s) => s.cuisine);
  const errorMessage = useMealPlanGenerationStore((s) => s.errorMessage);

  const setVibe = useMealPlanGenerationStore((s) => s.setVibe);
  const setCuisine = useMealPlanGenerationStore((s) => s.setCuisine);
  const closeGenerateModal = useMealPlanGenerationStore((s) => s.closeGenerateModal);
  const closeGenerateModalKeepLoading = useMealPlanGenerationStore((s) => s.closeGenerateModalKeepLoading);
  const setStatus = useMealPlanGenerationStore((s) => s.setStatus);
  const setGeneratedRecipes = useMealPlanGenerationStore((s) => s.setGeneratedRecipes);
  const openReviewSheet = useMealPlanGenerationStore((s) => s.openReviewSheet);

  const pantryItems = useQuery(api.pantry.getItems);
  const generateMealPlan = useAction(api.mealPlanGeneration.generate);

  const { isRendered, backdropOpacity, modalTranslateY } = useModalAnimation({
    visible: isVisible,
  });

  // Focus input when modal opens
  useEffect(() => {
    if (isVisible) {
      setTimeout(() => vibeInputRef.current?.focus(), 300);
    }
  }, [isVisible]);

  const handleClose = useCallback(() => {
    if (status === 'generating') return;
    closeGenerateModal();
  }, [status, closeGenerateModal]);

  const handleGenerate = useCallback(async () => {
    if (status === 'generating') return;
    if (!pantryItems || pantryItems.length === 0) return;

    if (!isPro) {
      setShowPaywall(true);
      return;
    }

    // Capture values before closing modal (since closeGenerateModalKeepLoading doesn't reset them)
    const currentVibe = vibe.trim();
    const currentCuisine = cuisine.trim();
    const ingredientNames = pantryItems.map((item) => item.name);

    setStatus('generating');
    // Close modal immediately - loading will show in floating indicator
    closeGenerateModalKeepLoading();

    try {
      const result = await generateMealPlan({
        ingredients: ingredientNames,
        vibe: currentVibe || undefined,
        cuisine: currentCuisine || undefined,
      });

      if (result.success && result.recipes) {
        setGeneratedRecipes(result.recipes);
        openReviewSheet();
      } else {
        setStatus('error', result.error ?? copy.error);
      }
    } catch (error) {
      console.error('Failed to generate meal plan:', error);
      setStatus('error', copy.error);
    }
  }, [
    status,
    pantryItems,
    isPro,
    vibe,
    cuisine,
    generateMealPlan,
    setStatus,
    setGeneratedRecipes,
    closeGenerateModalKeepLoading,
    openReviewSheet,
  ]);

  const pantryCount = pantryItems?.length ?? 0;
  const isGenerating = status === 'generating';
  const canGenerate = pantryCount > 0 && !isGenerating;

  if (!isRendered) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
          pointerEvents="box-none"
        >
          {/* Backdrop */}
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
          </Animated.View>

          {/* Modal */}
          <Animated.View
            style={[
              styles.modalContainer,
              { transform: [{ translateY: modalTranslateY }] },
            ]}
          >
            <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
            {/* Handle */}
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>{copy.title}</Text>
                <Text style={styles.subtitle}>{copy.subtitle}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={handleClose}
                hitSlop={12}
                disabled={isGenerating}
              >
                <Icon
                  name="close"
                  size={24}
                  color={isGenerating ? Colors.text.disabled : Colors.text.secondary}
                />
              </Pressable>
            </View>

            {/* Pantry Count */}
            <View style={styles.pantryCountContainer}>
              <Icon name="cart" size={18} color={Colors.accent} />
              <Text style={styles.pantryCountText}>{copy.usingItems(pantryCount)}</Text>
            </View>

            {/* Vibe Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{copy.vibeLabel}</Text>
              <TextInput
                ref={vibeInputRef}
                style={styles.textInput}
                placeholder={copy.vibePlaceholder}
                placeholderTextColor={Colors.text.tertiary}
                value={vibe}
                onChangeText={setVibe}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
                editable={!isGenerating}
              />
            </View>

            {/* Cuisine Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{copy.cuisineLabel}</Text>
              <TextInput
                style={styles.textInput}
                placeholder={copy.cuisinePlaceholder}
                placeholderTextColor={Colors.text.tertiary}
                value={cuisine}
                onChangeText={setCuisine}
                editable={!isGenerating}
              />
            </View>

            {/* Error Message */}
            {status === 'error' && errorMessage && (
              <View style={styles.errorContainer}>
                <Icon name="alert-circle" size={18} color={Colors.semantic.error} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Generate Button */}
            <Pressable
              style={[
                styles.generateButton,
                canGenerate && styles.generateButtonActive,
                isGenerating && styles.generateButtonLoading,
              ]}
              onPress={handleGenerate}
              disabled={!canGenerate}
              accessibilityRole="button"
              accessibilityLabel={copy.submit}
            >
              {isGenerating ? (
                <>
                  <ActivityIndicator size="small" color={Colors.text.inverse} />
                  <Text style={styles.generateButtonText}>{copy.generating}</Text>
                </>
              ) : (
                <Text
                  style={[
                    styles.generateButtonText,
                    !canGenerate && styles.generateButtonTextDisabled,
                  ]}
                >
                  {copy.submit}
                </Text>
              )}
            </Pressable>

            {/* Empty Pantry Warning */}
            {pantryCount === 0 && (
              <Text style={styles.emptyWarning}>{copy.emptyPantryPrompt}</Text>
            )}
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>

      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature="mealPlan"
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background.overlay,
  },
  modalContainer: {
    width: '100%',
  },
  modalContent: {
    backgroundColor: Colors.background.primary,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  title: {
    ...Typography.h2,
    color: Colors.text.primary,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  pantryCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    alignSelf: 'flex-start',
    marginBottom: Spacing.lg,
  },
  pantryCountText: {
    ...Typography.label,
    color: Colors.accent,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    ...Typography.label,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  textInput: {
    ...Typography.body,
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 48,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#FEE2E2',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    ...Typography.bodySmall,
    color: Colors.semantic.error,
    flex: 1,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background.tertiary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
  },
  generateButtonActive: {
    backgroundColor: Colors.accent,
  },
  generateButtonLoading: {
    opacity: 0.9,
  },
  generateButtonText: {
    ...Typography.label,
    fontSize: 16,
    color: Colors.text.inverse,
  },
  generateButtonTextDisabled: {
    color: Colors.text.disabled,
  },
  emptyWarning: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});
