import { memo } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Icon } from '@/components/ui/Icon';
import { Colors, Spacing, Typography } from '@/constants/theme';

type ProfilePostCardProps = {
  recipeTitle: string;
  recipeImageUrl?: string | null;
  easeRating: number;
  tasteRating: number;
  presentationRating: number;
  notes?: string | null;
  createdAt: number;
  onPress: () => void;
  onMenuPress?: () => void;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_HEIGHT = SCREEN_WIDTH * 0.6;

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

export const ProfilePostCard = memo(function ProfilePostCard({
  recipeTitle,
  recipeImageUrl,
  easeRating,
  tasteRating,
  presentationRating,
  notes,
  createdAt,
  onPress,
  onMenuPress,
}: ProfilePostCardProps): React.ReactElement {
  const fallbackBg = getPastelForTitle(recipeTitle);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${recipeTitle} post`}
      style={styles.card}
      onPress={onPress}
    >
      {/* Image */}
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
          <View style={styles.imagePlaceholder}>
            <Ionicons name="restaurant-outline" size={48} color={Colors.text.tertiary} />
          </View>
        )}
        {onMenuPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Post options"
            style={styles.menuButton}
            onPress={(e) => {
              e.stopPropagation();
              onMenuPress();
            }}
            hitSlop={12}
          >
            <Icon name="apps" size={22} color={Colors.text.inverse} />
          </Pressable>
        ) : null}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {recipeTitle}
        </Text>

        <Text style={styles.date}>{formatRelativeDate(createdAt)}</Text>

        {notes ? (
          <Text style={styles.notes} numberOfLines={2}>
            "{notes}"
          </Text>
        ) : null}

        <Text style={styles.ratings}>
          ease {easeRating} · taste {tasteRating} · look {presentationRating}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    width: SCREEN_WIDTH,
    backgroundColor: Colors.background.primary,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  imageContainer: {
    width: '100%',
    height: IMAGE_HEIGHT,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButton: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    padding: Spacing.xs,
  },
  content: {
    padding: Spacing.md,
  },
  title: {
    ...Typography.h3,
    color: Colors.text.primary,
  },
  date: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    marginTop: Spacing.xs,
  },
  notes: {
    ...Typography.body,
    color: Colors.text.secondary,
    fontStyle: 'italic',
    marginTop: Spacing.sm,
  },
  ratings: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    marginTop: Spacing.sm,
  },
});
