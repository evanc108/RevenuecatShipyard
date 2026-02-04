import { Icon } from '@/components/ui/Icon';
import { COPY } from '@/constants/copy';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from 'convex/react';

// --- Constants ---

const copy = COPY.recipeDetail;
const HERO_HEIGHT = 340;
const OVERLAY_BUTTON_SIZE = 40;
const STEP_CIRCLE_SIZE = 28;
const SERVINGS_BUTTON_SIZE = 36;
const INGREDIENT_DOT_SIZE = 6;
const STAR_SIZE = 28;
const STAR_COLOR_ACTIVE = '#FFB800';
const STAR_COLOR = '#FFB800';

const PASTEL_COLORS: readonly string[] = [
  '#E0D6FF', '#FFD6E0', '#D6E8FF', '#D6FFE8',
  '#FFE8D6', '#FFF5D6', '#D6F0E0', '#FFE0D6',
] as const;

function getPastelForTitle(title: string): string {
  const hash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return PASTEL_COLORS[hash % PASTEL_COLORS.length] ?? PASTEL_COLORS[0];
}

// --- Component ---

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const recipeId = id as Id<'recipes'>;

  const recipe = useQuery(api.recipes.get, recipeId ? { id: recipeId } : 'skip');
  const userRating = useQuery(
    api.recipes.getUserRating,
    recipeId ? { recipeId } : 'skip',
  );
  const rateMutation = useMutation(api.recipes.rate);
  const myPost = useQuery(
    api.posts.getMyPostForRecipe,
    recipeId ? { recipeId } : 'skip',
  );
  const updatePostMutation = useMutation(api.posts.update);

  const [servingsMultiplier, setServingsMultiplier] = useState(1);

  // Edit mode state for user's review
  const [isEditing, setIsEditing] = useState(false);
  const [editEase, setEditEase] = useState(0);
  const [editTaste, setEditTaste] = useState(0);
  const [editPresentation, setEditPresentation] = useState(0);
  const [editNotes, setEditNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Sync edit state when post loads or changes
  useEffect(() => {
    if (myPost) {
      setEditEase(myPost.easeRating);
      setEditTaste(myPost.tasteRating);
      setEditPresentation(myPost.presentationRating);
      setEditNotes(myPost.notes ?? '');
    }
  }, [myPost]);

  const originalServings = recipe?.servings ?? 1;
  const adjustedServings = Math.round(originalServings * servingsMultiplier);

  const adjustServings = (delta: number) => {
    const newMultiplier = servingsMultiplier + delta;
    if (newMultiplier >= 0.25 && newMultiplier <= 10) {
      setServingsMultiplier(newMultiplier);
    }
  };

  const formatQuantity = useCallback(
    (qty: number): string => {
      const adjusted = qty * servingsMultiplier;
      if (adjusted === Math.floor(adjusted)) {
        return adjusted.toString();
      }
      const rounded = Math.round(adjusted * 100) / 100;
      if (Math.abs(rounded - 0.25) < 0.01) return '\u00BC';
      if (Math.abs(rounded - 0.33) < 0.01) return '\u2153';
      if (Math.abs(rounded - 0.5) < 0.01) return '\u00BD';
      if (Math.abs(rounded - 0.67) < 0.01) return '\u2154';
      if (Math.abs(rounded - 0.75) < 0.01) return '\u00BE';
      return rounded.toString();
    },
    [servingsMultiplier],
  );

  const handleRate = async (value: number) => {
    if (!recipeId) return;
    await rateMutation({ recipeId, value });
  };

  const handleSaveReview = async () => {
    if (!myPost) return;
    setIsSaving(true);
    try {
      await updatePostMutation({
        postId: myPost._id,
        easeRating: editEase,
        tasteRating: editTaste,
        presentationRating: editPresentation,
        notes: editNotes || undefined,
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (myPost) {
      setEditEase(myPost.easeRating);
      setEditTaste(myPost.tasteRating);
      setEditPresentation(myPost.presentationRating);
      setEditNotes(myPost.notes ?? '');
    }
    setIsEditing(false);
  };

  // --- Early Returns ---

  if (!recipeId) {
    return (
      <View style={styles.container}>
        <View style={styles.centeredContainer}>
          <Text style={styles.errorText}>{copy.notFound}</Text>
        </View>
      </View>
    );
  }

  if (recipe === undefined) {
    return (
      <View style={styles.container}>
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </View>
    );
  }

  if (recipe === null) {
    return (
      <View style={styles.container}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={[styles.overlayButton, { top: insets.top + Spacing.sm, left: Spacing.md }]}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Icon name="arrow-back" size={22} color={Colors.text.primary} />
        </Pressable>
        <View style={styles.centeredContainer}>
          <Text style={styles.errorText}>{copy.notFound}</Text>
        </View>
      </View>
    );
  }

  // --- Computed Values ---

  const hasImage = Boolean(recipe.imageUrl);
  const hasNutrition = Boolean(
    recipe.calories ?? recipe.proteinGrams ?? recipe.carbsGrams ?? recipe.fatGrams,
  );
  const hasDietaryTags = Boolean(recipe.dietaryTags && recipe.dietaryTags.length > 0);
  const hasEquipment = Boolean(recipe.equipment && recipe.equipment.length > 0);

  // --- Render ---

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image Section */}
        <View style={styles.heroContainer}>
          {hasImage ? (
            <Image
              source={{ uri: recipe.imageUrl ?? undefined }}
              style={styles.heroImage}
              contentFit="cover"
              transition={300}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.heroFallback, { backgroundColor: getPastelForTitle(recipe.title) }]}>
              <Icon name="utensils" size={48} color={Colors.text.tertiary} />
            </View>
          )}

          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.6)']}
            locations={[0, 0.4, 1]}
            style={styles.heroGradient}
          />

          <View style={styles.heroOverlay}>
            <Text style={styles.heroTitle} numberOfLines={3} ellipsizeMode="tail">
              {recipe.title}
            </Text>
            {recipe.creatorName ? (
              <Text style={styles.heroCreator}>
                {copy.by} {recipe.creatorName}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Your Review Section - only show if user has a post for this recipe */}
        {myPost ? (
          <View style={styles.reviewSection}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewTitle}>{copy.yourReview.title}</Text>
              {isEditing ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cancel editing"
                  onPress={handleCancelEdit}
                  hitSlop={8}
                >
                  <Icon name="close" size={20} color={Colors.text.tertiary} />
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit review"
                  onPress={() => setIsEditing(true)}
                  hitSlop={8}
                >
                  <Icon name="pencil" size={18} color={Colors.accent} />
                </Pressable>
              )}
            </View>

            {/* Ease Rating */}
            <View style={styles.reviewRatingRow}>
              <Text style={styles.reviewRatingLabel}>{copy.yourReview.ease}</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => {
                  const value = isEditing ? editEase : myPost.easeRating;
                  return (
                    <Pressable
                      key={star}
                      accessibilityRole="button"
                      accessibilityLabel={`Rate ease ${star} stars`}
                      onPress={() => isEditing && setEditEase(star)}
                      disabled={!isEditing}
                      hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                    >
                      <Icon
                        name={star <= value ? 'star' : 'star-outline'}
                        size={20}
                        color={star <= value ? STAR_COLOR : Colors.text.tertiary}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Taste Rating */}
            <View style={styles.reviewRatingRow}>
              <Text style={styles.reviewRatingLabel}>{copy.yourReview.taste}</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => {
                  const value = isEditing ? editTaste : myPost.tasteRating;
                  return (
                    <Pressable
                      key={star}
                      accessibilityRole="button"
                      accessibilityLabel={`Rate taste ${star} stars`}
                      onPress={() => isEditing && setEditTaste(star)}
                      disabled={!isEditing}
                      hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                    >
                      <Icon
                        name={star <= value ? 'star' : 'star-outline'}
                        size={20}
                        color={star <= value ? STAR_COLOR : Colors.text.tertiary}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Presentation Rating */}
            <View style={styles.reviewRatingRow}>
              <Text style={styles.reviewRatingLabel}>{copy.yourReview.presentation}</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => {
                  const value = isEditing ? editPresentation : myPost.presentationRating;
                  return (
                    <Pressable
                      key={star}
                      accessibilityRole="button"
                      accessibilityLabel={`Rate presentation ${star} stars`}
                      onPress={() => isEditing && setEditPresentation(star)}
                      disabled={!isEditing}
                      hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                    >
                      <Icon
                        name={star <= value ? 'star' : 'star-outline'}
                        size={20}
                        color={star <= value ? STAR_COLOR : Colors.text.tertiary}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Notes */}
            <View style={styles.reviewNotesContainer}>
              <Text style={styles.reviewNotesLabel}>{copy.yourReview.notes}</Text>
              {isEditing ? (
                <TextInput
                  style={styles.reviewNotesInput}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  multiline
                  placeholder={copy.yourReview.noNotes}
                  placeholderTextColor={Colors.text.tertiary}
                />
              ) : (
                <Text style={styles.reviewNotesText}>
                  {myPost.notes || copy.yourReview.noNotes}
                </Text>
              )}
            </View>

            {/* Save Button */}
            {isEditing ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save review"
                style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                onPress={handleSaveReview}
                disabled={isSaving}
              >
                <Text style={styles.saveButtonText}>
                  {isSaving ? copy.yourReview.saving : copy.yourReview.save}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Quick Info Bar */}
        <View style={styles.infoBar}>
          {recipe.totalTimeMinutes ? (
            <View style={styles.infoChip}>
              <Icon name="clock" size={16} color={Colors.text.secondary} />
              <Text style={styles.infoChipText}>
                {copy.minutes(recipe.totalTimeMinutes)}
              </Text>
            </View>
          ) : null}

          {recipe.servings ? (
            <View style={styles.infoChip}>
              <Icon name="users" size={16} color={Colors.text.secondary} />
              <Text style={styles.infoChipText}>
                {adjustedServings} {copy.servings.label.toLowerCase()}
              </Text>
            </View>
          ) : null}

          {recipe.difficulty ? (
            <View style={styles.infoChip}>
              <Text style={styles.infoChipText}>{recipe.difficulty}</Text>
            </View>
          ) : null}

          {recipe.cuisine ? (
            <View style={styles.infoChip}>
              <Text style={styles.infoChipTextAccent}>{recipe.cuisine}</Text>
            </View>
          ) : null}
        </View>

        {/* Description */}
        {recipe.description ? (
          <Text style={styles.descriptionText}>{recipe.description}</Text>
        ) : null}

        {/* Rating Card */}
        <View style={styles.ratingCard}>
          <Text style={styles.ratingLabel}>{copy.rateThisRecipe}</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => {
              const filled = userRating != null && star <= userRating;
              return (
                <Pressable
                  key={star}
                  accessibilityRole="button"
                  accessibilityLabel={`Rate ${star} star${star > 1 ? 's' : ''}`}
                  onPress={() => handleRate(star)}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                >
                  <Icon
                    name="star"
                    size={STAR_SIZE}
                    color={filled ? STAR_COLOR_ACTIVE : Colors.text.tertiary}
                    filled={filled}
                  />
                </Pressable>
              );
            })}
          </View>
          {recipe.averageRating !== undefined && recipe.averageRating !== null ? (
            <Text style={styles.avgRatingText}>
              {copy.communityAverage(recipe.averageRating)}
            </Text>
          ) : null}
        </View>

        {/* Nutrition Card */}
        {hasNutrition ? (
          <View style={styles.nutritionCard}>
            <Text style={styles.nutritionTitle}>{copy.nutrition.title}</Text>
            <View style={styles.nutritionGrid}>
              {recipe.calories ? (
                <View style={styles.nutritionStat}>
                  <Text style={styles.nutritionValue}>
                    {Math.round(recipe.calories * servingsMultiplier)}
                  </Text>
                  <Text style={styles.nutritionStatLabel}>{copy.nutrition.calories}</Text>
                </View>
              ) : null}
              {recipe.proteinGrams ? (
                <View style={styles.nutritionStat}>
                  <Text style={styles.nutritionValue}>
                    {Math.round(recipe.proteinGrams * servingsMultiplier)}g
                  </Text>
                  <Text style={styles.nutritionStatLabel}>{copy.nutrition.protein}</Text>
                </View>
              ) : null}
              {recipe.carbsGrams ? (
                <View style={styles.nutritionStat}>
                  <Text style={styles.nutritionValue}>
                    {Math.round(recipe.carbsGrams * servingsMultiplier)}g
                  </Text>
                  <Text style={styles.nutritionStatLabel}>{copy.nutrition.carbs}</Text>
                </View>
              ) : null}
              {recipe.fatGrams ? (
                <View style={styles.nutritionStat}>
                  <Text style={styles.nutritionValue}>
                    {Math.round(recipe.fatGrams * servingsMultiplier)}g
                  </Text>
                  <Text style={styles.nutritionStatLabel}>{copy.nutrition.fat}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.nutritionNote}>{copy.nutrition.perServing}</Text>
          </View>
        ) : null}

        {/* Ingredients Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.ingredientHeaderRow}>
            <Text style={styles.sectionTitle}>
              {copy.ingredients} ({recipe.ingredients.length})
            </Text>

            {recipe.servings ? (
              <View style={styles.servingsAdjuster}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Decrease servings"
                  style={styles.servingsButton}
                  onPress={() => adjustServings(-0.5)}
                  disabled={servingsMultiplier <= 0.25}
                >
                  <Icon
                    name="minus"
                    size={18}
                    color={servingsMultiplier <= 0.25 ? Colors.text.tertiary : Colors.accent}
                  />
                </Pressable>
                <View style={styles.servingsDisplay}>
                  <Text style={styles.servingsCount}>{adjustedServings}</Text>
                  {servingsMultiplier !== 1 ? (
                    <Text style={styles.servingsOriginal}>
                      {copy.servings.was(originalServings)}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Increase servings"
                  style={styles.servingsButton}
                  onPress={() => adjustServings(0.5)}
                  disabled={servingsMultiplier >= 10}
                >
                  <Icon
                    name="plus"
                    size={18}
                    color={servingsMultiplier >= 10 ? Colors.text.tertiary : Colors.accent}
                  />
                </Pressable>
              </View>
            ) : null}
          </View>

          {servingsMultiplier !== 1 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reset to original servings"
              onPress={() => setServingsMultiplier(1)}
              style={styles.resetLinkContainer}
            >
              <Text style={styles.resetLink}>{copy.servings.reset}</Text>
            </Pressable>
          ) : null}

          {recipe.ingredients.map((ing, idx) => (
            <View key={`${ing.name}-${idx}`} style={styles.ingredientRow}>
              <View style={styles.ingredientDot} />
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
                {ing.optional ? (
                  <Text style={styles.ingredientOptional}> (optional)</Text>
                ) : null}
              </Text>
            </View>
          ))}
        </View>

        {/* Instructions Section */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.sectionTitle}>
            {copy.instructions} ({recipe.instructions.length})
          </Text>

          {recipe.instructions.map((inst) => (
            <View key={inst.stepNumber} style={styles.instructionRow}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepCircleText}>{inst.stepNumber}</Text>
              </View>
              <View style={styles.instructionContent}>
                <Text style={styles.instructionText}>{inst.text}</Text>

                {inst.tip ? (
                  <View style={styles.tipContainer}>
                    <Icon name="info" size={16} color={Colors.text.secondary} />
                    <Text style={styles.tipText}>{inst.tip}</Text>
                  </View>
                ) : null}

                {inst.temperature || inst.timeSeconds ? (
                  <View style={styles.instructionChips}>
                    {inst.temperature ? (
                      <View style={styles.temperatureChip}>
                        <Icon name="flame" size={14} color={Colors.accent} />
                        <Text style={styles.chipText}>{inst.temperature}</Text>
                      </View>
                    ) : null}

                    {inst.timeSeconds ? (
                      <View style={styles.timeChip}>
                        <Icon name="clock" size={14} color={Colors.text.secondary} />
                        <Text style={styles.chipTextMuted}>
                          {Math.ceil(inst.timeSeconds / 60)} min
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </View>

        {/* Tags Section */}
        {hasDietaryTags || hasEquipment ? (
          <View style={styles.tagsSection}>
            {hasDietaryTags ? (
              <>
                <Text style={styles.sectionTitle}>{copy.dietary}</Text>
                <View style={styles.tagRow}>
                  {recipe.dietaryTags?.map((tag, idx) => (
                    <View key={`dietary-${tag}-${idx}`} style={styles.tagPill}>
                      <Text style={styles.tagPillText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            {hasEquipment ? (
              <View style={hasDietaryTags ? styles.equipmentSubsection : undefined}>
                <Text style={styles.sectionTitle}>{copy.equipment}</Text>
                <View style={styles.tagRow}>
                  {recipe.equipment?.map((equip, idx) => (
                    <View key={`equip-${equip}-${idx}`} style={styles.tagPill}>
                      <Text style={styles.tagPillText}>{equip}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Source Footer */}
        <View style={styles.sourceFooter}>
          <Text style={styles.sourceText}>
            {copy.extractedVia} {recipe.methodUsed} {copy.tier}
          </Text>
          {recipe.url ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Open source URL"
              onPress={() => Linking.openURL(recipe.url)}
              hitSlop={8}
            >
              <View style={styles.sourceLinkRow}>
                <Text style={styles.sourceLink} numberOfLines={1} ellipsizeMode="middle">
                  {recipe.url}
                </Text>
                <Icon name="external-link" size={14} color={Colors.accent} />
              </View>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      {/* Overlay Buttons — fixed above ScrollView */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={[
          styles.overlayButton,
          { top: insets.top + Spacing.sm, left: Spacing.md },
        ]}
        onPress={() => router.back()}
        hitSlop={8}
      >
        <Icon name="arrow-back" size={22} color="#FFFFFF" />
      </Pressable>

      <View style={[styles.actionButtons, { top: insets.top + Spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bookmark recipe"
          style={styles.overlayButton}
          hitSlop={8}
        >
          <Icon name="bookmark" size={20} color="#FFFFFF" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share recipe"
          style={styles.overlayButton}
          hitSlop={8}
        >
          <Icon name="share" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
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

  // Hero
  heroContainer: {
    height: HERO_HEIGHT,
    overflow: 'hidden',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroCreator: {
    ...Typography.bodySmall,
    color: 'rgba(255,255,255,0.85)',
    marginTop: Spacing.xs,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Overlay Buttons
  overlayButton: {
    position: 'absolute',
    width: OVERLAY_BUTTON_SIZE,
    height: OVERLAY_BUTTON_SIZE,
    borderRadius: OVERLAY_BUTTON_SIZE / 2,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtons: {
    position: 'absolute',
    right: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.sm,
  },

  // Review Section
  reviewSection: {
    backgroundColor: Colors.background.primary,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadow.surface,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  reviewTitle: {
    ...Typography.label,
    color: Colors.text.primary,
  },
  reviewRatingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  reviewRatingLabel: {
    ...Typography.body,
    color: Colors.text.secondary,
    width: 100,
  },
  reviewNotesContainer: {
    marginTop: Spacing.sm,
  },
  reviewNotesLabel: {
    ...Typography.caption,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  reviewNotesText: {
    ...Typography.body,
    color: Colors.text.primary,
    fontStyle: 'italic',
  },
  reviewNotesInput: {
    ...Typography.body,
    color: Colors.text.primary,
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    ...Typography.label,
    color: Colors.text.inverse,
  },

  // Info Bar
  infoBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.background.primary,
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    ...Shadow.surface,
  },
  infoChipText: {
    ...Typography.caption,
    color: Colors.text.primary,
  },
  infoChipTextAccent: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '600',
  },

  // Description
  descriptionText: {
    ...Typography.body,
    color: Colors.text.secondary,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },

  // Rating Card
  ratingCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    alignItems: 'center',
    ...Shadow.surface,
  },
  ratingLabel: {
    ...Typography.label,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  starsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  avgRatingText: {
    ...Typography.caption,
    color: Colors.text.secondary,
    marginTop: Spacing.sm,
  },

  // Nutrition Card
  nutritionCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadow.surface,
  },
  nutritionTitle: {
    ...Typography.label,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  nutritionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  nutritionStat: {
    alignItems: 'center',
    minWidth: 60,
  },
  nutritionValue: {
    ...Typography.h3,
    color: Colors.accent,
  },
  nutritionStatLabel: {
    ...Typography.caption,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  nutritionNote: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },

  // Sections
  sectionContainer: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },

  // Ingredients
  ingredientHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  servingsAdjuster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  servingsButton: {
    width: SERVINGS_BUTTON_SIZE,
    height: SERVINGS_BUTTON_SIZE,
    borderRadius: SERVINGS_BUTTON_SIZE / 2,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servingsDisplay: {
    alignItems: 'center',
    minWidth: 28,
  },
  servingsCount: {
    ...Typography.label,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  servingsOriginal: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    fontSize: 10,
  },
  resetLinkContainer: {
    marginBottom: Spacing.md,
    alignSelf: 'flex-end',
  },
  resetLink: {
    ...Typography.caption,
    color: Colors.accent,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  ingredientDot: {
    width: INGREDIENT_DOT_SIZE,
    height: INGREDIENT_DOT_SIZE,
    borderRadius: INGREDIENT_DOT_SIZE / 2,
    backgroundColor: Colors.accent,
    marginTop: 8,
    marginRight: Spacing.sm,
  },
  ingredientText: {
    ...Typography.body,
    color: Colors.text.primary,
    flex: 1,
  },
  ingredientQuantity: {
    fontWeight: '600',
    color: Colors.accent,
  },
  ingredientOptional: {
    ...Typography.bodySmall,
    color: Colors.text.tertiary,
    fontStyle: 'italic',
  },

  // Instructions
  instructionsContainer: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  stepCircle: {
    width: STEP_CIRCLE_SIZE,
    height: STEP_CIRCLE_SIZE,
    borderRadius: STEP_CIRCLE_SIZE / 2,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    marginTop: 2,
  },
  stepCircleText: {
    ...Typography.caption,
    color: Colors.text.inverse,
    fontWeight: '700',
  },
  instructionContent: {
    flex: 1,
  },
  instructionText: {
    ...Typography.body,
    color: Colors.text.primary,
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  tipText: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    flex: 1,
  },
  instructionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  temperatureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accentLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    gap: Spacing.xs,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    gap: Spacing.xs,
  },
  chipText: {
    ...Typography.caption,
    color: Colors.accent,
  },
  chipTextMuted: {
    ...Typography.caption,
    color: Colors.text.secondary,
  },

  // Tags
  tagsSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tagPill: {
    backgroundColor: Colors.background.secondary,
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  tagPillText: {
    ...Typography.caption,
    color: Colors.text.secondary,
  },
  equipmentSubsection: {
    marginTop: Spacing.md,
  },

  // Source Footer
  sourceFooter: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
  },
  sourceText: {
    ...Typography.bodySmall,
    color: Colors.text.tertiary,
  },
  sourceLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  sourceLink: {
    ...Typography.caption,
    color: Colors.accent,
    flex: 1,
  },
});
