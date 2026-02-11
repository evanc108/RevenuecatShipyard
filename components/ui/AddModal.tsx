import { CookbookDropdown } from '@/components/cookbook/CookbookDropdown';
import { CreateCookbookModal } from '@/components/cookbook/CreateCookbookModal';
import { Icon } from '@/components/ui/Icon';
import { COPY } from '@/constants/copy';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useAddModal } from '@/context/AddModalContext';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useBackgroundExtraction } from '@/hooks/useBackgroundExtraction';
import { useSubscription, type PaywallFeature } from '@/hooks/useSubscription';
import { MODAL_ANIMATION, useModalAnimation } from '@/hooks/useModalAnimation';
import { usePendingUploadsStore } from '@/stores/usePendingUploadsStore';
import { PaywallModal } from '@/components/ui/PaywallModal';
import { useMutation, useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View
} from 'react-native';
import Reanimated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StarRatingInput } from './StarRatingInput';

const cookbookCopy = COPY.extraction.cookbook;

// Enable LayoutAnimation on Android
if (
	Platform.OS === 'android' &&
	UIManager.setLayoutAnimationEnabledExperimental
) {
	UIManager.setLayoutAnimationEnabledExperimental(true);
}

const copy = COPY.addModal;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const DROPDOWN_OPTION_HEIGHT = 44;
const DROPDOWN_VISIBLE_COUNT = 2;

type ModalView = 'main' | 'import' | 'share';

// Layout animation for container expansion - no text animation
const EXPAND_ANIMATION = {
	duration: MODAL_ANIMATION.duration,
	update: {
		type: LayoutAnimation.Types.easeInEaseOut,
		property: LayoutAnimation.Properties.scaleY
	},
	// Don't animate create/delete to prevent text animation
	create: undefined,
	delete: undefined
};

const PASTEL_FALLBACKS: readonly string[] = [
	'#FFE8D6',
	'#D6E8FF',
	'#E0D6FF',
	'#D6FFE8',
	'#FFF5D6',
	'#FFD6E0',
	'#D6F0E0',
	'#FFE0D6'
] as const;

function getRecipeCardColor(title: string): string {
	const hash = title
		.split('')
		.reduce((acc, char) => acc + char.charCodeAt(0), 0);
	return (
		PASTEL_FALLBACKS[hash % PASTEL_FALLBACKS.length] ?? PASTEL_FALLBACKS[0]
	);
}

