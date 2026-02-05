import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Icon } from '@/components/ui/Icon';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import { useModalAnimation } from '@/hooks/useModalAnimation';
import { usePantryItemModalStore } from '@/stores/usePantryItemModalStore';

const copy = COPY.pantry.yourFood;

type PantryCategory = 'produce' | 'dairy' | 'meat' | 'pantry' | 'spice' | 'frozen' | 'other';

const CATEGORIES: { value: PantryCategory; label: string; icon: string }[] = [
  { value: 'produce', label: copy.categories.produce, icon: 'nutrition' },
  { value: 'dairy', label: copy.categories.dairy, icon: 'water' },
  { value: 'meat', label: copy.categories.meat, icon: 'restaurant' },
  { value: 'pantry', label: copy.categories.pantry, icon: 'basket' },
  { value: 'spice', label: copy.categories.spice, icon: 'leaf' },
  { value: 'frozen', label: copy.categories.frozen, icon: 'snow' },
  { value: 'other', label: copy.categories.other, icon: 'ellipsis-horizontal' },
];

export function AddPantryItemModal(): React.ReactElement | null {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const isVisible = usePantryItemModalStore((s) => s.isVisible);
  const editingItem = usePantryItemModalStore((s) => s.editingItem);
  const closeModal = usePantryItemModalStore((s) => s.closeModal);

  const isEditMode = editingItem !== null;

  const [name, setName] = useState('');
  const [category, setCategory] = useState<PantryCategory>('other');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const addItem = useMutation(api.pantry.addItem);
  const updateItem = useMutation(api.pantry.updateItem);

  const resetState = useCallback(() => {
    setName('');
    setCategory('other');
    setQuantity('');
    setUnit('');
    setIsLoading(false);
  }, []);

  // Populate fields when editing
  useEffect(() => {
    if (isVisible && editingItem) {
      setName(editingItem.name);
      setCategory(editingItem.category ?? 'other');
      setQuantity(editingItem.quantity !== undefined ? String(editingItem.quantity) : '');
      setUnit(editingItem.unit ?? '');
    } else if (!isVisible) {
      resetState();
    }
  }, [isVisible, editingItem, resetState]);

  // Focus input when modal opens for adding
  useEffect(() => {
    if (isVisible && !editingItem) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isVisible, editingItem]);

  const { isRendered, backdropOpacity, modalTranslateY } = useModalAnimation({
    visible: isVisible,
    onAnimationComplete: resetState,
  });

  const handleClose = useCallback(() => {
    if (isLoading) return;
    closeModal();
  }, [isLoading, closeModal]);

  const handleSubmit = async () => {
    if (!name.trim() || isLoading) return;

    setIsLoading(true);
    try {
      if (isEditMode && editingItem) {
        await updateItem({
          itemId: editingItem._id,
          name: name.trim(),
          category,
          quantity: quantity ? parseFloat(quantity) : undefined,
          unit: unit.trim() || undefined,
        });
      } else {
        await addItem({
          name: name.trim(),
          category,
          quantity: quantity ? parseFloat(quantity) : undefined,
          unit: unit.trim() || undefined,
        });
      }
      closeModal();
    } catch (error) {
      console.error('Failed to save pantry item:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const canSubmit = name.trim().length > 0;

  if (!isRendered) return null;

  const title = isEditMode ? copy.addModal.editTitle : copy.addModal.title;
  const buttonText = isEditMode
    ? isLoading
      ? copy.addModal.saving
      : copy.addModal.save
    : isLoading
      ? copy.addModal.adding
      : copy.addModal.add;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        pointerEvents="box-none"
      >
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        {/* Modal */}
        <Animated.View
          style={[
            styles.modalContainer,
            { transform: [{ translateY: modalTranslateY }] },
          ]}
        >
          <View style={styles.modalContent}>
            {/* Handle */}
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={handleClose}
                hitSlop={12}
                disabled={isLoading}
              >
                <Icon
                  name="close"
                  size={24}
                  color={isLoading ? Colors.text.disabled : Colors.text.secondary}
                />
              </Pressable>
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={[
                styles.scrollContent,
                { paddingBottom: Math.max(insets.bottom, Spacing.lg) + Spacing.md },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Name Input */}
              <View style={styles.inputGroup}>
                <TextInput
                  ref={inputRef}
                  style={styles.textInput}
                  placeholder={copy.addModal.namePlaceholder}
                  placeholderTextColor={Colors.text.tertiary}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoFocus={!isEditMode}
                  editable={!isLoading}
                />
              </View>

              {/* Category Selection */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{copy.addModal.categoryLabel}</Text>
                <View style={styles.categoryGrid}>
                  {CATEGORIES.map((cat) => (
                    <Pressable
                      key={cat.value}
                      style={[
                        styles.categoryChip,
                        category === cat.value && styles.categoryChipSelected,
                      ]}
                      onPress={() => setCategory(cat.value)}
                      disabled={isLoading}
                    >
                      <Icon
                        name={cat.icon}
                        size={16}
                        color={category === cat.value ? Colors.accent : Colors.text.secondary}
                      />
                      <Text
                        style={[
                          styles.categoryChipText,
                          category === cat.value && styles.categoryChipTextSelected,
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Quantity and Unit */}
              <View style={styles.rowInputs}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>{copy.addModal.quantityLabel}</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder={copy.addModal.quantityPlaceholder}
                    placeholderTextColor={Colors.text.tertiary}
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="decimal-pad"
                    editable={!isLoading}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1.5 }]}>
                  <Text style={styles.inputLabel}>{copy.addModal.unitLabel}</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder={copy.addModal.unitPlaceholder}
                    placeholderTextColor={Colors.text.tertiary}
                    value={unit}
                    onChangeText={setUnit}
                    autoCapitalize="none"
                    editable={!isLoading}
                  />
                </View>
              </View>

              {/* Submit Button */}
              <Pressable
                style={[
                  styles.submitButton,
                  canSubmit && styles.submitButtonActive,
                  isLoading && styles.submitButtonLoading,
                ]}
                onPress={handleSubmit}
                disabled={!canSubmit || isLoading}
                accessibilityRole="button"
                accessibilityLabel={buttonText}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={Colors.text.inverse} />
                ) : (
                  <>
                    <Icon
                      name={isEditMode ? 'checkmark' : 'add'}
                      size={20}
                      color={canSubmit ? Colors.text.inverse : Colors.text.disabled}
                    />
                    <Text
                      style={[
                        styles.submitButtonText,
                        !canSubmit && styles.submitButtonTextDisabled,
                      ]}
                    >
                      {buttonText}
                    </Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background.overlay,
  },
  modalContainer: {
    width: '100%',
  },
  modalContent: {
    backgroundColor: Colors.background.primary,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    ...Typography.h2,
    color: Colors.text.primary,
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    ...Typography.label,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  textInput: {
    ...Typography.body,
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md + 2,
    minHeight: 48,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryChipSelected: {
    backgroundColor: Colors.accentLight,
    borderColor: Colors.accent,
  },
  categoryChipText: {
    ...Typography.caption,
    color: Colors.text.secondary,
  },
  categoryChipTextSelected: {
    color: Colors.accent,
    fontWeight: '600',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.tertiary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  submitButtonActive: {
    backgroundColor: Colors.accent,
  },
  submitButtonLoading: {
    opacity: 0.8,
  },
  submitButtonText: {
    ...Typography.label,
    fontSize: 16,
    color: Colors.text.inverse,
  },
  submitButtonTextDisabled: {
    color: Colors.text.disabled,
  },
});
