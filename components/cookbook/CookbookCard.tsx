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
}: CookbookCardProps): React.ReactElement {
  const pastelBg = getPastelForName(name);
  const isCarousel = variant === 'carousel';
  const hasImage = Boolean(coverImageUrl);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name} cookbook with ${recipeCount} recipes`}
      style={[
        styles.card,
        { backgroundColor: pastelBg },
        isCarousel ? styles.cardCarousel : styles.cardGrid,
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
      <View style={[styles.content, isCarousel && styles.contentCarousel]}>
        {/* Recipe count */}
        <Text
          style={[
            styles.recipeCount,
            isCarousel && styles.recipeCountCarousel,
            hasImage && styles.textOnImage,
          ]}
        >
          {recipeCount} {recipeCount === 1 ? 'Recipe' : 'Recipes'}
        </Text>

        {/* Name */}
        <Text
          style={[
            styles.cardTitle,
            isCarousel ? styles.cardTitleCarousel : styles.cardTitleGrid,
            hasImage && styles.titleOnImage,
          ]}
          numberOfLines={isCarousel ? 2 : 3}
          ellipsizeMode="tail"
        >
          {name}
        </Text>

        {/* Description — carousel only */}
        {isCarousel && description ? (
          <Text
            style={[
              styles.cardDescription,
              styles.cardDescriptionCarousel,
              hasImage && styles.descriptionOnImage,
            ]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {description}
          </Text>
        ) : null}
      </View>

      {/* More button */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cookbook options"
        style={[styles.moreIcon, isCarousel && styles.moreIconCarousel]}
        onPress={onMorePress}
        hitSlop={12}
      >
        <Icon
          name="apps"
          size={isCarousel ? 24 : 18}
          color={hasImage ? 'rgba(255,255,255,0.7)' : Colors.text.tertiary}
        />
      </Pressable>
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
    aspectRatio: 0.85,
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
  contentCarousel: {
    padding: Spacing.xl,
    paddingTop: Spacing.xxl,
  },

  // Recipe count — black
  recipeCount: {
    ...Typography.caption,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  recipeCountCarousel: {
    fontSize: 14,
    marginBottom: Spacing.sm,
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
    fontSize: 20,
    lineHeight: 24,
  },
  cardTitleCarousel: {
    fontSize: 32,
    lineHeight: 38,
    marginBottom: Spacing.sm,
  },

  // Description
  cardDescription: {
    ...Typography.h1,
    color: Colors.text.primary,
  },
  cardDescriptionCarousel: {
    fontSize: 16,
    lineHeight: 22,
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
    top: Spacing.xl,
    right: Spacing.lg,
  },
  moreIconCarousel: {
    top: Spacing.xxl,
    right: Spacing.xl,
  },
});
