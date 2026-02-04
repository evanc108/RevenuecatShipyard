import { View, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';

/**
 * Placeholder screen for the Add tab.
 * The actual add functionality is handled by the AddModal component
 * which is triggered by the custom AddTabButton in _layout.tsx.
 * This file exists to satisfy Expo Router's requirement for a file per tab.
 */
export default function AddScreen() {
  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
});
