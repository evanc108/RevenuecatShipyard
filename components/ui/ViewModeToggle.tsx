import { memo } from 'react';
import { StyleSheet, Pressable } from 'react-native';
import { Icon, IconName } from '@/components/ui/Icon';
import { Colors } from '@/constants/theme';

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
  // Show the icon for the alternate view mode (what it will switch to)
  const iconName = viewMode === 'slider' ? gridIcon : sliderIcon;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Switch to ${viewMode === 'slider' ? 'grid' : 'slider'} view`}
      style={styles.toggleButton}
      onPress={onToggle}
      hitSlop={12}
    >
      <Icon name={iconName} size={20} color={Colors.text.primary} strokeWidth={2.5} />
    </Pressable>
  );
});

export type { ViewMode };

const styles = StyleSheet.create({
  toggleButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
