import { useCallback, useState, useLayoutEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { RecipeCard, Recipe } from './RecipeCard';
import { Colors, Typography, Spacing } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

type SwipeableCardStackProps = {
  recipes: Recipe[];
  onSwipeLeft?: (recipe: Recipe) => void;
  onSwipeRight?: (recipe: Recipe) => void;
  onPress?: (recipe: Recipe) => void;
};

export function SwipeableCardStack({
  recipes,
  onSwipeLeft,
  onSwipeRight,
  onPress,
}: SwipeableCardStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const isSwipingRef = useRef(false);

  // Restore card opacity after React re-renders with the new card
  useLayoutEffect(() => {
    if (isSwipingRef.current) {
      cardOpacity.value = 1;
      isSwipingRef.current = false;
    }
  }, [currentIndex, cardOpacity]);

  const currentRecipe = recipes[currentIndex];
  const nextRecipe = recipes[currentIndex + 1];
  const isFirstCard = currentIndex === 0;

  const handleSwipeComplete = useCallback(
    (direction: 'left' | 'right') => {
      if (direction === 'left') {
        onSwipeLeft?.(recipes[currentIndex]);
      } else {
        onSwipeRight?.(recipes[currentIndex]);
      }
      setCurrentIndex((prev) => prev + 1);
    },
    [currentIndex, recipes, onSwipeLeft, onSwipeRight]
  );

  const resetPosition = useCallback(() => {
    translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
    translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
    rotation.value = withSpring(0, { damping: 20, stiffness: 200 });
  }, [translateX, translateY, rotation]);

  const setSwipingFlag = useCallback(() => {
    isSwipingRef.current = true;
  }, []);

  const swipeOff = useCallback(
    (direction: 'left' | 'right') => {
      const targetX = direction === 'left' ? -SCREEN_WIDTH * 1.5 : SCREEN_WIDTH * 1.5;
      translateX.value = withTiming(targetX, { duration: 300 }, (finished) => {
        'worklet';
        if (finished) {
          // Hide card before resetting position to prevent flash
          cardOpacity.value = 0;
          translateX.value = 0;
          translateY.value = 0;
          rotation.value = 0;
          // Set flag and update state - opacity restored in useLayoutEffect
          runOnJS(setSwipingFlag)();
          runOnJS(handleSwipeComplete)(direction);
        }
      });
      translateY.value = withTiming(-50, { duration: 300 });
    },
    [translateX, translateY, rotation, cardOpacity, setSwipingFlag, handleSwipeComplete]
  );

  const handlePress = useCallback(() => {
    if (currentRecipe) {
      onPress?.(currentRecipe);
    }
  }, [currentRecipe, onPress]);

  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      runOnJS(handlePress)();
    });

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.5;
      rotation.value = interpolate(
        event.translationX,
        [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
        [-15, 0, 15],
        Extrapolation.CLAMP
      );
    })
    .onEnd((event) => {
      if (event.translationX > SWIPE_THRESHOLD) {
        runOnJS(swipeOff)('right');
      } else if (event.translationX < -SWIPE_THRESHOLD) {
        runOnJS(swipeOff)('left');
      } else {
        runOnJS(resetPosition)();
      }
    });

  const composedGesture = Gesture.Exclusive(panGesture, tapGesture);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotation.value}deg` },
    ],
    opacity: cardOpacity.value,
  }));

  const nextCardAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      Math.abs(translateX.value),
      [0, SCREEN_WIDTH / 2],
      [0.95, 1],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ scale }],
      opacity: interpolate(
        Math.abs(translateX.value),
        [0, SCREEN_WIDTH / 4],
        [0.5, 1],
        Extrapolation.CLAMP
      ),
    };
  });

  const hintOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      Math.abs(translateX.value),
      [0, 50],
      [1, 0],
      Extrapolation.CLAMP
    ),
  }));

  if (currentIndex >= recipes.length) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No more recipes</Text>
        <Text style={styles.emptySubtitle}>
          Check back later for more delicious discoveries
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.cardsWrapper}>
        {/* Next card (underneath) */}
        {nextRecipe && (
          <Animated.View style={[styles.cardContainer, styles.nextCard, nextCardAnimatedStyle]}>
            <RecipeCard recipe={nextRecipe} />
          </Animated.View>
        )}

        {/* Current card (on top) */}
        {currentRecipe && (
          <GestureDetector gesture={composedGesture}>
            <Animated.View style={[styles.cardContainer, cardAnimatedStyle]}>
              <RecipeCard recipe={currentRecipe} />
            </Animated.View>
          </GestureDetector>
        )}
      </View>

      {/* Subtle swipe hint - only on first card */}
      {isFirstCard && (
        <Animated.View style={[styles.hintContainer, hintOverlayStyle]}>
          <Text style={styles.hintText}>← Skip</Text>
          <Text style={styles.hintText}>Save →</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: Spacing.md,
  },
  cardsWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  cardContainer: {
    position: 'absolute',
  },
  nextCard: {
    zIndex: -1,
  },
  hintContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    width: '100%',
  },
  hintText: {
    ...Typography.bodySmall,
    color: Colors.text.tertiary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.h2,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});
