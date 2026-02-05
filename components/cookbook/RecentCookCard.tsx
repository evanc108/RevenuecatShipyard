import { COPY } from '@/constants/copy';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { Icon } from '@/components/ui/Icon';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type RecentCookCardProps = {
  title: string;
  imageUrl?: string;
  totalTimeMinutes: number;
  cuisine?: string;
  onPress: () => void;
  onCook: () => void;
  actionLabel?: string;
};

const CARD_HEIGHT = 130;

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
  actionLabel,
}: RecentCookCardProps): React.ReactElement {
  const buttonLabel = actionLabel ?? COPY.cookbookDetail.cook;
  const fallbackBg = getPastelForTitle(title);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${totalTimeMinutes} ${COPY.cookbookDetail.minuteShort}`}
      style={[styles.card, { backgroundColor: fallbackBg }]}
      onPress={onPress}
    >
      {/* Thumbnail */}
      <View style={[styles.imageContainer, !imageUrl && { backgroundColor: 'rgba(255,255,255,0.45)' }]}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <Icon name="restaurant-outline" size={24} color={Colors.text.tertiary} />
        )}
      </View>

      {/* Text info */}
      <View style={styles.textArea}>
        <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
          {title}
        </Text>
        <View style={styles.tagsColumn}>
          <View style={styles.tagChip}>
            <Icon name="time-outline" size={14} color={Colors.text.primary} />
            <Text style={styles.tagText}>
              {totalTimeMinutes} {COPY.cookbookDetail.minuteShort}
            </Text>
          </View>
          {cuisine ? (
            <View style={styles.tagChip}>
              <Text style={styles.tagText}>{cuisine}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Floating Cook button */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${buttonLabel} ${title}`}
        style={styles.cookButton}
        onPress={onCook}
      >
        <View style={styles.cookTextWrapper}>
          <Text style={styles.cookText}>{buttonLabel}</Text>
        </View>
      </Pressable>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    minHeight: CARD_HEIGHT,
    borderRadius: Radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.md,
    paddingRight: Spacing.sm,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
    ...Shadow.surface,
  },
  imageContainer: {
    width: 90,
    height: 90,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
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
  tagsColumn: {
    gap: Spacing.xs,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.5)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  tagText: {
    ...Typography.bodySmall,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  cookButton: {
    backgroundColor: Colors.text.primary,
    width: 40,
    height: 100,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cookTextWrapper: {
    transform: [{ rotate: '90deg' }],
  },
  cookText: {
    color: Colors.text.inverse,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
