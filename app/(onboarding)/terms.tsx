import { Text, StyleSheet, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { ONBOARDING_COPY } from '@/constants/onboarding';
import { Colors, FontFamily, NAV_BUTTON_SIZE, Spacing, Typography } from '@/constants/theme';

const EFFECTIVE_DATE = 'January 1, 2025';

export default function TermsScreen() {
  const router = useRouter();
  const copy = ONBOARDING_COPY.terms;

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
          <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.body}>
            By downloading, installing, or using Nom ("the App"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the App.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Description of Service</Text>
          <Text style={styles.body}>
            Nom is a recipe saving and cooking application that allows users to import recipes from social media platforms and websites, organize them into cookbooks, plan meals, and share cooking experiences with others.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. User Accounts</Text>
          <Text style={styles.body}>
            You must create an account to use the App. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must provide accurate and complete information when creating your account.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. User Content</Text>
          <Text style={styles.body}>
            You retain ownership of any content you create, upload, or share through the App, including recipes, photos, and reviews. By posting content, you grant Nom a non-exclusive, worldwide, royalty-free license to use, display, and distribute your content within the App.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Recipe Importing</Text>
          <Text style={styles.body}>
            The App allows you to import recipes from third-party platforms. Imported recipes are for personal use only. You are responsible for ensuring your use of imported content complies with the original creator's rights and the terms of the source platform.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Subscriptions & Payments</Text>
          <Text style={styles.body}>
            Certain features require a paid subscription. Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period. Payment is charged to your Apple ID account. You can manage and cancel subscriptions in your device's Account Settings.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Prohibited Conduct</Text>
          <Text style={styles.body}>
            You agree not to: use the App for any unlawful purpose; upload harmful, offensive, or infringing content; attempt to interfere with the App's functionality; create multiple accounts for abusive purposes; or scrape or harvest data from the App.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Intellectual Property</Text>
          <Text style={styles.body}>
            The App, including its design, features, and content (excluding user content), is owned by Nom and protected by intellectual property laws. You may not copy, modify, or distribute any part of the App without written permission.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Disclaimer of Warranties</Text>
          <Text style={styles.body}>
            The App is provided "as is" without warranties of any kind. We do not guarantee the accuracy of nutritional information, cooking times, or recipe instructions. Always use your own judgment when preparing food.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Limitation of Liability</Text>
          <Text style={styles.body}>
            To the maximum extent permitted by law, Nom shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the App.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. Termination</Text>
          <Text style={styles.body}>
            We may suspend or terminate your account at any time for violation of these terms. You may delete your account at any time through the App settings.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>12. Changes to Terms</Text>
          <Text style={styles.body}>
            We may update these terms from time to time. Continued use of the App after changes constitutes acceptance of the updated terms. We will notify you of significant changes through the App.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>13. Contact</Text>
          <Text style={styles.body}>
            If you have questions about these Terms, please contact us through the App's support channel.
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
