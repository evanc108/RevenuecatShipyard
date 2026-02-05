import { CookbookCard } from '@/components/cookbook/CookbookCard';
import { Icon } from '@/components/ui/Icon';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import type { Id } from '@/convex/_generated/dataModel';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

// --- Types ---

type CookbookData = {
  _id: Id<'cookbooks'>;
  name: string;
  description?: string;
  coverImageUrl?: string;
  recipeCount: number;
  createdAt: number;
  updatedAt: number;
};

type ViewMode = 'slider' | 'grid';

type CookbookCarouselProps = {
  cookbooks: readonly CookbookData[];
  onCardPress: (id: Id<'cookbooks'>) => void;
  onMorePress: (id: Id<'cookbooks'>) => void;
  onAddPress: () => void;
  viewMode: ViewMode;
  onToggleViewMode: () => void;
};

type CarouselCardProps = {
  cookbook: CookbookData;
  index: number;
  translateX: SharedValue<number>;
  cardWidth: number;
  cardStep: number;
  screenWidth: number;
  onPress: () => void;
  onMorePress: () => void;
};

type AddCardProps = {
  index: number;
  translateX: SharedValue<number>;
  cardWidth: number;
  cardStep: number;
  screenWidth: number;
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
const SWIPE_VELOCITY_THRESHOLD = 500;
const DOT_SIZE = 6;
const DOT_ACTIVE_WIDTH = 18;

// Card carousel appearance
const SCALE_STEP = 0.05;
const CARD_SPACING_RATIO = 0.82;
const ADJACENT_Y_OFFSET = 24;
const CARD_STEP_RATIO = 0.35;

const SNAP_SPRING = {
  damping: 20,
  stiffness: 150,
  mass: 0.8,
} as const;

// Grid constants
const GRID_COLUMNS = 2;
const GRID_GAP = Spacing.md;

// Add card decorative fills
const STROKE_FILL_PRIMARY = '#EEEEF3';
const STROKE_FILL_SECONDARY = '#F2F2F6';

// --- Shared animation hook ---

function useCardAnimatedStyle(
  index: number,
  translateX: SharedValue<number>,
  cardStep: number,
  screenWidth: number,
) {
  return useAnimatedStyle(() => {
    const activeIndex = -translateX.value / cardStep;
    const distance = index - activeIndex;
    const absDistance = Math.abs(distance);

    const cardTranslateX = distance * screenWidth * CARD_SPACING_RATIO;

    const scale = interpolate(
      absDistance,
      [0, 1, 2, 3],
      [1, 1 - SCALE_STEP, 1 - SCALE_STEP * 2, 1 - SCALE_STEP * 3],
      Extrapolation.CLAMP,
    );

    const translateY = interpolate(
      absDistance,
      [0, 1, 2],
      [0, ADJACENT_Y_OFFSET, ADJACENT_Y_OFFSET * 1.5],
      Extrapolation.CLAMP,
    );

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
}

// --- Carousel Card ---

const CarouselCard = memo(function CarouselCard({
  cookbook,
  index,
  translateX,
  cardWidth,
  cardStep,
  screenWidth,
  onPress,
  onMorePress,
}: CarouselCardProps): React.ReactElement {
  const cardLeft = (screenWidth - cardWidth) / 2;
  const animatedStyle = useCardAnimatedStyle(index, translateX, cardStep, screenWidth);

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: cardWidth,
          left: cardLeft,
          top: 0,
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
          recipeCount={cookbook.recipeCount}
          coverImageUrl={cookbook.coverImageUrl}
          variant="carousel"
          onPress={onPress}
          onMorePress={onMorePress}
        />
      </Pressable>
    </Animated.View>
  );
});

// --- Add Cookbook Card ---

const AddCookbookCarouselCard = memo(function AddCookbookCarouselCard({
  index,
  translateX,
  cardWidth,
  cardStep,
  screenWidth,
  onPress,
}: AddCardProps): React.ReactElement {
  const cardLeft = (screenWidth - cardWidth) / 2;
  const animatedStyle = useCardAnimatedStyle(index, translateX, cardStep, screenWidth);

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: cardWidth,
          left: cardLeft,
          top: 0,
          bottom: 0,
          borderRadius: Radius.xl,
        },
        Shadow.elevated,
        animatedStyle,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add new cookbook"
        style={styles.cardPressable}
        onPress={onPress}
      >
        <View style={styles.addCardInner}>
          {/* Top-right plus icon */}
          <Icon
            name="plus"
            size={30}
            color={Colors.accent}
            style={styles.addPlusIcon}
          />

          {/* Decorative brush stroke */}
          <Svg
            style={styles.addStroke}
            viewBox="0 0 200 160"
            preserveAspectRatio="xMidYMid meet"
          >
            <Path
              d="M30,80 C45,30 90,15 130,40 C155,55 175,30 185,55 C195,80 170,110 135,105 C100,100 70,120 45,105 C20,90 20,95 30,80Z"
              fill={STROKE_FILL_PRIMARY}
            />
            <Path
              d="M145,25 C155,18 170,22 165,35 C160,48 148,40 145,25Z"
              fill={STROKE_FILL_SECONDARY}
            />
            <Path
              d="M25,105 C30,98 45,100 40,112 C35,120 22,115 25,105Z"
              fill={STROKE_FILL_SECONDARY}
            />
          </Svg>

          {/* Centered illustration */}
          <Image
            source={require('@/assets/images/create-cookbook-icon.png')}
            style={styles.addCardImage}
            contentFit="contain"
            cachePolicy="memory-disk"
          />

          {/* Bottom fade */}
          <LinearGradient
            colors={[
              'rgba(255,255,255,0)',
              'rgba(255,255,255,0.15)',
              'rgba(255,255,255,0.4)',
              'rgba(255,255,255,0.7)',
              'rgba(255,255,255,1)',
            ]}
            locations={[0, 0.25, 0.5, 0.75, 1]}
            style={styles.addCardGradient}
          />

          {/* Bottom-left label */}
          <View style={styles.addBottom}>
            <Text style={styles.addCardTitle}>{'Add\nCookbook'}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
});

// --- Pagination Dot ---

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

// --- Grid Add Card (mini ghost card) ---

const GridAddCard = memo(function GridAddCard({
  onPress,
}: {
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add new cookbook"
      style={styles.gridAddCard}
      onPress={onPress}
    >
      {/* Top-right plus icon */}
      <Icon
        name="plus"
        size={22}
        color={Colors.accent}
        style={styles.gridAddPlusIcon}
      />

      {/* Decorative brush stroke */}
      <Svg
        style={styles.gridAddStroke}
        viewBox="0 0 200 160"
        preserveAspectRatio="xMidYMid meet"
      >
        <Path
          d="M30,80 C45,30 90,15 130,40 C155,55 175,30 185,55 C195,80 170,110 135,105 C100,100 70,120 45,105 C20,90 20,95 30,80Z"
          fill={STROKE_FILL_PRIMARY}
        />
        <Path
          d="M145,25 C155,18 170,22 165,35 C160,48 148,40 145,25Z"
          fill={STROKE_FILL_SECONDARY}
        />
        <Path
          d="M25,105 C30,98 45,100 40,112 C35,120 22,115 25,105Z"
          fill={STROKE_FILL_SECONDARY}
        />
      </Svg>

      {/* Centered illustration */}
      <Image
        source={require('@/assets/images/create-cookbook-icon.png')}
        style={styles.gridAddImage}
        contentFit="contain"
        cachePolicy="memory-disk"
      />

      {/* Bottom fade */}
      <LinearGradient
        colors={[
          'rgba(255,255,255,0)',
          'rgba(255,255,255,0.15)',
          'rgba(255,255,255,0.4)',
          'rgba(255,255,255,0.7)',
          'rgba(255,255,255,1)',
        ]}
        locations={[0, 0.25, 0.5, 0.75, 1]}
        style={styles.gridAddGradient}
      />

      {/* Bottom-left label */}
      <View style={styles.gridAddBottom}>
        <Text style={styles.gridAddTitle}>{'Add\nCookbook'}</Text>
      </View>
    </Pressable>
  );
});

// --- View Mode Toggle ---

function ViewModeToggle({
  viewMode,
  onToggle,
}: {
  viewMode: ViewMode;
  onToggle: () => void;
}): React.ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Switch to ${viewMode === 'slider' ? 'grid' : 'slider'} view`}
      style={styles.toggleButton}
      onPress={onToggle}
      hitSlop={8}
    >
      <View style={styles.toggleTrack}>
        <View
          style={[
            styles.toggleIndicator,
            viewMode === 'grid' ? styles.toggleIndicatorRight : null,
          ]}
        />
        <View style={styles.toggleIconContainer}>
          <Icon
            name="layers"
            size={18}
            color={viewMode === 'slider' ? Colors.text.inverse : Colors.text.tertiary}
          />
        </View>
        <View style={styles.toggleIconContainer}>
          <Icon
            name="apps"
            size={18}
            color={viewMode === 'grid' ? Colors.text.inverse : Colors.text.tertiary}
          />
        </View>
      </View>
    </Pressable>
  );
}

// --- Controls Row (dots left, toggle right) ---

function ControlsRow({
  viewMode,
  onToggle,
  count,
  translateX,
  cardStep,
}: {
  viewMode: ViewMode;
  onToggle: () => void;
  count: number;
  translateX: SharedValue<number>;
  cardStep: number;
}): React.ReactElement {
  return (
    <View style={styles.controlsRow}>
      {viewMode === 'slider' && count > 1 ? (
        <PaginationDots count={count} translateX={translateX} cardStep={cardStep} />
      ) : (
        <View />
      )}
      <ViewModeToggle viewMode={viewMode} onToggle={onToggle} />
    </View>
  );
}

// --- Main Carousel ---

export function CookbookCarousel({
  cookbooks,
  onCardPress,
  onMorePress,
  onAddPress,
  viewMode,
  onToggleViewMode,
}: CookbookCarouselProps): React.ReactElement {
  const { width: screenWidth } = useWindowDimensions();

  const cardWidth = screenWidth * CARD_WIDTH_RATIO;
  const cardStep = screenWidth * CARD_STEP_RATIO;

  const translateX = useSharedValue(0);
  const contextX = useSharedValue(0);

  // +1 for the add card at the end
  const totalCards = cookbooks.length + 1;
  const maxIndex = Math.max(totalCards - 1, 0);

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

  // Grid item width accounting for gaps and padding
  const gridItemWidth = (screenWidth - Spacing.lg * 2 - GRID_GAP) / GRID_COLUMNS;

  return (
    <View style={styles.carouselContainer}>
      {/* Controls: dots (left) + toggle (right) */}
      <ControlsRow
        viewMode={viewMode}
        onToggle={onToggleViewMode}
        count={totalCards}
        translateX={translateX}
        cardStep={cardStep}
      />

      {viewMode === 'slider' ? (
        <GestureDetector gesture={panGesture}>
          <Animated.View style={styles.carouselTrack}>
            {cookbooks.map((cookbook, idx) => (
              <CarouselCard
                key={cookbook._id}
                cookbook={cookbook}
                index={idx}
                translateX={translateX}
                cardWidth={cardWidth}
                cardStep={cardStep}
                screenWidth={screenWidth}
                onPress={() => handleCardPress(cookbook._id)}
                onMorePress={() => onMorePress(cookbook._id)}
              />
            ))}

            {/* Add Cookbook card — always last */}
            <AddCookbookCarouselCard
              index={cookbooks.length}
              translateX={translateX}
              cardWidth={cardWidth}
              cardStep={cardStep}
              screenWidth={screenWidth}
              onPress={onAddPress}
            />
          </Animated.View>
        </GestureDetector>
      ) : (
        <ScrollView
          style={styles.gridContainer}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.gridRow}>
            {cookbooks.map((cookbook) => (
              <View
                key={cookbook._id}
                style={[
                  { width: gridItemWidth, marginBottom: GRID_GAP, borderRadius: Radius.xl },
                  styles.gridCardShadow,
                ]}
              >
                <CookbookCard
                  name={cookbook.name}
                  description={cookbook.description}
                  recipeCount={cookbook.recipeCount}
                  coverImageUrl={cookbook.coverImageUrl}
                  variant="grid"
                  onPress={() => handleCardPress(cookbook._id)}
                  onMorePress={() => onMorePress(cookbook._id)}
                />
              </View>
            ))}
            <View
              style={[
                { width: gridItemWidth, marginBottom: GRID_GAP, borderRadius: Radius.xl },
                styles.gridCardShadow,
              ]}
            >
              <GridAddCard onPress={onAddPress} />
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  carouselContainer: {
    flex: 1,
  },
  carouselTrack: {
    flex: 1,
    overflow: 'visible',
  },
  cardPressable: {
    flex: 1,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },

  // Controls row (dots left, toggle right)
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    minHeight: 32,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginLeft: Spacing.sm,
  },
  dot: {
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: Colors.text.primary,
  },

  // View mode toggle
  toggleButton: {
    padding: Spacing.xs,
  },
  toggleTrack: {
    flexDirection: 'row',
    width: 88,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background.tertiary,
    alignItems: 'center',
    position: 'relative',
  },
  toggleIndicator: {
    position: 'absolute',
    width: 42,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.text.primary,
    left: 2,
    top: 2,
  },
  toggleIndicatorRight: {
    left: 44,
  },
  toggleIconContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },

  // Grid view
  gridContainer: {
    flex: 1,
  },
  gridContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  gridAddCard: {
    width: '100%',
    aspectRatio: 0.7,
    borderRadius: Radius.xl,
    backgroundColor: Colors.background.primary,
    overflow: 'hidden',
    ...Shadow.surface,
  },
  gridAddPlusIcon: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    zIndex: 1,
  },
  gridAddStroke: {
    position: 'absolute',
    width: '92%',
    height: '65%',
    top: '8%',
    left: '4%',
  },
  gridAddImage: {
    position: 'absolute',
    width: '88%',
    height: '80%',
    top: '8%',
    left: '6%',
  },
  gridAddGradient: {
    position: 'absolute',
    bottom: 0,
    left: -1,
    right: -1,
    height: '75%',
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
  },
  gridAddBottom: {
    position: 'absolute',
    bottom: Spacing.lg,
    left: Spacing.md,
  },
  gridAddTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
  },
  gridCardShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 6,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },

  // Add Cookbook card (carousel)
  addCardInner: {
    flex: 1,
    borderRadius: Radius.xl,
    backgroundColor: Colors.background.primary,
    overflow: 'hidden',
  },
  addPlusIcon: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    zIndex: 1,
  },
  addStroke: {
    position: 'absolute',
    width: '92%',
    height: '65%',
    top: '8%',
    left: '4%',
  },
  addCardImage: {
    position: 'absolute',
    width: '88%',
    height: '80%',
    top: '8%',
    left: '6%',
  },
  addCardGradient: {
    position: 'absolute',
    bottom: 0,
    left: -1,
    right: -1,
    height: '75%',
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
  },
  addBottom: {
    position: 'absolute',
    bottom: '85%',
    left: Spacing.lg,
  },
  addCardTitle: {
    ...Typography.h1,
    color: Colors.text.primary,
  },
});
