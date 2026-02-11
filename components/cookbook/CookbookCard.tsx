import { Icon } from '@/components/ui/Icon';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type CookbookCardProps = {
  name: string;
  description?: string | null;
  recipeCount: number;
  coverImageUrl?: string | null;
  onPress: () => void;
  onMorePress?: () => void;
  variant?: 'grid' | 'carousel';
  size?: 'default' | 'compact';
};

// Solid pastel palette for cookbooks without cover images
const PASTEL_COLORS: readonly string[] = [
  '#E0D6FF', // Lavender
  '#FFD6E0', // Pink
  '#D6E8FF', // Sky blue
  '#D6FFE8', // Mint
  '#FFE8D6', // Peach
  '#FFF5D6', // Butter
  '#D6F0E0', // Sage
  '#FFE0D6', // Coral
] as const;

function getPastelForName(name: string): string {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return PASTEL_COLORS[hash % PASTEL_COLORS.length] ?? PASTEL_COLORS[0];
}

export const CookbookCard = memo(function CookbookCard({
  name,
  description,
  recipeCount,
  coverImageUrl,
  onPress,
  onMorePress,
  variant = 'grid',
  size = 'default',
}: CookbookCardProps): React.ReactElement {
  const pastelBg = getPastelForName(name);
  const isCarousel = variant === 'carousel';
  const isCompact = size === 'compact';
  const hasImage = Boolean(coverImageUrl);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name} cookbook with ${recipeCount} recipes`}
      style={[
        styles.card,
        { backgroundColor: pastelBg },
        isCarousel
          ? styles.cardCarousel
          : (isCompact ? styles.cardGridCompact : styles.cardGrid),
      ]}
      onPress={onPress}
    >
      {/* Full-bleed cover image */}
      {hasImage ? (
        <>
          <Image
            source={{ uri: coverImageUrl ?? undefined }}
            style={styles.fullBleedImage}
            contentFit="cover"
            transition={300}
            cachePolicy="memory-disk"
          />
          {/* Top gradient overlay for text readability on images */}
          <LinearGradient
            colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.2)', 'transparent']}
            locations={[0, 0.4, 0.7]}
            style={styles.topOverlay}
          />
        </>
      ) : null}

      {/* Content — top-left with padding */}
      <View style={[
        styles.content,
        isCarousel
          ? (isCompact ? styles.contentCarouselCompact : styles.contentCarousel)
          : (isCompact && styles.contentGridCompact),
      ]}>
        {/* Recipe count */}
        <Text
          style={[
            styles.recipeCount,
            isCarousel
              ? (isCompact ? styles.recipeCountCarouselCompact : styles.recipeCountCarousel)
              : (isCompact && styles.recipeCountGridCompact),
            hasImage && styles.textOnImage,
          ]}
        >
          {recipeCount} {recipeCount === 1 ? 'Recipe' : 'Recipes'}
        </Text>

        {/* Name */}
        <Text
          style={[
            styles.cardTitle,
            isCarousel
              ? (isCompact ? styles.cardTitleCarouselCompact : styles.cardTitleCarousel)
              : (isCompact ? styles.cardTitleGridCompact : styles.cardTitleGrid),
            hasImage && styles.titleOnImage,
          ]}
        >
          {name}
        </Text>

        {/* Description — carousel only */}
        {isCarousel && description ? (
          <Text
            style={[
              styles.cardDescription,
              isCompact ? styles.cardDescriptionCarouselCompact : styles.cardDescriptionCarousel,
              hasImage && styles.descriptionOnImage,
            ]}
          >
            {description}
          </Text>
        ) : null}
      </View>

      {/* More button — only shown when handler is provided */}
      {onMorePress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cookbook options"
          style={[
            styles.moreIcon,
            isCarousel
              ? (isCompact ? styles.moreIconCarouselCompact : styles.moreIconCarousel)
              : (isCompact && styles.moreIconGridCompact),
          ]}
          onPress={onMorePress}
          hitSlop={12}
        >
          <Icon
            name="apps"
            size={isCarousel ? (isCompact ? 18 : 24) : (isCompact ? 18 : 20)}
            color={hasImage ? 'rgba(255,255,255,0.7)' : Colors.text.tertiary}
          />
        </Pressable>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  cardGrid: {
    width: '100%',
    aspectRatio: 0.65,
  },
  cardGridCompact: {
    width: '100%',
    flex: 1,
  },
  cardCarousel: {
    flex: 1,
  },

  // Full-bleed cover image
  fullBleedImage: {
    ...StyleSheet.absoluteFillObject,
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
  },

  // Content — top-left aligned
  content: {
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  // Default carousel content (larger padding)
  contentCarousel: {
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  // Compact carousel content (profile page)
  contentCarouselCompact: {
    padding: Spacing.md,
    paddingTop: Spacing.lg,
  },
  // Compact grid content (profile page)
  contentGridCompact: {
    padding: Spacing.md,
    paddingTop: Spacing.md,
  },

  // Recipe count — black
  recipeCount: {
    ...Typography.caption,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  // Default carousel recipe count
  recipeCountCarousel: {
    fontSize: 16,
    marginBottom: Spacing.sm,
  },
  // Compact carousel recipe count (profile page)
  recipeCountCarouselCompact: {
    fontSize: 12,
    marginBottom: Spacing.xs,
  },
  // Compact grid recipe count (profile page)
  recipeCountGridCompact: {
    fontSize: 11,
    marginBottom: 2,
  },

  // Title — big and bold
  cardTitle: {
    ...Typography.h1,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  cardTitleGrid: {
    fontSize: 22,
    lineHeight: 26,
  },
  // Compact grid title (profile page)
  cardTitleGridCompact: {
    fontSize: 18,
    lineHeight: 22,
  },
  // Default carousel title (larger)
  cardTitleCarousel: {
    fontSize: 32,
    lineHeight: 36,
    marginBottom: Spacing.sm,
  },
  // Compact carousel title (profile page)
  cardTitleCarouselCompact: {
    fontSize: 24,
    lineHeight: 28,
    marginBottom: Spacing.xs,
  },

  // Description
  cardDescription: {
    ...Typography.h1,
    color: Colors.text.primary,
  },
  // Default carousel description
  cardDescriptionCarousel: {
    fontSize: 17,
    lineHeight: 22,
  },
  // Compact carousel description (profile page)
  cardDescriptionCarouselCompact: {
    fontSize: 13,
    lineHeight: 18,
  },

  // Text-on-image overrides (white text with shadow)
  textOnImage: {
    color: 'rgba(255,255,255,0.9)',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  titleOnImage: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  descriptionOnImage: {
    color: 'rgba(255,255,255,0.85)',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Clickable indicator — top-right
  moreIcon: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
  },
  moreIconCarousel: {
    top: Spacing.lg,
    right: Spacing.lg,
  },
  moreIconCarouselCompact: {
    top: Spacing.md,
    right: Spacing.md,
  },
  moreIconGridCompact: {
    top: Spacing.md,
    right: Spacing.md,
  },
});
