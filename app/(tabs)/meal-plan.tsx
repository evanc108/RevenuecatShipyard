import { useState, useMemo } from 'react';
import { View, Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { TabSlider } from '@/components/ui/TabSlider';
import { Icon } from '@/components/ui/Icon';
import {
  MealPlanContent,
  YourFoodContent,
} from '@/components/features/pantry';
import { GeneratedRecipesSheet } from '@/components/features/pantry/GeneratedRecipesSheet';
import { ScheduleOptionsSheet } from '@/components/features/pantry/ScheduleOptionsSheet';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { COPY } from '@/constants/copy';

type TabKey = 'mealPlan' | 'yourFood';

const TABS = [
  { key: 'mealPlan' as const, label: COPY.pantry.tabs.mealPlan },
  { key: 'yourFood' as const, label: COPY.pantry.tabs.yourFood },
];

export default function MealPlanScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('mealPlan');
  const groceryCount = useQuery(api.groceryList.getCount);

  const content = useMemo(() => {
    switch (activeTab) {
      case 'mealPlan':
        return <MealPlanContent />;
      case 'yourFood':
        return <YourFoodContent />;
      default:
        return <MealPlanContent />;
    }
  }, [activeTab]);

  const handleOpenGroceries = () => {
    router.push('/groceries');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topRow}>
        <View style={styles.tabSliderWrapper}>
          <TabSlider
            tabs={TABS}
            activeTab={activeTab}
            onTabChange={(key) => setActiveTab(key as TabKey)}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Groceries"
          style={styles.cartButton}
          hitSlop={8}
          onPress={handleOpenGroceries}
        >
          <Icon name="cart" size={20} color={Colors.text.primary} />
          {groceryCount !== undefined && groceryCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {groceryCount > 99 ? '99+' : groceryCount}
              </Text>
            </View>
          )}
        </Pressable>
      </View>
      <View style={styles.content}>{content}</View>

      {/* Meal Plan Generation Modals */}
      <GeneratedRecipesSheet />
      <ScheduleOptionsSheet />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
    backgroundColor: Colors.background.primary,
  },
  tabSliderWrapper: {
    flex: 1,
  },
  cartButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.text.inverse,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
});
