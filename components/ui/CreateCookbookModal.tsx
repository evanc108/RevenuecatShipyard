import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';

type CreateCookbookModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string, description?: string, imageUri?: string) => void;
  isLoading?: boolean;
};

export function CreateCookbookModal({
  visible,
  onClose,
  onSubmit,
  isLoading = false,
}: CreateCookbookModalProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setName('');
      setDescription('');
      setImageUri(null);
    }
  }, [visible]);

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

  const isValid = name.trim().length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Backdrop */}
        <Pressable style={styles.backdrop} onPress={handleClose} />

        {/* Modal Content */}
        <View style={styles.modalContent}>
          {/* Handle bar */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>New Cookbook</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={handleClose}
              hitSlop={12}
              disabled={isLoading}
            >
              <Ionicons
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
                      <Ionicons name="image-outline" size={16} color={Colors.text.secondary} />
                      <Text style={styles.imageActionText}>Change</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Remove image"
                      style={styles.imageActionButton}
                      onPress={handleRemoveImage}
                      disabled={isLoading}
                    >
                      <Ionicons name="trash-outline" size={16} color={Colors.semantic.error} />
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
                  <Ionicons name="camera-outline" size={22} color={Colors.text.tertiary} />
                  <Text style={styles.imagePickerText}>Add a cover photo</Text>
                </Pressable>
              )}
            </View>
          </ScrollView>

          {/* Submit button */}
          <View style={[styles.submitContainer, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create cookbook"
              accessibilityState={{ disabled: !isValid || isLoading }}
              style={[
                styles.submitButton,
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
                {isLoading ? 'Creating...' : 'Create Cookbook'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    backgroundColor: Colors.background.primary,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '80%',
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
