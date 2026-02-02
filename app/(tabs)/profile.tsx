import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';

export default function ProfileScreen() {
  const { signOut } = useAuth();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>Profile</Text>
      </View>
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={() => signOut()}
          activeOpacity={0.7}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Spacing.md,
  },
  title: {
    ...Typography.h1,
    color: Colors.text.primary,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: Spacing.xl,
  },
  signOutButton: {
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.semantic.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.semantic.error,
  },
});
