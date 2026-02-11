import { Icon } from '@/components/ui/Icon';
import { COPY } from '@/constants/copy';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type RecipeCardProps = {
  title: string;
  imageUrl?: string;
  totalTimeMinutes: number;
  difficulty?: number; // 1-5, omit or 0 to hide stars
  cuisine?: string;
  onPress: () => void;
  onMorePress?: () => void;
  compact?: boolean; // true for grid view (smaller text)
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

function DifficultyStars({
  difficulty,
  onImage,
  starSize,
  strokeWidth,
}: {
  difficulty: number;
  onImage?: boolean;
  starSize: number;
  strokeWidth: number;
}): React.ReactElement {
  const stars: React.ReactElement[] = [];
  for (let i = 1; i <= MAX_STARS; i++) {
    const isFilled = i <= difficulty;
    stars.push(
      <Icon
        key={i}
        name="star"
        size={starSize}
        strokeWidth={strokeWidth}
        filled={isFilled}
        color={
          isFilled
            ? (onImage ? '#FFD700' : Colors.accent)
            : (onImage ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.8)')
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
  difficulty = 0,
  cuisine,
  onPress,
  onMorePress,
  compact = false,
}: RecipeCardProps): React.ReactElement {
  const fallbackBg = getPastelForTitle(title);
  const hasImage = Boolean(imageUrl);
  const showStars = difficulty > 0;
  const starSize = compact ? 15 : 18;
  const starStrokeWidth = compact ? 2 : 2;
  const metaIconSize = compact ? 14 : 16;
  const moreIconSize = compact ? 20 : 28;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${totalTimeMinutes} ${COPY.cookbookDetail.minuteShort}${showStars ? `, rating ${difficulty} of ${MAX_STARS}` : ''}`}
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
          colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.2)', 'transparent']}
          locations={[0, 0.4, 0.75]}
          style={styles.gradientOverlay}
        />
      ) : null}

      {/* Settings button — top-right */}
      {onMorePress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Recipe options"
          style={compact ? styles.moreIconCompact : styles.moreIcon}
          onPress={onMorePress}
          hitSlop={12}
        >
          <Icon
            name="apps"
            size={moreIconSize}
            color={hasImage ? 'rgba(255,255,255,0.7)' : Colors.text.tertiary}
          />
        </Pressable>
      ) : null}

      {/* Info overlays on image, left-aligned */}
      <View style={compact ? styles.infoSectionCompact : styles.infoSection}>
        <Text
          style={[
            compact ? styles.titleCompact : styles.title,
            hasImage && styles.titleOnImage,
          ]}
        >
          {title}
        </Text>

        <View style={styles.metaRow}>
          <View style={compact ? styles.timeChipCompact : styles.timeChip}>
            <Icon
              name="time-outline"
              size={metaIconSize}
              color={hasImage ? 'rgba(255,255,255,0.95)' : Colors.text.primary}
            />
            <Text
              style={[
                compact ? styles.metaTextCompact : styles.metaText,
                hasImage && styles.textOnImage,
              ]}
            >
              {totalTimeMinutes} {COPY.cookbookDetail.minuteShort}
            </Text>
          </View>

          {cuisine ? (
            <View style={compact ? styles.cuisineChipCompact : styles.cuisineChip}>
              <Text
                style={[
                  compact ? styles.cuisineTextCompact : styles.cuisineText,
                  hasImage && styles.cuisineTextOnImage,
                ]}
              >
                {cuisine}
              </Text>
            </View>
          ) : null}
        </View>

        {showStars ? (
          <DifficultyStars
            difficulty={difficulty}
            onImage={hasImage}
            starSize={starSize}
            strokeWidth={starStrokeWidth}
          />
        ) : null}
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
  // Stack view info section
  infoSection: {
    padding: Spacing.md,
    paddingRight: Spacing.xl + Spacing.md,
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  // Grid view info section — tighter spacing
  infoSectionCompact: {
    padding: Spacing.sm,
    paddingRight: Spacing.xl,
    gap: Spacing.xs,
    alignItems: 'flex-start',
  },
  title: {
    ...Typography.h1,
    color: Colors.text.primary,
    textAlign: 'left',
    maxWidth: '90%',
  },
  titleCompact: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
    color: Colors.text.primary,
    textAlign: 'left',
    maxWidth: '90%',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  timeChipCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: Radius.full,
  },
  metaText: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  metaTextCompact: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600' as const,
    color: Colors.text.primary,
  },
  cuisineChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  cuisineChipCompact: {
    borderRadius: Radius.full,
  },
  cuisineText: {
    ...Typography.body,
    color: Colors.accent,
    fontWeight: '600',
  },
  cuisineTextCompact: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700' as const,
    color: Colors.accent,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 3,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  moreIcon: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
    zIndex: 1,
  },
  moreIconCompact: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    zIndex: 1,
  },
  titleOnImage: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  textOnImage: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cuisineTextOnImage: {
    color: 'rgba(255,255,255,0.95)',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
