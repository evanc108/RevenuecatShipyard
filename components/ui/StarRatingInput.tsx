import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '@/constants/theme';

type StarRatingInputProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

const STAR_COLOR = '#FFB800';

export function StarRatingInput({
  label,
  value,
  onChange,
  disabled = false,
}: StarRatingInputProps): React.ReactElement {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable
            key={star}
            onPress={() => !disabled && onChange(star)}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${star} out of 5 stars`}
            accessibilityState={{ selected: star <= value }}
            disabled={disabled}
          >
            <Ionicons
              name={star <= value ? 'star' : 'star-outline'}
              size={28}
              color={star <= value ? STAR_COLOR : Colors.text.tertiary}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.label,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  starsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
});
