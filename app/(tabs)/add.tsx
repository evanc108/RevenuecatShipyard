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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, Radius } from '@/constants/theme';
import { useRecipeExtraction } from '@/hooks/useRecipeExtraction';
import type { Recipe } from '@/types/recipe';

export default function AddRecipeScreen() {
  const [url, setUrl] = useState('');
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const { extractRecipe, status, error, reset } = useRecipeExtraction();

  const handleExtract = async () => {
    if (!url.trim()) return;

    setRecipe(null);
    const result = await extractRecipe(url.trim());
    if (result) {
      setRecipe(result);
    }
  };

  const handleReset = () => {
    setUrl('');
    setRecipe(null);
    reset();
  };

  const isLoading = status === 'extracting' || status === 'saving';

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
          <Text style={styles.title}>Import Recipe</Text>
          <Text style={styles.subtitle}>
            Paste a video URL from TikTok, Instagram, or YouTube
          </Text>

          {/* URL Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="https://youtube.com/watch?v=..."
              placeholderTextColor={Colors.text.tertiary}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              editable={!isLoading}
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
                <Text style={styles.buttonText}>
                  {status === 'extracting' ? 'Extracting...' : 'Saving...'}
                </Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>Extract Recipe</Text>
            )}
          </TouchableOpacity>

          {/* Status Display */}
          {status !== 'idle' && (
            <View style={styles.statusContainer}>
              <Text style={styles.statusLabel}>Status:</Text>
              <Text style={[
                styles.statusValue,
                status === 'error' && styles.statusError,
                status === 'complete' && styles.statusSuccess,
              ]}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </View>
          )}

          {/* Error Display */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={handleReset}>
                <Text style={styles.resetLink}>Try again</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Recipe Result */}
          {recipe && (
            <View style={styles.recipeContainer}>
              <Text style={styles.sectionTitle}>Extracted Recipe</Text>

              {/* Header */}
              <View style={styles.recipeHeader}>
                <Text style={styles.recipeTitle}>{recipe.title}</Text>
                {recipe.description ? (
                  <Text style={styles.recipeDescription}>{recipe.description}</Text>
                ) : null}
              </View>

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
                    <Text style={styles.metaText}>{recipe.totalTimeMinutes} min</Text>
                  </View>
                ) : null}
                {recipe.servings ? (
                  <View style={styles.metaTag}>
                    <Text style={styles.metaText}>{recipe.servings} servings</Text>
                  </View>
                ) : null}
              </View>

              {/* Method Used */}
              <View style={styles.methodContainer}>
                <Text style={styles.methodLabel}>Extracted via:</Text>
                <Text style={styles.methodValue}>{recipe.methodUsed} tier</Text>
              </View>

              {/* Creator */}
              {recipe.creatorName ? (
                <Text style={styles.creatorText}>By {recipe.creatorName}</Text>
              ) : null}

              {/* Ingredients */}
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>
                  Ingredients ({recipe.ingredients.length})
                </Text>
                {recipe.ingredients.map((ing, idx) => (
                  <View key={idx} style={styles.ingredientRow}>
                    <Text style={styles.ingredientBullet}>•</Text>
                    <Text style={styles.ingredientText}>{ing.rawText}</Text>
                  </View>
                ))}
              </View>

              {/* Instructions */}
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>
                  Instructions ({recipe.instructions.length})
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
                  <Text style={styles.sectionHeader}>Dietary</Text>
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
                  <Text style={styles.sectionHeader}>Equipment</Text>
                  <View style={styles.tagRow}>
                    {recipe.equipment.map((equip, idx) => (
                      <View key={idx} style={styles.tag}>
                        <Text style={styles.tagText}>{equip}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Reset */}
              <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
                <Text style={styles.resetButtonText}>Import Another</Text>
              </TouchableOpacity>
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
  resetButton: {
    marginTop: Spacing.xl,
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
});
