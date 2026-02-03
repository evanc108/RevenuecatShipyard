import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useNavigation } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { GoalCard } from '@/components/onboarding/GoalCard';
import { PageTurnButton } from '@/components/onboarding/PageTurnButton';
import { PageIndicator } from '@/components/onboarding/PageIndicator';
import { ONBOARDING_COPY, GOALS } from '@/constants/onboarding';
import { Colors, Spacing, Typography } from '@/constants/theme';

export default function GoalsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const copy = ONBOARDING_COPY.goals;
  const insets = useSafeAreaInsets();

  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      router.back();
    } else {
      router.replace('/(onboarding)/profile-setup');
    }
  };

  const toggleGoal = (goalId: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goalId)
        ? prev.filter((id) => id !== goalId)
        : [...prev, goalId],
    );
  };

  const handleContinue = () => {
    router.push({
      pathname: '/(onboarding)/dietary',
      params: { goals: JSON.stringify(selectedGoals) },
    });
  };

  const handleSkip = () => {
    router.push({
      pathname: '/(onboarding)/dietary',
      params: { goals: JSON.stringify([]) },
    });
  };

  const canContinue = selectedGoals.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={handleBack}
        hitSlop={8}
        style={styles.backButton}
      >
        <Ionicons name="chevron-back" size={28} color={Colors.text.primary} />
      </Pressable>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text style={styles.headline}>{copy.headline}</Text>
          <Text style={styles.subhead}>{copy.subhead}</Text>
        </Animated.View>

        <View style={styles.cardsContainer}>
          {GOALS.map((goal, index) => (
            <Animated.View
              key={goal.id}
              entering={FadeInDown.delay(index * 50).duration(400)}
            >
              <GoalCard
                emoji={goal.emoji}
                title={goal.title}
                description={goal.description}
                isSelected={selectedGoals.includes(goal.id)}
                onPress={() => toggleGoal(goal.id)}
              />
            </Animated.View>
          ))}
        </View>
      </ScrollView>

      <Animated.View
        entering={FadeInUp.delay(200).duration(400)}
        style={styles.bottomBar}
      >
        <View
          style={[styles.bottomLeft, { paddingBottom: insets.bottom + Spacing.sm }]}
        >
          <PageIndicator current={5} />
          <Pressable onPress={handleSkip} hitSlop={8}>
            <Text style={styles.skipText}>{copy.skip}</Text>
          </Pressable>
        </View>
        <PageTurnButton
          label="Next >"
          onPress={handleContinue}
          disabled={!canContinue}
        />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  backButton: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
    alignSelf: 'flex-start' as const,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  headline: {
    fontSize: 36,
    fontWeight: '400',
    color: Colors.text.primary,
    letterSpacing: -0.5,
    lineHeight: 50,
    marginBottom: Spacing.md,
  },
  subhead: {
    ...Typography.body,
    color: Colors.text.secondary,
    marginBottom: Spacing.lg,
  },
  cardsContainer: {
    gap: Spacing.sm,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingLeft: Spacing.xl,
  },
  bottomLeft: {
    gap: Spacing.xs,
  },
  skipText: {
    ...Typography.bodySmall,
    color: Colors.text.tertiary,
  },
});
