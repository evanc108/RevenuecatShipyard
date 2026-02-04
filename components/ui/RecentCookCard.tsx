import { memo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadow } from '@/constants/theme';
import { COPY } from '@/constants/copy';

type RecentCookCardProps = {
  title: string;
  imageUrl?: string;
  totalTimeMinutes: number;
  cuisine?: string;
  onPress: () => void;
  onCook: () => void;
};

const CARD_HEIGHT = 100;

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

export const RecentCookCard = memo(function RecentCookCard({
  title,
  imageUrl,
  totalTimeMinutes,
  cuisine,
  onPress,
  onCook,
}: RecentCookCardProps): React.ReactElement {
  const fallbackBg = getPastelForTitle(title);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${totalTimeMinutes} ${COPY.cookbookDetail.minuteShort}`}
      style={styles.card}
      onPress={onPress}
    >
      {/* Thumbnail */}
      <View style={[styles.imageContainer, !imageUrl && { backgroundColor: fallbackBg }]}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <Ionicons name="restaurant-outline" size={24} color={Colors.text.tertiary} />
        )}
      </View>

      {/* Text info */}
      <View style={styles.textArea}>
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {title}
        </Text>
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={13} color={Colors.text.tertiary} />
          <Text style={styles.metaText}>
            {totalTimeMinutes} {COPY.cookbookDetail.minuteShort}
          </Text>
          {cuisine ? (
            <>
              <Text style={styles.metaDot}>{'\u00B7'}</Text>
              <Text style={styles.metaText}>{cuisine}</Text>
            </>
          ) : null}
        </View>
      </View>

      {/* Floating Cook button */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${COPY.cookbookDetail.cook} ${title}`}
        style={styles.cookButton}
        onPress={onCook}
      >
        <Text style={styles.cookText}>{COPY.cookbookDetail.cook}</Text>
      </Pressable>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    height: CARD_HEIGHT,
    borderRadius: Radius.lg,
    backgroundColor: Colors.background.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.sm,
    paddingRight: Spacing.md,
    gap: Spacing.md,
    ...Shadow.surface,
  },
  imageContainer: {
    width: 76,
    height: 76,
    borderRadius: Radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.secondary,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  textArea: {
    flex: 1,
    gap: Spacing.xs,
  },
  title: {
    ...Typography.h3,
    color: Colors.text.primary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metaText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
  metaDot: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
  cookButton: {
    backgroundColor: Colors.text.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  cookText: {
    color: Colors.text.inverse,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
