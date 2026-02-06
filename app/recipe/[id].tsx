import { CookbookSelectionModal } from '@/components/cookbook/CookbookSelectionModal';
import type { IconName } from '@/components/ui/Icon';
import { Icon } from '@/components/ui/Icon';
import { Loading } from '@/components/ui/Loading';
import { COPY } from '@/constants/copy';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSubscription, type PaywallFeature } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/ui/PaywallModal';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// --- Constants ---

const copy = COPY.recipeDetail;
const HERO_HEIGHT = 360;
const CONTENT_OVERLAP = 28;
const SERVINGS_BUTTON_SIZE = 36;
const STAR_SIZE = 28;
const STAR_COLOR_ACTIVE = '#FFB800';
const INGREDIENT_IMAGE_SIZE = 44;
const NAV_BUTTON_SIZE = 40;
const HEADER_BUTTON_SIZE = 38;
const NAV_ICON_STROKE = 2.5;
const NAV_EXPANDED_HEIGHT = NAV_BUTTON_SIZE * 5 + Spacing.xs * 2;
const FLOATING_BAR_HEIGHT = 56;

const PASTEL_COLORS: readonly string[] = [
	'#E0D6FF',
	'#FFD6E0',
	'#D6E8FF',
	'#D6FFE8',
	'#FFE8D6',
	'#FFF5D6',
	'#D6F0E0',
	'#FFE0D6'
] as const;

const CATEGORY_COLORS = {
	protein: '#FFE0E0',
	vegetable: '#E0F5E0',
	fruit: '#FFF5D6',
	dairy: '#DEE8FF',
	other: '#F5F5F7'
} as const;

type IngredientCategory = keyof typeof CATEGORY_COLORS;

const JUMP_SECTIONS: { key: string; icon: IconName }[] = [
	{ key: 'top', icon: 'arrow-up' },
	{ key: 'nutrition', icon: 'flame' },
	{ key: 'ingredients', icon: 'apple' },
	{ key: 'instructions', icon: 'book-open' }
];

const DIFFICULTY_MAP: Record<string, number> = {
	easy: 1,
	medium: 2,
	moderate: 2,
	intermediate: 3,
	hard: 4,
	difficult: 4,
	expert: 5
};

// --- Helper Functions ---

function getPastelForTitle(title: string): string {
	const hash = title
		.split('')
		.reduce((acc, char) => acc + char.charCodeAt(0), 0);
	return PASTEL_COLORS[hash % PASTEL_COLORS.length] ?? PASTEL_COLORS[0];
}

function parseDifficulty(difficulty?: string | number): number {
	if (difficulty === undefined || difficulty === null) return 0;
	if (typeof difficulty === 'number')
		return Math.min(5, Math.max(1, Math.round(difficulty)));
	const mapped = DIFFICULTY_MAP[difficulty.toLowerCase()];
	if (mapped !== undefined) return mapped;
	const num = parseInt(difficulty, 10);
	if (!isNaN(num) && num >= 1 && num <= 5) return num;
	return 3;
}

function getIngredientCategory(
	category?: string,
	name?: string
): IngredientCategory {
	const has = (text: string, keys: string[]): boolean =>
		keys.some((k) => text.includes(k));

	if (category) {
		const cat = category.toLowerCase();
		if (has(cat, ['protein', 'meat', 'poultry', 'seafood', 'fish', 'egg']))
			return 'protein';
		if (has(cat, ['vegetable', 'produce', 'veg'])) return 'vegetable';
		if (has(cat, ['fruit'])) return 'fruit';
		if (has(cat, ['dairy', 'milk', 'cheese'])) return 'dairy';
		return 'other';
	}

	if (name) {
		const lower = name.toLowerCase();
		if (
			has(lower, [
				'chicken',
				'beef',
				'pork',
				'lamb',
				'turkey',
				'fish',
				'salmon',
				'tuna',
				'shrimp',
				'prawn',
				'egg',
				'bacon',
				'sausage',
				'steak',
				'tofu',
				'tempeh',
				'duck',
				'veal',
				'crab',
				'lobster',
				'scallop'
			])
		)
			return 'protein';
		if (
			has(lower, [
				'onion',
				'garlic',
				'tomato',
				'pepper',
				'carrot',
				'celery',
				'broccoli',
				'spinach',
				'kale',
				'lettuce',
				'potato',
				'mushroom',
				'zucchini',
				'cucumber',
				'corn',
				'peas',
				'cabbage',
				'cauliflower',
				'asparagus',
				'eggplant',
				'squash',
				'artichoke',
				'leek',
				'scallion',
				'shallot',
				'beet',
				'radish',
				'turnip'
			])
		)
			return 'vegetable';
		if (
			has(lower, [
				'lemon',
				'lime',
				'orange',
				'apple',
				'banana',
				'berry',
				'strawberry',
				'blueberry',
				'raspberry',
				'mango',
				'pineapple',
				'avocado',
				'coconut',
				'grape',
				'peach',
				'pear',
				'cherry',
				'plum',
				'fig',
				'date',
				'melon',
				'kiwi',
				'pomegranate',
				'cranberry'
			])
		)
			return 'fruit';
		if (
			has(lower, [
				'milk',
				'cream',
				'cheese',
				'yogurt',
				'butter',
				'sour cream',
				'whey',
				'ricotta',
				'mozzarella',
				'parmesan',
				'cheddar'
			])
		)
			return 'dairy';
	}

	return 'other';
}

