import { memo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '@/constants/theme';

type CookbookCardProps = {
  name: string;
  description?: string | null;
  recipeCount: number;
  coverImageUrl?: string | null;
  onPress: () => void;
};

// Beautiful gradient patterns for cookbooks without cover images
type GradientColors = readonly [string, string];

const GRADIENT_PATTERNS: readonly GradientColors[] = [
  ['#667eea', '#764ba2'], // Purple blue
  ['#f093fb', '#f5576c'], // Pink
  ['#4facfe', '#00f2fe'], // Blue cyan
  ['#43e97b', '#38f9d7'], // Green mint
  ['#fa709a', '#fee140'], // Pink yellow
  ['#a8edea', '#fed6e3'], // Soft teal pink
  ['#ff9a9e', '#fecfef'], // Soft pink
  ['#ffecd2', '#fcb69f'], // Peach
] as const;

function getGradientForName(name: string): GradientColors {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return GRADIENT_PATTERNS[hash % GRADIENT_PATTERNS.length] ?? GRADIENT_PATTERNS[0];
}

export const CookbookCard = memo(function CookbookCard({
  name,
  description,
  recipeCount,
  coverImageUrl,
  onPress,
}: CookbookCardProps): React.ReactElement {
  const gradient = getGradientForName(name);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name} cookbook with ${recipeCount} recipes`}
      style={styles.card}
      onPress={onPress}
    >
      {/* Background */}
      {coverImageUrl ? (
        <Image
          source={{ uri: coverImageUrl }}
          style={styles.backgroundImage}
          contentFit="cover"
          transition={300}
          cachePolicy="memory-disk"
        />
      ) : (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.backgroundGradient}
        />
      )}

      {/* Overlay gradient for text readability */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.6)']}
        locations={[0, 0.4, 1]}
        style={styles.overlay}
      />

      {/* Recipe count badge — top left */}
      <View style={styles.recipeBadge}>
        <Ionicons name="restaurant-outline" size={18} color="rgba(255,255,255,0.95)" />
        <Text style={styles.recipeBadgeText}>{recipeCount}</Text>
      </View>

      {/* Content — bottom left */}
      <View style={styles.content}>
        <Text style={styles.cardTitle} numberOfLines={1} ellipsizeMode="tail">
          {name}
        </Text>
        {description ? (
          <Text style={styles.cardDescription} numberOfLines={1} ellipsizeMode="tail">
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    width: '100%',
    aspectRatio: 1.2,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    backgroundColor: Colors.background.secondary,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  recipeBadge: {
    position: 'absolute',
    top: Spacing.sm + 4,
    left: Spacing.sm + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    zIndex: 2,
  },
  recipeBadgeText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.md,
    zIndex: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
    letterSpacing: -0.3,
    marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cardDescription: {
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.8)',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
