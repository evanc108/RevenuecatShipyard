import { CookbookCard } from '@/components/ui/CookbookCard';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import type { Id } from '@/convex/_generated/dataModel';
import { memo, useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

// --- Types ---

type CookbookData = {
  _id: Id<'cookbooks'>;
  name: string;
  description?: string;
  coverImageUrl?: string;
  createdAt: number;
  updatedAt: number;
};

type CookbookCarouselProps = {
  cookbooks: readonly CookbookData[];
  onCardPress: (id: Id<'cookbooks'>) => void;
};

type CarouselCardProps = {
  cookbook: CookbookData;
  index: number;
  translateX: SharedValue<number>;
  cardWidth: number;
  cardHeight: number;
  cardStep: number;
  screenWidth: number;
  totalCards: number;
  onPress: () => void;
};

type PaginationDotsProps = {
  count: number;
  translateX: SharedValue<number>;
  cardStep: number;
};

type PaginationDotProps = {
  index: number;
  translateX: SharedValue<number>;
  cardStep: number;
};

// --- Constants ---

const CARD_WIDTH_RATIO = 0.85;
const CARD_HEIGHT_RATIO = 0.65;
const SWIPE_VELOCITY_THRESHOLD = 500;
const DOT_SIZE = 8;
const DOT_ACTIVE_WIDTH = 24;

// Card carousel appearance
const SCALE_STEP = 0.05;
const CARD_SPACING_RATIO = 0.82;
const ADJACENT_Y_OFFSET = 24;

const SNAP_SPRING = {
  damping: 20,
  stiffness: 150,
  mass: 0.8,
} as const;

// --- Carousel Card ---

const CarouselCard = memo(function CarouselCard({
  cookbook,
  index,
  translateX,
  cardWidth,
  cardHeight,
  cardStep,
  screenWidth,
  totalCards,
  onPress,
}: CarouselCardProps): React.ReactElement {
  const cardLeft = (screenWidth - cardWidth) / 2;

  const animatedStyle = useAnimatedStyle(() => {
    const activeIndex = -translateX.value / cardStep;
    const distance = index - activeIndex;
    const absDistance = Math.abs(distance);

    // Horizontal: spread cards left/right from center
    const cardTranslateX = distance * screenWidth * CARD_SPACING_RATIO;

    // Scale: active = 1.0, adjacent cards progressively smaller
    const scale = interpolate(
      absDistance,
      [0, 1, 2, 3],
      [1, 1 - SCALE_STEP, 1 - SCALE_STEP * 2, 1 - SCALE_STEP * 3],
      Extrapolation.CLAMP,
    );

    // Subtle vertical offset for depth (active card appears elevated)
    const translateY = interpolate(
      absDistance,
      [0, 1, 2],
      [0, ADJACENT_Y_OFFSET, ADJACENT_Y_OFFSET * 1.5],
      Extrapolation.CLAMP,
    );

    // Opacity: active full, adjacent cards faint/ghostly
    const opacity = interpolate(
      absDistance,
      [0, 1, 2, 3],
      [1, 0.5, 0.15, 0],
      Extrapolation.CLAMP,
    );

    const zIndex = 100 - Math.round(absDistance);

    return {
      transform: [
        { translateX: cardTranslateX },
        { translateY },
        { scale },
      ],
      opacity,
      zIndex,
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: cardWidth,
          height: cardHeight,
          left: cardLeft,
          bottom: 0,
          borderRadius: Radius.xl,
        },
        Shadow.elevated,
        animatedStyle,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${cookbook.name} cookbook`}
        style={styles.cardPressable}
        onPress={onPress}
      >
        <CookbookCard
          name={cookbook.name}
          description={cookbook.description}
          recipeCount={0}
          coverImageUrl={cookbook.coverImageUrl}
          variant="carousel"
          onPress={onPress}
        />
      </Pressable>
    </Animated.View>
  );
});

// --- Pagination Dot (black, active is wider pill) ---

const PaginationDot = memo(function PaginationDot({
  index,
  translateX,
  cardStep,
}: PaginationDotProps): React.ReactElement {
  const animatedStyle = useAnimatedStyle(() => {
    const activeIndex = -translateX.value / cardStep;
    const distance = Math.abs(index - activeIndex);

    const dotWidth = interpolate(
      distance,
      [0, 1],
      [DOT_ACTIVE_WIDTH, DOT_SIZE],
      Extrapolation.CLAMP,
    );
    const dotOpacity = interpolate(
      distance,
      [0, 1],
      [1, 0.3],
      Extrapolation.CLAMP,
    );

    return {
      width: dotWidth,
      opacity: dotOpacity,
    };
  });

  return <Animated.View style={[styles.dot, animatedStyle]} />;
});

// --- Pagination Dots ---

function PaginationDots({
  count,
  translateX,
  cardStep,
}: PaginationDotsProps): React.ReactElement | null {
  if (count <= 1) return null;

  return (
    <View style={styles.dotsContainer}>
      {Array.from({ length: count }, (_, i) => (
        <PaginationDot
          key={i}
          index={i}
          translateX={translateX}
          cardStep={cardStep}
        />
      ))}
    </View>
  );
}

// --- Main Carousel ---

export function CookbookCarousel({
  cookbooks,
  onCardPress,
}: CookbookCarouselProps): React.ReactElement {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const cardWidth = screenWidth * CARD_WIDTH_RATIO;
  const cardHeight = screenHeight * CARD_HEIGHT_RATIO;
  // cardStep is the abstract "drag distance per card transition"
  const cardStep = screenWidth * 0.35;

  const translateX = useSharedValue(0);
  const contextX = useSharedValue(0);

  const maxIndex = Math.max(cookbooks.length - 1, 0);

  // Reset position when data changes (sort/search)
  useEffect(() => {
    translateX.value = withSpring(0, SNAP_SPRING);
  }, [cookbooks.length, translateX]);

  const handleCardPress = useCallback(
    (id: Id<'cookbooks'>) => {
      onCardPress(id);
    },
    [onCardPress],
  );

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-5, 5])
    .onStart(() => {
      contextX.value = translateX.value;
    })
    .onUpdate((event) => {
      const proposed = contextX.value + event.translationX;
      const minTranslate = -maxIndex * cardStep;
      const maxTranslate = 0;

      if (proposed > maxTranslate) {
        translateX.value = maxTranslate + (proposed - maxTranslate) * 0.3;
      } else if (proposed < minTranslate) {
        translateX.value = minTranslate + (proposed - minTranslate) * 0.3;
      } else {
        translateX.value = proposed;
      }
    })
    .onEnd((event) => {
      const currentIndex = -translateX.value / cardStep;
      let targetIndex: number;

      if (Math.abs(event.velocityX) > SWIPE_VELOCITY_THRESHOLD) {
        targetIndex =
          event.velocityX > 0
            ? Math.floor(currentIndex)
            : Math.ceil(currentIndex);
      } else {
        targetIndex = Math.round(currentIndex);
      }

      targetIndex = Math.max(0, Math.min(targetIndex, maxIndex));

      translateX.value = withSpring(-targetIndex * cardStep, SNAP_SPRING);
    });

  return (
    <View style={styles.carouselContainer}>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.carouselTrack, { height: cardHeight }]}>
          {cookbooks.map((cookbook, idx) => (
            <CarouselCard
              key={cookbook._id}
              cookbook={cookbook}
              index={idx}
              translateX={translateX}
              cardWidth={cardWidth}
              cardHeight={cardHeight}
              cardStep={cardStep}
              screenWidth={screenWidth}
              totalCards={cookbooks.length}
              onPress={() => handleCardPress(cookbook._id)}
            />
          ))}
        </Animated.View>
      </GestureDetector>

      <PaginationDots
        count={cookbooks.length}
        translateX={translateX}
        cardStep={cardStep}
      />
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  carouselContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  carouselTrack: {
    position: 'relative',
    overflow: 'visible',
  },
  cardPressable: {
    flex: 1,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  dot: {
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: Colors.text.primary,
  },
});
