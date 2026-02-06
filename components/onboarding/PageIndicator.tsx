import { Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';

type PageIndicatorProps = {
  current: number;
  total?: number;
};

export function PageIndicator({ current, total = 6 }: PageIndicatorProps) {
  return (
    <Text style={styles.container}>
      <Text style={styles.current}>{current}</Text>
      <Text style={styles.total}>/{total}</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
  },
  current: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -0.5,
  },
  total: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.tertiary,
  },
});
