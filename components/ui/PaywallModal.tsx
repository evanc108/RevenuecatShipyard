import { Icon } from '@/components/ui/Icon';
import { COPY } from '@/constants/copy';
import { Colors, FontFamily, Radius, Spacing, Typography } from '@/constants/theme';
import { useSubscription, type PaywallFeature } from '@/hooks/useSubscription';
import { useModalAnimation } from '@/hooks/useModalAnimation';
import { FREE_RECIPE_LIMIT } from '@/stores/useSubscriptionStore';
import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const APP_ICON = require('@/assets/images/app_icon.png');

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const successOpacity = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.8)).current;

  const { isRendered, backdropOpacity, modalTranslateY } = useModalAnimation({
    visible,
  });

  // Reset success state when modal opens
  useEffect(() => {
    if (visible) {
      setShowSuccess(false);
      successOpacity.setValue(0);
      successScale.setValue(0.8);
    }
  }, [visible, successOpacity, successScale]);

  const playSuccessAndClose = useCallback(() => {
    setShowSuccess(true);
    Animated.parallel([
      Animated.timing(successOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(successScale, {
        toValue: 1,
        damping: 12,
        stiffness: 180,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      onClose();
    }, 1500);
    return timer;
  }, [successOpacity, successScale, onClose]);

  const handlePurchase = useCallback(async () => {
    setErrorMessage(null);
    setIsPurchasing(true);
    const result = await purchase();
    setIsPurchasing(false);
    if (result.success) {
      playSuccessAndClose();
    } else if (result.error) {
      setErrorMessage(result.error);
    }
  }, [purchase, playSuccessAndClose]);

  const handleRestore = useCallback(async () => {
    setErrorMessage(null);
    setIsRestoring(true);
    const result = await restore();
    setIsRestoring(false);
    if (result.success) {
      playSuccessAndClose();
    } else if (result.error) {
      setErrorMessage(result.error);
    }
  }, [restore, playSuccessAndClose]);

  const isActioning = isPurchasing || isRestoring;

  if (!isRendered) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <View style={StyleSheet.absoluteFill}>
        {/* Backdrop */}
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
        />

        {/* Full-page modal */}
        <Animated.View
          style={[
            styles.container,
            { transform: [{ translateY: modalTranslateY }] },
          ]}
        >
          <View
            style={[
              styles.content,
              {
                paddingTop: insets.top + Spacing.md,
                paddingBottom: Math.max(insets.bottom, Spacing.lg),
              },
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

            {/* Header with app logo */}
            <View style={styles.header}>
              <Image
                source={APP_ICON}
                style={styles.appLogo}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
              <Text style={styles.title}>{COPY.subscription.paywallTitle}</Text>
              <Text style={styles.subtitle}>{getSubtitle(feature)}</Text>
            </View>

            {/* Feature list */}
            <View style={styles.featureList}>
              {FEATURES.map((f) => (
                <View key={f.label} style={styles.featureRow}>
                  <View style={styles.featureIconWrap}>
                    <Icon name={f.icon} size={22} color={Colors.accent} />
                  </View>
                  <Text style={styles.featureLabel}>{f.label}</Text>
                </View>
              ))}
            </View>

            {/* Spacer to push purchase section to bottom */}
            <View style={styles.spacer} />

            {/* Error message */}
            {errorMessage ? (
              <View style={styles.errorContainer}>
                <Icon name="alert-circle" size={16} color={Colors.semantic.error} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

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

            {/* Success overlay */}
            {showSuccess ? (
              <Animated.View
                style={[
                  styles.successOverlay,
                  {
                    opacity: successOpacity,
                    transform: [{ scale: successScale }],
                  },
                ]}
                pointerEvents="none"
              >
                <View style={styles.successIconWrap}>
                  <Icon name="check" size={40} color={Colors.text.inverse} />
                </View>
                <Text style={styles.successTitle}>
                  {COPY.subscription.successTitle}
                </Text>
                <Text style={styles.successSubtitle}>
                  {COPY.subscription.successSubtitle}
                </Text>
              </Animated.View>
            ) : null}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background.overlay,
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    paddingHorizontal: Spacing.lg,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: Spacing.xs,
    marginBottom: Spacing.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  appLogo: {
    width: 72,
    height: 72,
    borderRadius: Radius.lg,
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
    gap: Spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIconWrap: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
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
  spacer: {
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#FEE2E2',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    ...Typography.bodySmall,
    color: Colors.semantic.error,
    flex: 1,
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
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.semantic.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  successTitle: {
    ...Typography.h1,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  successSubtitle: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});