export function AddModal(): React.ReactElement {
	const insets = useSafeAreaInsets();
	const { isVisible, initialCookbookId, closeModal } = useAddModal();

	// Smooth keyboard animation using Reanimated
	const keyboard = useAnimatedKeyboard();
	const keyboardStyle = useAnimatedStyle(() => ({
		paddingBottom: keyboard.height.value,
	}));

	// View state
	const [currentView, setCurrentView] = useState<ModalView>('main');

	// Content opacity for instant text transitions (no animation on text)
	const contentOpacity = useRef(new Animated.Value(1)).current;

	// Import view state
	const [url, setUrl] = useState('');
	const [selectedCookbookId, setSelectedCookbookId] =
		useState<Id<'cookbooks'> | null>(null);
	const [cookbookError, setCookbookError] = useState(false);

	// Floating dropdown position (measured from trigger)
	const dropdownTriggerRef = useRef<View>(null);
	const [dropdownPosition, setDropdownPosition] = useState({
		top: 0,
		left: 0,
		width: 0
	});

	// Inline cookbook dropdown state (for main view)
	const [isCookbookDropdownOpen, setIsCookbookDropdownOpen] = useState(false);
	const [showCreateCookbookModal, setShowCreateCookbookModal] =
		useState(false);
	const [isCreatingCookbook, setIsCreatingCookbook] = useState(false);

	// Background extraction
	const { startExtraction, canImportRecipe } = useBackgroundExtraction();
	const addUpload = usePendingUploadsStore((s) => s.addUpload);

	// Subscription
	const { isPro, freeRecipesRemaining } = useSubscription();
	const [showPaywall, setShowPaywall] = useState(false);

	// Get cookbooks to find selected cookbook name
	const cookbooks = useQuery(api.cookbooks.list);
	const createCookbookMutation = useMutation(api.cookbooks.create);

	// Share post view state
	const [selectedRecipeId, setSelectedRecipeId] =
		useState<Id<'recipes'> | null>(null);
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

	// Pre-select cookbook when modal opens with initialCookbookId
	const prevVisibleRef = useRef(false);
	if (isVisible && !prevVisibleRef.current && initialCookbookId) {
		setSelectedCookbookId(initialCookbookId);
		setCurrentView('import');
		// Note: Auto-focus removed to prevent keyboard from appearing during modal slide animation
	}
	prevVisibleRef.current = isVisible;

	// Reset state callback - defined before useModalAnimation
	const resetState = useCallback(() => {
		setCurrentView('main');
		setUrl('');
		setSelectedCookbookId(null);
		setCookbookError(false);
		setIsCookbookDropdownOpen(false);
		setShowCreateCookbookModal(false);
		setSelectedRecipeId(null);
		setShareSearchQuery('');
		setEaseRating(0);
		setTasteRating(0);
		setPresentationRating(0);
		setShareNotes('');
		setShowPaywall(false);
	}, []);

	// Use shared modal animation
	const { isRendered, backdropOpacity, modalTranslateY, animateOut } =
		useModalAnimation({
			visible: isVisible,
			onAnimationComplete: resetState
		});

	// Handle view transitions with smooth expansion animation
	// Container expands smoothly, text appears instantly (no animation on text)
	const animateToView = useCallback(
		(newView: ModalView, { slide = false } = {}) => {
			// Close floating dropdown if open
			setIsCookbookDropdownOpen(false);

			if (slide) {
				// Slide the entire modal down, switch view, then slide back up
				Animated.timing(modalTranslateY, {
					toValue: SCREEN_HEIGHT,
					duration: 250,
					useNativeDriver: true,
				}).start(() => {
					setCurrentView(newView);
					Animated.spring(modalTranslateY, {
						toValue: 0,
						...MODAL_ANIMATION.spring,
						useNativeDriver: true,
					}).start();
				});
			} else {
				// Instantly hide content
				contentOpacity.setValue(0);

				// Configure layout animation for container only
				LayoutAnimation.configureNext(EXPAND_ANIMATION);
				setCurrentView(newView);

				// Instantly show new content after layout settles
				setTimeout(() => {
					contentOpacity.setValue(1);
				}, 16);

				// Note: Auto-focus removed to prevent keyboard from appearing during view transitions
			}
		},
		[contentOpacity, modalTranslateY]
	);

	const handleClose = () => {
		if (isLoading) return;
		setIsCookbookDropdownOpen(false);
		animateOut(() => {
			closeModal();
		});
	};

	const handleBack = () => {
		if (isCookbookContext && currentView === 'import') {
			animateOut(() => {
				closeModal();
			});
		} else if (currentView === 'share') {
			animateToView('main', { slide: true });
		} else {
			animateToView('main');
		}
	};

	const handleCookbookSelect = (id: Id<'cookbooks'>) => {
		setSelectedCookbookId(id);
		setCookbookError(false);
	};

	const handleInlineCookbookSelect = (id: Id<'cookbooks'>) => {
		handleCookbookSelect(id);
		setIsCookbookDropdownOpen(false);
	};

	const handleToggleDropdown = useCallback(() => {
		if (isCookbookDropdownOpen) {
			setIsCookbookDropdownOpen(false);
		} else {
			dropdownTriggerRef.current?.measureInWindow(
				(x, y, width, height) => {
					setDropdownPosition({ top: y + height, left: x, width });
					setIsCookbookDropdownOpen(true);
				}
			);
		}
	}, [isCookbookDropdownOpen]);

	const handleCreateNewCookbook = () => {
		setIsCookbookDropdownOpen(false);
		setShowCreateCookbookModal(true);
	};

	const handleCreateCookbookSubmit = useCallback(
		async (name: string, description?: string, imageUri?: string) => {
			setIsCreatingCookbook(true);
			try {
				const newId = await createCookbookMutation({
					name,
					description,
					coverImageUrl: imageUri
				});
				setShowCreateCookbookModal(false);
				setSelectedCookbookId(newId);
				setCookbookError(false);
			} finally {
				setIsCreatingCookbook(false);
			}
		},
		[createCookbookMutation]
	);

	const handleImport = () => {
		if (!url.trim()) return;

		if (!selectedCookbookId) {
			setCookbookError(true);
			return;
		}

		// Find cookbook name for display in progress indicator
		const selectedCookbook = cookbooks?.find(
			(c) => c._id === selectedCookbookId
		);
		const cookbookName = selectedCookbook?.name ?? 'Cookbook';

		// Add to pending uploads store and start background extraction
		const uploadId = addUpload(
			url.trim(),
			selectedCookbookId,
			cookbookName
		);
		const allowed = startExtraction(uploadId);

		if (!allowed) {
			// Free limit reached — show paywall
			setShowPaywall(true);
			return;
		}

		// Close modal immediately - progress shown in UploadProgressIndicator
		closeModal();
	};

	const handleSharePost = async () => {
		if (
			!selectedRecipeId ||
			easeRating === 0 ||
			tasteRating === 0 ||
			presentationRating === 0
		) {
			return;
		}

		setShareIsLoading(true);
		try {
			await createPost({
				recipeId: selectedRecipeId,
				easeRating,
				tasteRating,
				presentationRating,
				notes: shareNotes.trim() || undefined
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

	const selectedCookbook = cookbooks?.find(
		(c) => c._id === selectedCookbookId
	);

	const renderMainView = () => (
		<View style={styles.optionsContainer}>
			{/* Free imports remaining badge */}
			{!isPro && (
				<View style={styles.freeImportsBadge}>
					<Icon name="info" size={16} color={Colors.accent} />
					<Text style={styles.freeImportsBadgeText}>
						{COPY.subscription.freeRecipesRemaining(freeRecipesRemaining)}
					</Text>
				</View>
			)}

			{/* Import Section Header */}
			<Text style={styles.sectionTitle}>{copy.importUrl.title}</Text>

			{/* Inline Import Section */}
			<View style={styles.inlineImportSection}>
				<View style={styles.inlineImportRow}>
					{/* Left column: URL input + Dropdown trigger */}
					<View style={styles.inlineImportInputs}>
						{/* URL Input */}
						<View style={styles.inlineUrlInputContainer}>
							<Icon
								name="link"
								size={18}
								color={Colors.text.tertiary}
								style={styles.urlIcon}
							/>
							<TextInput
								ref={inputRef}
								style={styles.inlineUrlInput}
								placeholder="URL..."
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
									<Icon
										name="close-circle"
										size={18}
										color={Colors.text.tertiary}
									/>
								</Pressable>
							)}
						</View>

						{/* Cookbook Dropdown Trigger */}
						<View ref={dropdownTriggerRef}>
							<Pressable
								style={[
									styles.inlineDropdownTrigger,
									isCookbookDropdownOpen &&
										styles.inlineDropdownTriggerOpen,
									cookbookError &&
										styles.inlineDropdownTriggerError
								]}
								onPress={handleToggleDropdown}
								accessibilityRole="button"
								accessibilityLabel={cookbookCopy.selectCookbook}
							>
								<Text
									style={[
										styles.inlineDropdownTriggerText,
										!selectedCookbook &&
											styles.inlineDropdownPlaceholder
									]}
									numberOfLines={1}
								>
									{selectedCookbook?.name ??
										cookbookCopy.selectPlaceholder}
								</Text>
								<Icon
									name={
										isCookbookDropdownOpen
											? 'chevron-up'
											: 'chevron-down'
									}
									size={18}
									color={Colors.text.secondary}
								/>
							</Pressable>
						</View>
					</View>

					{/* Right column: Submit button (50%) */}
					<Pressable
						style={[
							styles.inlineSubmitButton,
							canImport && styles.inlineSubmitButtonActive
						]}
						onPress={handleImport}
						disabled={!canImport}
						accessibilityRole="button"
						accessibilityLabel="Import recipe"
						accessibilityState={{ disabled: !canImport }}
					>
						<Icon
							name="arrow-right"
							size={28}
							color={
								canImport
									? Colors.text.inverse
									: Colors.text.disabled
							}
							strokeWidth={2}
						/>
					</Pressable>
				</View>

				{cookbookError && (
					<Text style={styles.inlineDropdownErrorText}>
						{cookbookCopy.required}
					</Text>
				)}
			</View>

			{/* Or Divider */}
			<View style={styles.orDivider}>
				<View style={styles.orDividerLine} />
				<Text style={styles.orDividerText}>or</Text>
				<View style={styles.orDividerLine} />
			</View>

			{/* Share a Cook Option Card */}
			<Pressable
				style={styles.optionCard}
				onPress={() => animateToView('share', { slide: true })}
				accessibilityRole="button"
				accessibilityLabel={copy.options.sharePost}
			>
				<View style={styles.optionCardRow}>
					<View style={styles.optionIconContainerLarge}>
						<Icon
							name="camera"
							size={26}
							color={Colors.accent}
							strokeWidth={2}
						/>
					</View>
					<View style={styles.optionContent}>
						<Text style={styles.optionTitle}>
							{copy.options.sharePost}
						</Text>
						<Text style={styles.optionDescription}>
							{copy.options.sharePostDesc}
						</Text>
					</View>
					<Icon
						name="chevron-forward"
						size={20}
						color={Colors.text.tertiary}
					/>
				</View>
			</Pressable>
		</View>
	);

	// Whether we're in cookbook-context mode (opened from a cookbook page)
	const isCookbookContext = initialCookbookId !== null;

	const renderImportView = () => {
		const urlLabel = isCookbookContext
			? copy.addRecipe.urlLabel
			: copy.importUrl.urlLabel;
		const placeholder = isCookbookContext
			? copy.addRecipe.placeholder
			: copy.importUrl.placeholder;
		const canSubmit = isCookbookContext ? url.trim().length > 0 : canImport;
		const submitLabel = isCookbookContext
			? copy.addRecipe.submit
			: selectedCookbookId
				? copy.importUrl.submitActive
				: copy.importUrl.submit;

		return (
			<>
				{/* Social media hint — only in cookbook context */}
				{isCookbookContext ? (
					<View style={styles.hintContainer}>
						<Icon
							name="share"
							size={18}
							color={Colors.text.tertiary}
						/>
						<Text style={styles.hintText}>
							{copy.addRecipe.hint}
						</Text>
					</View>
				) : null}

				{/* URL Input */}
				<View style={styles.inputGroup}>
					<Text style={styles.inputLabel}>{urlLabel}</Text>
					<View style={styles.urlInputContainer}>
						<Icon
							name="link"
							size={20}
							color={Colors.text.tertiary}
							style={styles.urlIcon}
						/>
						<TextInput
							ref={inputRef}
							style={styles.urlInput}
							placeholder={placeholder}
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
								<Icon
									name="close-circle"
									size={20}
									color={Colors.text.tertiary}
								/>
							</Pressable>
						)}
					</View>
				</View>

				{/* Cookbook Selection — hide when opened from a cookbook page */}
				{!isCookbookContext ? (
					<View style={styles.inputGroup}>
						<CookbookDropdown
							selectedId={selectedCookbookId}
							onSelect={handleCookbookSelect}
							error={cookbookError}
						/>
					</View>
				) : null}

				{/* Import / Add Button */}
				<Pressable
					style={[
						styles.importButton,
						canSubmit && styles.importButtonActive
					]}
					onPress={handleImport}
					disabled={!canSubmit}
					accessibilityRole="button"
					accessibilityLabel={submitLabel}
					accessibilityState={{ disabled: !canSubmit }}
				>
					<View
						style={{
							flexDirection: 'row',
							alignItems: 'center',
							justifyContent: 'center'
						}}
					>
						<Icon
							name="download"
							size={20}
							color={
								canSubmit
									? Colors.text.inverse
									: Colors.text.disabled
							}
						/>
						<Text
							style={[
								styles.importButtonText,
								!canSubmit && styles.importButtonTextDisabled
							]}
						>
							{submitLabel}
						</Text>
					</View>
				</Pressable>
			</>
		);
	};

	const canShare =
		selectedRecipeId &&
		easeRating > 0 &&
		tasteRating > 0 &&
		presentationRating > 0;

	// Get selected recipe details for display
	const selectedRecipe = useMemo(() => {
		if (!selectedRecipeId || !userRecipes) return null;
		return userRecipes.find((r) => r._id === selectedRecipeId) ?? null;
	}, [selectedRecipeId, userRecipes]);

	const renderSharePostView = () => (
		<>
			{/* Recipe Selection Section */}
			<View style={styles.inputGroup}>
				<Text style={styles.inputLabel}>
					{copy.sharePost.selectRecipe}
				</Text>

				{/* Search Bar */}
				<View style={styles.searchInputContainer}>
					<Icon
						name="search"
						size={20}
						color={Colors.text.tertiary}
						style={styles.searchIcon}
					/>
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
							<Icon
								name="close-circle"
								size={20}
								color={Colors.text.tertiary}
							/>
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
										selectedRecipeId === recipe._id &&
											styles.recipeCardSelected
									]}
									onPress={() =>
										setSelectedRecipeId(recipe._id)
									}
									disabled={shareIsLoading}
								>
									<View
										style={[
											styles.recipeCardImage,
											{
												backgroundColor:
													getRecipeCardColor(
														recipe.title
													)
											}
										]}
									>
										{recipe.imageUrl ? (
											<Image
												source={{
													uri: recipe.imageUrl
												}}
												style={
													styles.recipeCardImageFill
												}
												contentFit="cover"
												transition={200}
												cachePolicy="memory-disk"
											/>
										) : (
											<Icon
												name="restaurant-outline"
												size={24}
												color={Colors.text.tertiary}
											/>
										)}
										{selectedRecipeId === recipe._id && (
											<View
												style={
													styles.recipeCardCheckmark
												}
											>
												<Icon
													name="checkmark-circle"
													size={24}
													color={Colors.accent}
												/>
											</View>
										)}
									</View>
									<Text
										style={[
											styles.recipeCardTitle,
											selectedRecipeId === recipe._id &&
												styles.recipeCardTitleSelected
										]}
										numberOfLines={2}
									>
										{recipe.title}
									</Text>
								</Pressable>
							))
						) : (
							<View style={styles.noResultsInline}>
								<Text style={styles.noResultsText}>
									No recipes match "{shareSearchQuery}"
								</Text>
							</View>
						)}
					</ScrollView>
				) : (
					<View style={styles.emptyRecipes}>
						<Icon
							name="book"
							size={32}
							color={Colors.text.tertiary}
						/>
						<Text style={styles.emptyRecipesTitle}>
							{copy.sharePost.noRecipes}
						</Text>
						<Text style={styles.emptyRecipesDesc}>
							{copy.sharePost.noRecipesDesc}
						</Text>
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
				return isCookbookContext
					? copy.addRecipe.title
					: copy.importUrl.title;
			case 'share':
				return copy.sharePost.title;
			default:
				return copy.main.title;
		}
	};

	if (!isRendered) return <></>;

	return (
		<Modal visible transparent animationType="none" statusBarTranslucent>
		<Reanimated.View style={[styles.fullScreen, keyboardStyle]} pointerEvents="box-none">
			<View style={styles.container} pointerEvents="box-none">
				{/* Animated Backdrop */}
				<Animated.View
					style={[styles.backdrop, { opacity: backdropOpacity }]}
				>
					<Pressable
						style={StyleSheet.absoluteFill}
						onPress={handleClose}
					/>
				</Animated.View>

				{/* Animated Modal Content */}
				<Animated.View
					style={[
						styles.modalContainer,
						{
							transform: [{ translateY: modalTranslateY }],
							maxHeight: currentView === 'main' ? '50%' : '90%'
						}
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
									<Icon
										name="arrow-back"
										size={24}
										color={Colors.text.primary}
									/>
								</Pressable>
								<Text style={styles.title}>
									{getModalTitle()}
								</Text>
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
										color={
											isLoading
												? Colors.text.disabled
												: Colors.text.secondary
										}
									/>
								</Pressable>
							</View>
						)}

						{/* Content - wrapped in Animated.View for instant text transitions */}
						<ScrollView
							style={[
								styles.scrollView,
								currentView === 'share' && {
									maxHeight: SCREEN_HEIGHT * 0.65
								}
							]}
							contentContainerStyle={[
								styles.scrollContent,
								currentView !== 'share' && {
									paddingBottom:
										Math.max(insets.bottom, Spacing.lg) +
										Spacing.md
								}
							]}
							showsVerticalScrollIndicator={false}
							keyboardShouldPersistTaps="handled"
							bounces={false}
						>
							<Animated.View style={{ opacity: contentOpacity }}>
								{currentView === 'main' && renderMainView()}
								{currentView === 'import' && renderImportView()}
								{currentView === 'share' &&
									renderSharePostView()}
							</Animated.View>
						</ScrollView>

						{/* Sticky Submit Button for Share View */}
						{currentView === 'share' && (
							<View
								style={[
									styles.stickyButtonContainer,
									{
										paddingBottom: Math.max(
											insets.bottom,
											Spacing.md
										)
									}
								]}
							>
								<Pressable
									style={[
										styles.submitButton,
										canShare && styles.submitButtonActive,
										shareIsLoading &&
											styles.submitButtonLoading
									]}
									onPress={handleSharePost}
									disabled={!canShare || shareIsLoading}
									accessibilityRole="button"
									accessibilityLabel={copy.sharePost.submit}
								>
									{shareIsLoading ? (
										<ActivityIndicator
											size="small"
											color={Colors.text.inverse}
										/>
									) : (
										<Text
											style={[
												styles.submitButtonText,
												!canShare &&
													styles.submitButtonTextDisabled
											]}
										>
											{copy.sharePost.submit}
										</Text>
									)}
								</Pressable>
							</View>
						)}
					</View>
				</Animated.View>
			</View>

			{/* Floating Cookbook Dropdown Overlay */}
			{isCookbookDropdownOpen && (
				<View style={StyleSheet.absoluteFill} pointerEvents="box-none">
					{/* Backdrop to close dropdown on outside tap */}
					<Pressable
						style={StyleSheet.absoluteFill}
						onPress={() => setIsCookbookDropdownOpen(false)}
					/>
					{/* Floating dropdown list */}
					<View
						style={[
							styles.floatingDropdown,
							{
								top: dropdownPosition.top,
								left: dropdownPosition.left,
								width: dropdownPosition.width,
								maxHeight:
									SCREEN_HEIGHT -
									dropdownPosition.top -
									insets.bottom -
									Spacing.md
							}
						]}
					>
						<ScrollView
							style={styles.floatingDropdownScroll}
							showsVerticalScrollIndicator={false}
							nestedScrollEnabled
							keyboardShouldPersistTaps="handled"
							bounces={false}
						>
							{cookbooks && cookbooks.length === 0 ? (
								<View style={styles.floatingDropdownEmpty}>
									<Text
										style={styles.floatingDropdownEmptyText}
									>
										{cookbookCopy.noCookbooks}
									</Text>
								</View>
							) : (
								cookbooks?.map((cookbook) => (
									<Pressable
										key={cookbook._id}
										style={[
											styles.floatingDropdownOption,
											selectedCookbookId ===
												cookbook._id &&
												styles.floatingDropdownOptionSelected
										]}
										onPress={() =>
											handleInlineCookbookSelect(
												cookbook._id
											)
										}
									>
										<Text
											style={[
												styles.floatingDropdownOptionText,
												selectedCookbookId ===
													cookbook._id &&
													styles.floatingDropdownOptionTextSelected
											]}
											numberOfLines={1}
										>
											{cookbook.name}
										</Text>
										{selectedCookbookId ===
											cookbook._id && (
											<Icon
												name="checkmark"
												size={18}
												color={Colors.accent}
											/>
										)}
									</Pressable>
								))
							)}
						</ScrollView>
						{/* Sticky Create New option */}
						<Pressable
							style={styles.floatingDropdownCreateOption}
							onPress={handleCreateNewCookbook}
						>
							<Icon name="plus" size={18} color={Colors.accent} />
							<Text style={styles.floatingDropdownCreateText}>
								{cookbookCopy.createNew}
							</Text>
						</Pressable>
					</View>
				</View>
			)}

			{/* Create Cookbook Modal */}
			<CreateCookbookModal
				visible={showCreateCookbookModal}
				onClose={() => setShowCreateCookbookModal(false)}
				onSubmit={handleCreateCookbookSubmit}
				isLoading={isCreatingCookbook}
			/>

			{/* Paywall Modal */}
			<PaywallModal
				visible={showPaywall}
				onClose={() => setShowPaywall(false)}
				feature="recipeLimit"
			/>
		</Reanimated.View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	fullScreen: {
		...StyleSheet.absoluteFillObject,
	},
	container: {
		flex: 1,
		justifyContent: 'flex-end'
	},
	backdrop: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: Colors.background.overlay
	},
	modalContainer: {
		width: '100%'
	},
	modalContent: {
		backgroundColor: Colors.background.primary,
		borderTopLeftRadius: Radius.xl,
		borderTopRightRadius: Radius.xl
	},
	modalContentFlex: {
		flex: 1
	},
	handleContainer: {
		alignItems: 'center',
		paddingTop: Spacing.sm,
		paddingBottom: Spacing.xs
	},
	handle: {
		width: 36,
		height: 4,
		borderRadius: 2,
		backgroundColor: Colors.border
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingHorizontal: Spacing.lg,
		paddingTop: Spacing.xs,
		paddingBottom: Spacing.md,
		borderBottomWidth: 1,
		borderBottomColor: Colors.border
	},
	backButton: {
		padding: Spacing.xs,
		marginLeft: -Spacing.xs,
		borderRadius: Radius.sm
	},
	title: {
		...Typography.h2,
		color: Colors.text.primary,
		flex: 1,
		textAlign: 'center'
	},
	scrollView: {
		flexGrow: 0
	},
	scrollViewFlex: {
		flex: 1
	},
	scrollContent: {
		paddingHorizontal: Spacing.lg,
		paddingTop: Spacing.lg
	},
	inputGroup: {
		marginBottom: Spacing.md
	},
	inputLabel: {
		...Typography.label,
		color: Colors.text.primary,
		marginBottom: Spacing.sm
	},
	urlInputContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: Colors.background.secondary,
		borderRadius: Radius.md,
		paddingHorizontal: Spacing.md,
		borderWidth: 1,
		borderColor: Colors.border
	},
	urlIcon: {
		marginRight: Spacing.sm
	},
	urlInput: {
		flex: 1,
		...Typography.body,
		color: Colors.text.primary,
		paddingVertical: Spacing.md
	},
	progressSection: {
		backgroundColor: Colors.background.secondary,
		borderRadius: Radius.md,
		padding: Spacing.md,
		marginTop: Spacing.md
	},
	progressRow: {
		flexDirection: 'row',
		alignItems: 'center'
	},
	progressText: {
		...Typography.body,
		color: Colors.text.secondary,
		flex: 1,
		marginLeft: Spacing.sm
	},
	progressBarContainer: {
		height: 4,
		backgroundColor: Colors.border,
		borderRadius: 2,
		overflow: 'hidden',
		marginTop: Spacing.sm
	},
	progressBar: {
		height: '100%',
		backgroundColor: Colors.accent,
		borderRadius: 2
	},
	errorContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#FEE2E2',
		borderRadius: Radius.md,
		padding: Spacing.md,
		marginTop: Spacing.md
	},
	errorText: {
		...Typography.bodySmall,
		color: Colors.semantic.error,
		flex: 1,
		marginLeft: Spacing.sm
	},
	importButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: Colors.background.tertiary,
		borderRadius: Radius.md,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.lg,
		marginTop: Spacing.md
	},
	importButtonActive: {
		backgroundColor: Colors.accent
	},
	importButtonLoading: {
		backgroundColor: Colors.accent,
		opacity: 0.8
	},
	importButtonText: {
		...Typography.label,
		fontSize: 16,
		color: Colors.text.inverse,
		marginLeft: Spacing.sm
	},
	importButtonTextDisabled: {
		color: Colors.text.disabled
	},
	hintContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Spacing.sm,
		backgroundColor: Colors.background.secondary,
		borderRadius: Radius.md,
		padding: Spacing.md,
		marginBottom: Spacing.md
	},
	hintText: {
		...Typography.caption,
		color: Colors.text.secondary,
		flex: 1
	},
	freeImportsBadge: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Spacing.sm,
		backgroundColor: Colors.accent + '12',
		borderRadius: Radius.sm,
		paddingVertical: Spacing.sm,
		paddingHorizontal: Spacing.md,
		marginBottom: Spacing.md,
	},
	freeImportsBadgeText: {
		...Typography.caption,
		color: Colors.accent,
	},
	optionsContainer: {
		marginTop: Spacing.sm
	},
	sectionTitle: {
		...Typography.label,
		color: Colors.text.primary,
		marginBottom: Spacing.sm,
	},
	orDivider: {
		flexDirection: 'row',
		alignItems: 'center',
		marginVertical: Spacing.md,
	},
	orDividerLine: {
		flex: 1,
		height: StyleSheet.hairlineWidth,
		backgroundColor: Colors.border,
	},
	orDividerText: {
		...Typography.caption,
		color: Colors.text.tertiary,
		marginHorizontal: Spacing.md,
	},

	// Inline Import Section
	inlineImportSection: {
		marginBottom: Spacing.md
	},
	inlineImportRow: {
		flexDirection: 'row',
		gap: Spacing.sm
	},
	inlineImportInputs: {
		flex: 5,
		gap: Spacing.sm
	},
	inlineUrlInputContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: Colors.background.secondary,
		borderRadius: Radius.md,
		paddingHorizontal: Spacing.md,
		borderWidth: 1,
		borderColor: Colors.border
	},
	inlineUrlInput: {
		flex: 1,
		...Typography.body,
		fontSize: 14,
		color: Colors.text.primary,
		paddingVertical: Spacing.sm + 2
	},
	inlineDropdownTrigger: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		backgroundColor: Colors.background.secondary,
		borderRadius: Radius.md,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm + 2,
		borderWidth: 1,
		borderColor: Colors.border
	},
	inlineDropdownTriggerOpen: {
		borderBottomLeftRadius: 0,
		borderBottomRightRadius: 0
	},
	inlineDropdownTriggerError: {
		borderColor: Colors.semantic.error
	},
	inlineDropdownTriggerText: {
		...Typography.body,
		fontSize: 14,
		color: Colors.text.primary,
		flex: 1,
		marginRight: Spacing.sm
	},
	inlineDropdownPlaceholder: {
		color: Colors.text.tertiary
	},
	inlineSubmitButton: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: Colors.background.tertiary,
		borderRadius: Radius.md
	},
	inlineSubmitButtonActive: {
		backgroundColor: Colors.accent
	},
	// Floating dropdown styles
	floatingDropdown: {
		position: 'absolute',
		backgroundColor: Colors.background.primary,
		borderWidth: 1,
		borderTopWidth: 0,
		borderColor: Colors.border,
		borderBottomLeftRadius: Radius.md,
		borderBottomRightRadius: Radius.md,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.15,
		shadowRadius: 12,
		elevation: 8
	},
	floatingDropdownScroll: {
		maxHeight: DROPDOWN_OPTION_HEIGHT * DROPDOWN_VISIBLE_COUNT
	},
	floatingDropdownOption: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		height: DROPDOWN_OPTION_HEIGHT,
		paddingHorizontal: Spacing.md,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: Colors.border
	},
	floatingDropdownOptionSelected: {
		backgroundColor: Colors.accent + '12'
	},
	floatingDropdownOptionText: {
		...Typography.body,
		fontSize: 14,
		color: Colors.text.primary,
		flex: 1,
		marginRight: Spacing.sm
	},
	floatingDropdownOptionTextSelected: {
		fontWeight: '600',
		color: Colors.accent
	},
	floatingDropdownCreateOption: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Spacing.sm,
		height: DROPDOWN_OPTION_HEIGHT,
		paddingHorizontal: Spacing.md,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: Colors.border
	},
	floatingDropdownCreateText: {
		...Typography.label,
		fontSize: 14,
		color: Colors.accent
	},
	floatingDropdownEmpty: {
		paddingVertical: Spacing.md,
		alignItems: 'center'
	},
	floatingDropdownEmptyText: {
		...Typography.body,
		fontSize: 14,
		color: Colors.text.tertiary
	},
	inlineDropdownErrorText: {
		...Typography.caption,
		color: Colors.semantic.error,
		marginTop: Spacing.xs
	},

	optionCard: {
		backgroundColor: Colors.background.secondary,
		borderRadius: Radius.md,
		padding: Spacing.md,
		marginBottom: Spacing.sm
	},
	optionCardRow: {
		flexDirection: 'row',
		alignItems: 'center',
		flex: 1
	},
	optionIconContainer: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: Colors.accentLight,
		alignItems: 'center',
		justifyContent: 'center',
		marginRight: Spacing.md
	},
	optionIconContainerLarge: {
		width: 52,
		height: 52,
		borderRadius: Radius.lg,
		backgroundColor: Colors.accent + '20',
		alignItems: 'center',
		justifyContent: 'center',
		marginRight: Spacing.md
	},
	optionContent: {
		flex: 1,
		marginRight: Spacing.sm
	},
	optionTitle: {
		...Typography.label,
		color: Colors.text.primary,
		fontSize: 15
	},
	optionDescription: {
		...Typography.caption,
		color: Colors.text.secondary,
		marginTop: 2
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
		marginTop: Spacing.xs
	},
	textArea: {
		minHeight: 80,
		paddingTop: Spacing.md
	},
	textAreaLarge: {
		minHeight: 120,
		paddingTop: Spacing.md
	},
	submitButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: Colors.background.tertiary,
		borderRadius: Radius.md,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.lg
	},
	submitButtonActive: {
		backgroundColor: Colors.accent
	},
	submitButtonText: {
		...Typography.label,
		fontSize: 16,
		color: Colors.text.inverse,
		marginLeft: Spacing.sm
	},
	submitButtonTextDisabled: {
		color: Colors.text.disabled
	},
	recipeList: {
		maxHeight: 200,
		backgroundColor: Colors.background.secondary,
		borderRadius: Radius.md,
		borderWidth: 1,
		borderColor: Colors.border,
		marginTop: Spacing.sm
	},
	recipeOption: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.md,
		borderBottomWidth: 1,
		borderBottomColor: Colors.border
	},
	recipeOptionSelected: {
		backgroundColor: Colors.accentLight
	},
	recipeOptionText: {
		...Typography.body,
		color: Colors.text.primary,
		flex: 1
	},
	recipeOptionTextSelected: {
		color: Colors.accent,
		fontWeight: '600'
	},
	emptyRecipes: {
		alignItems: 'center',
		paddingVertical: Spacing.xl,
		backgroundColor: Colors.background.secondary,
		borderRadius: Radius.md,
		marginTop: Spacing.sm
	},
	emptyRecipesTitle: {
		...Typography.label,
		color: Colors.text.secondary,
		marginTop: Spacing.md
	},
	emptyRecipesDesc: {
		...Typography.caption,
		color: Colors.text.tertiary,
		marginTop: Spacing.xs
	},
	searchInputContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: Colors.background.secondary,
		borderRadius: Radius.md,
		paddingHorizontal: Spacing.md,
		borderWidth: 1,
		borderColor: Colors.border
	},
	searchIcon: {
		marginRight: Spacing.sm
	},
	searchInput: {
		flex: 1,
		...Typography.body,
		color: Colors.text.primary,
		paddingVertical: Spacing.md
	},
	noResultsContainer: {
		padding: Spacing.lg,
		alignItems: 'center'
	},
	noResultsText: {
		...Typography.body,
		color: Colors.text.tertiary
	},
	ratingsSection: {
		marginBottom: Spacing.md
	},
	selectRecipeHint: {
		backgroundColor: Colors.background.secondary,
		borderRadius: Radius.md,
		padding: Spacing.lg,
		alignItems: 'center',
		marginBottom: Spacing.md
	},
	selectRecipeHintText: {
		...Typography.body,
		color: Colors.text.tertiary
	},
	submitButtonLoading: {
		backgroundColor: Colors.accent,
		opacity: 0.8
	},
	stickyButtonContainer: {
		paddingHorizontal: Spacing.lg,
		paddingTop: Spacing.md,
		borderTopWidth: 1,
		borderTopColor: Colors.border,
		backgroundColor: Colors.background.primary
	},
	shareSubmitButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: Colors.background.tertiary,
		borderRadius: Radius.md,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.lg,
		marginTop: Spacing.lg
	},
	recipeCardsContainer: {
		marginTop: Spacing.md,
		marginHorizontal: -Spacing.lg
	},
	recipeCardsContent: {
		paddingHorizontal: Spacing.lg,
		gap: Spacing.sm
	},
	recipeCard: {
		width: 120,
		borderRadius: Radius.md,
		backgroundColor: Colors.background.secondary,
		overflow: 'hidden',
		borderWidth: 2,
		borderColor: 'transparent'
	},
	recipeCardSelected: {
		borderColor: Colors.accent
	},
	recipeCardImage: {
		width: '100%',
		height: 80,
		alignItems: 'center',
		justifyContent: 'center',
		position: 'relative'
	},
	recipeCardImageFill: {
		width: '100%',
		height: '100%'
	},
	recipeCardCheckmark: {
		position: 'absolute',
		top: Spacing.xs,
		right: Spacing.xs,
		backgroundColor: Colors.background.primary,
		borderRadius: Radius.full
	},
	recipeCardTitle: {
		...Typography.caption,
		color: Colors.text.primary,
		padding: Spacing.sm,
		textAlign: 'center'
	},
	recipeCardTitleSelected: {
		color: Colors.accent,
		fontWeight: '600'
	},
	noResultsInline: {
		width: 200,
		alignItems: 'center',
		justifyContent: 'center',
		padding: Spacing.md
	}
});
