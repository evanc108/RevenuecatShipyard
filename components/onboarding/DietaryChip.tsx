import { Pressable, Text, StyleSheet } from 'react-native';
import { Colors, Radius } from '@/constants/theme';

type DietaryChipProps = {
  label: string;
  isSelected: boolean;
  onPress: () => void;
};

export function DietaryChip({ label, isSelected, onPress }: DietaryChipProps) {
  return (
    <Pressable
      style={[styles.chip, isSelected && styles.chipSelected]}
      onPress={onPress}
    >
      <Text style={[styles.label, isSelected && styles.labelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 36,
    paddingHorizontal: 14,
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.full,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: Colors.accentLight,
    borderColor: Colors.accent,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  labelSelected: {
    color: Colors.accent,
  },
});
