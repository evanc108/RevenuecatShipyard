import { memo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Icon, IconName } from '@/components/ui/Icon';
import { Colors, Spacing } from '@/constants/theme';

type ViewMode = 'slider' | 'grid';

type ViewModeToggleProps = {
  viewMode: ViewMode;
  onToggle: () => void;
  sliderIcon?: IconName;
  gridIcon?: IconName;
};

export const ViewModeToggle = memo(function ViewModeToggle({
  viewMode,
  onToggle,
  sliderIcon = 'layers',
  gridIcon = 'apps',
}: ViewModeToggleProps): React.ReactElement {
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
            name={sliderIcon}
            size={18}
            color={viewMode === 'slider' ? Colors.text.inverse : Colors.accent}
          />
        </View>
        <View style={styles.toggleIconContainer}>
          <Icon
            name={gridIcon}
            size={18}
            color={viewMode === 'grid' ? Colors.text.inverse : Colors.accent}
          />
        </View>
      </View>
    </Pressable>
  );
});

export type { ViewMode };

const styles = StyleSheet.create({
  toggleButton: {
    padding: Spacing.xs,
  },
  toggleTrack: {
    flexDirection: 'row',
    width: 88,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    position: 'relative',
  },
  toggleIndicator: {
    position: 'absolute',
    width: 42,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent,
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
});
