import { ReactNode, useEffect } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Colors, Spacing } from '@/constants/theme';

type KeyboardAwareScrollViewProps = {
  children: ReactNode;
  bottomBar?: ReactNode;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
  scrollViewStyle?: ViewStyle;
  showsVerticalScrollIndicator?: boolean;
};

/**
 * A scroll view with a fixed bottom bar that slides up when keyboard appears.
 * Content does NOT shift — only the bottom bar moves.
 */
export function KeyboardAwareScrollView({
  children,
  bottomBar,
  contentContainerStyle,
  scrollViewStyle,
  showsVerticalScrollIndicator = false,
}: KeyboardAwareScrollViewProps) {
  const insets = useSafeAreaInsets();
  const bottomBarTranslate = useSharedValue(0);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        bottomBarTranslate.value = withTiming(-e.endCoordinates.height + insets.bottom, {
          duration: Platform.OS === 'ios' ? 250 : 0,
        });
      }
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        bottomBarTranslate.value = withTiming(0, {
          duration: Platform.OS === 'ios' ? 250 : 0,
        });
      }
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [insets.bottom, bottomBarTranslate]);

  const bottomBarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bottomBarTranslate.value }],
  }));

  return (
    <View style={styles.flex}>
      <ScrollView
        style={[styles.scrollView, scrollViewStyle]}
        contentContainerStyle={[
          styles.scrollContent,
          contentContainerStyle,
          bottomBar ? { paddingBottom: Spacing.xl } : undefined,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        keyboardDismissMode="interactive"
      >
        {children}
      </ScrollView>

      {bottomBar && (
        <Animated.View style={[styles.bottomBarContainer, bottomBarAnimatedStyle]}>
          {bottomBar}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  bottomBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background.primary,
  },
});
