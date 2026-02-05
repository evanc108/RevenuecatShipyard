import { memo, useCallback, useState } from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Icon } from '@/components/ui/Icon';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import type { Id } from '@/convex/_generated/dataModel';

const copy = COPY.recipeDetail;

type AddToGroceryButtonProps = {
  recipeId: Id<'recipes'>;
  servingsMultiplier?: number;
  variant?: 'primary' | 'secondary' | 'icon';
};

function AddToGroceryButtonComponent({
  recipeId,
  servingsMultiplier = 1,
  variant = 'secondary',
}: AddToGroceryButtonProps): React.ReactElement {
  const [isLoading, setIsLoading] = useState(false);
  const [added, setAdded] = useState(false);
  const addFromRecipe = useMutation(api.groceryList.addFromRecipe);

  const handlePress = useCallback(async () => {
    if (added) return;

    setIsLoading(true);
    try {
      await addFromRecipe({ recipeId, servingsMultiplier });
      setAdded(true);
      // Reset after 2 seconds
      setTimeout(() => setAdded(false), 2000);
    } catch (error) {
      console.error('Failed to add to grocery list:', error);
    } finally {
      setIsLoading(false);
    }
  }, [recipeId, servingsMultiplier, addFromRecipe, added]);

  if (variant === 'icon') {
    return (
      <Pressable
        style={[styles.iconButton, added && styles.iconButtonAdded]}
        onPress={handlePress}
        disabled={isLoading}
        accessibilityRole="button"
        accessibilityLabel={added ? copy.addedToCart : copy.addToCart}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={Colors.text.inverse} />
        ) : (
          <Icon
            name={added ? 'check' : 'cart'}
            size={20}
            color={Colors.text.inverse}
          />
        )}
      </Pressable>
    );
  }

  const isPrimary = variant === 'primary';

  return (
    <Pressable
      style={[
        styles.button,
        isPrimary ? styles.buttonPrimary : styles.buttonSecondary,
        added && styles.buttonAdded,
      ]}
      onPress={handlePress}
      disabled={isLoading}
      accessibilityRole="button"
      accessibilityLabel={added ? copy.addedToCart : copy.addToCart}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={isPrimary ? Colors.text.inverse : Colors.accent}
        />
      ) : (
        <>
          <Icon
            name={added ? 'check' : 'cart'}
            size={18}
            color={
              added
                ? Colors.semantic.success
                : isPrimary
                  ? Colors.text.inverse
                  : Colors.text.primary
            }
          />
          <Text
            style={[
              styles.buttonText,
              isPrimary ? styles.buttonTextPrimary : styles.buttonTextSecondary,
              added && styles.buttonTextAdded,
            ]}
          >
            {added ? copy.addedToCart : copy.addToCart}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    minWidth: 100,
  },
  buttonPrimary: {
    backgroundColor: Colors.accent,
  },
  buttonSecondary: {
    backgroundColor: Colors.background.secondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  buttonAdded: {
    backgroundColor: Colors.background.secondary,
    borderColor: Colors.semantic.success,
  },
  buttonText: {
    ...Typography.label,
  },
  buttonTextPrimary: {
    color: Colors.text.inverse,
  },
  buttonTextSecondary: {
    color: Colors.text.primary,
  },
  buttonTextAdded: {
    color: Colors.semantic.success,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonAdded: {
    backgroundColor: Colors.semantic.success,
  },
});

export const AddToGroceryButton = memo(AddToGroceryButtonComponent);
