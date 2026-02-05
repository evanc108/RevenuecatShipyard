import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '@/components/ui/Icon';
import { Colors, FontFamily, Spacing, Radius, Typography } from '@/constants/theme';
import { memo } from 'react';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;
const CARD_HEIGHT = CARD_WIDTH * 1.4;
const MAX_STARS = 5;

/**
 * Ingredient type matching the recipes schema
 */
type Ingredient = {
  rawText: string;
  name: string;
  normalizedName: string;
  quantity: number;
  unit: string;
  preparation?: string;
  category?: string;
  optional?: boolean;
  sortOrder?: number;
};

/**
 * Instruction type matching the recipes schema
 */
type Instruction = {
  stepNumber: number;
  text: string;
  timeSeconds?: number;
  temperature?: string;
  tip?: string;
};

/**
 * Recipe type matching the recipes table schema
 */
type Recipe = {
  // Canonical URL for deduplication
  url: string;

  // Core identification
  title: string;
  description?: string;
  cuisine?: string;
  difficulty?: string;
  imageUrl?: string;

  // Servings and timing
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  totalTimeMinutes?: number;

  // Nutrition
  calories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;

  // Tags and metadata
  dietaryTags?: string[];
  keywords?: string[];
  equipment?: string[];

  // Creator information
  creatorName?: string;
  creatorProfileUrl?: string;

  // Recipe content
  ingredients: Ingredient[];
  instructions: Instruction[];

  // For display purposes (from TheMealDB, optional)
  mealDbId?: string;
};

type RecipeCardProps = {
  recipe: Recipe;
};

function parseDifficulty(difficulty?: string): number {
  if (!difficulty) return 0;
  const lower = difficulty.toLowerCase();
  if (lower === 'easy') return 1;
  if (lower === 'medium' || lower === 'moderate') return 3;
  if (lower === 'hard' || lower === 'difficult') return 5;
  const parsed = parseInt(difficulty, 10);
  if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) return parsed;
  return 0;
}

const DifficultyStars = memo(function DifficultyStars({
  difficulty,
}: {
  difficulty: number;
}): React.ReactElement {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Icon
          key={star}
          name="star"
          size={14}
          strokeWidth={2}
          filled={star <= difficulty}
          color={star <= difficulty ? '#FFD700' : 'rgba(255,255,255,0.5)'}
        />
      ))}
    </View>
  );
});

export const RecipeCard = memo(function RecipeCard({ recipe }: RecipeCardProps) {
  const totalTime = recipe.totalTimeMinutes ??
    (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);

  const difficultyValue = parseDifficulty(recipe.difficulty);

  return (
    <View style={styles.card}>
      <Image
        source={{ uri: recipe.imageUrl }}
        style={styles.image}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
      />

      {/* Bottom gradient for text readability */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.75)']}
        locations={[0, 0.35, 1]}
        style={styles.gradient}
      />

      {/* Top-left cuisine badge */}
      {recipe.cuisine ? (
        <View style={styles.cuisineBadge}>
          <Text style={styles.cuisineText}>{recipe.cuisine}</Text>
        </View>
      ) : null}

      {/* Content overlay — bottom aligned */}
      <View style={styles.content}>
        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>
          {recipe.title}
        </Text>

        {/* Description */}
        {recipe.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {recipe.description}
          </Text>
        ) : null}

        {/* Meta row: time, calories, servings */}
        <View style={styles.metaRow}>
          {totalTime > 0 ? (
            <View style={styles.metaItem}>
              <Icon name="clock" size={14} color="rgba(255,255,255,0.85)" />
              <Text style={styles.metaText}>{totalTime} min</Text>
            </View>
          ) : null}
          {recipe.calories !== undefined ? (
            <View style={styles.metaItem}>
              <Icon name="flame" size={14} color="rgba(255,255,255,0.85)" />
              <Text style={styles.metaText}>{recipe.calories} cal</Text>
            </View>
          ) : null}
          {recipe.servings !== undefined ? (
            <View style={styles.metaItem}>
              <Icon name="users" size={14} color="rgba(255,255,255,0.85)" />
              <Text style={styles.metaText}>{recipe.servings} servings</Text>
            </View>
          ) : null}
        </View>

        {/* Difficulty stars */}
        {difficultyValue > 0 ? (
          <DifficultyStars difficulty={difficultyValue} />
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: Radius.xl,
    backgroundColor: Colors.background.tertiary,
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
  },
  cuisineBadge: {
    position: 'absolute',
    top: Spacing.lg,
    left: Spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
  },
  cuisineText: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: FontFamily.bold,
    fontWeight: '800',
    color: Colors.text.inverse,
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  description: {
    ...Typography.body,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metaText: {
    fontSize: 14,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 2,
  },
});

export type { Recipe };
