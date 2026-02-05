import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { memo, useEffect, useRef } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

type Tab = {
  key: string;
  label: string;
};

type TabSliderProps = {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabKey: string) => void;
};

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 300,
  mass: 0.6,
};

function TabSliderComponent({ tabs, activeTab, onTabChange }: TabSliderProps) {
  const tabWidth = useSharedValue(0);
  const indicatorPosition = useSharedValue(0);
  const hasLaidOut = useRef(false);

  const activeIndex = tabs.findIndex((tab) => tab.key === activeTab);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    const singleTabWidth = width / tabs.length;
    tabWidth.value = singleTabWidth;
    // Snap instantly on first layout
    indicatorPosition.value = activeIndex * singleTabWidth;
    hasLaidOut.current = true;
  };

  // Animate indicator whenever activeIndex changes after initial layout
  useEffect(() => {
    if (!hasLaidOut.current) return;
    indicatorPosition.value = withSpring(
      activeIndex * tabWidth.value,
      SPRING_CONFIG
    );
  }, [activeIndex, indicatorPosition, tabWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: tabWidth.value - Spacing.xs * 2,
    transform: [{ translateX: indicatorPosition.value + Spacing.xs }],
  }));

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <Animated.View style={[styles.indicator, indicatorStyle]} />
      {tabs.map((tab, index) => {
        const isActive = tab.key === activeTab;
        return (
          <Pressable
            key={tab.key}
            style={styles.tab}
            onPress={() => onTabChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
          >
            <Text
              style={[
                styles.tabText,
                isActive ? styles.tabTextActive : styles.tabTextInactive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.full,
    padding: Spacing.xs,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: Spacing.xs,
    bottom: Spacing.xs,
    backgroundColor: Colors.background.primary,
    borderRadius: Radius.full,
    ...Shadow.surface,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    ...Typography.label,
  },
  tabTextActive: {
    color: Colors.text.primary,
  },
  tabTextInactive: {
    color: Colors.text.tertiary,
  },
});

export const TabSlider = memo(TabSliderComponent);
