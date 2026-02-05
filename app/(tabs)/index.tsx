import { CookbookCarousel } from '@/components/cookbook/CookbookCarousel';
import { CreateCookbookModal } from '@/components/cookbook/CreateCookbookModal';
import { PendingImportRow } from '@/components/cookbook/PendingImportRow';
import { Icon } from '@/components/ui/Icon';
import { Loading } from '@/components/ui/Loading';
import { Colors, Shadow, Spacing, Typography } from '@/constants/theme';
import { useShareIntent } from '@/context/ShareIntentContext';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
	Alert,
	Pressable,
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
import { SafeAreaView } from 'react-native-safe-area-context';

// --- Constants ---

const SEARCH_ICON_SIZE = 48;

const COPY = {
	titleTop: 'Your',
	titleBottom: 'Cookbooks',
	searchPlaceholder: 'Search...',
	newCookbook: 'New Cookbook',
	createError: 'Failed to create cookbook. Please try again.'
} as const;

// --- Component ---

export default function CookbookScreen() {
	const cookbooks = useQuery(api.cookbooks.list);
	const createCookbook = useMutation(api.cookbooks.create);
	const generateUploadUrl = useMutation(api.users.generateUploadUrl);

	const updateCookbook = useMutation(api.cookbooks.update);
	const deleteCookbook = useMutation(api.cookbooks.remove);

	const [isSearchActive, setIsSearchActive] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
	const [isCreating, setIsCreating] = useState(false);
	const [viewMode, setViewMode] = useState<'slider' | 'grid'>('slider');

	// Edit modal state
	const [editCookbookId, setEditCookbookId] =
		useState<Id<'cookbooks'> | null>(null);
	const [isEditModalVisible, setIsEditModalVisible] = useState(false);
	const [isEditing, setIsEditing] = useState(false);

	// Share intent context
	const { triggerImport } = useShareIntent();

	const searchProgress = useSharedValue(0);
	const inputRef = useRef<TextInput>(null);

	// --- Search Animation ---

	const handleOpenSearch = useCallback(() => {
		setIsSearchActive(true);
		searchProgress.value = withTiming(1, { duration: 250 });
		setTimeout(() => inputRef.current?.focus(), 150);
	}, [searchProgress]);

	const handleCloseSearch = useCallback(() => {
		searchProgress.value = withTiming(0, { duration: 200 });
		setSearchQuery('');
		setTimeout(() => setIsSearchActive(false), 220);
	}, [searchProgress]);

	const searchBarAnimatedStyle = useAnimatedStyle(() => ({
		width: interpolate(
			searchProgress.value,
			[0, 1],
			[SEARCH_ICON_SIZE, 260]
		)
	}));

	const searchInputOpacity = useAnimatedStyle(() => ({
		opacity: interpolate(searchProgress.value, [0.3, 0.7], [0, 1])
	}));

	// --- Filter ---

	const filtered = useMemo(() => {
		if (!cookbooks) return [];

		let result = [...cookbooks];

		if (searchQuery.trim().length > 0) {
			const q = searchQuery.toLowerCase().trim();
			result = result.filter(
				(c) =>
					c.name.toLowerCase().includes(q) ||
					(c.description?.toLowerCase().includes(q) ?? false)
			);
		}

		// Default sort: most recent first
		result.sort((a, b) => b.createdAt - a.createdAt);

		return result;
	}, [cookbooks, searchQuery]);

	// --- Handlers ---

	const handleCreateCookbook = useCallback(
		async (name: string, description?: string, imageUri?: string) => {
			try {
				setIsCreating(true);

				let coverImageStorageId: Id<'_storage'> | undefined;

				if (imageUri) {
					const uploadUrl = await generateUploadUrl();
					const response = await fetch(imageUri);
					const blob = await response.blob();
					const uploadResponse = await fetch(uploadUrl, {
						method: 'POST',
						headers: { 'Content-Type': blob.type },
						body: blob
					});
					if (!uploadResponse.ok) {
						throw new Error(COPY.createError);
					}
					const { storageId } = (await uploadResponse.json()) as {
						storageId: Id<'_storage'>;
					};
					coverImageStorageId = storageId;
				}

				await createCookbook({
					name,
					description,
					coverImageStorageId
				});
				setIsCreateModalVisible(false);
			} catch {
				Alert.alert('Error', COPY.createError);
			} finally {
				setIsCreating(false);
			}
		},
		[createCookbook, generateUploadUrl]
	);

	const router = useRouter();

	const handleCardPress = useCallback(
		(id: Id<'cookbooks'>) => {
			router.push({
				pathname: '/cookbook/[cookbookId]',
				params: { cookbookId: id }
			});
		},
		[router]
	);

	// --- Edit / Delete ---

	const editCookbookData = useMemo(() => {
		if (!editCookbookId || !cookbooks) return undefined;
		const cookbook = cookbooks.find((c) => c._id === editCookbookId);
		if (!cookbook) return undefined;
		return {
			name: cookbook.name,
			description: cookbook.description,
			coverImageUrl: cookbook.coverImageUrl
		};
	}, [editCookbookId, cookbooks]);

	const handleMorePress = useCallback((id: Id<'cookbooks'>) => {
		setEditCookbookId(id);
		setIsEditModalVisible(true);
	}, []);

	const handleEditSubmit = useCallback(
		async (name: string, description?: string, imageUri?: string) => {
			if (!editCookbookId) return;
			try {
				setIsEditing(true);

				let coverImageStorageId: Id<'_storage'> | undefined;
				const originalUrl = editCookbookData?.coverImageUrl;
				const imageChanged = imageUri !== originalUrl;

				if (imageUri && imageChanged) {
					const uploadUrl = await generateUploadUrl();
					const response = await fetch(imageUri);
					const blob = await response.blob();
					const uploadResponse = await fetch(uploadUrl, {
						method: 'POST',
						headers: { 'Content-Type': blob.type },
						body: blob
					});
					if (!uploadResponse.ok) {
						throw new Error('Failed to upload image.');
					}
					const { storageId } = (await uploadResponse.json()) as {
						storageId: Id<'_storage'>;
					};
					coverImageStorageId = storageId;
				}

				await updateCookbook({
					cookbookId: editCookbookId,
					name,
					description,
					coverImageStorageId,
					coverImageUrl:
						imageUri && !imageChanged ? imageUri : undefined,
					removeCoverImage: !imageUri && Boolean(originalUrl)
				});
				setIsEditModalVisible(false);
				setEditCookbookId(null);
			} catch {
				Alert.alert(
					'Error',
					'Failed to update cookbook. Please try again.'
				);
			} finally {
				setIsEditing(false);
			}
		},
		[editCookbookId, editCookbookData, updateCookbook, generateUploadUrl]
	);

	const handleDeleteCookbook = useCallback(async () => {
		if (!editCookbookId) return;
		try {
			setIsEditing(true);
			await deleteCookbook({ cookbookId: editCookbookId });
			setIsEditModalVisible(false);
			setEditCookbookId(null);
		} catch {
			Alert.alert(
				'Error',
				'Failed to delete cookbook. Please try again.'
			);
		} finally {
			setIsEditing(false);
		}
	}, [editCookbookId, deleteCookbook]);

	const isLoading = cookbooks === undefined;

	// --- Render ---

	return (
		<SafeAreaView style={styles.container} edges={['top']}>
			{/* Scrollable Content */}
			<Animated.ScrollView
				style={styles.scrollView}
				contentContainerStyle={styles.scrollContent}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				{/* Header */}
				<View style={styles.header}>
					<View style={styles.titleColumn}>
						<Image
							source={require('@/assets/images/header_icon.svg')}
							style={{ width: 100, height: 60 }}
							contentFit="contain"
						/>
						<Text style={styles.titleTop}>{COPY.titleTop}</Text>
						<Text style={styles.titleBottom}>
							{COPY.titleBottom}
						</Text>
					</View>

					{/* Top-right actions */}
					<View style={styles.headerActions}>
						{/* Search — black button, expands left */}
						<Animated.View
							style={[styles.searchBar, searchBarAnimatedStyle]}
						>
							<Pressable
								accessibilityRole="button"
								accessibilityLabel="Search"
								onPress={
									!isSearchActive
										? handleOpenSearch
										: undefined
								}
								style={styles.searchIconButton}
							>
								<Icon
									name="search"
									size={18}
									strokeWidth={2.5}
									color={isSearchActive ? Colors.text.primary : Colors.text.inverse}
								/>
							</Pressable>

							{isSearchActive ? (
								<Animated.View
									style={[
										styles.searchInputContainer,
										searchInputOpacity
									]}
								>
									<Pressable
										accessibilityRole="button"
										accessibilityLabel="Close search"
										onPress={handleCloseSearch}
										style={styles.searchCloseButton}
										hitSlop={8}
									>
										<Icon
											name="close"
											size={18}
											strokeWidth={2.5}
											color={Colors.text.inverse}
										/>
									</Pressable>
									<TextInput
										ref={inputRef}
										style={styles.searchInput}
										placeholder={COPY.searchPlaceholder}
										placeholderTextColor="rgba(255,255,255,0.6)"
										value={searchQuery}
										onChangeText={setSearchQuery}
										autoCapitalize="none"
										autoCorrect={false}
										accessibilityLabel={
											COPY.searchPlaceholder
										}
									/>
								</Animated.View>
							) : null}
						</Animated.View>
					</View>
				</View>

				{/* Pending Imports Row */}
				<PendingImportRow />

				{/* Content */}
				{isLoading ? (
					<View style={styles.loadingContainer}>
						<Loading size="large" color={Colors.accent} />
					</View>
				) : (
					<CookbookCarousel
						cookbooks={filtered}
						onCardPress={handleCardPress}
						onMorePress={handleMorePress}
						onAddPress={() => setIsCreateModalVisible(true)}
						viewMode={viewMode}
						onToggleViewMode={() =>
							setViewMode((m) =>
								m === 'slider' ? 'grid' : 'slider'
							)
						}
					/>
				)}
			</Animated.ScrollView>

			{/* Create Modal */}
			<CreateCookbookModal
				visible={isCreateModalVisible}
				onClose={() => setIsCreateModalVisible(false)}
				onSubmit={handleCreateCookbook}
				isLoading={isCreating}
			/>

			{/* Edit Modal */}
			<CreateCookbookModal
				visible={isEditModalVisible}
				onClose={() => {
					setIsEditModalVisible(false);
					setEditCookbookId(null);
				}}
				onSubmit={handleEditSubmit}
				onDelete={handleDeleteCookbook}
				isLoading={isEditing}
				editData={editCookbookData}
			/>
		</SafeAreaView>
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
		flexGrow: 1,
		paddingBottom: Spacing.xl // Space for tab bar
	},

	// Header
	header: {
		paddingHorizontal: Spacing.lg,
		paddingTop: Spacing.sm,
		paddingBottom: Spacing.sm,
		backgroundColor: Colors.background.primary,
	},
	titleColumn: {
		flexDirection: 'column',
		gap: Spacing.xs
	},
	titleTop: {
		fontSize: 20,
		lineHeight: 24,
		fontFamily: 'Lora_400Regular',
		fontWeight: '400',
		color: Colors.text.primary,
		letterSpacing: -0.2,
		paddingLeft: Spacing.sm
	},
	titleBottom: {
		fontSize: 32,
		lineHeight: 36,
		fontFamily: 'Lora_700Bold',
		fontWeight: '700',
		color: Colors.text.primary,
		letterSpacing: -0.3,
		paddingLeft: Spacing.sm
	},

	// Header Actions
	headerActions: {
		position: 'absolute',
		top: Spacing.md,
		right: Spacing.lg,
		flexDirection: 'row',
		alignItems: 'center',
		gap: Spacing.sm
	},
	// Search
	searchBar: {
		height: SEARCH_ICON_SIZE,
		backgroundColor: Colors.accent,
		borderRadius: SEARCH_ICON_SIZE / 2,
		flexDirection: 'row-reverse',
		alignItems: 'center',
		overflow: 'hidden',
		...Shadow.surface
	},
	searchIconButton: {
		width: SEARCH_ICON_SIZE,
		height: SEARCH_ICON_SIZE,
		alignItems: 'center',
		justifyContent: 'center'
	},
	searchCloseButton: {
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm
	},
	searchInputContainer: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		gap: Spacing.xs
	},
	searchInput: {
		flex: 1,
		...Typography.body,
		fontFamily: 'Lora_400Regular',
		color: Colors.text.inverse,
		paddingVertical: 0
	},

	// Loading
	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center'
	}
});
