import { memo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { Colors, Spacing, Radius, Typography, Shadow } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import type { Id } from '@/convex/_generated/dataModel';

type PantryItemCardProps = {
  itemId: Id<'pantryItems'>;
  name: string;
  category?: string;
  quantity?: number;
  unit?: string;
  onRemove: (itemId: Id<'pantryItems'>) => void;
  onEdit: () => void;
};

const CATEGORY_ICONS: Record<string, string> = {
  produce: 'sun',
  dairy: 'heart',
  meat: 'restaurant',
  pantry: 'cart',
  spice: 'flame',
  frozen: 'star',
  other: 'more',
};

function PantryItemCardComponent({
  itemId,
  name,
  category,
  quantity,
  unit,
  onRemove,
  onEdit,
}: PantryItemCardProps): React.ReactElement {
  const handleRemove = useCallback(() => {
    onRemove(itemId);
  }, [itemId, onRemove]);

  const iconName = category ? CATEGORY_ICONS[category] ?? 'ellipsis-horizontal' : 'ellipsis-horizontal';
  const categoryLabel = category
    ? COPY.pantry.yourFood.categories[category as keyof typeof COPY.pantry.yourFood.categories] ?? category
    : undefined;

  const quantityText = quantity && unit
    ? `${quantity} ${unit}`
    : quantity
      ? `${quantity}`
      : undefined;

  return (
    <Pressable
      style={styles.card}
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${name}`}
    >
      <View style={styles.iconContainer}>
        <Icon name={iconName} size={20} color={Colors.accent} />
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.metaRow}>
          {categoryLabel ? (
            <Text style={styles.category}>{categoryLabel}</Text>
          ) : null}
          {quantityText ? (
            <Text style={styles.quantity}>{quantityText}</Text>
          ) : null}
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${name} from pantry`}
        onPress={handleRemove}
        hitSlop={8}
        style={styles.removeButton}
      >
        <Icon name="close" size={16} color={Colors.text.tertiary} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.sm,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background.primary,
    borderRadius: Radius.md,
    ...Shadow.surface,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  category: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
  quantity: {
    ...Typography.caption,
    color: Colors.text.secondary,
  },
  removeButton: {
    padding: Spacing.xs,
  },
});

export const PantryItemCard = memo(PantryItemCardComponent);
