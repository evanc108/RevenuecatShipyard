import { useState, useRef, useCallback, useMemo } from 'react';
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
  Dimensions,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import { useAddModal } from '@/context/AddModalContext';
import { useBackgroundExtraction } from '@/hooks/useBackgroundExtraction';
import { usePendingUploadsStore } from '@/stores/usePendingUploadsStore';
import { useModalAnimation, MODAL_ANIMATION } from '@/hooks/useModalAnimation';
import { CookbookDropdown } from './CookbookDropdown';
import { StarRatingInput } from './StarRatingInput';
import type { Id } from '@/convex/_generated/dataModel';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const copy = COPY.addModal;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type ModalView = 'main' | 'import' | 'share';

// Layout animation for container expansion - no text animation
const EXPAND_ANIMATION = {
  duration: MODAL_ANIMATION.duration,
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.scaleY,
  },
  // Don't animate create/delete to prevent text animation
  create: undefined,
  delete: undefined,
};

const PASTEL_FALLBACKS: readonly string[] = [
  '#FFE8D6',
  '#D6E8FF',
  '#E0D6FF',
  '#D6FFE8',
  '#FFF5D6',
  '#FFD6E0',
  '#D6F0E0',
  '#FFE0D6',
] as const;

function getRecipeCardColor(title: string): string {
  const hash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return PASTEL_FALLBACKS[hash % PASTEL_FALLBACKS.length] ?? PASTEL_FALLBACKS[0];
}

