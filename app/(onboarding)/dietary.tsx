import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
} from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { DietaryChip } from '@/components/onboarding/DietaryChip';
import { DislikeChip } from '@/components/onboarding/DislikeChip';
import { PageTurnButton } from '@/components/onboarding/PageTurnButton';
import { PageIndicator } from '@/components/onboarding/PageIndicator';
import { ONBOARDING_COPY, DIETARY_RESTRICTIONS } from '@/constants/onboarding';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';

export default function DietaryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ goals: string }>();
  const copy = ONBOARDING_COPY.dietary;
  const insets = useSafeAreaInsets();

  const [selectedRestrictions, setSelectedRestrictions] = useState<string[]>(
    [],
  );
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [dislikeInput, setDislikeInput] = useState('');

  const toggleRestriction = (restriction: string) => {
    setSelectedRestrictions((prev) =>
      prev.includes(restriction)
        ? prev.filter((r) => r !== restriction)
        : [...prev, restriction],
    );
  };

  const addDislike = () => {
    const trimmed = dislikeInput.trim().toLowerCase();
    if (trimmed && !dislikes.includes(trimmed)) {
      setDislikes((prev) => [...prev, trimmed]);
      setDislikeInput('');
    }
  };

  const removeDislike = (ingredient: string) => {
    setDislikes((prev) => prev.filter((d) => d !== ingredient));
  };

  const handleContinue = () => {
    router.push({
      pathname: '/(onboarding)/first-recipe',
      params: {
        goals: params.goals,
        dietary: JSON.stringify(selectedRestrictions),
        dislikes: JSON.stringify(dislikes),
      },
    });
  };

  const handleSkip = () => {
    router.push({
      pathname: '/(onboarding)/first-recipe',
      params: {
        goals: params.goals,
        dietary: JSON.stringify([]),
        dislikes: JSON.stringify([]),
      },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => router.back()}
        hitSlop={8}
        style={styles.backButton}
      >
        <Icon name="chevron-back" size={28} color={Colors.text.primary} />
      </Pressable>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headline}>{copy.headline}</Text>
        <Text style={styles.subhead}>{copy.subhead}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{copy.restrictionsLabel}</Text>
          <View style={styles.chipsContainer}>
            {DIETARY_RESTRICTIONS.map((restriction) => (
              <DietaryChip
                key={restriction}
                label={restriction}
                isSelected={selectedRestrictions.includes(restriction)}
                onPress={() => toggleRestriction(restriction)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{copy.dislikesLabel}</Text>
          <TextInput
            style={styles.input}
            placeholder={copy.dislikesPlaceholder}
            placeholderTextColor={Colors.text.tertiary}
            value={dislikeInput}
            onChangeText={setDislikeInput}
            onSubmitEditing={addDislike}
            returnKeyType="done"
          />
          {dislikes.length > 0 && (
            <View style={styles.chipsContainer}>
              {dislikes.map((dislike) => (
                <DislikeChip
                  key={dislike}
                  label={dislike}
                  onRemove={() => removeDislike(dislike)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <Animated.View
        entering={FadeInUp.delay(200).duration(400)}
        style={styles.bottomBar}
      >
        <View
          style={[styles.bottomLeft, { paddingBottom: insets.bottom + Spacing.sm }]}
        >
          <PageIndicator current={6} />
          <Pressable onPress={handleSkip} hitSlop={8}>
            <Text style={styles.skipText}>{copy.skip}</Text>
          </Pressable>
        </View>
        <PageTurnButton label="Next >" onPress={handleContinue} />
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
  section: {
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    ...Typography.label,
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  input: {
    height: 52,
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
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
