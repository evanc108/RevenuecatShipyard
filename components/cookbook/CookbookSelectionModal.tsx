import { useState, useEffect, useRef } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { useModalAnimation } from '@/hooks/useModalAnimation';

type Recipe = {
  title: string;
  imageUrl?: string;
  url: string;
};

type CookbookSelectionModalProps = {
  visible: boolean;
  recipe: Recipe | null;
  onClose: () => void;
  onSelect: (cookbookId: Id<'cookbooks'>) => void;
  isLoading?: boolean;
};

export function CookbookSelectionModal({
  visible,
  recipe,
  onClose,
  onSelect,
  isLoading = false,
}: CookbookSelectionModalProps): React.ReactElement | null {
  const insets = useSafeAreaInsets();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCookbookName, setNewCookbookName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Use shared modal animation
  const { isRendered, backdropOpacity, modalTranslateY } = useModalAnimation({
    visible,
    onAnimationComplete: () => {
      setShowCreateForm(false);
      setNewCookbookName('');
    },
  });

  const cookbooks = useQuery(api.cookbooks.list);
  const createCookbook = useMutation(api.cookbooks.create);

  useEffect(() => {
    if (showCreateForm) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [showCreateForm]);

  const handleClose = () => {
    if (isLoading || isCreating) return;
    onClose();
  };

  const handleSelectCookbook = (cookbookId: Id<'cookbooks'>) => {
    if (isLoading || isCreating) return;
    onSelect(cookbookId);
  };

  const handleCreateAndSelect = async () => {
    const trimmedName = newCookbookName.trim();
    if (trimmedName.length === 0 || isCreating) return;

    setIsCreating(true);
    try {
      const newCookbookId = await createCookbook({ name: trimmedName });
      setNewCookbookName('');
      setShowCreateForm(false);
      onSelect(newCookbookId);
    } catch (err) {
      console.error('Failed to create cookbook:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const isCreateValid = newCookbookName.trim().length > 0;

  if (!isRendered) return null;

  return (
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
        <Animated.View
          style={[styles.modalContent, { transform: [{ translateY: modalTranslateY }] }]}
        >
          {/* Handle bar */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Save to Cookbook</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={handleClose}
              hitSlop={12}
              disabled={isLoading || isCreating}
            >
              <Ionicons
                name="close"
                size={24}
                color={isLoading || isCreating ? Colors.text.disabled : Colors.text.secondary}
              />
            </Pressable>
          </View>

          {/* Recipe Preview */}
          {recipe && (
            <View style={styles.recipePreview}>
              {recipe.imageUrl && (
                <Image
                  source={{ uri: recipe.imageUrl }}
                  style={styles.recipeImage}
                  contentFit="cover"
                />
              )}
              <Text style={styles.recipeTitle} numberOfLines={2}>
                {recipe.title}
              </Text>
            </View>
          )}

          {/* Content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom, Spacing.md) },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {/* Create New Cookbook Section */}
            {showCreateForm ? (
              <View style={styles.createForm}>
                <TextInput
                  ref={inputRef}
                  style={styles.createInput}
                  placeholder="Cookbook name"
                  placeholderTextColor={Colors.text.tertiary}
                  value={newCookbookName}
                  onChangeText={setNewCookbookName}
                  maxLength={50}
                  returnKeyType="done"
                  onSubmitEditing={handleCreateAndSelect}
                  editable={!isCreating}
                  autoCapitalize="words"
                />
                <View style={styles.createActions}>
                  <Pressable
                    style={styles.cancelButton}
                    onPress={() => {
                      setShowCreateForm(false);
                      setNewCookbookName('');
                    }}
                    disabled={isCreating}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.createButton,
                      (!isCreateValid || isCreating) && styles.createButtonDisabled,
                    ]}
                    onPress={handleCreateAndSelect}
                    disabled={!isCreateValid || isCreating}
                  >
                    {isCreating ? (
                      <ActivityIndicator size="small" color={Colors.text.inverse} />
                    ) : (
                      <Text
                        style={[
                          styles.createButtonText,
                          !isCreateValid && styles.createButtonTextDisabled,
                        ]}
                      >
                        Create & Save
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                style={styles.createNewButton}
                onPress={() => setShowCreateForm(true)}
                disabled={isLoading}
              >
                <View style={styles.createNewIcon}>
                  <Ionicons name="add" size={20} color={Colors.accent} />
                </View>
                <Text style={styles.createNewText}>Create New Cookbook</Text>
              </Pressable>
            )}

            {/* Divider */}
            {cookbooks && cookbooks.length > 0 && (
              <View style={styles.dividerContainer}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>or choose existing</Text>
                <View style={styles.divider} />
              </View>
            )}

            {/* Cookbook List */}
            {cookbooks === undefined ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={Colors.accent} />
              </View>
            ) : cookbooks.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  No cookbooks yet. Create your first one above!
                </Text>
              </View>
            ) : (
              <View style={styles.cookbookList}>
                {cookbooks.map((cookbook) => (
                  <Pressable
                    key={cookbook._id}
                    style={({ pressed }) => [
                      styles.cookbookItem,
                      pressed && styles.cookbookItemPressed,
                    ]}
                    onPress={() => handleSelectCookbook(cookbook._id)}
                    disabled={isLoading || isCreating}
                  >
                    <View style={styles.cookbookItemContent}>
                      {cookbook.coverImageUrl ? (
                        <Image
                          source={{ uri: cookbook.coverImageUrl }}
                          style={styles.cookbookImage}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={[styles.cookbookImage, styles.cookbookImagePlaceholder]}>
                          <Ionicons name="book-outline" size={20} color={Colors.text.tertiary} />
                        </View>
                      )}
                      <View style={styles.cookbookInfo}>
                        <Text style={styles.cookbookName} numberOfLines={1}>
                          {cookbook.name}
                        </Text>
                        <Text style={styles.cookbookCount}>
                          {cookbook.recipeCount} {cookbook.recipeCount === 1 ? 'recipe' : 'recipes'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={Colors.text.tertiary} />
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Loading Overlay */}
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={Colors.accent} />
              <Text style={styles.loadingText}>Saving recipe...</Text>
            </View>
          )}
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
  modalContent: {
    width: '100%',
    backgroundColor: Colors.background.primary,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '85%',
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
  recipePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
  },
  recipeImage: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
  },
  recipeTitle: {
    ...Typography.body,
    color: Colors.text.primary,
    flex: 1,
    fontWeight: '500',
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  createNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderStyle: 'dashed',
  },
  createNewIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createNewText: {
    ...Typography.body,
    color: Colors.accent,
    fontWeight: '600',
  },
  createForm: {
    gap: Spacing.md,
  },
  createInput: {
    ...Typography.body,
    backgroundColor: Colors.background.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  createActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.background.secondary,
  },
  cancelButtonText: {
    ...Typography.label,
    color: Colors.text.secondary,
  },
  createButton: {
    flex: 2,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
  },
  createButtonDisabled: {
    backgroundColor: Colors.background.tertiary,
  },
  createButtonText: {
    ...Typography.label,
    color: Colors.text.inverse,
  },
  createButtonTextDisabled: {
    color: Colors.text.disabled,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.lg,
    gap: Spacing.md,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
  loadingContainer: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    ...Typography.bodySmall,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
  cookbookList: {
    gap: Spacing.sm,
  },
  cookbookItem: {
    borderRadius: Radius.md,
  },
  cookbookItemPressed: {
    backgroundColor: Colors.background.secondary,
  },
  cookbookItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  cookbookImage: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
  },
  cookbookImagePlaceholder: {
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cookbookInfo: {
    flex: 1,
    gap: 2,
  },
  cookbookName: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  cookbookCount: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.text.secondary,
  },
});
