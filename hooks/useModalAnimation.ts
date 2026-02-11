/**
 * Shared modal animation hook for consistent animations across all modals.
 *
 * Provides:
 * - Backdrop fade animation
 * - Modal slide-up with spring physics
 * - Proper cleanup and reset
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { Animated, Dimensions } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Shared animation configuration for all modals
export const MODAL_ANIMATION = {
  duration: 300,
  spring: {
    tension: 65,
    friction: 11,
  },
} as const;

type UseModalAnimationOptions = {
  visible: boolean;
  onAnimationComplete?: () => void;
};

type UseModalAnimationReturn = {
  isRendered: boolean;
  backdropOpacity: Animated.Value;
  modalTranslateY: Animated.Value;
  animateOut: (callback?: () => void) => void;
};

export function useModalAnimation({
  visible,
  onAnimationComplete,
}: UseModalAnimationOptions): UseModalAnimationReturn {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const modalTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [isRendered, setIsRendered] = useState(false);

  // Animate out function for programmatic closing
  const animateOut = useCallback(
    (callback?: () => void) => {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: MODAL_ANIMATION.duration - 50,
          useNativeDriver: true,
        }),
        Animated.timing(modalTranslateY, {
          toValue: SCREEN_HEIGHT,
          duration: MODAL_ANIMATION.duration,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsRendered(false);
        callback?.();
        onAnimationComplete?.();
      });
    },
    [backdropOpacity, modalTranslateY, onAnimationComplete]
  );

  useEffect(() => {
    if (visible) {
      setIsRendered(true);
      // Reset values before animating in
      backdropOpacity.setValue(0);
      modalTranslateY.setValue(SCREEN_HEIGHT);

      // Animate in: slide up modal and fade in backdrop together
      Animated.parallel([
        Animated.spring(modalTranslateY, {
          toValue: 0,
          ...MODAL_ANIMATION.spring,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: MODAL_ANIMATION.duration,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (isRendered) {
      animateOut();
    }
  }, [visible]);

  return {
    isRendered,
    backdropOpacity,
    modalTranslateY,
    animateOut,
  };
}
