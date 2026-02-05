import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { memo, useCallback } from 'react';
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
  damping:  100,
  stiffness: 700,
};

function TabSliderComponent({ tabs, activeTab, onTabChange }: TabSliderProps) {
  const tabWidth = useSharedValue(0);
  const indicatorPosition = useSharedValue(0);

  const activeIndex = tabs.findIndex((tab) => tab.key === activeTab);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width } = event.nativeEvent.layout;
      const singleTabWidth = width / tabs.length;
      tabWidth.value = singleTabWidth;
      indicatorPosition.value = withSpring(
        activeIndex * singleTabWidth,
        SPRING_CONFIG
      );
    },
    [activeIndex, tabs.length, tabWidth, indicatorPosition]
  );

  const handleTabPress = useCallback(
    (tabKey: string, index: number) => {
      indicatorPosition.value = withSpring(
        index * tabWidth.value,
        SPRING_CONFIG
      );
      onTabChange(tabKey);
    },
    [onTabChange, indicatorPosition, tabWidth]
  );

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
            onPress={() => handleTabPress(tab.key, index)}
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
