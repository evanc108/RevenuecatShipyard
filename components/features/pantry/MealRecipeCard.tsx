import { memo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Icon } from '@/components/ui/Icon';
import { Colors, Spacing, Radius, Typography, Shadow } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import type { Id } from '@/convex/_generated/dataModel';

type RecipeProjection = {
  _id: Id<'recipes'>;
  title: string;
  imageUrl?: string;
  totalTimeMinutes?: number;
  calories?: number;
};

type MealRecipeCardProps = {
  entryId: Id<'mealPlanEntries'>;
  recipe: RecipeProjection;
  onPress: () => void;
  onRemove: (entryId: Id<'mealPlanEntries'>) => void;
};

function MealRecipeCardComponent({
  entryId,
  recipe,
  onPress,
  onRemove,
}: MealRecipeCardProps): React.ReactElement {
  const handleRemove = useCallback(() => {
    onRemove(entryId);
  }, [entryId, onRemove]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${recipe.title}${recipe.calories ? `, ${recipe.calories} calories` : ''}`}
      style={styles.card}
      onPress={onPress}
    >
      {recipe.imageUrl ? (
        <Image
          source={{ uri: recipe.imageUrl }}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Icon name="utensils" size={22} color={Colors.text.tertiary} />
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {recipe.title}
        </Text>
        <View style={styles.metaRow}>
          {recipe.calories ? (
            <View style={styles.metaChip}>
              <Icon name="flame" size={12} color={Colors.accent} />
              <Text style={styles.metaText}>{recipe.calories} cal</Text>
            </View>
          ) : null}
          {recipe.totalTimeMinutes ? (
            <View style={styles.metaChip}>
              <Icon name="time-outline" size={12} color={Colors.text.tertiary} />
              <Text style={styles.metaText}>
                {recipe.totalTimeMinutes} {COPY.cookbookDetail.minuteShort}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Remove recipe"
        onPress={handleRemove}
        hitSlop={8}
        style={styles.removeButton}
      >
        <Icon name="close" size={16} color={Colors.text.tertiary} />
      </Pressable>
    </Pressable>
  );
}

const IMAGE_SIZE = 64;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: Colors.background.primary,
    borderRadius: Radius.md,
    ...Shadow.surface,
  },
  image: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: Radius.sm,
  },
  imagePlaceholder: {
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: Spacing.xs,
  },
  title: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metaText: {
    ...Typography.caption,
    color: Colors.text.secondary,
  },
  removeButton: {
    padding: Spacing.xs,
  },
});

export const MealRecipeCard = memo(MealRecipeCardComponent);
