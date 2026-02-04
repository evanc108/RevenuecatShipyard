import { COPY } from '@/constants/copy';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
      {/* Image fills entire card as background */}
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

      {/* Info overlays on image, right-aligned */}
      <View style={styles.infoSection}>
        <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
          {title}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.timeChip}>
            <Ionicons name="time-outline" size={14} color={Colors.text.secondary} />
            <Text style={styles.timeText}>
              {totalTimeMinutes} {COPY.cookbookDetail.minuteShort}
            </Text>
          </View>

          {cuisine ? (
            <View style={styles.cuisineChip}>
              <Text style={styles.cuisineText}>{cuisine}</Text>
            </View>
          ) : null}
        </View>

        <DifficultyStars difficulty={difficulty} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  imageContainer: {
    ...StyleSheet.absoluteFillObject,
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
    alignItems: 'flex-end',
  },
  title: {
    ...Typography.h1,
    color: Colors.text.primary,
    textAlign: 'right',
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
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  timeText: {
    ...Typography.caption,
    color: Colors.text.secondary,
  },
  cuisineChip: {
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
