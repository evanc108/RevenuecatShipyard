import { useState, useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TabSlider } from '@/components/ui/TabSlider';
import { Icon } from '@/components/ui/Icon';
import {
  MealPlanContent,
  YourFoodContent,
} from '@/components/features/pantry';
import { Colors, Spacing } from '@/constants/theme';
import { COPY } from '@/constants/copy';

type TabKey = 'mealPlan' | 'yourFood';

const TABS = [
  { key: 'mealPlan' as const, label: COPY.pantry.tabs.mealPlan },
  { key: 'yourFood' as const, label: COPY.pantry.tabs.yourFood },
];

export default function MealPlanScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('mealPlan');

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
        >
          <Icon name="shopping-cart" size={20} color={Colors.text.primary} />
        </Pressable>
      </View>
      <View style={styles.content}>{content}</View>
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
  content: {
    flex: 1,
  },
});
