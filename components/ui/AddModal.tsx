import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import { useAddModal } from '@/context/AddModalContext';
import { useRecipeExtraction } from '@/hooks/useRecipeExtraction';
import { CookbookDropdown } from './CookbookDropdown';
import { StarRatingInput } from './StarRatingInput';
import type { Id } from '@/convex/_generated/dataModel';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const copy = COPY.addModal;
const extractionCopy = COPY.extraction;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type ModalView = 'main' | 'import' | 'share';

const ANIMATION_DURATION = 350;
const SPRING_CONFIG = {
  tension: 65,
  friction: 11,
};

const EXPAND_ANIMATION = {
  duration: 300,
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.scaleY,
  },
};

export function AddModal(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { isVisible, closeModal } = useAddModal();

  // Animation values
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const modalTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Internal visibility state for animation
  const [isRendered, setIsRendered] = useState(false);

  // View state
  const [currentView, setCurrentView] = useState<ModalView>('main');

  // Import view state
  const [url, setUrl] = useState('');
  const [selectedCookbookId, setSelectedCookbookId] = useState<Id<'cookbooks'> | null>(null);
  const [cookbookError, setCookbookError] = useState(false);

  // Recipe extraction
  const { extractRecipe, status, progress, error, reset: resetExtraction } = useRecipeExtraction();

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

  // Handle modal open/close animations
  useEffect(() => {
    if (isVisible) {
      setIsRendered(true);
      // Animate in
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.spring(modalTranslateY, {
          toValue: 0,
          ...SPRING_CONFIG,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (isRendered) {
      // Animate out
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: ANIMATION_DURATION - 100,
          useNativeDriver: true,
        }),
        Animated.timing(modalTranslateY, {
          toValue: SCREEN_HEIGHT,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsRendered(false);
        // Reset state after animation
        resetState();
      });
    }
  }, [isVisible]);

  const resetState = () => {
    setCurrentView('main');
    setUrl('');
    setSelectedCookbookId(null);
    setCookbookError(false);
    resetExtraction();
    setSelectedRecipeId(null);
    setShareSearchQuery('');
    setEaseRating(0);
    setTasteRating(0);
    setPresentationRating(0);
    setShareNotes('');
  };

  // Handle view transitions with smooth expansion animation
  const animateToView = (newView: ModalView) => {
    LayoutAnimation.configureNext(EXPAND_ANIMATION);
    setCurrentView(newView);
    // Focus input when navigating to import view
    if (newView === 'import') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

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

  const handleImport = async () => {
    if (!url.trim()) return;

    if (!selectedCookbookId) {
      setCookbookError(true);
      return;
    }

    const result = await extractRecipe(url.trim(), selectedCookbookId);
    if (result) {
      closeModal();
    }
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

  const isLoading = status === 'checking' || status === 'extracting' || status === 'saving' || shareIsLoading;
  const canImport = url.trim().length > 0 && selectedCookbookId && !isLoading;

  const getStatusMessage = useCallback(() => {
    switch (status) {
      case 'checking':
        return extractionCopy.checking;
      case 'extracting':
        return progress?.message ?? extractionCopy.extracting;
      case 'saving':
        return extractionCopy.saving;
      default:
        return copy.importUrl.importing;
    }
  }, [status, progress?.message]);

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
            editable={!isLoading}
            returnKeyType="done"
          />
          {url.length > 0 && !isLoading && (
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
          disabled={isLoading}
          error={cookbookError}
        />
      </View>

      {/* Progress indicator */}
      {isLoading && (
        <View style={styles.progressSection}>
          <View style={styles.progressRow}>
            <ActivityIndicator size="small" color={Colors.accent} />
            <Text style={styles.progressText}>{getStatusMessage()}</Text>
          </View>
          {status === 'extracting' && progress && (
            <View style={styles.progressBarContainer}>
              <Animated.View
                style={[
                  styles.progressBar,
                  { width: `${Math.round(progress.percent * 100)}%` },
                ]}
              />
            </View>
          )}
        </View>
      )}

      {/* Error display */}
      {error && (
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={16} color={Colors.semantic.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Import Button */}
      <Pressable
        style={[
          styles.importButton,
          canImport && styles.importButtonActive,
          isLoading && styles.importButtonLoading,
        ]}
        onPress={handleImport}
        disabled={!canImport}
        accessibilityRole="button"
        accessibilityLabel={copy.importUrl.submitActive}
        accessibilityState={{ disabled: !canImport }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          {isLoading ? (
            <ActivityIndicator size="small" color={Colors.text.inverse} />
          ) : (
            <>
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
            </>
          )}
        </View>
      </Pressable>
    </>
  );

  const canShare = selectedRecipeId && easeRating > 0 && tasteRating > 0 && presentationRating > 0;

  const renderSharePostView = () => (
    <>
      {/* Search Bar */}
      <View style={styles.inputGroup}>
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
      </View>

      {/* Recipe Selection */}
      <View style={styles.inputGroup}>
        {userRecipes && userRecipes.length > 0 ? (
          <ScrollView
            style={styles.recipeList}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {filteredRecipes.length > 0 ? (
              filteredRecipes.map((recipe) => (
                <Pressable
                  key={recipe._id}
                  style={[
                    styles.recipeOption,
                    selectedRecipeId === recipe._id && styles.recipeOptionSelected,
                  ]}
                  onPress={() => setSelectedRecipeId(recipe._id)}
                  disabled={shareIsLoading}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Text style={[
                      styles.recipeOptionText,
                      selectedRecipeId === recipe._id && styles.recipeOptionTextSelected,
                    ]} numberOfLines={1}>
                      {recipe.title}
                    </Text>
                    {selectedRecipeId === recipe._id && (
                      <Icon name="check" size={20} color={Colors.accent} />
                    )}
                  </View>
                </Pressable>
              ))
            ) : (
              <View style={styles.noResultsContainer}>
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

      {/* Ratings - only show when recipe is selected */}
      {selectedRecipeId ? (
        <>
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
      ) : (
        <View style={styles.selectRecipeHint}>
          <Text style={styles.selectRecipeHintText}>{copy.sharePost.selectRecipeFirst}</Text>
        </View>
      )}

      {/* Submit Button */}
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

            {/* Content */}
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={[
                styles.scrollContent,
                { paddingBottom: Math.max(insets.bottom, Spacing.lg) + Spacing.md },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              {currentView === 'main' && renderMainView()}
              {currentView === 'import' && renderImportView()}
              {currentView === 'share' && renderSharePostView()}
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
    overflow: 'hidden',
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
    marginTop: Spacing.lg,
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
});
