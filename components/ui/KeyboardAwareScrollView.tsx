import { ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type ViewStyle,
} from 'react-native';
import { Colors, Spacing } from '@/constants/theme';

type KeyboardAwareScrollViewProps = {
  children: ReactNode;
  bottomBar?: ReactNode;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
  scrollViewStyle?: ViewStyle;
  showsVerticalScrollIndicator?: boolean;
};

/**
 * A scroll view that adjusts for the keyboard on iOS.
 * Uses native `automaticallyAdjustKeyboardInsets` to scroll focused
 * inputs into view. The bottom bar stays fixed — the keyboard covers it.
 */
export function KeyboardAwareScrollView({
  children,
  bottomBar,
  contentContainerStyle,
  scrollViewStyle,
  showsVerticalScrollIndicator = false,
}: KeyboardAwareScrollViewProps) {
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
        automaticallyAdjustKeyboardInsets
      >
        {children}
      </ScrollView>

      {bottomBar && (
        <View style={styles.bottomBarContainer}>
          {bottomBar}
        </View>
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
