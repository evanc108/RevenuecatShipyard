import { Pressable, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius } from '@/constants/theme';

type DislikeChipProps = {
  label: string;
  onRemove: () => void;
};

export function DislikeChip({ label, onRemove }: DislikeChipProps) {
  return (
    <Pressable style={styles.chip} onPress={onRemove}>
      <Text style={styles.label}>{label}</Text>
      <Ionicons name="close" size={16} color={Colors.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 36,
    paddingLeft: 14,
    paddingRight: 10,
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: Colors.accent,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.accent,
  },
});
