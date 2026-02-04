import { memo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadow } from '@/constants/theme';
import { COPY } from '@/constants/copy';

type RecipeCardProps = {
  title: string;
  imageUrl?: string;
  totalTimeMinutes: number;
  difficulty: number; // 1-5
  cuisine?: string;
  onPress: () => void;
};

const PASTEL_FALLBACKS: readonly string[] = [
  '#FFE8D6',
  '#D6E8FF',
  '#E0D6FF',
  '#D6FFE8',
  '#FFF5D6',
  '#FFD6E0',
  '#D6F0E0',
  '#FFE0D6',
] as const;

function getPastelForTitle(title: string): string {
  const hash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return PASTEL_FALLBACKS[hash % PASTEL_FALLBACKS.length] ?? PASTEL_FALLBACKS[0];
}

const MAX_STARS = 5;

function DifficultyStars({ difficulty }: { difficulty: number }): React.ReactElement {
  const stars: React.ReactElement[] = [];
  for (let i = 1; i <= MAX_STARS; i++) {
    stars.push(
      <Ionicons
        key={i}
        name={i <= difficulty ? 'star' : 'star-outline'}
        size={14}
        color={i <= difficulty ? Colors.accent : Colors.text.tertiary}
      />,
    );
  }
  return <View style={styles.starsRow}>{stars}</View>;
}

export const RecipeCard = memo(function RecipeCard({
  title,
  imageUrl,
  totalTimeMinutes,
  difficulty,
  cuisine,
  onPress,
}: RecipeCardProps): React.ReactElement {
  const fallbackBg = getPastelForTitle(title);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${totalTimeMinutes} ${COPY.cookbookDetail.minuteShort}, difficulty ${difficulty} of ${MAX_STARS}`}
      style={styles.card}
      onPress={onPress}
    >
      {/* Hero image */}
      <View style={[styles.imageContainer, !imageUrl && { backgroundColor: fallbackBg }]}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.heroImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <Ionicons name="restaurant-outline" size={40} color={Colors.text.tertiary} />
        )}
      </View>

      {/* Info section */}
      <View style={styles.infoSection}>
        <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
          {title}
        </Text>

        <View style={styles.metaRow}>
          {/* Time */}
          <View style={styles.timeChip}>
            <Ionicons name="time-outline" size={14} color={Colors.text.secondary} />
            <Text style={styles.timeText}>
              {totalTimeMinutes} {COPY.cookbookDetail.minuteShort}
            </Text>
          </View>

          {/* Cuisine tag */}
          {cuisine ? (
            <View style={styles.cuisineChip}>
              <Text style={styles.cuisineText}>{cuisine}</Text>
            </View>
          ) : null}
        </View>

        {/* Difficulty */}
        <DifficultyStars difficulty={difficulty} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    backgroundColor: Colors.background.primary,
    overflow: 'hidden',
    ...Shadow.surface,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 16 / 10,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  infoSection: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  title: {
    ...Typography.h3,
    color: Colors.text.primary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.background.secondary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  timeText: {
    ...Typography.caption,
    color: Colors.text.secondary,
  },
  cuisineChip: {
    backgroundColor: Colors.accentLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  cuisineText: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '600',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
});
