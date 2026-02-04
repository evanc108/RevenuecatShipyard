import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type PostRowProps = {
  recipeTitle: string;
  recipeImageUrl?: string | null;
  easeRating: number;
  tasteRating: number;
  presentationRating: number;
  notes?: string | null;
  createdAt: number;
  onPress: () => void;
};

function calculateAverageRating(ease: number, taste: number, presentation: number): number {
  return Math.round(((ease + taste + presentation) / 3) * 10) / 10;
}

const IMAGE_SIZE = 56;
const STAR_COLOR = '#FFB800';

const PASTEL_FALLBACKS: readonly string[] = [
  '#FFE8D6',
  '#D6E8FF',
  '#E0D6FF',
  '#D6FFE8',
  '#FFF5D6',
  '#FFD6E0',
] as const;

function getPastelForTitle(title: string): string {
  const hash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return PASTEL_FALLBACKS[hash % PASTEL_FALLBACKS.length] ?? PASTEL_FALLBACKS[0];
}

function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}


export const PostRow = memo(function PostRow({
  recipeTitle,
  recipeImageUrl,
  easeRating,
  tasteRating,
  presentationRating,
  notes,
  createdAt,
  onPress,
}: PostRowProps): React.ReactElement {
  const fallbackBg = getPastelForTitle(recipeTitle);
  const averageRating = calculateAverageRating(easeRating, tasteRating, presentationRating);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${recipeTitle} post`}
      style={styles.row}
      onPress={onPress}
    >
      {/* Thumbnail */}
      <View style={[styles.imageContainer, !recipeImageUrl && { backgroundColor: fallbackBg }]}>
        {recipeImageUrl ? (
          <Image
            source={{ uri: recipeImageUrl }}
            style={styles.image}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <Ionicons name="restaurant-outline" size={24} color={Colors.text.tertiary} />
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Title */}
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {recipeTitle}
        </Text>

        {/* Date */}
        <Text style={styles.dateText}>{formatRelativeDate(createdAt)}</Text>

        {/* Notes if present */}
        {notes ? (
          <Text style={styles.notes} numberOfLines={2} ellipsizeMode="tail">
            {notes}
          </Text>
        ) : null}
      </View>

      {/* Average Rating */}
      <View style={styles.ratingContainer}>
        <Ionicons name="star" size={16} color={STAR_COLOR} />
        <Text style={styles.ratingText}>{averageRating.toFixed(1)}</Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    backgroundColor: Colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  imageContainer: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...Typography.label,
    color: Colors.text.primary,
  },
  dateText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
  notes: {
    ...Typography.caption,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    ...Typography.label,
    color: Colors.text.primary,
  },
});
