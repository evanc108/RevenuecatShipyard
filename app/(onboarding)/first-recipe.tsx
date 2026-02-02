import { PageIndicator } from '@/components/onboarding/PageIndicator';
import { PageTurnButton } from '@/components/onboarding/PageTurnButton';
import { ONBOARDING_COPY } from '@/constants/onboarding';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// Illustration: People illustrations by Storyset (https://storyset.com/people)

const isValidRecipeUrl = (url: string): boolean => {
  const patterns = [
    /tiktok\.com/i,
    /instagram\.com\/reel/i,
    /instagram\.com\/p\//i,
    /youtube\.com\/shorts/i,
    /youtu\.be/i,
    /youtube\.com\/watch/i,
  ];
  return patterns.some((p) => p.test(url));
};

export default function FirstRecipeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    goals: string;
    dietary: string;
    dislikes: string;
  }>();
  const { user } = useUser();
  const copy = ONBOARDING_COPY.firstRecipe;
  const insets = useSafeAreaInsets();

  const [linkValue, setLinkValue] = useState('');

  useEffect(() => {
    const checkClipboard = async () => {
      try {
        const content = await Clipboard.getStringAsync();
        if (content && isValidRecipeUrl(content)) {
          setLinkValue(content);
        }
      } catch {
        // Clipboard access may be denied
      }
    };
    checkClipboard();
  }, []);

  const saveOnboardingData = async (recipeUrl: string | null) => {
    await user?.update({
      unsafeMetadata: {
        hasCompletedOnboarding: true,
        goals: JSON.parse(params.goals || '[]'),
        dietaryRestrictions: JSON.parse(params.dietary || '[]'),
        ingredientDislikes: JSON.parse(params.dislikes || '[]'),
        firstRecipeUrl: recipeUrl,
      },
    });
  };

  const handleContinue = async () => {
    await saveOnboardingData(linkValue);
    router.replace('/(tabs)');
  };

  const handleSkip = async () => {
    await saveOnboardingData(null);
    router.replace('/(tabs)');
  };

  const hasValidLink = isValidRecipeUrl(linkValue);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => router.back()}
        hitSlop={8}
        style={styles.backButton}
      >
        <Ionicons name="chevron-back" size={28} color={Colors.text.primary} />
      </Pressable>

      <Animated.View
        entering={FadeInDown.delay(0).duration(400)}
        style={styles.headlineContainer}
      >
        <Text style={styles.headline}>{copy.headline}</Text>
        <Text style={styles.subhead}>{copy.subhead}</Text>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(100).duration(400)}
        style={styles.illustrationContainer}
      >
        <Image
          source={require('@/assets/images/first-recipe.icon.png')}
          style={styles.illustration}
          contentFit="contain"
        />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(150).duration(400)}
        style={styles.inputSection}
      >
        <TextInput
          style={styles.linkInput}
          placeholder={copy.inputPlaceholder}
          placeholderTextColor={Colors.text.tertiary}
          value={linkValue}
          onChangeText={setLinkValue}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
        />

        <Text style={styles.orText}>{copy.orText}</Text>

        <View style={styles.shareCard}>
          <Ionicons
            name="share-outline"
            size={24}
            color={Colors.text.secondary}
          />
          <View style={styles.shareCardText}>
            <Text style={styles.shareTitle}>{copy.shareTitle}</Text>
            <Text style={styles.shareDescription}>
              {copy.shareDescription}
            </Text>
          </View>
        </View>
      </Animated.View>

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
        <PageTurnButton
          label="Start"
          onPress={handleContinue}
          disabled={!hasValidLink}
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
  headlineContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
  headline: {
    fontSize: 36,
    fontWeight: '400',
    color: Colors.text.primary,
    letterSpacing: -0.5,
    lineHeight: 50,
  },
  subhead: {
    ...Typography.body,
    color: Colors.text.secondary,
    fontSize: 16,
    lineHeight: 24,
  },
  illustrationContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustration: {
    width: 400,
    height: 400,
  },
  inputSection: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  linkInput: {
    minHeight: 64,
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Typography.body,
    color: Colors.text.primary,
    textAlignVertical: 'top',
  },
  orText: {
    ...Typography.label,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
  shareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  shareCardText: {
    flex: 1,
    gap: Spacing.xs,
  },
  shareTitle: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  shareDescription: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
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
