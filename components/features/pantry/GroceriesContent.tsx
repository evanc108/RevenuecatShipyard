import { memo, useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SectionList,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Icon } from '@/components/ui/Icon';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import { GroceryItemCard } from './GroceryItemCard';
import { GroceryItemEditor } from './GroceryItemEditor';
import { getCategoryLabel } from '@/types/grocery';

const copy = COPY.pantry.groceries;

const CATEGORY_ORDER: string[] = [
  'produce',
  'dairy',
  'meat',
  'pantry',
  'spice',
  'frozen',
  'other',
];

const CATEGORY_SET = new Set(CATEGORY_ORDER);

type GrocerySource = {
  recipeId: Id<'recipes'>;
  recipeName: string;
  quantity: number;
  unit: string;
  servingsMultiplier: number;
  mealPlanEntryId?: Id<'mealPlanEntries'>;
  scheduledDate?: string;
};

type EnrichedGroceryItem = {
  _id: Id<'groceryItems'>;
  _creationTime: number;
  userId: Id<'users'>;
  name: string;
  normalizedName: string;
  category?: string;
  totalQuantity: number;
  unit: string;
  sources: GrocerySource[];
  isChecked: boolean;
  userQuantityOverride?: number;
  amazonFreshUrl?: string;
  addedAt: number;
  updatedAt: number;
  adjustedQuantity: number;
  pantryQuantity?: number;
  pantryUnit?: string;
  effectiveQuantity: number;
};

type SectionData = {
  title: string;
  category: string;
  data: EnrichedGroceryItem[];
};

