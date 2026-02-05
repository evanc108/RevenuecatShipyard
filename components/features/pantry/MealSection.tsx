import { MealRecipeCard } from '@/components/features/pantry/MealRecipeCard';
import type { IconName } from '@/components/ui/Icon';
import { Icon } from '@/components/ui/Icon';
import { COPY } from '@/constants/copy';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import type { Id } from '@/convex/_generated/dataModel';
import type { MealType } from '@/stores/useMealPlanStore';
import { useRouter } from 'expo-router';
import { memo, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type MealEntry = {
	_id: Id<'mealPlanEntries'>;
	mealType: string;
	sortOrder: number;
	recipe: {
		_id: Id<'recipes'>;
		title: string;
		imageUrl?: string;
		cuisine?: string;
		totalTimeMinutes?: number;
		difficulty?: string | number;
		calories?: number;
	};
};

type MealSectionProps = {
	mealType: MealType;
	entries: MealEntry[];
	onAddPress: () => void;
	onRemoveEntry: (entryId: Id<'mealPlanEntries'>) => void;
};

const MEAL_ICON_MAP: Record<MealType, IconName> = {
	breakfast: 'sun',
	lunch: 'utensils',
	dinner: 'moon',
	snack: 'cookie'
};

function MealSectionComponent({
	mealType,
	entries,
	onAddPress,
	onRemoveEntry
}: MealSectionProps): React.ReactElement {
	const router = useRouter();
	const iconName = MEAL_ICON_MAP[mealType];
	const label = COPY.pantry.mealPlan.mealTypes[mealType];

	const totalCalories = useMemo(
		() =>
			entries.reduce(
				(sum, entry) => sum + (entry.recipe.calories ?? 0),
				0
			),
		[entries]
	);

	const handleRecipePress = useCallback(
		(recipeId: Id<'recipes'>) => {
			router.push(`/recipe/${recipeId}`);
		},
		[router]
	);

	const handleRemove = useCallback(
		(entryId: Id<'mealPlanEntries'>) => {
			onRemoveEntry(entryId);
		},
		[onRemoveEntry]
	);

	return (
		<View style={styles.container}>
			{/* Section Header */}
			<View style={styles.header}>
				<View style={styles.headerLeft}>
					<Icon name={iconName} size={18} color={Colors.accent} />
					<Text style={styles.label}>{label}</Text>
					{totalCalories > 0 ? (
						<View style={styles.calorieBadge}>
							<Icon
								name="flame"
								size={12}
								color={Colors.accent}
							/>
							<Text style={styles.calorieText}>
								{totalCalories} cal
							</Text>
						</View>
					) : null}
				</View>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={`Add recipe to ${label}`}
					onPress={onAddPress}
					hitSlop={8}
					style={styles.addButton}
				>
					<Text style={styles.addButtonText}>+ ADD</Text>
				</Pressable>
			</View>

			{/* Recipe Cards List */}
			{entries.length > 0 ? (
				<View style={styles.list}>
					{entries.map((entry) => (
						<MealRecipeCard
							key={entry._id}
							entryId={entry._id}
							recipe={entry.recipe}
							onPress={() => handleRecipePress(entry.recipe._id)}
							onRemove={handleRemove}
						/>
					))}
				</View>
			) : null}

			{/* Bottom divider */}
			<View style={styles.bottomDivider} />
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		gap: Spacing.sm
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between'
	},
	headerLeft: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Spacing.sm
	},
	label: {
		...Typography.h3,
		color: Colors.text.primary
	},
	calorieBadge: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Spacing.xs,
		paddingHorizontal: Spacing.sm,
		paddingVertical: 2,
		backgroundColor: Colors.background.primary,
		borderWidth: 1,
		borderColor: Colors.accentDark,
		borderRadius: Radius.full
	},
	calorieText: {
		...Typography.caption,
		color: Colors.accent,
		fontWeight: '600'
	},
	addButton: {
		paddingVertical: Spacing.xs,
		paddingHorizontal: Spacing.md,
		backgroundColor: Colors.background.primary,
		borderWidth: 1,
		borderColor: Colors.accentDark,
		borderRadius: Radius.full
	},
	addButtonText: {
		...Typography.caption,
		color: Colors.accent,
		fontWeight: '600',
		letterSpacing: 0.5
	},
	list: {
		gap: Spacing.sm,
		marginTop: Spacing.xs
	},
	bottomDivider: {
		height: 1,
		backgroundColor: Colors.border,
		marginTop: Spacing.xs
	}
});

export const MealSection = memo(MealSectionComponent);