function getIngredientImageUrl(name: string): string {
	const mainName = name.split(/[,(]/)[0].trim();
	const formatted = mainName
		.split(' ')
		.map(
			(word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
		)
		.join(' ');
	return `https://www.themealdb.com/images/ingredients/${encodeURIComponent(formatted)}-Small.png`;
}

// --- Sub-components ---

type IngredientCardProps = {
	name: string;
	rawText: string;
	quantity: number;
	unit: string;
	preparation?: string;
	category?: string;
	isOptional?: boolean;
	servingsMultiplier: number;
	formatQuantity: (qty: number) => string;
};

const IngredientCard = memo(function IngredientCard({
	name,
	rawText,
	quantity,
	unit,
	preparation,
	category,
	isOptional,
	servingsMultiplier,
	formatQuantity
}: IngredientCardProps) {
	const ingredientCategory = getIngredientCategory(category, name);
	const bgColor = CATEGORY_COLORS[ingredientCategory];
	const imageUrl = getIngredientImageUrl(name);

	const displayText =
		servingsMultiplier !== 1 && quantity > 0
			? `${formatQuantity(quantity)} ${unit}${preparation ? `, ${preparation}` : ''}`
			: rawText;

	return (
		<View
			style={[ingStyles.card, { backgroundColor: bgColor }]}
			accessibilityLabel={`${name}${isOptional ? ', optional' : ''}`}
		>
			<View style={ingStyles.imageCircle}>
				<Text style={ingStyles.imageFallback}>
					{name.charAt(0).toUpperCase()}
				</Text>
				<Image
					source={{ uri: imageUrl }}
					style={StyleSheet.absoluteFillObject}
					contentFit="contain"
					cachePolicy="memory-disk"
				/>
			</View>
			<View style={ingStyles.info}>
				<Text style={ingStyles.name} numberOfLines={1}>
					{name}
					{isOptional ? (
						<Text style={ingStyles.optional}> (optional)</Text>
					) : null}
				</Text>
				<Text style={ingStyles.detail} numberOfLines={1}>
					{displayText}
				</Text>
			</View>
		</View>
	);
});

const ingStyles = StyleSheet.create({
	card: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: Spacing.sm + 4,
		paddingHorizontal: Spacing.sm + 2,
		borderRadius: Radius.lg,
		marginBottom: Spacing.sm
	},
	imageCircle: {
		width: INGREDIENT_IMAGE_SIZE,
		height: INGREDIENT_IMAGE_SIZE,
		borderRadius: INGREDIENT_IMAGE_SIZE / 2,
		backgroundColor: 'rgba(255,255,255,0.7)',
		alignItems: 'center',
		justifyContent: 'center',
		overflow: 'hidden',
		marginRight: Spacing.sm
	},
	imageFallback: {
		fontSize: 16,
		fontWeight: '700',
		color: Colors.text.primary
	},
	info: {
		flex: 1,
		gap: 2
	},
	name: {
		...Typography.label,
		fontWeight: '700',
		color: Colors.text.primary
	},
	detail: {
		...Typography.bodySmall,
		color: Colors.text.primary
	},
	optional: {
		fontWeight: '400',
		fontStyle: 'italic',
		color: Colors.text.tertiary
	}
});

function DifficultyStars({
	difficulty
}: {
	difficulty: number;
}): React.ReactElement {
	return (
		<View style={{ flexDirection: 'row', gap: 2 }}>
			{[1, 2, 3, 4, 5].map((star) => (
				<Icon
					key={star}
					name="star"
					size={14}
					color={
						star <= difficulty
							? STAR_COLOR_ACTIVE
							: Colors.text.disabled
					}
					filled={star <= difficulty}
				/>
			))}
		</View>
	);
}

function SectionDivider({ title }: { title: string }): React.ReactElement {
	return (
		<View style={divStyles.container}>
			<Text style={divStyles.title}>{title}</Text>
		</View>
	);
}

const divStyles = StyleSheet.create({
	container: {
		marginTop: Spacing.xl,
		marginBottom: Spacing.md
	},
	title: {
		...Typography.h3,
		color: Colors.text.primary,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 0.5
	}
});

// --- Main Component ---

export default function RecipeDetailScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const recipeId = id as Id<'recipes'>;

	const recipe = useQuery(
		api.recipes.get,
		recipeId ? { id: recipeId } : 'skip'
	);
	const userRating = useQuery(
		api.recipes.getUserRating,
		recipeId ? { recipeId } : 'skip'
	);
	const rateMutation = useMutation(api.recipes.rate);
	const myPost = useQuery(
		api.posts.getMyPostForRecipe,
		recipeId ? { recipeId } : 'skip'
	);
	const updatePostMutation = useMutation(api.posts.update);
	const isInCookbook = useQuery(
		api.cookbooks.isRecipeInAnyCookbook,
		recipeId ? { recipeId } : 'skip'
	);
	const addToCookbookMutation = useMutation(api.cookbooks.addRecipe);

	const { isPro } = useSubscription();
	const [paywallFeature, setPaywallFeature] = useState<PaywallFeature | null>(null);

	const [servingsMultiplier, setServingsMultiplier] = useState(1);
	const [isSaveModalVisible, setIsSaveModalVisible] = useState(false);
	const [isSavingToCookbook, setIsSavingToCookbook] = useState(false);
	const [jumpMenuOpen, setJumpMenuOpen] = useState(false);
	const menuProgress = useSharedValue(0);

	const navPillStyle = useAnimatedStyle(() => ({
		height: interpolate(
			menuProgress.value,
			[0, 1],
			[NAV_BUTTON_SIZE, NAV_EXPANDED_HEIGHT]
		)
	}));

	// Review edit state
	const [isEditing, setIsEditing] = useState(false);
	const [editEase, setEditEase] = useState(0);
	const [editTaste, setEditTaste] = useState(0);
	const [editPresentation, setEditPresentation] = useState(0);
	const [editNotes, setEditNotes] = useState('');
	const [isSaving, setIsSaving] = useState(false);

	// Section scroll refs
	const scrollViewRef = useRef<ScrollView>(null);
	const contentBoxY = useRef(0);
	const sectionYMap = useRef<Record<string, number>>({});

	useEffect(() => {
		if (myPost) {
			setEditEase(myPost.easeRating);
			setEditTaste(myPost.tasteRating);
			setEditPresentation(myPost.presentationRating);
			setEditNotes(myPost.notes ?? '');
		}
	}, [myPost]);

	const originalServings = recipe?.servings ?? 1;
	const adjustedServings = Math.round(originalServings * servingsMultiplier);

	const adjustServings = (delta: number) => {
		const next = servingsMultiplier + delta;
		if (next >= 0.25 && next <= 10) {
			setServingsMultiplier(next);
		}
	};

	const formatQuantity = useCallback(
		(qty: number): string => {
			const adjusted = qty * servingsMultiplier;
			if (adjusted === Math.floor(adjusted)) return adjusted.toString();
			const rounded = Math.round(adjusted * 100) / 100;
			if (Math.abs(rounded - 0.25) < 0.01) return '\u00BC';
			if (Math.abs(rounded - 0.33) < 0.01) return '\u2153';
			if (Math.abs(rounded - 0.5) < 0.01) return '\u00BD';
			if (Math.abs(rounded - 0.67) < 0.01) return '\u2154';
			if (Math.abs(rounded - 0.75) < 0.01) return '\u00BE';
			return rounded.toString();
		},
		[servingsMultiplier]
	);

	const handleRate = async (value: number) => {
		if (!recipeId) return;
		await rateMutation({ recipeId, value });
	};

	const handleSaveReview = async () => {
		if (!myPost) return;
		setIsSaving(true);
		try {
			await updatePostMutation({
				postId: myPost._id,
				easeRating: editEase,
				tasteRating: editTaste,
				presentationRating: editPresentation,
				notes: editNotes || undefined
			});
			setIsEditing(false);
		} finally {
			setIsSaving(false);
		}
	};

	const handleCancelEdit = () => {
		if (myPost) {
			setEditEase(myPost.easeRating);
			setEditTaste(myPost.tasteRating);
			setEditPresentation(myPost.presentationRating);
			setEditNotes(myPost.notes ?? '');
		}
		setIsEditing(false);
	};

	const handleSaveToCookbook = useCallback(
		async (cookbookId: Id<'cookbooks'>) => {
			if (!recipeId || isSavingToCookbook) return;
			setIsSavingToCookbook(true);
			try {
				await addToCookbookMutation({ cookbookId, recipeId });
				setIsSaveModalVisible(false);
			} finally {
				setIsSavingToCookbook(false);
			}
		},
		[recipeId, addToCookbookMutation, isSavingToCookbook]
	);

	const handleSectionLayout = useCallback((section: string, y: number) => {
		sectionYMap.current[section] = y;
	}, []);

	const scrollToSection = useCallback(
		(section: string) => {
			setJumpMenuOpen(false);
			menuProgress.value = withTiming(0, { duration: 200 });
			if (section === 'top') {
				scrollViewRef.current?.scrollTo({ y: 0, animated: true });
				return;
			}
			const sectionY = sectionYMap.current[section];
			if (sectionY !== undefined) {
				const targetY = contentBoxY.current + sectionY - Spacing.md;
				scrollViewRef.current?.scrollTo({
					y: Math.max(0, targetY),
					animated: true
				});
			}
		},
		[menuProgress]
	);

	const toggleJumpMenu = useCallback(() => {
		setJumpMenuOpen((prev) => {
			const nextOpen = !prev;
			menuProgress.value = nextOpen
				? withTiming(1, { duration: 250 })
				: withTiming(0, { duration: 200 });
			return nextOpen;
		});
	}, [menuProgress]);

	// --- Early Returns ---

	if (!recipeId) {
		return (
			<View style={styles.container}>
				<View style={styles.centeredContainer}>
					<Text style={styles.errorText}>{copy.notFound}</Text>
				</View>
			</View>
		);
	}

	if (recipe === undefined) {
		return (
			<View style={styles.container}>
				<View style={styles.centeredContainer}>
					<Loading size="large" />
				</View>
			</View>
		);
	}

	if (recipe === null) {
		return (
			<View style={styles.container}>
				{/* Floating header for null state */}
				<View
					style={[
						styles.floatingHeader,
						{ paddingTop: insets.top + Spacing.sm }
					]}
				>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel="Go back"
						onPress={() => router.back()}
						hitSlop={12}
						style={styles.headerBackButton}
					>
						<Icon
							name="arrow-back"
							size={22}
							color={Colors.text.primary}
							strokeWidth={2}
						/>
					</Pressable>
				</View>
				<View style={styles.centeredContainer}>
					<Text style={styles.errorText}>{copy.notFound}</Text>
				</View>
			</View>
		);
	}

	// --- Computed Values ---

	const hasImage = Boolean(recipe.imageUrl);
	const hasNutrition = Boolean(
		recipe.calories ??
		recipe.proteinGrams ??
		recipe.carbsGrams ??
		recipe.fatGrams
	);
	const hasDietaryTags = Boolean(
		recipe.dietaryTags && recipe.dietaryTags.length > 0
	);
	const hasEquipment = Boolean(
		recipe.equipment && recipe.equipment.length > 0
	);
	const difficultyLevel = parseDifficulty(recipe.difficulty);
	const heroHeight = HERO_HEIGHT + insets.top;

	// Build quick info items — key info in black
	const quickInfoItems: React.ReactNode[] = [];
	if (recipe.creatorName) {
		quickInfoItems.push(
			<Text key="creator" style={styles.quickInfoTextBlack}>
				{recipe.creatorName}
			</Text>
		);
	}
	if (recipe.totalTimeMinutes) {
		quickInfoItems.push(
			<View key="time" style={styles.quickInfoItem}>
				<Icon name="clock" size={14} color={Colors.text.primary} />
				<Text style={styles.quickInfoTextBlack}>
					{copy.minutes(recipe.totalTimeMinutes)}
				</Text>
			</View>
		);
	}
	if (recipe.servings) {
		quickInfoItems.push(
			<View key="servings" style={styles.quickInfoItem}>
				<Icon name="users" size={14} color={Colors.text.primary} />
				<Text style={styles.quickInfoTextBlack}>
					{adjustedServings} {copy.servings.label.toLowerCase()}
				</Text>
			</View>
		);
	}
	if (difficultyLevel > 0) {
		quickInfoItems.push(
			<View key="difficulty">
				<DifficultyStars difficulty={difficultyLevel} />
			</View>
		);
	}
	if (recipe.cuisine) {
		quickInfoItems.push(
			<Text key="cuisine" style={styles.quickInfoCuisine}>
				{recipe.cuisine}
			</Text>
		);
	}

	// --- Render ---

	return (
		<View style={styles.container}>
			{/* Scrollable Content — image extends to very top */}
			<ScrollView
				ref={scrollViewRef}
				style={styles.scrollView}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
			>
				{/* Hero Image — full bleed to top edge of screen */}
				<View style={[styles.heroContainer, { height: heroHeight }]}>
					{hasImage ? (
						<Image
							source={{ uri: recipe.imageUrl ?? undefined }}
							style={styles.heroImage}
							contentFit="cover"
							transition={300}
							cachePolicy="memory-disk"
						/>
					) : (
						<View
							style={[
								styles.heroFallback,
								{
									backgroundColor: getPastelForTitle(
										recipe.title
									)
								}
							]}
						>
							<Icon
								name="utensils"
								size={48}
								color={Colors.text.tertiary}
							/>
						</View>
					)}
				</View>

				{/* Content Box — rounded top, overlaps image bottom */}
				<View
					style={styles.contentBox}
					onLayout={(e) => {
						contentBoxY.current = e.nativeEvent.layout.y;
					}}
				>
					{/* Title */}
					<Text
						style={styles.title}
						numberOfLines={3}
						ellipsizeMode="tail"
					>
						{recipe.title}
					</Text>

					{/* Quick Info Row — key info in black */}
					{quickInfoItems.length > 0 ? (
						<View style={styles.quickInfoRow}>
							{quickInfoItems.map((item, idx) => (
								<View
									key={idx}
									style={styles.quickInfoItemWrapper}
								>
									{idx > 0 ? (
										<Text style={styles.quickInfoDot}>
											{'\u2022'}
										</Text>
									) : null}
									{item}
								</View>
							))}
						</View>
					) : null}

					{/* Dietary tags — inline in header area */}
					{hasDietaryTags ? (
						<View style={styles.dietaryRow}>
							{recipe.dietaryTags?.map((tag) => (
								<View key={tag} style={styles.dietaryTag}>
									<Text style={styles.dietaryTagText}>
										{tag}
									</Text>
								</View>
							))}
						</View>
					) : null}

					{/* Description */}
					{recipe.description ? (
						<Text style={styles.descriptionText}>
							{recipe.description}
						</Text>
					) : null}

					{/* Your Review */}
					{myPost ? (
						<>
							<SectionDivider title={copy.yourReview.title} />
							<View style={styles.reviewSection}>
								<View style={styles.reviewHeader}>
									{isEditing ? (
										<Pressable
											accessibilityRole="button"
											accessibilityLabel="Cancel editing"
											onPress={handleCancelEdit}
											hitSlop={8}
										>
											<Icon
												name="close"
												size={20}
												color={Colors.text.tertiary}
											/>
										</Pressable>
									) : (
										<Pressable
											accessibilityRole="button"
											accessibilityLabel="Edit review"
											onPress={() => setIsEditing(true)}
											hitSlop={8}
										>
											<Icon
												name="pencil"
												size={18}
												color={Colors.accent}
											/>
										</Pressable>
									)}
								</View>

								{/* Ease Rating */}
								<View style={styles.reviewRatingRow}>
									<Text style={styles.reviewRatingLabel}>
										{copy.yourReview.ease}
									</Text>
									<View style={styles.starsRow}>
										{[1, 2, 3, 4, 5].map((star) => {
											const value = isEditing
												? editEase
												: myPost.easeRating;
											return (
												<Pressable
													key={star}
													accessibilityRole="button"
													accessibilityLabel={`Rate ease ${star} stars`}
													onPress={() =>
														isEditing &&
														setEditEase(star)
													}
													disabled={!isEditing}
													hitSlop={{
														top: 4,
														bottom: 4,
														left: 2,
														right: 2
													}}
												>
													<Icon
														name={
															star <= value
																? 'star'
																: 'star-outline'
														}
														size={20}
														color={
															star <= value
																? STAR_COLOR_ACTIVE
																: Colors.text
																		.tertiary
														}
													/>
												</Pressable>
											);
										})}
									</View>
								</View>

								{/* Taste Rating */}
								<View style={styles.reviewRatingRow}>
									<Text style={styles.reviewRatingLabel}>
										{copy.yourReview.taste}
									</Text>
									<View style={styles.starsRow}>
										{[1, 2, 3, 4, 5].map((star) => {
											const value = isEditing
												? editTaste
												: myPost.tasteRating;
											return (
												<Pressable
													key={star}
													accessibilityRole="button"
													accessibilityLabel={`Rate taste ${star} stars`}
													onPress={() =>
														isEditing &&
														setEditTaste(star)
													}
													disabled={!isEditing}
													hitSlop={{
														top: 4,
														bottom: 4,
														left: 2,
														right: 2
													}}
												>
													<Icon
														name={
															star <= value
																? 'star'
																: 'star-outline'
														}
														size={20}
														color={
															star <= value
																? STAR_COLOR_ACTIVE
																: Colors.text
																		.tertiary
														}
													/>
												</Pressable>
											);
										})}
									</View>
								</View>

								{/* Presentation Rating */}
								<View style={styles.reviewRatingRow}>
									<Text style={styles.reviewRatingLabel}>
										{copy.yourReview.presentation}
									</Text>
									<View style={styles.starsRow}>
										{[1, 2, 3, 4, 5].map((star) => {
											const value = isEditing
												? editPresentation
												: myPost.presentationRating;
											return (
												<Pressable
													key={star}
													accessibilityRole="button"
													accessibilityLabel={`Rate presentation ${star} stars`}
													onPress={() =>
														isEditing &&
														setEditPresentation(
															star
														)
													}
													disabled={!isEditing}
													hitSlop={{
														top: 4,
														bottom: 4,
														left: 2,
														right: 2
													}}
												>
													<Icon
														name={
															star <= value
																? 'star'
																: 'star-outline'
														}
														size={20}
														color={
															star <= value
																? STAR_COLOR_ACTIVE
																: Colors.text
																		.tertiary
														}
													/>
												</Pressable>
											);
										})}
									</View>
								</View>

								{/* Notes */}
								<View style={styles.reviewNotesContainer}>
									<Text style={styles.reviewNotesLabel}>
										{copy.yourReview.notes}
									</Text>
									{isEditing ? (
										<TextInput
											style={styles.reviewNotesInput}
											value={editNotes}
											onChangeText={setEditNotes}
											multiline
											placeholder={
												copy.yourReview.noNotes
											}
											placeholderTextColor={
												Colors.text.tertiary
											}
										/>
									) : (
										<Text style={styles.reviewNotesText}>
											{myPost.notes ||
												copy.yourReview.noNotes}
										</Text>
									)}
								</View>

								{/* Save Button */}
								{isEditing ? (
									<Pressable
										accessibilityRole="button"
										accessibilityLabel="Save review"
										style={[
											styles.saveButton,
											isSaving &&
												styles.saveButtonDisabled
										]}
										onPress={handleSaveReview}
										disabled={isSaving}
									>
										<Text style={styles.saveButtonText}>
											{isSaving
												? copy.yourReview.saving
												: copy.yourReview.save}
										</Text>
									</Pressable>
								) : null}
							</View>
						</>
					) : null}

					{/* Nutrition */}
					{hasNutrition ? (
						<View
							onLayout={(e) =>
								handleSectionLayout(
									'nutrition',
									e.nativeEvent.layout.y
								)
							}
						>
							<SectionDivider title={copy.nutrition.title} />
							<View style={styles.nutritionGrid}>
								{recipe.calories ? (
									<View style={styles.nutritionStat}>
										<Text style={styles.nutritionValue}>
											{Math.round(
												recipe.calories *
													servingsMultiplier
											)}
										</Text>
										<Text style={styles.nutritionStatLabel}>
											{copy.nutrition.calories}
										</Text>
									</View>
								) : null}
								{recipe.proteinGrams ? (
									<View style={styles.nutritionStat}>
										<Text style={styles.nutritionValue}>
											{Math.round(
												recipe.proteinGrams *
													servingsMultiplier
											)}
											g
										</Text>
										<Text style={styles.nutritionStatLabel}>
											{copy.nutrition.protein}
										</Text>
									</View>
								) : null}
								{recipe.carbsGrams ? (
									<View style={styles.nutritionStat}>
										<Text style={styles.nutritionValue}>
											{Math.round(
												recipe.carbsGrams *
													servingsMultiplier
											)}
											g
										</Text>
										<Text style={styles.nutritionStatLabel}>
											{copy.nutrition.carbs}
										</Text>
									</View>
								) : null}
								{recipe.fatGrams ? (
									<View style={styles.nutritionStat}>
										<Text style={styles.nutritionValue}>
											{Math.round(
												recipe.fatGrams *
													servingsMultiplier
											)}
											g
										</Text>
										<Text style={styles.nutritionStatLabel}>
											{copy.nutrition.fat}
										</Text>
									</View>
								) : null}
							</View>
							<Text style={styles.nutritionNote}>
								{copy.nutrition.perServing}
							</Text>
						</View>
					) : null}

					{/* Ingredients */}
					<View
						onLayout={(e) =>
							handleSectionLayout(
								'ingredients',
								e.nativeEvent.layout.y
							)
						}
					>
						<SectionDivider
							title={`${copy.ingredients} (${recipe.ingredients.length})`}
						/>

						{recipe.servings ? (
							<View style={styles.servingsRow}>
								<Pressable
									accessibilityRole="button"
									accessibilityLabel="Decrease servings"
									style={[
										styles.servingsButton,
										servingsMultiplier <= 0.25 &&
											styles.servingsButtonDisabled
									]}
									onPress={() => adjustServings(-0.5)}
									disabled={servingsMultiplier <= 0.25}
								>
									<Icon
										name="minus"
										size={18}
										color={Colors.text.inverse}
									/>
								</Pressable>
								<View style={styles.servingsDisplay}>
									<Text style={styles.servingsCount}>
										{adjustedServings}
									</Text>
									{servingsMultiplier !== 1 ? (
										<Text style={styles.servingsOriginal}>
											{copy.servings.was(
												originalServings
											)}
										</Text>
									) : null}
								</View>
								<Pressable
									accessibilityRole="button"
									accessibilityLabel="Increase servings"
									style={[
										styles.servingsButton,
										servingsMultiplier >= 10 &&
											styles.servingsButtonDisabled
									]}
									onPress={() => adjustServings(0.5)}
									disabled={servingsMultiplier >= 10}
								>
									<Icon
										name="plus"
										size={18}
										color={Colors.text.inverse}
									/>
								</Pressable>
								{servingsMultiplier !== 1 ? (
									<Pressable
										accessibilityRole="button"
										accessibilityLabel="Reset to original servings"
										onPress={() => setServingsMultiplier(1)}
										hitSlop={8}
										style={styles.resetButton}
									>
										<Text style={styles.resetLink}>
											{copy.servings.reset}
										</Text>
									</Pressable>
								) : null}
							</View>
						) : null}

						{recipe.ingredients.map((ing, idx) => (
							<IngredientCard
								key={`${ing.name}-${idx}`}
								name={ing.name}
								rawText={ing.rawText}
								quantity={ing.quantity}
								unit={ing.unit}
								preparation={ing.preparation}
								category={ing.category}
								isOptional={ing.optional}
								servingsMultiplier={servingsMultiplier}
								formatQuantity={formatQuantity}
							/>
						))}
					</View>

					{/* Instructions */}
					<View
						onLayout={(e) =>
							handleSectionLayout(
								'instructions',
								e.nativeEvent.layout.y
							)
						}
					>
						<SectionDivider
							title={`${copy.instructions} (${recipe.instructions.length})`}
						/>

						{recipe.instructions.map((inst) => (
							<View
								key={inst.stepNumber}
								style={styles.instructionCard}
							>
								<Text style={styles.stepNumber}>
									{inst.stepNumber}
								</Text>
								<Text style={styles.instructionText}>
									{inst.text}
								</Text>

								{inst.tip ? (
									<View style={styles.tipContainer}>
										<Icon
											name="info"
											size={16}
											color={Colors.text.secondary}
										/>
										<Text style={styles.tipText}>
											{inst.tip}
										</Text>
									</View>
								) : null}

								{inst.temperature || inst.timeSeconds ? (
									<View style={styles.instructionMeta}>
										{inst.temperature ? (
											<View
												style={
													styles.instructionMetaItem
												}
											>
												<Icon
													name="flame"
													size={14}
													color={Colors.accent}
												/>
												<Text
													style={
														styles.instructionMetaText
													}
												>
													{inst.temperature}
												</Text>
											</View>
										) : null}
										{inst.timeSeconds ? (
											<View
												style={
													styles.instructionMetaItem
												}
											>
												<Icon
													name="clock"
													size={14}
													color={Colors.text.tertiary}
												/>
												<Text
													style={
														styles.instructionMetaText
													}
												>
													{Math.ceil(
														inst.timeSeconds / 60
													)}{' '}
													min
												</Text>
											</View>
										) : null}
									</View>
								) : null}
							</View>
						))}
					</View>

					{/* Equipment — only if present, no dietary section here anymore */}
					{hasEquipment ? (
						<>
							<SectionDivider title={copy.equipment} />
							<View style={styles.tagsTextSection}>
								<Text style={styles.tagsText}>
									{recipe.equipment?.join('  \u2022  ')}
								</Text>
							</View>
						</>
					) : null}

					{/* Rating */}
					<SectionDivider title={copy.rateThisRecipe} />
					<View style={styles.ratingSection}>
						<View style={styles.starsRow}>
							{[1, 2, 3, 4, 5].map((star) => {
								const filled =
									userRating != null && star <= userRating;
								return (
									<Pressable
										key={star}
										accessibilityRole="button"
										accessibilityLabel={`Rate ${star} star${star > 1 ? 's' : ''}`}
										onPress={() => handleRate(star)}
										hitSlop={{
											top: 8,
											bottom: 8,
											left: 4,
											right: 4
										}}
									>
										<Icon
											name="star"
											size={STAR_SIZE}
											color={
												filled
													? STAR_COLOR_ACTIVE
													: Colors.text.tertiary
											}
											filled={filled}
										/>
									</Pressable>
								);
							})}
						</View>
						{recipe.averageRating !== undefined &&
						recipe.averageRating !== null ? (
							<Text style={styles.avgRatingText}>
								{copy.communityAverage(recipe.averageRating)}
							</Text>
						) : null}
					</View>

					{/* Source Footer */}
					<View style={styles.sourceFooter}>
						<View style={styles.sourceDivider} />
						<Text style={styles.sourceText}>
							{copy.extractedVia} {recipe.methodUsed} {copy.tier}
						</Text>
						{recipe.url ? (
							<Pressable
								accessibilityRole="link"
								accessibilityLabel="Open source URL"
								onPress={() => Linking.openURL(recipe.url)}
								hitSlop={8}
							>
								<View style={styles.sourceLinkRow}>
									<Text
										style={styles.sourceLink}
										numberOfLines={1}
										ellipsizeMode="middle"
									>
										{recipe.url}
									</Text>
									<Icon
										name="external-link"
										size={14}
										color={Colors.accent}
									/>
								</View>
							</Pressable>
						) : null}
					</View>
				</View>
			</ScrollView>

			{/* Floating Action Bar — Cook + Meal Plan */}
			<View
				style={[
					styles.floatingBar,
					{ paddingBottom: insets.bottom + Spacing.sm }
				]}
			>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={copy.cook}
					style={styles.floatingButtonCook}
					onPress={() => {
						if (!isPro) {
							setPaywallFeature('cook');
							return;
						}
						router.push(`/recipe/cook/${recipeId}`);
					}}
				>
					<Icon name="flame" size={18} color={Colors.text.inverse} />
					<Text style={styles.floatingButtonText}>{copy.cook}</Text>
				</Pressable>
				{isInCookbook === false ? (
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={copy.saveToCookbook}
						style={styles.floatingButtonMealPlan}
						onPress={() => setIsSaveModalVisible(true)}
					>
						<Icon
							name="bookmark"
							size={18}
							color={Colors.text.primary}
						/>
						<Text style={styles.floatingButtonMealPlanText}>
							{copy.saveToCookbook}
						</Text>
					</Pressable>
				) : (
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={copy.mealPlan}
						style={styles.floatingButtonMealPlan}
						onPress={() => {
							if (!isPro) {
								setPaywallFeature('mealPlan');
								return;
							}
							// TODO: meal plan action
						}}
					>
						<Icon
							name="calendar"
							size={18}
							color={Colors.text.primary}
						/>
						<Text style={styles.floatingButtonMealPlanText}>
							{copy.mealPlan}
						</Text>
					</Pressable>
				)}
			</View>

			{/* Floating Header — overlays on top of hero image */}
			<View
				style={[
					styles.floatingHeader,
					{ paddingTop: insets.top + Spacing.sm }
				]}
			>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Go back"
					onPress={() => router.back()}
					hitSlop={12}
					style={styles.headerBackButton}
				>
					<Icon
						name="arrow-back"
						size={24}
						color={Colors.text.inverse}
						strokeWidth={2.5}
					/>
				</Pressable>

				<View style={styles.headerRight}>
					<Animated.View style={[styles.navPill, navPillStyle]}>
						{/* Menu toggle — always visible at top */}
						<Pressable
							accessibilityRole="button"
							accessibilityLabel="Jump to section"
							onPress={toggleJumpMenu}
							style={styles.navPillItem}
						>
							<Icon
								name={jumpMenuOpen ? 'close' : 'menu'}
								size={20}
								color={Colors.text.inverse}
								strokeWidth={NAV_ICON_STROKE}
							/>
						</Pressable>

						{/* Section shortcuts — revealed as pill expands */}
						{JUMP_SECTIONS.map((section) => (
							<Pressable
								key={section.key}
								style={styles.navPillItem}
								onPress={() => scrollToSection(section.key)}
								accessibilityRole="button"
								accessibilityLabel={`Go to ${section.key}`}
							>
								<Icon
									name={section.icon}
									size={20}
									color={Colors.text.inverse}
									strokeWidth={NAV_ICON_STROKE}
								/>
							</Pressable>
						))}
					</Animated.View>
				</View>
			</View>

			{/* Backdrop to close expanded nav */}
			{jumpMenuOpen ? (
				<Pressable
					style={styles.jumpBackdrop}
					onPress={() => {
						setJumpMenuOpen(false);
						menuProgress.value = withTiming(0, { duration: 200 });
					}}
					accessibilityRole="button"
					accessibilityLabel="Close menu"
				/>
			) : null}

			{/* Save to Cookbook modal */}
			<CookbookSelectionModal
				visible={isSaveModalVisible}
				recipe={
					recipe
						? {
								title: recipe.title,
								imageUrl: recipe.imageUrl,
								url: recipe.url
							}
						: null
				}
				onClose={() => setIsSaveModalVisible(false)}
				onSelect={handleSaveToCookbook}
				isLoading={isSavingToCookbook}
			/>

			{/* Paywall Modal */}
			<PaywallModal
				visible={paywallFeature !== null}
				onClose={() => setPaywallFeature(null)}
				feature={paywallFeature ?? 'cook'}
			/>
		</View>
	);
}