function GroceriesContentComponent(): React.ReactElement {
  const groceryList = useQuery(api.groceryList.getList, { includeChecked: true });
  const removeItem = useMutation(api.groceryList.removeItem);
  const updateItem = useMutation(api.groceryList.updateItem);
  const updateAmazonUrl = useMutation(api.groceryList.updateAmazonUrl);
  const clearAll = useMutation(api.groceryList.clearAll);
  const generateAmazonUrls = useAction(api.groceryListActions.generateAmazonUrls);

  const [editingItem, setEditingItem] = useState<EnrichedGroceryItem | null>(null);

  const handleRemoveItem = useCallback(
    async (itemId: Id<'groceryItems'>) => {
      try {
        await removeItem({ itemId });
      } catch (error) {
        console.error('Failed to remove grocery item:', error);
      }
    },
    [removeItem]
  );

  const handleToggleCheck = useCallback(
    async (itemId: Id<'groceryItems'>, isChecked: boolean) => {
      try {
        await updateItem({ itemId, isChecked });
      } catch (error) {
        console.error('Failed to update grocery item:', error);
      }
    },
    [updateItem]
  );

  const handleEditItem = useCallback((item: EnrichedGroceryItem) => {
    setEditingItem(item);
  }, []);

  const handleSaveEdit = useCallback(
    async (itemId: Id<'groceryItems'>, quantity: number) => {
      try {
        await updateItem({ itemId, userQuantityOverride: quantity });
        setEditingItem(null);
      } catch (error) {
        console.error('Failed to update quantity:', error);
      }
    },
    [updateItem]
  );

  const handleCloseEditor = useCallback(() => {
    setEditingItem(null);
  }, []);

  const handleClearAll = useCallback(() => {
    Alert.alert(copy.clearAll, copy.clearAllConfirm, [
      { text: copy.cancel, style: 'cancel' },
      {
        text: copy.clearAll,
        style: 'destructive',
        onPress: async () => {
          try {
            await clearAll({});
          } catch (error) {
            console.error('Failed to clear grocery list:', error);
          }
        },
      },
    ]);
  }, [clearAll]);

  const handleOpenAmazon = useCallback(
    async (item: EnrichedGroceryItem) => {
      // If we already have a URL, open it directly
      if (item.amazonFreshUrl) {
        try {
          await Linking.openURL(item.amazonFreshUrl);
        } catch (error) {
          console.error('Failed to open Amazon URL:', error);
          Alert.alert('Error', 'Unable to open Amazon link');
        }
        return;
      }

      // Generate a new URL
      try {
        const result = await generateAmazonUrls({
          items: [
            {
              itemId: item._id,
              name: item.name,
              quantity: item.effectiveQuantity,
              unit: item.unit,
            },
          ],
        });

        if (result.success && result.results && result.results.length > 0) {
          const url = result.results[0]?.url;
          if (url) {
            // Save the URL to the database for future use
            await updateAmazonUrl({ itemId: item._id, amazonFreshUrl: url });

            // Open the URL
            await Linking.openURL(url);
          }
        } else {
          console.error('Amazon URL generation failed:', result.error);
          Alert.alert('Error', result.error ?? 'Failed to generate Amazon link');
        }
      } catch (error) {
        console.error('Failed to generate/open Amazon URL:', error);
        Alert.alert('Error', 'Failed to open Amazon link');
      }
    },
    [generateAmazonUrls, updateAmazonUrl]
  );

  const sections = useMemo<SectionData[]>(() => {
    if (!groceryList || groceryList.length === 0) return [];

    const grouped: Record<string, EnrichedGroceryItem[]> = {};
    for (const item of groceryList) {
      const raw = item.category ?? 'other';
      const category = CATEGORY_SET.has(raw) ? raw : 'other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(item as EnrichedGroceryItem);
    }

    return CATEGORY_ORDER.filter(
      (cat) => grouped[cat] && grouped[cat].length > 0
    ).map((cat) => ({
      title: getCategoryLabel(cat),
      category: cat,
      data: grouped[cat] ?? [],
    }));
  }, [groceryList]);

  const totalCount = groceryList?.length ?? 0;
  const uncheckedCount =
    groceryList?.filter((item) => !item.isChecked).length ?? 0;

  const renderItem = useCallback(
    ({ item }: { item: EnrichedGroceryItem }) => (
      <GroceryItemCard
        item={item}
        onRemove={handleRemoveItem}
        onToggleCheck={handleToggleCheck}
        onEdit={() => handleEditItem(item)}
        onOpenAmazon={() => handleOpenAmazon(item)}
      />
    ),
    [handleRemoveItem, handleToggleCheck, handleEditItem, handleOpenAmazon]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionData }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <Text style={styles.sectionCount}>{section.data.length}</Text>
      </View>
    ),
    []
  );

  const keyExtractor = useCallback(
    (item: EnrichedGroceryItem) => item._id,
    []
  );

  if (groceryList === undefined) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={Colors.accent} />
      </View>
    );
  }

  if (totalCount === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.iconContainer}>
          <Icon name="cart" size={48} color={Colors.text.tertiary} />
        </View>
        <Text style={styles.emptyTitle}>{copy.emptyTitle}</Text>
        <Text style={styles.emptySubtitle}>{copy.emptySubtitle}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {copy.itemCount(uncheckedCount)}
          {uncheckedCount !== totalCount && (
            <Text style={styles.checkedCount}>
              {' '}
              ({totalCount - uncheckedCount} checked)
            </Text>
          )}
        </Text>
        <Pressable
          style={styles.clearButton}
          onPress={handleClearAll}
          accessibilityRole="button"
          accessibilityLabel={copy.clearAll}
        >
          <Icon name="trash" size={16} color={Colors.semantic.error} />
          <Text style={styles.clearButtonText}>{copy.clearAll}</Text>
        </Pressable>
      </View>

      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        SectionSeparatorComponent={() => <View style={styles.sectionSeparator} />}
      />

      {editingItem && (
        <GroceryItemEditor
          item={editingItem}
          onSave={handleSaveEdit}
          onClose={handleCloseEditor}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  iconContainer: {
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    ...Typography.body,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  checkedCount: {
    ...Typography.bodySmall,
    color: Colors.text.tertiary,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  clearButtonText: {
    ...Typography.label,
    color: Colors.semantic.error,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background.primary,
  },
  sectionTitle: {
    ...Typography.label,
    color: Colors.text.primary,
  },
  sectionCount: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 36,
  },
  sectionSeparator: {
    height: Spacing.sm,
  },
});

export const GroceriesContent = memo(GroceriesContentComponent);
