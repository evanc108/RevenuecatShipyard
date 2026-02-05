import { memo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Icon } from '@/components/ui/Icon';
import { Colors, Spacing, Radius, Typography, Shadow } from '@/constants/theme';
import type { Id } from '@/convex/_generated/dataModel';

type RecipeProjection = {
  _id: Id<'recipes'>;
  title: string;
  imageUrl?: string;
  cuisine?: string;
  totalTimeMinutes?: number;
};

type MealRecipeCardProps = {
  entryId: Id<'mealPlanEntries'>;
  recipe: RecipeProjection;
  onRemove: (entryId: Id<'mealPlanEntries'>) => void;
};

function MealRecipeCardComponent({
  entryId,
  recipe,
  onRemove,
}: MealRecipeCardProps): React.ReactElement {
  const handleRemove = useCallback(() => {
    onRemove(entryId);
  }, [entryId, onRemove]);

  return (
    <View style={styles.card}>
      {recipe.imageUrl ? (
        <Image
          source={{ uri: recipe.imageUrl }}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Icon name="utensils" size={20} color={Colors.text.tertiary} />
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {recipe.title}
        </Text>
        {recipe.cuisine ? (
          <Text style={styles.cuisine} numberOfLines={1}>
            {recipe.cuisine}
          </Text>
        ) : null}
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
    </View>
  );
}

const IMAGE_SIZE = 56;

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
    gap: 2,
  },
  title: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  cuisine: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
  removeButton: {
    padding: Spacing.xs,
  },
});

export const MealRecipeCard = memo(MealRecipeCardComponent);