// --- Styles ---

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background.primary
	},
	scrollView: {
		flex: 1
	},
	scrollContent: {
		paddingBottom: FLOATING_BAR_HEIGHT + Spacing.xxl + Spacing.lg
	},
	centeredContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: Spacing.lg
	},
	errorText: {
		...Typography.body,
		color: Colors.text.primary,
		textAlign: 'center'
	},

	// Floating header — absolutely positioned over hero image
	floatingHeader: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		flexDirection: 'row',
		alignItems: 'flex-start',
		justifyContent: 'space-between',
		paddingHorizontal: Spacing.lg,
		paddingBottom: Spacing.sm,
		zIndex: 10
	},
	headerBackButton: {
		width: HEADER_BUTTON_SIZE,
		height: NAV_BUTTON_SIZE,
		alignItems: 'center',
		justifyContent: 'center'
	},
	headerRight: {
		flexDirection: 'row',
		alignItems: 'flex-start'
	},
	navPill: {
		width: NAV_BUTTON_SIZE,
		borderRadius: NAV_BUTTON_SIZE / 2,
		backgroundColor: Colors.text.primary,
		alignItems: 'center',
		overflow: 'hidden',
		zIndex: 52
	},
	navPillItem: {
		width: NAV_BUTTON_SIZE,
		height: NAV_BUTTON_SIZE,
		alignItems: 'center',
		justifyContent: 'center'
	},

	// Hero — full bleed
	heroContainer: {
		overflow: 'hidden'
	},
	heroImage: {
		...StyleSheet.absoluteFillObject
	},
	heroFallback: {
		...StyleSheet.absoluteFillObject,
		alignItems: 'center',
		justifyContent: 'center'
	},

	// Content Box — rounded top corners, overlaps image
	contentBox: {
		backgroundColor: Colors.background.primary,
		borderTopLeftRadius: Radius.xl,
		borderTopRightRadius: Radius.xl,
		marginTop: -CONTENT_OVERLAP,
		paddingHorizontal: Spacing.lg,
		paddingTop: Spacing.lg,
		paddingBottom: Spacing.lg
	},

	// Title
	title: {
		...Typography.h1,
		color: Colors.text.primary
	},

	// Quick Info Row — key information in black
	quickInfoRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		alignItems: 'center',
		marginTop: Spacing.md,
		gap: Spacing.xs
	},
	quickInfoItemWrapper: {
		flexDirection: 'row',
		alignItems: 'center'
	},
	quickInfoItem: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Spacing.xs
	},
	quickInfoTextBlack: {
		...Typography.bodySmall,
		color: Colors.text.primary,
		fontWeight: '600'
	},
	quickInfoDot: {
		...Typography.bodySmall,
		color: Colors.text.tertiary,
		marginHorizontal: Spacing.xs
	},
	quickInfoCuisine: {
		...Typography.bodySmall,
		color: Colors.accent,
		fontWeight: '600'
	},

	// Dietary tags — inline in header area
	dietaryRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: Spacing.xs,
		marginTop: Spacing.sm
	},
	dietaryTag: {
		backgroundColor: Colors.background.secondary,
		borderRadius: Radius.full,
		paddingHorizontal: Spacing.sm + 2,
		paddingVertical: Spacing.xs
	},
	dietaryTagText: {
		...Typography.caption,
		color: Colors.text.primary
	},

	// Description
	descriptionText: {
		...Typography.body,
		color: Colors.text.secondary,
		marginTop: Spacing.md
	},

	// Review Section
	reviewSection: {
		backgroundColor: Colors.background.secondary,
		borderRadius: Radius.md,
		padding: Spacing.md
	},
	reviewHeader: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		marginBottom: Spacing.sm
	},
	reviewRatingRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: Spacing.sm
	},
	reviewRatingLabel: {
		...Typography.body,
		color: Colors.text.primary,
		width: 100
	},
	starsRow: {
		flexDirection: 'row',
		gap: Spacing.xs
	},
	reviewNotesContainer: {
		marginTop: Spacing.sm
	},
	reviewNotesLabel: {
		...Typography.caption,
		color: Colors.text.primary,
		marginBottom: Spacing.xs
	},
	reviewNotesText: {
		...Typography.body,
		color: Colors.text.primary,
		fontStyle: 'italic'
	},
	reviewNotesInput: {
		...Typography.body,
		color: Colors.text.primary,
		backgroundColor: Colors.background.primary,
		borderRadius: Radius.sm,
		padding: Spacing.sm,
		minHeight: 80,
		textAlignVertical: 'top'
	},
	saveButton: {
		backgroundColor: Colors.accent,
		borderRadius: Radius.sm,
		paddingVertical: Spacing.sm,
		alignItems: 'center',
		marginTop: Spacing.md
	},
	saveButtonDisabled: {
		opacity: 0.6
	},
	saveButtonText: {
		...Typography.label,
		color: Colors.text.inverse
	},

	// Rating
	ratingSection: {
		alignItems: 'center',
		paddingVertical: Spacing.sm
	},
	avgRatingText: {
		...Typography.caption,
		color: Colors.text.primary,
		marginTop: Spacing.sm
	},

	// Nutrition
	nutritionGrid: {
		flexDirection: 'row',
		justifyContent: 'space-around'
	},
	nutritionStat: {
		alignItems: 'center',
		minWidth: 60
	},
	nutritionValue: {
		...Typography.h3,
		color: Colors.accent
	},
	nutritionStatLabel: {
		...Typography.caption,
		color: Colors.text.primary,
		marginTop: 2
	},
	nutritionNote: {
		...Typography.caption,
		color: Colors.text.primary,
		textAlign: 'center',
		marginTop: Spacing.sm
	},

	// Servings Adjuster
	servingsRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Spacing.sm,
		marginBottom: Spacing.md
	},
	servingsButton: {
		width: SERVINGS_BUTTON_SIZE,
		height: SERVINGS_BUTTON_SIZE,
		borderRadius: SERVINGS_BUTTON_SIZE / 2,
		backgroundColor: Colors.text.primary,
		alignItems: 'center',
		justifyContent: 'center'
	},
	servingsButtonDisabled: {
		backgroundColor: Colors.text.disabled
	},
	servingsDisplay: {
		alignItems: 'center',
		minWidth: 28
	},
	servingsCount: {
		...Typography.label,
		color: Colors.text.primary,
		textAlign: 'center'
	},
	servingsOriginal: {
		...Typography.caption,
		color: Colors.text.primary,
		fontSize: 10
	},
	resetButton: {
		marginLeft: 'auto'
	},
	resetLink: {
		...Typography.caption,
		color: Colors.accent
	},

	// Instructions — centered card list with shadow and bold step numbers
	instructionCard: {
		backgroundColor: Colors.background.primary,
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.md,
		marginBottom: Spacing.md,
		borderRadius: Radius.xl,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.15,
		shadowRadius: 12,
		elevation: 8
	},
	stepNumber: {
		fontSize: 32,
		fontWeight: '900',
		color: Colors.text.primary,
		marginBottom: Spacing.xs
	},
	instructionText: {
		...Typography.body,
		color: Colors.text.primary
	},
	tipContainer: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		backgroundColor: Colors.background.secondary,
		borderRadius: Radius.sm,
		padding: Spacing.sm,
		marginTop: Spacing.sm,
		gap: Spacing.sm
	},
	tipText: {
		...Typography.bodySmall,
		color: Colors.text.secondary,
		flex: 1
	},
	instructionMeta: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: Spacing.md,
		marginTop: Spacing.sm
	},
	instructionMetaItem: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Spacing.xs
	},
	instructionMetaText: {
		...Typography.caption,
		color: Colors.text.secondary
	},

	// Tags — plain text, no pills
	tagsTextSection: {
		marginBottom: Spacing.sm
	},
	tagsText: {
		...Typography.body,
		color: Colors.text.primary,
		lineHeight: 24
	},

	// Source Footer
	sourceFooter: {
		marginTop: Spacing.xl
	},
	sourceDivider: {
		height: StyleSheet.hairlineWidth,
		backgroundColor: Colors.border,
		marginBottom: Spacing.md
	},
	sourceText: {
		...Typography.bodySmall,
		color: Colors.text.primary
	},
	sourceLinkRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Spacing.xs,
		marginTop: Spacing.xs
	},
	sourceLink: {
		...Typography.caption,
		color: Colors.accent,
		flex: 1
	},

	// Floating Action Bar
	floatingBar: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		flexDirection: 'row',
		paddingHorizontal: Spacing.lg,
		paddingTop: Spacing.sm,
		gap: Spacing.md,
		...Shadow.elevated
	},
	floatingButtonCook: {
		flex: 1,
		height: FLOATING_BAR_HEIGHT,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: Spacing.sm,
		backgroundColor: Colors.accent,
		borderRadius: Radius.full,
		...Shadow.elevated
	},
	floatingButtonText: {
		...Typography.label,
		color: Colors.text.inverse,
		fontWeight: '700'
	},
	floatingButtonMealPlan: {
		flex: 1,
		height: FLOATING_BAR_HEIGHT,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: Spacing.sm,
		backgroundColor: Colors.background.secondary,
		borderRadius: Radius.full,
		...Shadow.elevated
	},
	floatingButtonMealPlanText: {
		...Typography.label,
		color: Colors.text.primary,
		fontWeight: '700'
	},

	// Backdrop — closes expanded nav pill
	jumpBackdrop: {
		...StyleSheet.absoluteFillObject,
		zIndex: 50
	}
});
