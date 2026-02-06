import { View, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Icon } from '@/components/ui/Icon';
import { GroceriesContent } from '@/components/features/pantry';
import { Colors, NAV_BUTTON_SIZE, Spacing, Typography } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import { Text } from 'react-native';

const copy = COPY.pantry.groceries;

export default function GroceriesScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
        >
          <Icon name="arrow-back" size={20} color={Colors.text.inverse} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>{copy.title}</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <GroceriesContent />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: NAV_BUTTON_SIZE,
    height: NAV_BUTTON_SIZE,
    borderRadius: NAV_BUTTON_SIZE / 2,
    backgroundColor: Colors.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Typography.h3,
    color: Colors.text.primary,
  },
  placeholder: {
    width: 32,
  },
});
