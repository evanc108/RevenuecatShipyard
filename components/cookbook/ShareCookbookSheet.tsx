/**
 * Bottom sheet for cookbook selection when importing via share intent.
 *
 * Shows:
 * - URL preview (domain + truncated link)
 * - Cookbook dropdown for selection
 * - Import/Cancel buttons
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';

import { Icon } from '@/components/ui/Icon';
import { CookbookDropdown } from '@/components/ui/CookbookDropdown';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import { getDomainFromUrl } from '@/hooks/useShareHandler';
import { useModalAnimation } from '@/hooks/useModalAnimation';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

const copy = COPY.shareIntent;

type ShareCookbookSheetProps = {
  visible: boolean;
  url: string | null;
  onClose: () => void;
  onSubmit: (cookbookId: Id<'cookbooks'>, cookbookName: string) => void;
};

export function ShareCookbookSheet({
  visible,
  url,
  onClose,
  onSubmit,
}: ShareCookbookSheetProps): React.ReactElement | null {
  const insets = useSafeAreaInsets();
  const [selectedCookbookId, setSelectedCookbookId] = useState<Id<'cookbooks'> | null>(null);
  const [cookbookError, setCookbookError] = useState(false);

  // Use shared modal animation
  const { isRendered, backdropOpacity, modalTranslateY } = useModalAnimation({
    visible,
    onAnimationComplete: () => {
      setSelectedCookbookId(null);
      setCookbookError(false);
    },
  });

  // Get cookbooks to find selected name
  const cookbooks = useQuery(api.cookbooks.list);
  const selectedCookbook = cookbooks?.find((c) => c._id === selectedCookbookId);

  // Reset error when modal opens
  useEffect(() => {
    if (visible) {
      setCookbookError(false);
    }
  }, [visible]);

  const handleCookbookSelect = (id: Id<'cookbooks'>) => {
    setSelectedCookbookId(id);
    setCookbookError(false);
  };

  const handleImport = () => {
    if (!selectedCookbookId) {
      setCookbookError(true);
      return;
    }

    const cookbookName = selectedCookbook?.name ?? 'Cookbook';
    onSubmit(selectedCookbookId, cookbookName);
  };

  if (!isRendered || !url) return null;

  const domain = getDomainFromUrl(url);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheetContainer,
          { transform: [{ translateY: modalTranslateY }] },
        ]}
      >
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, Spacing.lg) + Spacing.md },
          ]}
        >
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{copy.title}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={copy.cancel}
            >
              <Icon name="close" size={24} color={Colors.text.secondary} />
            </Pressable>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* URL Preview */}
            <View style={styles.urlPreview}>
              <Icon name="link" size={20} color={Colors.accent} />
              <View style={styles.urlTextContainer}>
                <Text style={styles.urlDomain}>{copy.urlPreview} {domain}</Text>
                <Text style={styles.urlFull} numberOfLines={1}>
                  {url}
                </Text>
              </View>
            </View>

            {/* Cookbook Selection */}
            <View style={styles.inputGroup}>
              <CookbookDropdown
                selectedId={selectedCookbookId}
                onSelect={handleCookbookSelect}
                error={cookbookError}
              />
            </View>

            {/* Buttons */}
            <View style={styles.buttons}>
              <Pressable
                style={styles.cancelButton}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={copy.cancel}
              >
                <Text style={styles.cancelButtonText}>{copy.cancel}</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.importButton,
                  selectedCookbookId && styles.importButtonActive,
                ]}
                onPress={handleImport}
                accessibilityRole="button"
                accessibilityLabel={copy.import}
              >
                <Icon
                  name="download"
                  size={20}
                  color={selectedCookbookId ? Colors.text.inverse : Colors.text.disabled}
                />
                <Text
                  style={[
                    styles.importButtonText,
                    !selectedCookbookId && styles.importButtonTextDisabled,
                  ]}
                >
                  {copy.import}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background.overlay,
  },
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    backgroundColor: Colors.background.primary,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    ...Typography.h2,
    color: Colors.text.primary,
  },
  content: {
    padding: Spacing.lg,
  },
  urlPreview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  urlTextContainer: {
    flex: 1,
  },
  urlDomain: {
    ...Typography.label,
    color: Colors.text.primary,
  },
  urlFull: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    ...Typography.label,
    color: Colors.text.primary,
  },
  importButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.tertiary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  importButtonActive: {
    backgroundColor: Colors.accent,
  },
  importButtonText: {
    ...Typography.label,
    fontSize: 16,
    color: Colors.text.inverse,
  },
  importButtonTextDisabled: {
    color: Colors.text.disabled,
  },
});
