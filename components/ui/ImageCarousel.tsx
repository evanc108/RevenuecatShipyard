import { memo, useCallback, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Image } from 'expo-image';
import { Colors } from '@/constants/theme';

type ImageCarouselProps = {
  imageUrls: string[];
  width: number;
  height: number;
  borderRadius?: number;
};

export const ImageCarousel = memo(function ImageCarousel({
  imageUrls,
  width,
  height,
  borderRadius = 0,
}: ImageCarouselProps): React.ReactElement {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / width);
      setActiveIndex(index);
    },
    [width]
  );

  if (imageUrls.length === 1) {
    return (
      <View style={[{ width, height, borderRadius, overflow: 'hidden' }]}>
        <Image
          source={{ uri: imageUrls[0] }}
          style={{ width, height }}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
      </View>
    );
  }

  return (
    <View style={{ width }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        style={[{ width, height, borderRadius, overflow: 'hidden' }]}
      >
        {imageUrls.map((uri, index) => (
          <Image
            key={`${uri}-${index}`}
            source={{ uri }}
            style={{ width, height }}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ))}
      </ScrollView>
      <View style={styles.dotsContainer}>
        {imageUrls.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === activeIndex ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 8,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: Colors.accent,
  },
  dotInactive: {
    backgroundColor: Colors.border,
  },
});