export function AddModal(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { isVisible, closeModal } = useAddModal();

  // View state
  const [currentView, setCurrentView] = useState<ModalView>('main');

  // Content opacity for instant text transitions (no animation on text)
  const contentOpacity = useRef(new Animated.Value(1)).current;

  // Import view state
  const [url, setUrl] = useState('');
  const [selectedCookbookId, setSelectedCookbookId] = useState<Id<'cookbooks'> | null>(null);
  const [cookbookError, setCookbookError] = useState(false);

  // Background extraction
  const { startExtraction } = useBackgroundExtraction();
  const addUpload = usePendingUploadsStore((s) => s.addUpload);

  // Get cookbooks to find selected cookbook name
  const cookbooks = useQuery(api.cookbooks.list);

  // Share post view state
  const [selectedRecipeId, setSelectedRecipeId] = useState<Id<'recipes'> | null>(null);
  const [shareSearchQuery, setShareSearchQuery] = useState('');
  const [easeRating, setEaseRating] = useState(0);
  const [tasteRating, setTasteRating] = useState(0);
  const [presentationRating, setPresentationRating] = useState(0);
  const [shareNotes, setShareNotes] = useState('');
  const [shareIsLoading, setShareIsLoading] = useState(false);

  // User's recipes for share view
  const userRecipes = useQuery(api.recipes.listSaved);
  const createPost = useMutation(api.posts.create);

  // Filter recipes by search query
  const filteredRecipes = useMemo(() => {
    if (!userRecipes) return [];
    if (!shareSearchQuery.trim()) return userRecipes;
    const query = shareSearchQuery.toLowerCase();
    return userRecipes.filter((recipe) =>
      recipe.title.toLowerCase().includes(query)
    );
  }, [userRecipes, shareSearchQuery]);

  const inputRef = useRef<TextInput>(null);

  // Reset state callback - defined before useModalAnimation
  const resetState = useCallback(() => {
    setCurrentView('main');
    setUrl('');
    setSelectedCookbookId(null);
    setCookbookError(false);
    setSelectedRecipeId(null);
    setShareSearchQuery('');
    setEaseRating(0);
    setTasteRating(0);
    setPresentationRating(0);
    setShareNotes('');
  }, []);

  // Use shared modal animation
  const { isRendered, backdropOpacity, modalTranslateY } = useModalAnimation({
    visible: isVisible,
    onAnimationComplete: resetState,
  });

  // Handle view transitions with smooth expansion animation
  // Container expands smoothly, text appears instantly (no animation on text)
  const animateToView = useCallback((newView: ModalView) => {
    // Instantly hide content
    contentOpacity.setValue(0);

    // Configure layout animation for container only
    LayoutAnimation.configureNext(EXPAND_ANIMATION);
    setCurrentView(newView);

    // Instantly show new content after layout settles
    // Using a short delay ensures the layout animation has started
    setTimeout(() => {
      contentOpacity.setValue(1);
    }, 16); // One frame delay

    // Focus input when navigating to import view
    if (newView === 'import') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [contentOpacity]);

  const handleClose = () => {
    if (isLoading) return;
    closeModal();
  };

  const handleBack = () => {
    animateToView('main');
  };

  const handleCookbookSelect = (id: Id<'cookbooks'>) => {
    setSelectedCookbookId(id);
    setCookbookError(false);
  };

  const handleImport = () => {
    if (!url.trim()) return;

    if (!selectedCookbookId) {
      setCookbookError(true);
      return;
    }

    // Find cookbook name for display in progress indicator
    const selectedCookbook = cookbooks?.find((c) => c._id === selectedCookbookId);
    const cookbookName = selectedCookbook?.name ?? 'Cookbook';

    // Add to pending uploads store and start background extraction
    const uploadId = addUpload(url.trim(), selectedCookbookId, cookbookName);
    startExtraction(uploadId);

    // Close modal immediately - progress shown in UploadProgressIndicator
    closeModal();
  };

  const handleSharePost = async () => {
    if (!selectedRecipeId || easeRating === 0 || tasteRating === 0 || presentationRating === 0) {
      return;
    }

    setShareIsLoading(true);
    try {
      await createPost({
        recipeId: selectedRecipeId,
        easeRating,
        tasteRating,
        presentationRating,
        notes: shareNotes.trim() || undefined,
      });
      closeModal();
    } catch (error) {
      // TODO: Show error toast
      console.error('Failed to create post:', error);
    } finally {
      setShareIsLoading(false);
    }
  };

  const isLoading = shareIsLoading;
  const canImport = url.trim().length > 0 && selectedCookbookId !== null;

  const renderMainView = () => (
    <View style={styles.optionsContainer}>
      <Pressable
        style={styles.optionCard}
        onPress={() => animateToView('import')}
        accessibilityRole="button"
        accessibilityLabel={copy.options.importUrl}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View style={styles.optionIconContainer}>
            <Icon name="link" size={24} color={Colors.accent} />
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>{copy.options.importUrl}</Text>
            <Text style={styles.optionDescription}>{copy.options.importUrlDesc}</Text>
          </View>
          <Icon name="chevron-forward" size={20} color={Colors.text.tertiary} />
        </View>
      </Pressable>

      <Pressable
        style={styles.optionCard}
        onPress={() => animateToView('share')}
        accessibilityRole="button"
        accessibilityLabel={copy.options.sharePost}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View style={styles.optionIconContainer}>
            <Icon name="camera" size={24} color={Colors.accent} />
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>{copy.options.sharePost}</Text>
            <Text style={styles.optionDescription}>{copy.options.sharePostDesc}</Text>
          </View>
          <Icon name="chevron-forward" size={20} color={Colors.text.tertiary} />
        </View>
      </Pressable>
    </View>
  );

  const renderImportView = () => (
    <>
      {/* URL Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>{copy.importUrl.urlLabel}</Text>
        <View style={styles.urlInputContainer}>
          <Icon name="link" size={20} color={Colors.text.tertiary} style={styles.urlIcon} />
          <TextInput
            ref={inputRef}
            style={styles.urlInput}
            placeholder={copy.importUrl.placeholder}
            placeholderTextColor={Colors.text.tertiary}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="done"
          />
          {url.length > 0 && (
            <Pressable
              onPress={() => setUrl('')}
              hitSlop={8}
              accessibilityLabel="Clear URL"
            >
              <Icon name="close-circle" size={20} color={Colors.text.tertiary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Cookbook Selection */}
      <View style={styles.inputGroup}>
        <CookbookDropdown
          selectedId={selectedCookbookId}
          onSelect={handleCookbookSelect}
          error={cookbookError}
        />
      </View>

      {/* Import Button */}
      <Pressable
        style={[
          styles.importButton,
          canImport && styles.importButtonActive,
        ]}
        onPress={handleImport}
        disabled={!canImport}
        accessibilityRole="button"
        accessibilityLabel={copy.importUrl.submitActive}
        accessibilityState={{ disabled: !canImport }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <Icon
            name="download"
            size={20}
            color={canImport ? Colors.text.inverse : Colors.text.disabled}
          />
          <Text style={[
            styles.importButtonText,
            !canImport && styles.importButtonTextDisabled,
          ]}>
            {selectedCookbookId ? copy.importUrl.submitActive : copy.importUrl.submit}
          </Text>
        </View>
      </Pressable>
    </>
  );

  const canShare = selectedRecipeId && easeRating > 0 && tasteRating > 0 && presentationRating > 0;

  // Get selected recipe details for display
  const selectedRecipe = useMemo(() => {
    if (!selectedRecipeId || !userRecipes) return null;
    return userRecipes.find((r) => r._id === selectedRecipeId) ?? null;
  }, [selectedRecipeId, userRecipes]);

  const renderSharePostView = () => (
    <>
      {/* Recipe Selection Section */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>{copy.sharePost.selectRecipe}</Text>

        {/* Search Bar */}
        <View style={styles.searchInputContainer}>
          <Icon name="search" size={20} color={Colors.text.tertiary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={copy.sharePost.searchPlaceholder}
            placeholderTextColor={Colors.text.tertiary}
            value={shareSearchQuery}
            onChangeText={setShareSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!shareIsLoading}
          />
          {shareSearchQuery.length > 0 && (
            <Pressable
              onPress={() => setShareSearchQuery('')}
              hitSlop={8}
              accessibilityLabel="Clear search"
            >
              <Icon name="close-circle" size={20} color={Colors.text.tertiary} />
            </Pressable>
          )}
        </View>

        {/* Horizontal Recipe Cards */}
        {userRecipes && userRecipes.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.recipeCardsContainer}
            contentContainerStyle={styles.recipeCardsContent}
          >
            {filteredRecipes.length > 0 ? (
              filteredRecipes.map((recipe) => (
                <Pressable
                  key={recipe._id}
                  style={[
                    styles.recipeCard,
                    selectedRecipeId === recipe._id && styles.recipeCardSelected,
                  ]}
                  onPress={() => setSelectedRecipeId(recipe._id)}
                  disabled={shareIsLoading}
                >
                  <View style={[
                    styles.recipeCardImage,
                    { backgroundColor: getRecipeCardColor(recipe.title) },
                  ]}>
                    {recipe.imageUrl ? (
                      <Image
                        source={{ uri: recipe.imageUrl }}
                        style={styles.recipeCardImageFill}
                        contentFit="cover"
                        transition={200}
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <Icon name="restaurant-outline" size={24} color={Colors.text.tertiary} />
                    )}
                    {selectedRecipeId === recipe._id && (
                      <View style={styles.recipeCardCheckmark}>
                        <Icon name="checkmark-circle" size={24} color={Colors.accent} />
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.recipeCardTitle,
                      selectedRecipeId === recipe._id && styles.recipeCardTitleSelected,
                    ]}
                    numberOfLines={2}
                  >
                    {recipe.title}
                  </Text>
                </Pressable>
              ))
            ) : (
              <View style={styles.noResultsInline}>
                <Text style={styles.noResultsText}>No recipes match "{shareSearchQuery}"</Text>
              </View>
            )}
          </ScrollView>
        ) : (
          <View style={styles.emptyRecipes}>
            <Icon name="book" size={32} color={Colors.text.tertiary} />
            <Text style={styles.emptyRecipesTitle}>{copy.sharePost.noRecipes}</Text>
            <Text style={styles.emptyRecipesDesc}>{copy.sharePost.noRecipesDesc}</Text>
          </View>
        )}
      </View>

      {/* Ratings Section */}
      <View style={styles.ratingsSection}>
        <StarRatingInput
          label={copy.sharePost.ratings.ease}
          value={easeRating}
          onChange={setEaseRating}
          disabled={shareIsLoading}
        />
        <StarRatingInput
          label={copy.sharePost.ratings.taste}
          value={tasteRating}
          onChange={setTasteRating}
          disabled={shareIsLoading}
        />
        <StarRatingInput
          label={copy.sharePost.ratings.presentation}
          value={presentationRating}
          onChange={setPresentationRating}
          disabled={shareIsLoading}
        />
      </View>

      {/* Notes */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>{copy.sharePost.notes}</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          placeholder={copy.sharePost.notesPlaceholder}
          placeholderTextColor={Colors.text.tertiary}
          value={shareNotes}
          onChangeText={setShareNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          editable={!shareIsLoading}
        />
      </View>
    </>
  );

  const getModalTitle = () => {
    switch (currentView) {
      case 'import':
        return copy.importUrl.title;
      case 'share':
        return copy.sharePost.title;
      default:
        return copy.main.title;
    }
  };

  if (!isRendered) return <></>;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        pointerEvents="box-none"
      >
        {/* Animated Backdrop */}
        <Animated.View
          style={[
            styles.backdrop,
            { opacity: backdropOpacity },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        {/* Animated Modal Content */}
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{ translateY: modalTranslateY }],
              maxHeight: currentView === 'main' ? '60%' : '90%',
            },
          ]}
        >
          <View style={styles.modalContent}>
            {/* Handle bar */}
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>

            {/* Header - only show for sub-views */}
            {currentView !== 'main' && (
              <View style={styles.header}>
                <Pressable
                  onPress={handleBack}
                  hitSlop={12}
                  style={styles.backButton}
                  accessibilityLabel={copy.back}
                >
                  <Icon name="arrow-back" size={24} color={Colors.text.primary} />
                </Pressable>
                <Text style={styles.title}>{getModalTitle()}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={copy.cancel}
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
            )}

            {/* Content - wrapped in Animated.View for instant text transitions */}
            <ScrollView
              style={[
                styles.scrollView,
                currentView === 'share' && { maxHeight: SCREEN_HEIGHT * 0.65 },
              ]}
              contentContainerStyle={[
                styles.scrollContent,
                currentView !== 'share' && { paddingBottom: Math.max(insets.bottom, Spacing.lg) + Spacing.md },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              <Animated.View style={{ opacity: contentOpacity }}>
                {currentView === 'main' && renderMainView()}
                {currentView === 'import' && renderImportView()}
                {currentView === 'share' && renderSharePostView()}
              </Animated.View>
            </ScrollView>

            {/* Sticky Submit Button for Share View */}
            {currentView === 'share' && (
              <View style={[styles.stickyButtonContainer, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
                <Pressable
                  style={[
                    styles.submitButton,
                    canShare && styles.submitButtonActive,
                    shareIsLoading && styles.submitButtonLoading,
                  ]}
                  onPress={handleSharePost}
                  disabled={!canShare || shareIsLoading}
                  accessibilityRole="button"
                  accessibilityLabel={copy.sharePost.submit}
                >
                  {shareIsLoading ? (
                    <ActivityIndicator size="small" color={Colors.text.inverse} />
                  ) : (
                    <Text style={[
                      styles.submitButtonText,
                      !canShare && styles.submitButtonTextDisabled,
                    ]}>
                      {copy.sharePost.submit}
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
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
  modalContentFlex: {
    flex: 1,
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
  backButton: {
    padding: Spacing.xs,
    marginLeft: -Spacing.xs,
    borderRadius: Radius.sm,
  },
  title: {
    ...Typography.h2,
    color: Colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollViewFlex: {
    flex: 1,
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
  urlInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  urlIcon: {
    marginRight: Spacing.sm,
  },
  urlInput: {
    flex: 1,
    ...Typography.body,
    color: Colors.text.primary,
    paddingVertical: Spacing.md,
  },
  progressSection: {
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressText: {
    ...Typography.body,
    color: Colors.text.secondary,
    flex: 1,
    marginLeft: Spacing.sm,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: Spacing.sm,
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  errorText: {
    ...Typography.bodySmall,
    color: Colors.semantic.error,
    flex: 1,
    marginLeft: Spacing.sm,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.tertiary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  importButtonActive: {
    backgroundColor: Colors.accent,
  },
  importButtonLoading: {
    backgroundColor: Colors.accent,
    opacity: 0.8,
  },
  importButtonText: {
    ...Typography.label,
    fontSize: 16,
    color: Colors.text.inverse,
    marginLeft: Spacing.sm,
  },
  importButtonTextDisabled: {
    color: Colors.text.disabled,
  },
  optionsContainer: {
    marginTop: Spacing.sm,
  },
  optionCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  optionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  optionContent: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  optionTitle: {
    ...Typography.label,
    color: Colors.text.primary,
    fontSize: 15,
  },
  optionDescription: {
    ...Typography.caption,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  textInput: {
    ...Typography.body,
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.xs,
  },
  textArea: {
    minHeight: 80,
    paddingTop: Spacing.md,
  },
  textAreaLarge: {
    minHeight: 120,
    paddingTop: Spacing.md,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.tertiary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  submitButtonActive: {
    backgroundColor: Colors.accent,
  },
  submitButtonText: {
    ...Typography.label,
    fontSize: 16,
    color: Colors.text.inverse,
    marginLeft: Spacing.sm,
  },
  submitButtonTextDisabled: {
    color: Colors.text.disabled,
  },
  recipeList: {
    maxHeight: 200,
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.sm,
  },
  recipeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  recipeOptionSelected: {
    backgroundColor: Colors.accentLight,
  },
  recipeOptionText: {
    ...Typography.body,
    color: Colors.text.primary,
    flex: 1,
  },
  recipeOptionTextSelected: {
    color: Colors.accent,
    fontWeight: '600',
  },
  emptyRecipes: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
  },
  emptyRecipesTitle: {
    ...Typography.label,
    color: Colors.text.secondary,
    marginTop: Spacing.md,
  },
  emptyRecipesDesc: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    marginTop: Spacing.xs,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    color: Colors.text.primary,
    paddingVertical: Spacing.md,
  },
  noResultsContainer: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  noResultsText: {
    ...Typography.body,
    color: Colors.text.tertiary,
  },
  ratingsSection: {
    marginBottom: Spacing.md,
  },
  selectRecipeHint: {
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  selectRecipeHintText: {
    ...Typography.body,
    color: Colors.text.tertiary,
  },
  submitButtonLoading: {
    backgroundColor: Colors.accent,
    opacity: 0.8,
  },
  stickyButtonContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background.primary,
  },
  shareSubmitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.tertiary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  recipeCardsContainer: {
    marginTop: Spacing.md,
    marginHorizontal: -Spacing.lg,
  },
  recipeCardsContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  recipeCard: {
    width: 120,
    borderRadius: Radius.md,
    backgroundColor: Colors.background.secondary,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  recipeCardSelected: {
    borderColor: Colors.accent,
  },
  recipeCardImage: {
    width: '100%',
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  recipeCardImageFill: {
    width: '100%',
    height: '100%',
  },
  recipeCardCheckmark: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    backgroundColor: Colors.background.primary,
    borderRadius: Radius.full,
  },
  recipeCardTitle: {
    ...Typography.caption,
    color: Colors.text.primary,
    padding: Spacing.sm,
    textAlign: 'center',
  },
  recipeCardTitleSelected: {
    color: Colors.accent,
    fontWeight: '600',
  },
  noResultsInline: {
    width: 200,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
});
