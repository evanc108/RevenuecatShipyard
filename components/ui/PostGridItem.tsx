import { memo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius } from '@/constants/theme';

type PostGridItemProps = {
  imageUrl?: string | null;
  title: string;
  onPress: () => void;
};

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

export const PostGridItem = memo(function PostGridItem({
  imageUrl,
  title,
  onPress,
}: PostGridItemProps): React.ReactElement {
  const fallbackBg = getPastelForTitle(title);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title} post`}
      style={styles.container}
      onPress={onPress}
    >
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
          <Ionicons name="restaurant-outline" size={32} color={Colors.text.tertiary} />
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    aspectRatio: 1,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  imageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
