import { COPY } from '@/constants/copy';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { Icon } from '@/components/ui/Icon';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
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

function DifficultyStars({ difficulty, onImage }: { difficulty: number; onImage?: boolean }): React.ReactElement {
  const stars: React.ReactElement[] = [];
  for (let i = 1; i <= MAX_STARS; i++) {
    const isFilled = i <= difficulty;
    stars.push(
      <Icon
        key={i}
        name="star"
        size={14}
        color={
          isFilled
            ? (onImage ? '#FFD700' : Colors.accent)
            : (onImage ? 'rgba(255,255,255,0.25)' : Colors.border)
        }
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
  const hasImage = Boolean(imageUrl);

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
          <Icon name="restaurant-outline" size={40} color={Colors.text.tertiary} />
        )}
      </View>

      {/* Gradient overlay for text visibility */}
      {hasImage ? (
        <LinearGradient
          colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.2)', 'transparent']}
          locations={[0, 0.4, 0.75]}
          style={styles.gradientOverlay}
        />
      ) : null}

      {/* Info overlays on image, right-aligned */}
      <View style={styles.infoSection}>
        <Text
          style={[styles.title, hasImage && styles.titleOnImage]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {title}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.timeChip}>
            <Icon
              name="time-outline"
              size={14}
              color={hasImage ? 'rgba(255,255,255,0.9)' : Colors.text.primary}
            />
            <Text style={[styles.timeText, hasImage && styles.textOnImage]}>
              {totalTimeMinutes} {COPY.cookbookDetail.minuteShort}
            </Text>
          </View>

          {cuisine ? (
            <View style={styles.cuisineChip}>
              <Text style={[styles.cuisineText, hasImage && styles.cuisineTextOnImage]}>
                {cuisine}
              </Text>
            </View>
          ) : null}
        </View>

        <DifficultyStars difficulty={difficulty} onImage={hasImage} />
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
    backgroundColor: Colors.background.primary,
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
    color: Colors.text.primary,
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
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  titleOnImage: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  textOnImage: {
    color: 'rgba(255,255,255,0.9)',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  cuisineTextOnImage: {
    color: 'rgba(255,255,255,0.85)',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
