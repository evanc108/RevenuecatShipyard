import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { COPY } from '@/constants/copy';

function MealPlanContentComponent() {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Icon name="calendar" size={48} color={Colors.text.tertiary} />
      </View>
      <Text style={styles.title}>{COPY.pantry.mealPlan.emptyTitle}</Text>
      <Text style={styles.subtitle}>{COPY.pantry.mealPlan.emptySubtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  iconContainer: {
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.h3,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});

export const MealPlanContent = memo(MealPlanContentComponent);
