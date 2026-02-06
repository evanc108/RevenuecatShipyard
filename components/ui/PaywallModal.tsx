import { Icon } from '@/components/ui/Icon';
import { COPY } from '@/constants/copy';
import { Colors, FontFamily, Radius, Spacing, Typography } from '@/constants/theme';
import { useSubscription, type PaywallFeature } from '@/hooks/useSubscription';
import { FREE_RECIPE_LIMIT } from '@/stores/useSubscriptionStore';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type PaywallModalProps = {
  visible: boolean;
  onClose: () => void;
  feature: PaywallFeature;
};

const FEATURES = [
  { icon: 'download' as const, label: COPY.subscription.features.unlimitedImports },
  { icon: 'flame' as const, label: COPY.subscription.features.cookMode },
  { icon: 'calendar' as const, label: COPY.subscription.features.mealPlanning },
  { icon: 'book' as const, label: COPY.subscription.features.allFeatures },
];

function getSubtitle(feature: PaywallFeature): string {
  switch (feature) {
    case 'recipeLimit':
      return COPY.subscription.recipeLimitReached(FREE_RECIPE_LIMIT);
    case 'cook':
      return COPY.subscription.unlockCook;
    case 'mealPlan':
      return COPY.subscription.unlockMealPlan;
  }
}

export function PaywallModal({
  visible,
  onClose,
  feature,
}: PaywallModalProps): React.ReactElement | null {
  const insets = useSafeAreaInsets();
  const { purchase, restore, priceString } = useSubscription();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const handlePurchase = useCallback(async () => {
    setIsPurchasing(true);
    const success = await purchase();
    setIsPurchasing(false);
    if (success) {
      onClose();
    }
  }, [purchase, onClose]);

  const handleRestore = useCallback(async () => {
    setIsRestoring(true);
    const success = await restore();
    setIsRestoring(false);
    if (success) {
      onClose();
    }
  }, [restore, onClose]);

  const isActioning = isPurchasing || isRestoring;

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.container,
            { paddingBottom: Math.max(insets.bottom, Spacing.lg) },
          ]}
        >
          {/* Close button */}
          <Pressable
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
            disabled={isActioning}
          >
            <Icon
              name="close"
              size={24}
              color={isActioning ? Colors.text.disabled : Colors.text.secondary}
            />
          </Pressable>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconBadge}>
              <Icon name="star" size={28} color={Colors.accent} />
            </View>
            <Text style={styles.title}>{COPY.subscription.paywallTitle}</Text>
            <Text style={styles.subtitle}>{getSubtitle(feature)}</Text>
          </View>

          {/* Feature list */}
          <View style={styles.featureList}>
            {FEATURES.map((f) => (
              <View key={f.label} style={styles.featureRow}>
                <View style={styles.featureIconWrap}>
                  <Icon name={f.icon} size={20} color={Colors.accent} />
                </View>
                <Text style={styles.featureLabel}>{f.label}</Text>
              </View>
            ))}
          </View>

          {/* Price */}
          <Text style={styles.price}>{priceString}</Text>

          {/* Purchase button */}
          <Pressable
            style={[styles.purchaseButton, isActioning && styles.buttonDisabled]}
            onPress={handlePurchase}
            disabled={isActioning}
            accessibilityRole="button"
            accessibilityLabel={COPY.subscription.purchase}
          >
            {isPurchasing ? (
              <ActivityIndicator size="small" color={Colors.text.inverse} />
            ) : (
              <Text style={styles.purchaseButtonText}>
                {COPY.subscription.purchase}
              </Text>
            )}
          </Pressable>

          {/* Restore button */}
          <Pressable
            style={styles.restoreButton}
            onPress={handleRestore}
            disabled={isActioning}
            accessibilityRole="button"
            accessibilityLabel={COPY.subscription.restore}
          >
            {isRestoring ? (
              <ActivityIndicator size="small" color={Colors.text.secondary} />
            ) : (
              <Text style={styles.restoreButtonText}>
                {COPY.subscription.restore}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.background.overlay,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.background.primary,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: Spacing.xs,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.h1,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  featureList: {
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accent + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  featureLabel: {
    ...Typography.body,
    color: Colors.text.primary,
    flex: 1,
    fontFamily: FontFamily.medium,
  },
  price: {
    ...Typography.h2,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  purchaseButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  purchaseButtonText: {
    ...Typography.label,
    fontSize: 16,
    color: Colors.text.inverse,
  },
  restoreButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
  },
  restoreButtonText: {
    ...Typography.body,
    color: Colors.text.secondary,
  },
});
