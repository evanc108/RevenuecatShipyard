import { Text, StyleSheet, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { ONBOARDING_COPY } from '@/constants/onboarding';
import { Colors, FontFamily, NAV_BUTTON_SIZE, Spacing, Typography } from '@/constants/theme';

const EFFECTIVE_DATE = 'January 1, 2025';

export default function PrivacyScreen() {
  const router = useRouter();
  const copy = ONBOARDING_COPY.privacy;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => router.back()}
        hitSlop={8}
        style={styles.backButton}
      >
        <Icon name="arrow-back" size={20} color={Colors.text.inverse} strokeWidth={2} />
      </Pressable>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.effectiveDate}>Effective: {EFFECTIVE_DATE}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Information We Collect</Text>
          <Text style={styles.body}>
            We collect information you provide when creating an account, including your name, email address, username, and profile photo. We also collect recipes you save, your dietary preferences, cooking goals, and content you share within the App.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
          <Text style={styles.body}>
            We use your information to: provide and improve the App; personalize your recipe recommendations; enable social features like following other users and sharing posts; sync your data across devices; and communicate important updates about the App.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Recipe Data</Text>
          <Text style={styles.body}>
            When you import recipes from third-party platforms, we extract and store recipe information (ingredients, instructions, nutritional data) to provide our service. We do not claim ownership of imported recipe content.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Third-Party Services</Text>
          <Text style={styles.body}>
            We use the following third-party services that may collect data: Clerk (authentication), Convex (data storage), RevenueCat (subscription management), and Apple/Google (OAuth sign-in). Each service operates under its own privacy policy.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Data Sharing</Text>
          <Text style={styles.body}>
            We do not sell your personal information. We share data only with: service providers necessary to operate the App; other users (only content you choose to make public, such as posts and your profile); and legal authorities when required by law.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Data Storage & Security</Text>
          <Text style={styles.body}>
            Your data is stored securely using industry-standard encryption. We use Convex for cloud data storage with built-in security measures. While we take reasonable precautions to protect your data, no method of transmission over the internet is 100% secure.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Your Rights</Text>
          <Text style={styles.body}>
            You have the right to: access your personal data; correct inaccurate information; delete your account and associated data; export your recipes and data; and opt out of non-essential communications. You can exercise these rights through the App settings or by contacting us.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Cookies & Analytics</Text>
          <Text style={styles.body}>
            As a mobile application, we do not use browser cookies. We may collect anonymous usage analytics to improve the App experience. This data does not personally identify you.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Children's Privacy</Text>
          <Text style={styles.body}>
            The App is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If we become aware that we have collected data from a child under 13, we will take steps to delete it.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Data Retention</Text>
          <Text style={styles.body}>
            We retain your data for as long as your account is active. When you delete your account, we will delete your personal data within 30 days, except where retention is required by law or for legitimate business purposes.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. Changes to This Policy</Text>
          <Text style={styles.body}>
            We may update this Privacy Policy from time to time. We will notify you of significant changes through the App. Your continued use after changes constitutes acceptance of the updated policy.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>12. Contact Us</Text>
          <Text style={styles.body}>
            If you have questions about this Privacy Policy or how we handle your data, please contact us through the App's support channel.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  backButton: {
    width: NAV_BUTTON_SIZE,
    height: NAV_BUTTON_SIZE,
    borderRadius: NAV_BUTTON_SIZE / 2,
    backgroundColor: Colors.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
    marginTop: Spacing.md,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  title: {
    fontSize: 32,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.3,
    marginBottom: Spacing.xs,
  },
  effectiveDate: {
    ...Typography.bodySmall,
    color: Colors.text.tertiary,
    marginBottom: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  body: {
    ...Typography.body,
    color: Colors.text.secondary,
    lineHeight: 24,
  },
});
