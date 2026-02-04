import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '@/components/ui/Icon';
import { Colors, Spacing, Radius, Typography, Shadow } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;
const CARD_HEIGHT = CARD_WIDTH * 1.4;

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

export function RecipeCard({ recipe }: RecipeCardProps) {
  const totalTime = recipe.totalTimeMinutes ??
    (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);

  const creatorName = recipe.creatorName ?? 'Unknown';
  const tags = recipe.dietaryTags ?? recipe.keywords ?? [];

  return (
    <View style={styles.card}>
      <Image
        source={{ uri: recipe.imageUrl }}
        style={styles.image}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
      />

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.gradient}
      />

      {/* Top badges */}
      <View style={styles.topBadges}>
        <View style={styles.cuisineBadge}>
          <Text style={styles.cuisineText}>{recipe.cuisine ?? 'International'}</Text>
        </View>
        {recipe.calories !== undefined && (
          <View style={styles.ratingBadge}>
            <Icon name="flame" size={12} color="#FFD700" />
            <Text style={styles.ratingText}>{recipe.calories} cal</Text>
          </View>
        )}
      </View>

      {/* Content overlay */}
      <View style={styles.content}>
        <View style={styles.authorRow}>
          <View style={styles.authorInfo}>
            <View style={styles.authorAvatar}>
              <Text style={styles.authorInitial}>
                {creatorName.charAt(0)}
              </Text>
            </View>
            <Text style={styles.authorName}>{creatorName}</Text>
          </View>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {recipe.title}
        </Text>

        <Text style={styles.description} numberOfLines={2}>
          {recipe.description ?? ''}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Icon name="time-outline" size={16} color={Colors.text.inverse} />
            <Text style={styles.metaText}>{totalTime} min</Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <Icon name="flame-outline" size={16} color={Colors.text.inverse} />
            <Text style={styles.metaText}>{recipe.difficulty ?? 'Medium'}</Text>
          </View>
          {recipe.servings !== undefined && (
            <>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <Icon name="people-outline" size={16} color={Colors.text.inverse} />
                <Text style={styles.metaText}>{recipe.servings} servings</Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.tagsRow}>
          {tags.slice(0, 3).map((tag: string) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: Radius.xl,
    backgroundColor: Colors.background.primary,
    overflow: 'hidden',
    ...Shadow.elevated,
  },
  image: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  topBadges: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cuisineBadge: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
  },
  cuisineText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  ratingBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.text.inverse,
  },
  content: {
    position: 'absolute',
    bottom: Spacing.lg,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  authorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorInitial: {
    color: Colors.text.inverse,
    fontWeight: '600',
    fontSize: 12,
  },
  authorName: {
    ...Typography.bodySmall,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
    flexShrink: 1,
  },
  title: {
    ...Typography.h2,
    color: Colors.text.inverse,
    marginBottom: Spacing.xs,
  },
  description: {
    ...Typography.bodySmall,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: Spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metaText: {
    ...Typography.bodySmall,
    color: Colors.text.inverse,
  },
  metaDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: Spacing.md,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  tagText: {
    ...Typography.caption,
    color: Colors.text.inverse,
  },
});

export type { Recipe };
