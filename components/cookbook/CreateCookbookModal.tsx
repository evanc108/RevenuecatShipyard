import { Icon } from '@/components/ui/Icon';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useModalAnimation } from '@/hooks/useModalAnimation';

type EditData = {
  name: string;
  description?: string;
  coverImageUrl?: string;
};

type CreateCookbookModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string, description?: string, imageUri?: string) => void;
  onDelete?: () => void;
  isLoading?: boolean;
  editData?: EditData;
};

export function CreateCookbookModal({
  visible,
  onClose,
  onSubmit,
  onDelete,
  isLoading = false,
  editData,
}: CreateCookbookModalProps): React.ReactElement | null {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const isEditMode = editData !== undefined;

  // Use shared modal animation
  const { isRendered, backdropOpacity, modalTranslateY } = useModalAnimation({
    visible,
    onAnimationComplete: () => {
      // Reset state only when closing (not editing)
      if (!editData) {
        setName('');
        setDescription('');
        setImageUri(null);
      }
    },
  });

  // Prefill with edit data or reset for create when modal opens
  useEffect(() => {
    if (visible) {
      if (editData) {
        setName(editData.name);
        setDescription(editData.description ?? '');
        setImageUri(editData.coverImageUrl ?? null);
      } else {
        setName('');
        setDescription('');
        setImageUri(null);
      }
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [visible, editData]);

  const handleClose = () => {
    if (isLoading) return;
    onClose();
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleRemoveImage = () => {
    setImageUri(null);
  };

  const handleSubmit = () => {
    const trimmedName = name.trim();
    if (trimmedName.length === 0 || isLoading) return;
    onSubmit(trimmedName, description.trim() || undefined, imageUri ?? undefined);
  };

  const handleDelete = () => {
    if (!onDelete || isLoading) return;
    Alert.alert(
      'Delete Cookbook',
      'Are you sure you want to delete this cookbook? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: onDelete,
        },
      ],
    );
  };

  const isValid = name.trim().length > 0;

  if (!isRendered) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
          pointerEvents="box-none"
        >
          {/* Animated Backdrop */}
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
          </Animated.View>

          {/* Animated Modal Content */}
          <Animated.View style={[styles.modalContent, { transform: [{ translateY: modalTranslateY }] }]}>
            {/* Handle bar */}
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>{isEditMode ? 'Edit Cookbook' : 'New Cookbook'}</Text>
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

            {/* Form */}
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              {/* Name Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  placeholder="My Recipes"
                  placeholderTextColor={Colors.text.tertiary}
                  value={name}
                  onChangeText={setName}
                  maxLength={50}
                  returnKeyType="next"
                  editable={!isLoading}
                  autoCapitalize="words"
                />
              </View>

              {/* Description Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Description <Text style={styles.optionalLabel}>(optional)</Text>
                </Text>
                <TextInput
                  style={[styles.input, styles.descriptionInput]}
                  placeholder="A collection of my favorite dishes"
                  placeholderTextColor={Colors.text.tertiary}
                  value={description}
                  onChangeText={setDescription}
                  maxLength={150}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  editable={!isLoading}
                />
              </View>

              {/* Cover Image */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Cover Image <Text style={styles.optionalLabel}>(optional)</Text>
                </Text>

                {imageUri ? (
                  <View style={styles.imagePreviewContainer}>
                    <Image
                      source={{ uri: imageUri }}
                      style={styles.imagePreview}
                      contentFit="cover"
                    />
                    <View style={styles.imageActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Change image"
                        style={styles.imageActionButton}
                        onPress={handlePickImage}
                        disabled={isLoading}
                      >
                        <Icon name="image-outline" size={16} color={Colors.text.secondary} />
                        <Text style={styles.imageActionText}>Change</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Remove image"
                        style={styles.imageActionButton}
                        onPress={handleRemoveImage}
                        disabled={isLoading}
                      >
                        <Icon name="trash-outline" size={16} color={Colors.semantic.error} />
                        <Text style={[styles.imageActionText, styles.imageActionTextDanger]}>
                          Remove
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Add cover image"
                    style={styles.imagePickerButton}
                    onPress={handlePickImage}
                    disabled={isLoading}
                  >
                    <Icon name="camera-outline" size={22} color={Colors.text.tertiary} />
                    <Text style={styles.imagePickerText}>Add a cover photo</Text>
                  </Pressable>
                )}
              </View>

            </ScrollView>

            {/* Action buttons */}
            <View style={[styles.submitContainer, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
              <View style={isEditMode && onDelete ? styles.buttonRow : undefined}>
                {/* Delete button (edit mode only) */}
                {isEditMode && onDelete ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Delete cookbook"
                    style={[styles.deleteButton, isLoading && styles.deleteButtonDisabled]}
                    onPress={handleDelete}
                    disabled={isLoading}
                  >
                    <Icon
                      name="trash-outline"
                      size={18}
                      color={isLoading ? Colors.text.disabled : Colors.semantic.error}
                    />
                    <Text
                      style={[styles.deleteButtonText, isLoading && styles.deleteButtonTextDisabled]}
                    >
                      Delete
                    </Text>
                  </Pressable>
                ) : null}

                {/* Submit button */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isEditMode ? 'Save changes' : 'Create cookbook'}
                  accessibilityState={{ disabled: !isValid || isLoading }}
                  style={[
                    styles.submitButton,
                    isEditMode && onDelete ? styles.submitButtonFlex : undefined,
                    (!isValid || isLoading) && styles.submitButtonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={!isValid || isLoading}
                >
                  <Text
                    style={[
                      styles.submitButtonText,
                      (!isValid || isLoading) && styles.submitButtonTextDisabled,
                    ]}
                  >
                    {isLoading
                      ? (isEditMode ? 'Saving...' : 'Creating...')
                      : (isEditMode ? 'Save Changes' : 'Create Cookbook')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
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
  modalContent: {
    width: '100%',
    backgroundColor: Colors.background.primary,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '90%',
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
    paddingBottom: Spacing.lg,
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
    gap: Spacing.lg,
  },
  inputGroup: {
    gap: Spacing.sm,
  },
  label: {
    ...Typography.label,
    color: Colors.text.primary,
  },
  optionalLabel: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    fontWeight: '400',
  },
  input: {
    ...Typography.body,
    backgroundColor: Colors.background.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  descriptionInput: {
    minHeight: 80,
    paddingTop: Spacing.md,
  },
  imagePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.background.secondary,
  },
  imagePickerText: {
    ...Typography.body,
    color: Colors.text.tertiary,
  },
  imagePreviewContainer: {
    gap: Spacing.sm,
  },
  imagePreview: {
    width: '100%',
    height: 120,
    borderRadius: Radius.md,
  },
  imageActions: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  imageActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  imageActionText: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
  },
  imageActionTextDanger: {
    color: Colors.semantic.error,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.semantic.error,
  },
  deleteButtonDisabled: {
    borderColor: Colors.text.disabled,
  },
  deleteButtonText: {
    ...Typography.label,
    color: Colors.semantic.error,
  },
  deleteButtonTextDisabled: {
    color: Colors.text.disabled,
  },
  submitContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  submitButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonFlex: {
    flex: 1,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.background.tertiary,
  },
  submitButtonText: {
    ...Typography.label,
    color: Colors.text.inverse,
  },
  submitButtonTextDisabled: {
    color: Colors.text.disabled,
  },
});
