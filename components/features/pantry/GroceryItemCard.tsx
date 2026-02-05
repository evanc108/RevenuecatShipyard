import { memo, useCallback, useState, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Icon } from '@/components/ui/Icon';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import { formatQuantityWithUnit } from '@/types/grocery';
import type { Id } from '@/convex/_generated/dataModel';

const copy = COPY.pantry.groceries;

type GrocerySource = {
  recipeId: Id<'recipes'>;
  recipeName: string;
  quantity: number;
  unit: string;
  servingsMultiplier: number;
  mealPlanEntryId?: Id<'mealPlanEntries'>;
  scheduledDate?: string;
};

type GroceryItem = {
  _id: Id<'groceryItems'>;
  name: string;
  normalizedName: string;
  category?: string;
  totalQuantity: number;
  unit: string;
  sources: GrocerySource[];
  isChecked: boolean;
  userQuantityOverride?: number;
  amazonFreshUrl?: string;
  adjustedQuantity: number;
  pantryQuantity?: number;
  pantryUnit?: string;
  effectiveQuantity: number;
};

type GroceryItemCardProps = {
  item: GroceryItem;
  onRemove: (itemId: Id<'groceryItems'>) => void;
  onToggleCheck: (itemId: Id<'groceryItems'>, isChecked: boolean) => void;
  onEdit: () => void;
  onOpenAmazon: () => void;
};

function GroceryItemCardComponent({
  item,
  onRemove,
  onToggleCheck,
  onEdit,
  onOpenAmazon,
}: GroceryItemCardProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const swipeableRef = useRef<Swipeable>(null);

  const handleRemove = useCallback(() => {
    swipeableRef.current?.close();
    onRemove(item._id);
  }, [item._id, onRemove]);

  const handleToggleCheck = useCallback(() => {
    onToggleCheck(item._id, !item.isChecked);
  }, [item._id, item.isChecked, onToggleCheck]);

  const handleToggleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const renderRightActions = useCallback(
    (
      _progress: Animated.AnimatedInterpolation<number>,
      dragX: Animated.AnimatedInterpolation<number>
    ) => {
      const scale = dragX.interpolate({
        inputRange: [-100, 0],
        outputRange: [1, 0.5],
        extrapolate: 'clamp',
      });

      return (
        <Pressable style={styles.deleteAction} onPress={handleRemove}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <Icon name="trash" size={20} color={Colors.text.inverse} />
          </Animated.View>
        </Pressable>
      );
    },
    [handleRemove]
  );

  const hasPantryDeduction =
    item.pantryQuantity !== undefined && item.pantryQuantity > 0;
  const hasScheduledSources = item.sources.some((s) => s.scheduledDate);

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
    >
      <View style={[styles.card, item.isChecked && styles.cardChecked]}>
        {/* Checkbox */}
        <Pressable
          style={styles.checkbox}
          onPress={handleToggleCheck}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.isChecked }}
          accessibilityLabel={`${item.isChecked ? 'Uncheck' : 'Check'} ${item.name}`}
        >
          <View
            style={[
              styles.checkboxInner,
              item.isChecked && styles.checkboxChecked,
            ]}
          >
            {item.isChecked && (
              <Icon name="check" size={12} color={Colors.text.inverse} />
            )}
          </View>
        </Pressable>

        {/* Content */}
        <Pressable style={styles.content} onPress={onEdit}>
          <View style={styles.mainRow}>
            <View style={styles.nameContainer}>
              <Text
                style={[styles.name, item.isChecked && styles.nameChecked]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text
                style={[styles.quantityInline, item.isChecked && styles.quantityChecked]}
              >
                {formatQuantityWithUnit(item.effectiveQuantity, item.unit)}
              </Text>
            </View>

            {/* Amazon button */}
            <Pressable
              style={({ pressed }) => [
                styles.amazonButton,
                pressed && styles.amazonButtonPressed,
              ]}
              onPress={onOpenAmazon}
              accessibilityLabel={copy.openAmazon}
            >
              <Icon name="cart" size={20} color={Colors.accent} />
            </Pressable>
          </View>

          {/* Pantry deduction note - show prominently */}
          {hasPantryDeduction && (
            <View style={styles.pantryRow}>
              <Icon name="check-circle" size={12} color={Colors.semantic.success} />
              <Text style={styles.pantryNote}>
                {formatQuantityWithUnit(item.pantryQuantity ?? 0, item.pantryUnit ?? item.unit)} in pantry
              </Text>
            </View>
          )}

          {/* Recipe sources indicator */}
          <Pressable
            onPress={handleToggleExpand}
            style={styles.sourcesRow}
            hitSlop={8}
          >
            <Text style={styles.sourcesText}>
              {item.sources.length} recipe{item.sources.length > 1 ? 's' : ''}
              {hasScheduledSources && ' • scheduled'}
            </Text>
            <Icon
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={12}
              color={Colors.text.tertiary}
            />
          </Pressable>

          {/* Expanded recipe sources */}
          {expanded && (
            <View style={styles.expandedSources}>
              {item.sources.map((source, index) => (
                <View key={`${source.recipeId}-${index}`} style={styles.sourceItem}>
                  <Text style={styles.sourceRecipeName} numberOfLines={1}>
                    {source.recipeName}
                  </Text>
                  <Text style={styles.sourceQuantity}>
                    {formatQuantityWithUnit(source.quantity, source.unit)}
                    {source.scheduledDate && (
                      <Text style={styles.scheduledBadge}> (scheduled)</Text>
                    )}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Pressable>
      </View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.background.primary,
    borderRadius: Radius.md,
  },
  cardChecked: {
    backgroundColor: Colors.background.secondary,
    opacity: 0.7,
  },
  checkbox: {
    paddingTop: 2,
  },
  checkboxInner: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  content: {
    flex: 1,
    gap: Spacing.xs,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  nameContainer: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  nameChecked: {
    color: Colors.text.tertiary,
    textDecorationLine: 'line-through',
  },
  quantityInline: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  pantryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  pantryNote: {
    ...Typography.caption,
    color: Colors.semantic.success,
    fontWeight: '500',
  },
  sourcesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  sourcesText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
  expandedSources: {
    marginTop: Spacing.xs,
    gap: Spacing.xs,
    paddingLeft: Spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: Colors.border,
  },
  sourceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sourceRecipeName: {
    ...Typography.caption,
    color: Colors.text.secondary,
    flex: 1,
  },
  sourceQuantity: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
  scheduledBadge: {
    color: Colors.accent,
  },
  quantityChecked: {
    color: Colors.text.tertiary,
    textDecorationLine: 'line-through',
  },
  amazonButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentLight,
  },
  amazonButtonPressed: {
    backgroundColor: Colors.accentDark,
    opacity: 0.8,
  },
  deleteAction: {
    backgroundColor: Colors.semantic.error,
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
    borderRadius: Radius.md,
    marginLeft: Spacing.xs,
  },
});

export const GroceryItemCard = memo(GroceryItemCardComponent);
