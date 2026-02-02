import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

type PlaceholderAssetProps = {
  width: number;
  height: number;
  label?: string;
  borderRadius?: number;
};

export function PlaceholderAsset({
  width,
  height,
  label = 'Asset',
  borderRadius = 20,
}: PlaceholderAssetProps) {
  return (
    <View style={[styles.container, { width, height, borderRadius }]}>
      <Ionicons name="image-outline" size={32} color={Colors.border} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    fontSize: 12,
    color: Colors.text.tertiary,
    fontWeight: '500',
  },
});
