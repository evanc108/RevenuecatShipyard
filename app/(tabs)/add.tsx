import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Colors, Spacing, Typography, Radius } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import { useRecipeExtraction } from '@/hooks/useRecipeExtraction';
import { CookbookDropdown } from '@/components/ui/CookbookDropdown';
import type { Recipe } from '@/types/recipe';
import type { Id } from '@/convex/_generated/dataModel';

const copy = COPY.extraction;

export default function AddRecipeScreen() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [servingsMultiplier, setServingsMultiplier] = useState(1);
  const [selectedCookbookId, setSelectedCookbookId] = useState<Id<'cookbooks'> | null>(null);
  const [showCookbookError, setShowCookbookError] = useState(false);
  const { extractRecipe, status, progress, error, wasExisting, reset } = useRecipeExtraction();

  // Rating state
  const [recipeId, setRecipeId] = useState<Id<'recipes'> | null>(null);
  const userRating = useQuery(
    api.recipes.getUserRating,
    recipeId ? { recipeId } : 'skip'
  );
  const rateMutation = useMutation(api.recipes.rate);

  // Derived values for adjusted servings
  const originalServings = recipe?.servings ?? 1;
  const adjustedServings = Math.round(originalServings * servingsMultiplier);

  const adjustServings = (delta: number) => {
    const newMultiplier = servingsMultiplier + delta;
    if (newMultiplier >= 0.25 && newMultiplier <= 10) {
      setServingsMultiplier(newMultiplier);
    }
  };

  const formatQuantity = (qty: number): string => {
    const adjusted = qty * servingsMultiplier;
    // Format nicely - show fractions for common cooking amounts
    if (adjusted === Math.floor(adjusted)) {
      return adjusted.toString();
    }
    // Round to 2 decimal places
    const rounded = Math.round(adjusted * 100) / 100;
    // Show as fraction for common amounts
    if (Math.abs(rounded - 0.25) < 0.01) return '¼';
    if (Math.abs(rounded - 0.33) < 0.01) return '⅓';
    if (Math.abs(rounded - 0.5) < 0.01) return '½';
    if (Math.abs(rounded - 0.67) < 0.01) return '⅔';
    if (Math.abs(rounded - 0.75) < 0.01) return '¾';
    return rounded.toString();
  };

  const handleExtract = async () => {
    if (!url.trim()) return;

    // Validate cookbook selection
    if (!selectedCookbookId) {
      setShowCookbookError(true);
      return;
    }

    setShowCookbookError(false);
    setRecipe(null);
    setRecipeId(null);
    const result = await extractRecipe(url.trim(), selectedCookbookId);
    if (result) {
      setRecipe(result);
      setRecipeId(result.id as Id<'recipes'>);
    }
  };

  const handleReset = () => {
    setUrl('');
    setRecipe(null);
    setRecipeId(null);
    setServingsMultiplier(1);
    setShowCookbookError(false);
    reset();
  };

  const handleCookbookSelect = (id: Id<'cookbooks'>) => {
    setSelectedCookbookId(id);
    setShowCookbookError(false);
  };

  const handleRate = async (value: number) => {
    if (!recipeId) return;
    await rateMutation({ recipeId, value });
  };

  const isLoading = status === 'checking' || status === 'extracting' || status === 'saving';

  const getStatusMessage = () => {
    switch (status) {
      case 'checking':
        return copy.checking;
      case 'extracting':
        return progress?.message ?? copy.extracting;
      case 'saving':
        return copy.saving;
      case 'complete':
        return copy.status.complete;
      case 'error':
        return copy.status.error;
      default:
        return copy.status.idle;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.subtitle}</Text>

          {/* URL Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={copy.placeholder}
              placeholderTextColor={Colors.text.tertiary}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              editable={!isLoading}
            />
          </View>

          {/* Cookbook Selection */}
          <View style={styles.cookbookContainer}>
            <CookbookDropdown
              selectedId={selectedCookbookId}
              onSelect={handleCookbookSelect}
              disabled={isLoading}
              error={showCookbookError}
            />
          </View>

          {/* Extract Button */}
          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleExtract}
            disabled={isLoading || !url.trim()}
          >
            {isLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={Colors.text.inverse} size="small" />
                <Text style={styles.buttonText}>{getStatusMessage()}</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>{copy.submit}</Text>
            )}
          </TouchableOpacity>

          {/* Progress Bar */}
          {status === 'extracting' && progress && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.round(progress.percent * 100)}%` }
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {Math.round(progress.percent * 100)}%
                {progress.tier ? ` (${progress.tier} ${copy.tier})` : ''}
              </Text>
            </View>
          )}

          {/* Status Display */}
          {status !== 'idle' && status !== 'extracting' && (
            <View style={styles.statusContainer}>
              <Text style={styles.statusLabel}>Status:</Text>
              <Text style={[
                styles.statusValue,
                status === 'error' && styles.statusError,
                status === 'complete' && styles.statusSuccess,
              ]}>
                {getStatusMessage()}
              </Text>
            </View>
          )}

          {/* Already Existed Indicator */}
          {status === 'complete' && wasExisting && (
            <View style={styles.existingBadge}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.semantic.success} />
              <Text style={styles.existingText}>{copy.alreadyExists}</Text>
            </View>
          )}

          {/* Error Display */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={handleReset}>
                <Text style={styles.resetLink}>{copy.tryAgain}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Recipe Result */}
          {recipe && (
            <View style={styles.recipeContainer}>
              <Text style={styles.sectionTitle}>{copy.extractedRecipe}</Text>

              {/* Recipe Image */}
              {recipe.thumbnailUrl ? (
                <View style={styles.imageContainer}>
                  <Image
                    source={{ uri: recipe.thumbnailUrl }}
                    style={styles.recipeImage}
                    contentFit="cover"
                    transition={300}
                    cachePolicy="memory-disk"
                  />
                </View>
              ) : null}

              {/* Header */}
              <View style={styles.recipeHeader}>
                <Text style={styles.recipeTitle}>{recipe.title}</Text>
                {recipe.description ? (
                  <Text style={styles.recipeDescription}>{recipe.description}</Text>
                ) : null}
              </View>

              {/* Rating Section */}
              <View style={styles.ratingSection}>
                <Text style={styles.ratingLabel}>{copy.rateThisRecipe}</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => handleRate(star)}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    >
                      <Ionicons
                        name={userRating != null && star <= userRating ? 'star' : 'star-outline'}
                        size={28}
                        color={userRating != null && star <= userRating ? '#FFB800' : Colors.text.tertiary}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
                {recipe.averageRating !== undefined && (
                  <Text style={styles.avgRatingText}>
                    {copy.communityAverage(recipe.averageRating)}
                  </Text>
                )}
              </View>

              {/* Servings Adjuster */}
              {recipe.servings ? (
                <View style={styles.servingsSection}>
                  <Text style={styles.servingsLabel}>{copy.servings.label}</Text>
                  <View style={styles.servingsAdjuster}>
                    <TouchableOpacity
                      style={styles.servingsButton}
                      onPress={() => adjustServings(-0.5)}
                      disabled={servingsMultiplier <= 0.25}
                    >
                      <Ionicons
                        name="remove"
                        size={20}
                        color={servingsMultiplier <= 0.25 ? Colors.text.tertiary : Colors.accent}
                      />
                    </TouchableOpacity>
                    <View style={styles.servingsDisplay}>
                      <Text style={styles.servingsValue}>{adjustedServings}</Text>
                      {servingsMultiplier !== 1 && (
                        <Text style={styles.servingsOriginal}>
                          {copy.servings.was(originalServings)}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.servingsButton}
                      onPress={() => adjustServings(0.5)}
                      disabled={servingsMultiplier >= 10}
                    >
                      <Ionicons
                        name="add"
                        size={20}
                        color={servingsMultiplier >= 10 ? Colors.text.tertiary : Colors.accent}
                      />
                    </TouchableOpacity>
                  </View>
                  {servingsMultiplier !== 1 && (
                    <TouchableOpacity onPress={() => setServingsMultiplier(1)}>
                      <Text style={styles.resetServings}>{copy.servings.reset}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : null}

              {/* Meta */}
              <View style={styles.metaRow}>
                {recipe.cuisine ? (
                  <View style={styles.metaTag}>
                    <Text style={styles.metaText}>{recipe.cuisine}</Text>
                  </View>
                ) : null}
                {recipe.difficulty ? (
                  <View style={styles.metaTag}>
                    <Text style={styles.metaText}>{recipe.difficulty}</Text>
                  </View>
                ) : null}
                {recipe.totalTimeMinutes ? (
                  <View style={styles.metaTag}>
                    <Text style={styles.metaText}>
                      {copy.meta.minutes(recipe.totalTimeMinutes)}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Method Used */}
              <View style={styles.methodContainer}>
                <Text style={styles.methodLabel}>{copy.extractedVia}</Text>
                <Text style={styles.methodValue}>{recipe.methodUsed} {copy.tier}</Text>
              </View>

              {/* Creator */}
              {recipe.creatorName ? (
                <Text style={styles.creatorText}>{copy.by} {recipe.creatorName}</Text>
              ) : null}

              {/* Ingredients */}
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>
                  {copy.ingredients} ({recipe.ingredients.length})
                </Text>
                {recipe.ingredients.map((ing, idx) => (
                  <View key={idx} style={styles.ingredientRow}>
                    <Text style={styles.ingredientBullet}>•</Text>
                    <Text style={styles.ingredientText}>
                      {servingsMultiplier !== 1 && ing.quantity > 0 ? (
                        <>
                          <Text style={styles.ingredientQuantity}>
                            {formatQuantity(ing.quantity)} {ing.unit}{' '}
                          </Text>
                          {ing.name}
                          {ing.preparation ? `, ${ing.preparation}` : ''}
                        </>
                      ) : (
                        ing.rawText
                      )}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Instructions */}
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>
                  {copy.instructions} ({recipe.instructions.length})
                </Text>
                {recipe.instructions.map((inst, idx) => (
                  <View key={idx} style={styles.instructionRow}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>{inst.stepNumber}</Text>
                    </View>
                    <Text style={styles.instructionText}>{inst.text}</Text>
                  </View>
                ))}
              </View>

              {/* Dietary Tags */}
              {recipe.dietaryTags && recipe.dietaryTags.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>{copy.dietary}</Text>
                  <View style={styles.tagRow}>
                    {recipe.dietaryTags.map((tag, idx) => (
                      <View key={idx} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Equipment */}
              {recipe.equipment && recipe.equipment.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>{copy.equipment}</Text>
                  <View style={styles.tagRow}>
                    {recipe.equipment.map((equip, idx) => (
                      <View key={idx} style={styles.tag}>
                        <Text style={styles.tagText}>{equip}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.viewRecipeButton}
                  onPress={() => router.push(`/recipe/${recipeId}`)}
                >
                  <Ionicons name="book-outline" size={18} color={Colors.text.inverse} />
                  <Text style={styles.viewRecipeButtonText}>{copy.viewRecipe}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
                  <Text style={styles.resetButtonText}>{copy.importAnother}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  title: {
    ...Typography.h1,
    color: Colors.text.primary,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  inputContainer: {
    marginBottom: Spacing.md,
  },
  cookbookContainer: {
    marginBottom: Spacing.md,
  },
  input: {
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    ...Typography.body,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  button: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    ...Typography.label,
    color: Colors.text.inverse,
    fontSize: 16,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  statusLabel: {
    ...Typography.body,
    color: Colors.text.secondary,
  },
  statusValue: {
    ...Typography.label,
    color: Colors.text.primary,
  },
  statusError: {
    color: Colors.semantic.error,
  },
  statusSuccess: {
    color: Colors.semantic.success,
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  errorText: {
    ...Typography.body,
    color: Colors.semantic.error,
  },
  resetLink: {
    ...Typography.label,
    color: Colors.accent,
    marginTop: Spacing.sm,
  },
  recipeContainer: {
    marginTop: Spacing.xl,
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h2,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  imageContainer: {
    marginBottom: Spacing.md,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  recipeImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: Colors.background.tertiary,
  },
  recipeHeader: {
    marginBottom: Spacing.md,
  },
  recipeTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
  },
  recipeDescription: {
    ...Typography.body,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  metaTag: {
    backgroundColor: Colors.accentLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  metaText: {
    ...Typography.caption,
    color: Colors.accent,
  },
  methodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  methodLabel: {
    ...Typography.bodySmall,
    color: Colors.text.tertiary,
  },
  methodValue: {
    ...Typography.label,
    color: Colors.semantic.success,
    textTransform: 'capitalize',
  },
  creatorText: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
  },
  section: {
    marginTop: Spacing.lg,
  },
  sectionHeader: {
    ...Typography.label,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  ingredientRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  ingredientBullet: {
    ...Typography.body,
    color: Colors.accent,
    marginRight: Spacing.sm,
  },
  ingredientText: {
    ...Typography.body,
    color: Colors.text.primary,
    flex: 1,
  },
  instructionRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  stepNumberText: {
    ...Typography.caption,
    color: Colors.text.inverse,
    fontWeight: '700',
  },
  instructionText: {
    ...Typography.body,
    color: Colors.text.primary,
    flex: 1,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tag: {
    backgroundColor: Colors.background.tertiary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  tagText: {
    ...Typography.caption,
    color: Colors.text.secondary,
  },
  actionButtons: {
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  viewRecipeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  viewRecipeButtonText: {
    ...Typography.label,
    color: Colors.text.inverse,
    fontSize: 16,
  },
  resetButton: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: Radius.md,
  },
  resetButtonText: {
    ...Typography.label,
    color: Colors.accent,
  },
  progressContainer: {
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.background.secondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 4,
  },
  progressText: {
    ...Typography.caption,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  existingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    marginTop: Spacing.md,
  },
  existingText: {
    ...Typography.bodySmall,
    color: Colors.semantic.success,
    flex: 1,
  },
  ratingSection: {
    backgroundColor: Colors.background.primary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  ratingLabel: {
    ...Typography.label,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  starsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  avgRatingText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    marginTop: Spacing.sm,
  },
  servingsSection: {
    backgroundColor: Colors.background.primary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  servingsLabel: {
    ...Typography.label,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  servingsAdjuster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  servingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  servingsDisplay: {
    alignItems: 'center',
    minWidth: 60,
  },
  servingsValue: {
    ...Typography.h2,
    color: Colors.text.primary,
  },
  servingsOriginal: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
  resetServings: {
    ...Typography.caption,
    color: Colors.accent,
    marginTop: Spacing.xs,
  },
  ingredientQuantity: {
    fontWeight: '600',
    color: Colors.accent,
  },
});
