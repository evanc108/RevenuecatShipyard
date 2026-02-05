import { memo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { Colors, Spacing, Radius, Typography, Shadow } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import { formatQuantity } from '@/types/grocery';
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

type GroceryItemEditorProps = {
  item: GroceryItem;
  onSave: (itemId: Id<'groceryItems'>, quantity: number) => void;
  onClose: () => void;
};

function GroceryItemEditorComponent({
  item,
  onSave,
  onClose,
}: GroceryItemEditorProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const [quantity, setQuantity] = useState(
    item.effectiveQuantity.toString()
  );

  const handleSave = useCallback(() => {
    const numQuantity = parseFloat(quantity);
    if (!isNaN(numQuantity) && numQuantity > 0) {
      onSave(item._id, numQuantity);
    }
  }, [item._id, quantity, onSave]);

  const handleQuantityChange = useCallback((text: string) => {
    // Allow only numbers and decimal point
    const filtered = text.replace(/[^0-9.]/g, '');
    // Prevent multiple decimal points
    const parts = filtered.split('.');
    if (parts.length > 2) {
      setQuantity(parts[0] + '.' + parts.slice(1).join(''));
    } else {
      setQuantity(filtered);
    }
  }, []);

  const hasPantryDeduction =
    item.pantryQuantity !== undefined && item.pantryQuantity > 0;

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + Spacing.md },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{copy.editQuantity}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel="Close"
            >
              <Icon name="close" size={24} color={Colors.text.secondary} />
            </Pressable>
          </View>

          {/* Item info */}
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{item.name}</Text>
            {hasPantryDeduction && (
              <Text style={styles.pantryNote}>
                {copy.pantryDeduction(item.pantryQuantity ?? 0, item.pantryUnit ?? item.unit)}
              </Text>
            )}
          </View>

          {/* Quantity breakdown */}
          <View style={styles.breakdownSection}>
            <Text style={styles.breakdownLabel}>{copy.fromRecipes}:</Text>
            {item.sources.map((source, index) => (
              <View key={`${source.recipeId}-${index}`} style={styles.breakdownRow}>
                <Text style={styles.breakdownRecipe} numberOfLines={1}>
                  {source.recipeName}
                </Text>
                <Text style={styles.breakdownQuantity}>
                  {formatQuantity(source.quantity)} {source.unit}
                </Text>
              </View>
            ))}
            <View style={styles.breakdownTotalRow}>
              <Text style={styles.breakdownTotalLabel}>Total needed:</Text>
              <Text style={styles.breakdownTotalValue}>
                {formatQuantity(item.totalQuantity)} {item.unit}
              </Text>
            </View>
            {hasPantryDeduction && (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownRecipe}>In pantry:</Text>
                <Text style={styles.breakdownPantry}>
                  -{formatQuantity(item.pantryQuantity ?? 0)} {item.pantryUnit ?? item.unit}
                </Text>
              </View>
            )}
          </View>

          {/* Quantity input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>{copy.quantityLabel}</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={quantity}
                onChangeText={handleQuantityChange}
                keyboardType="decimal-pad"
                selectTextOnFocus
                autoFocus
              />
              <Text style={styles.inputUnit}>{item.unit}</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>{copy.cancel}</Text>
            </Pressable>
            <Pressable style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>{copy.save}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background.overlay,
  },
  sheet: {
    backgroundColor: Colors.background.primary,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    ...Shadow.elevated,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h3,
    color: Colors.text.primary,
  },
  itemInfo: {
    marginBottom: Spacing.lg,
  },
  itemName: {
    ...Typography.h2,
    color: Colors.text.primary,
  },
  pantryNote: {
    ...Typography.bodySmall,
    color: Colors.semantic.success,
    marginTop: Spacing.xs,
  },
  breakdownSection: {
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  breakdownLabel: {
    ...Typography.label,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownRecipe: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    flex: 1,
  },
  breakdownQuantity: {
    ...Typography.bodySmall,
    color: Colors.text.primary,
  },
  breakdownPantry: {
    ...Typography.bodySmall,
    color: Colors.semantic.success,
  },
  breakdownTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: Spacing.xs,
  },
  breakdownTotalLabel: {
    ...Typography.label,
    color: Colors.text.primary,
  },
  breakdownTotalValue: {
    ...Typography.label,
    color: Colors.text.primary,
  },
  inputSection: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    ...Typography.label,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    ...Typography.h3,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  inputUnit: {
    ...Typography.body,
    color: Colors.text.secondary,
    minWidth: 60,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  cancelButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...Typography.label,
    color: Colors.text.secondary,
  },
  saveButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center',
  },
  saveButtonText: {
    ...Typography.label,
    color: Colors.text.inverse,
  },
});

export const GroceryItemEditor = memo(GroceryItemEditorComponent);
