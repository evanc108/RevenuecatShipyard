import { useState, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TabSlider } from '@/components/ui/TabSlider';
import {
  MealPlanContent,
  YourFoodContent,
  GroceriesContent,
} from '@/components/features/pantry';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { COPY } from '@/constants/copy';

type TabKey = 'mealPlan' | 'yourFood' | 'groceries';

const TABS = [
  { key: 'mealPlan' as const, label: COPY.pantry.tabs.mealPlan },
  { key: 'yourFood' as const, label: COPY.pantry.tabs.yourFood },
  { key: 'groceries' as const, label: COPY.pantry.tabs.groceries },
];

export default function MealPlanScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('mealPlan');

  const content = useMemo(() => {
    switch (activeTab) {
      case 'mealPlan':
        return <MealPlanContent />;
      case 'yourFood':
        return <YourFoodContent />;
      case 'groceries':
        return <GroceriesContent />;
      default:
        return <MealPlanContent />;
    }
  }, [activeTab]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Pantry</Text>
      </View>
      <View style={styles.tabContainer}>
        <TabSlider
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(key) => setActiveTab(key as TabKey)}
        />
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
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: {
    ...Typography.h1,
    color: Colors.text.primary,
  },
  tabContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  content: {
    flex: 1,
  },
});
