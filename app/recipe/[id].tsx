import { CookbookSelectionModal } from '@/components/cookbook/CookbookSelectionModal';
import { MealPlanPickerModal } from '@/components/cookbook/MealPlanPickerModal';
import { Icon } from '@/components/ui/Icon';
import { Loading } from '@/components/ui/Loading';
import { RateRecipeModal } from '@/components/ui/RateRecipeModal';
import { COPY } from '@/constants/copy';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { getIngredientImageUrl } from '@/utils/ingredientImage';
import { useMutation, useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSubscription, type PaywallFeature } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/ui/PaywallModal';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// --- Constants ---

const copy = COPY.recipeDetail;
const HERO_HEIGHT = 360;
const CONTENT_OVERLAP = 28;
const SERVINGS_BUTTON_SIZE = 36;
const STAR_COLOR_ACTIVE = '#FFB800';
const INGREDIENT_IMAGE_SIZE = 44;
const NAV_BUTTON_SIZE = 40;
const NAV_ICON_STROKE = 2.5;
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

const DIFFICULTY_MAP: Record<string, number> = {
	easy: 1,
	medium: 2,
	moderate: 2,
	intermediate: 3,
	hard: 4,
	difficult: 4,
	expert: 5
};

const DIFFICULTY_LABELS: Record<number, string> = {
	1: 'Easy',
	2: 'Medium',
	3: 'Intermediate',
	4: 'Hard',
	5: 'Expert',
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
	if (typeof difficulty === 'number') {
		if (difficulty <= 0) return 0;
		return Math.min(5, Math.max(1, Math.round(difficulty)));
	}
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
	const [imageError, setImageError] = useState(false);
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
			<View style={ingStyles.imageContainer}>
				{imageError ? (
					<View style={[ingStyles.imageFallback, { backgroundColor: bgColor }]}>
						<Text style={ingStyles.imageFallbackText}>
							{name.charAt(0).toUpperCase()}
						</Text>
					</View>
				) : (
					<Image
						source={{ uri: imageUrl }}
						style={ingStyles.ingredientImage}
						contentFit="contain"
						cachePolicy="memory-disk"
						onError={() => setImageError(true)}
					/>
				)}
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
	imageContainer: {
		width: INGREDIENT_IMAGE_SIZE,
		height: INGREDIENT_IMAGE_SIZE,
		marginRight: Spacing.sm
	},
	ingredientImage: {
		width: '100%',
		height: '100%'
	},
	imageFallback: {
		width: '100%',
		height: '100%',
		borderRadius: Radius.md,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
		borderColor: 'rgba(0,0,0,0.08)'
	},
	imageFallbackText: {
		fontSize: 20,
		fontWeight: '700',
		color: Colors.text.secondary
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
	const addToGrocery = useMutation(api.groceryList.addFromRecipe);
	const removeFromGrocery = useMutation(api.groceryList.removeRecipeSource);
	const isInGroceryList = useQuery(
		api.groceryList.isRecipeInGroceryList,
		recipeId ? { recipeId } : 'skip'
	);

	const { isPro } = useSubscription();
	const [paywallFeature, setPaywallFeature] = useState<PaywallFeature | null>(null);

	const [servingsMultiplier, setServingsMultiplier] = useState(1);
	const [isSaveModalVisible, setIsSaveModalVisible] = useState(false);
	const [isSavingToCookbook, setIsSavingToCookbook] = useState(false);
	const [isRateModalVisible, setIsRateModalVisible] = useState(false);
	const [isMealPlanVisible, setIsMealPlanVisible] = useState(false);
	const [groceryLoading, setGroceryLoading] = useState(false);
	const [showGroceryOverlay, setShowGroceryOverlay] = useState(false);
	const [groceryOverlayText, setGroceryOverlayText] = useState('');

	// Grocery confirmation overlay animation
	const groceryOverlayOpacity = useSharedValue(0);
	const groceryIconScale = useSharedValue(0);
	const groceryIconTranslateY = useSharedValue(20);

	// Review edit state
	const [isEditing, setIsEditing] = useState(false);
	const [editEase, setEditEase] = useState(0);
	const [editTaste, setEditTaste] = useState(0);
	const [editPresentation, setEditPresentation] = useState(0);
	const [editNotes, setEditNotes] = useState('');
	const [isSaving, setIsSaving] = useState(false);

	// Section scroll refs
	const scrollViewRef = useRef<ScrollView>(null);

	useEffect(() => {
		if (myPost) {
			setEditEase(myPost.easeRating);
			setEditTaste(myPost.tasteRating);
			setEditPresentation(myPost.presentationRating);
			setEditNotes(myPost.notes ?? '');
		}
	}, [myPost]);

	// Grocery overlay animated styles
	const groceryOverlayAnimatedStyle = useAnimatedStyle(() => ({
		opacity: groceryOverlayOpacity.value
	}));

	const groceryIconAnimatedStyle = useAnimatedStyle(() => ({
		transform: [
			{ scale: groceryIconScale.value },
			{ translateY: groceryIconTranslateY.value }
		]
	}));

	const playGroceryOverlay = useCallback(
		(text: string) => {
			setGroceryOverlayText(text);
			setShowGroceryOverlay(true);

			groceryOverlayOpacity.value = withSequence(
				withTiming(1, { duration: 200 }),
				withDelay(1200, withTiming(0, { duration: 300 }))
			);

			groceryIconScale.value = withSequence(
				withTiming(0, { duration: 0 }),
				withTiming(1.2, { duration: 250 }),
				withSpring(1, { damping: 10, stiffness: 200 }),
				withDelay(700, withTiming(0, { duration: 200 }))
			);

			groceryIconTranslateY.value = withSequence(
				withTiming(20, { duration: 0 }),
				withSpring(0, { damping: 8, stiffness: 150 })
			);

			setTimeout(() => setShowGroceryOverlay(false), 1800);
		},
		[groceryOverlayOpacity, groceryIconScale, groceryIconTranslateY]
	);

	const handleGroceryToggle = useCallback(async () => {
		if (groceryLoading || !recipeId) return;
		setGroceryLoading(true);
		try {
			if (isInGroceryList) {
				await removeFromGrocery({ recipeId });
				playGroceryOverlay(copy.groceryRemoved);
			} else {
				await addToGrocery({ recipeId, servingsMultiplier });
				playGroceryOverlay(copy.groceryAdded);
			}
		} finally {
			setGroceryLoading(false);
		}
	}, [
		recipeId,
		servingsMultiplier,
		addToGrocery,
		removeFromGrocery,
		isInGroceryList,
		groceryLoading,
		playGroceryOverlay
	]);

	const originalServings = recipe?.servings ?? 1;
	const adjustedServings = Math.round(originalServings * servingsMultiplier);

	const adjustServings = (delta: number) => {
		const newServings = adjustedServings + delta;
		if (newServings >= 1 && newServings <= originalServings * 10) {
			setServingsMultiplier(newServings / originalServings);
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
				playGroceryOverlay(copy.savedToCookbook);
			} finally {
				setIsSavingToCookbook(false);
			}
		},
		[recipeId, addToCookbookMutation, isSavingToCookbook, playGroceryOverlay]
	);

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
							size={20}
							color={Colors.text.inverse}
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
	if (difficultyLevel > 0 && DIFFICULTY_LABELS[difficultyLevel]) {
		quickInfoItems.push(
			<Text key="difficulty" style={styles.quickInfoTextBlack}>
				{DIFFICULTY_LABELS[difficultyLevel]}
			</Text>
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

					{/* Nutrition */}
					{hasNutrition ? (
						<View>
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
					<View>
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
										adjustedServings <= 1 &&
											styles.servingsButtonDisabled
									]}
									onPress={() => adjustServings(-1)}
									disabled={adjustedServings <= 1}
								>
									<Icon
										name="minus"
										size={18}
										color={Colors.text.inverse}
									/>
								</Pressable>
								<View style={styles.servingsDisplay}>
									<Text style={styles.servingsCount}>
										{adjustedServings} {copy.servings.label.toLowerCase()}
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
										adjustedServings >= originalServings * 10 &&
											styles.servingsButtonDisabled
									]}
									onPress={() => adjustServings(1)}
									disabled={adjustedServings >= originalServings * 10}
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
					<View>
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

					{/* Your Review or Rate This Recipe */}
					{myPost ? (
						<View>
							<SectionDivider title={copy.yourReview.title} />
							<View style={styles.reviewSectionFlat}>
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
																: Colors.text.tertiary
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
																: Colors.text.tertiary
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
														setEditPresentation(star)
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
																: Colors.text.tertiary
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
											placeholder={copy.yourReview.noNotes}
											placeholderTextColor={Colors.text.tertiary}
										/>
									) : (
										<Text style={styles.reviewNotesText}>
											{myPost.notes || copy.yourReview.noNotes}
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
											isSaving && styles.saveButtonDisabled
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
						</View>
					) : (
						<View style={styles.ratingSection}>
							<Pressable
								accessibilityRole="button"
								accessibilityLabel="Rate this recipe"
								style={styles.rateButton}
								onPress={() => setIsRateModalVisible(true)}
							>
								<Icon name="star" size={20} color={Colors.text.inverse} />
								<Text style={styles.rateButtonText}>
									{copy.rateThisRecipe}
								</Text>
							</Pressable>
							{recipe.averageRating !== undefined &&
							recipe.averageRating !== null ? (
								<Text style={styles.avgRatingText}>
									{copy.communityAverage(recipe.averageRating)}
								</Text>
							) : null}
						</View>
					)}

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

			{/* Floating Action Bar — Cook + Save/Meal Plan + Post */}
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
							setIsMealPlanVisible(true);
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
						size={20}
						color={Colors.text.inverse}
						strokeWidth={2}
					/>
				</Pressable>

				<View style={styles.headerRight}>
					{isInCookbook === false ? (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={copy.addToCookbook}
							style={styles.headerCartButton}
							onPress={() => setIsSaveModalVisible(true)}
							hitSlop={8}
						>
							<Icon
								name="plus"
								size={20}
								color={Colors.text.inverse}
								strokeWidth={NAV_ICON_STROKE}
							/>
						</Pressable>
					) : null}
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={isInGroceryList ? copy.addedToCart : copy.addToCart}
						style={[
							styles.headerCartButton,
							isInGroceryList === true && styles.headerCartButtonAdded,
						]}
						onPress={handleGroceryToggle}
						disabled={groceryLoading}
						hitSlop={8}
					>
						{groceryLoading ? (
							<ActivityIndicator size="small" color={Colors.text.inverse} />
						) : (
							<Icon
								name={isInGroceryList ? 'check' : 'cart'}
								size={20}
								color={Colors.text.inverse}
								strokeWidth={NAV_ICON_STROKE}
							/>
						)}
					</Pressable>
				</View>
			</View>

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

			<RateRecipeModal
				visible={isRateModalVisible}
				recipeId={recipeId}
				recipeTitle={recipe?.title ?? ''}
				onClose={() => setIsRateModalVisible(false)}
			/>

			{/* Meal Plan Picker */}
			<MealPlanPickerModal
				visible={isMealPlanVisible}
				recipeId={recipeId}
				recipeTitle={recipe?.title ?? ''}
				onClose={() => setIsMealPlanVisible(false)}
				onSuccess={() => playGroceryOverlay(copy.addedToMealPlan)}
			/>

			{/* Paywall Modal */}
			<PaywallModal
				visible={paywallFeature !== null}
				onClose={() => setPaywallFeature(null)}
				feature={paywallFeature ?? 'cook'}
			/>

			{/* Grocery confirmation overlay */}
			{showGroceryOverlay ? (
				<Animated.View
					style={[styles.groceryOverlay, groceryOverlayAnimatedStyle]}
					pointerEvents="none"
				>
					<Animated.View style={groceryIconAnimatedStyle}>
						<Image
							source={require('@/assets/images/loading_icon.svg')}
							style={styles.groceryOverlayIcon}
							contentFit="contain"
						/>
					</Animated.View>
					<Text style={styles.groceryOverlayText}>
						{groceryOverlayText}
					</Text>
				</Animated.View>
			) : null}
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
		width: NAV_BUTTON_SIZE,
		height: NAV_BUTTON_SIZE,
		borderRadius: NAV_BUTTON_SIZE / 2,
		backgroundColor: Colors.text.primary,
		alignItems: 'center',
		justifyContent: 'center'
	},
	headerRight: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: Spacing.sm,
	},
	headerCartButton: {
		width: NAV_BUTTON_SIZE,
		height: NAV_BUTTON_SIZE,
		borderRadius: NAV_BUTTON_SIZE / 2,
		backgroundColor: Colors.text.primary,
		alignItems: 'center',
		justifyContent: 'center',
	},
	headerCartButtonAdded: {
		backgroundColor: Colors.semantic.success,
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
	reviewSectionFlat: {
		// No background - flat inline style
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
		paddingVertical: Spacing.md
	},
	rateButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: Spacing.sm,
		backgroundColor: Colors.accent,
		borderRadius: Radius.md,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.xl
	},
	rateButtonText: {
		...Typography.label,
		color: Colors.text.inverse,
		fontSize: 16
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

	// Grocery confirmation overlay
	groceryOverlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: '#FFFFFF',
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 999
	},
	groceryOverlayIcon: {
		width: 200,
		height: 200
	},
	groceryOverlayText: {
		...Typography.h3,
		color: Colors.text.primary,
		fontWeight: '700',
		textAlign: 'center',
		marginTop: Spacing.md,
		paddingHorizontal: Spacing.xl
	},
});
