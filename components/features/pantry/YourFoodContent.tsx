import { memo, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, SectionList } from 'react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Icon } from '@/components/ui/Icon';
import { Loading } from '@/components/ui/Loading';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import { useMealPlanGenerationStore } from '@/stores/useMealPlanGenerationStore';
import { usePantryItemModalStore } from '@/stores/usePantryItemModalStore';
import { PantryItemCard } from './PantryItemCard';

const copy = COPY.pantry.yourFood;

const CATEGORY_ORDER: string[] = ['produce', 'dairy', 'meat', 'pantry', 'spice', 'frozen', 'other'];

type PantryItem = {
  _id: Id<'pantryItems'>;
  name: string;
  normalizedName: string;
  category?: string;
  quantity?: number;
  unit?: string;
  addedAt: number;
};

type SectionData = {
  title: string;
  data: PantryItem[];
};

function YourFoodContentComponent(): React.ReactElement {
  const pantryItems = useQuery(api.pantry.getItems);
  const removeItem = useMutation(api.pantry.removeItem);
  const openGenerateModal = useMealPlanGenerationStore((s) => s.openGenerateModal);
  const openAddModal = usePantryItemModalStore((s) => s.openAddModal);
  const openEditModal = usePantryItemModalStore((s) => s.openEditModal);

  const handleRemoveItem = useCallback(
    async (itemId: Id<'pantryItems'>) => {
      try {
        await removeItem({ itemId });
      } catch (error) {
        console.error('Failed to remove pantry item:', error);
      }
    },
    [removeItem]
  );

  const sections = useMemo<SectionData[]>(() => {
    if (!pantryItems || pantryItems.length === 0) return [];

    const grouped: Record<string, PantryItem[]> = {};
    for (const item of pantryItems) {
      const category = item.category ?? 'other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(item);
    }

    return CATEGORY_ORDER.filter((cat) => grouped[cat] && grouped[cat].length > 0).map((cat) => ({
      title:
        copy.categories[cat as keyof typeof copy.categories] ?? cat,
      data: grouped[cat] ?? [],
    }));
  }, [pantryItems]);

  const totalCount = pantryItems?.length ?? 0;

  const handleEditItem = useCallback(
    (item: PantryItem) => {
      openEditModal({
        _id: item._id,
        name: item.name,
        category: item.category as 'produce' | 'dairy' | 'meat' | 'pantry' | 'spice' | 'frozen' | 'other' | undefined,
        quantity: item.quantity,
        unit: item.unit,
      });
    },
    [openEditModal]
  );

  const renderItem = useCallback(
    ({ item }: { item: PantryItem }) => (
      <PantryItemCard
        itemId={item._id}
        name={item.name}
        category={item.category}
        quantity={item.quantity}
        unit={item.unit}
        onRemove={handleRemoveItem}
        onEdit={() => handleEditItem(item)}
      />
    ),
    [handleRemoveItem, handleEditItem]
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

  const keyExtractor = useCallback((item: PantryItem) => item._id, []);

  // Loading state
  if (pantryItems === undefined) {
    return (
      <View style={styles.loadingContainer}>
        <Loading size="small" color={Colors.accent} />
      </View>
    );
  }

  // Empty state
  if (totalCount === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.iconContainer}>
          <Icon name="cart" size={48} color={Colors.text.tertiary} />
        </View>
        <Text style={styles.emptyTitle}>{copy.emptyTitle}</Text>
        <Text style={styles.emptySubtitle}>{copy.emptySubtitle}</Text>
        <Pressable
          style={styles.addButton}
          onPress={openAddModal}
          accessibilityRole="button"
          accessibilityLabel={copy.addItem}
        >
          <Icon name="add" size={20} color={Colors.text.inverse} />
          <Text style={styles.addButtonText}>{copy.addItem}</Text>
        </Pressable>
      </View>
    );
  }

  // List view
  return (
    <View style={styles.container}>
      {/* Header with count */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{copy.itemCount(totalCount)}</Text>
        <Pressable
          style={styles.headerAddButton}
          onPress={openAddModal}
          accessibilityRole="button"
          accessibilityLabel={copy.addItem}
        >
          <Icon name="add" size={20} color={Colors.accent} />
          <Text style={styles.headerAddButtonText}>{copy.addItem}</Text>
        </Pressable>
      </View>

      {/* Plan from Pantry Button */}
      <Pressable
        style={styles.generateButton}
        onPress={openGenerateModal}
        accessibilityRole="button"
        accessibilityLabel={COPY.pantry.generate.button}
      >
        <Icon name="restaurant" size={18} color={Colors.accent} />
        <Text style={styles.generateButtonText}>
          {COPY.pantry.generate.button}
        </Text>
      </Pressable>

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
    marginBottom: Spacing.lg,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  addButtonText: {
    ...Typography.label,
    color: Colors.text.inverse,
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
  headerAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  headerAddButtonText: {
    ...Typography.label,
    color: Colors.accent,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.md,
  },
  generateButtonText: {
    ...Typography.label,
    color: Colors.accent,
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
    height: Spacing.sm,
  },
  sectionSeparator: {
    height: Spacing.md,
  },
});

export const YourFoodContent = memo(YourFoodContentComponent);
