/**
 * Full-page modal for cookbook selection when importing via share intent.
 *
 * Shows:
 * - "Importing this recipe" header
 * - URL preview (domain + truncated link)
 * - Cookbook list for selection or "Create New"
 * - Sticky Import button at the bottom
 */

import { useMutation, useQuery } from 'convex/react';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CreateCookbookModal } from '@/components/cookbook/CreateCookbookModal';
import { Icon } from '@/components/ui/Icon';
import { COPY } from '@/constants/copy';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { getDomainFromUrl } from '@/hooks/useShareHandler';

const copy = COPY.shareIntent;
const cookbooksCopy = COPY.cookbooks;
const extractionCopy = COPY.extraction.cookbook;

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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [fadeAnim] = useState(() => new Animated.Value(0));

  const cookbooks = useQuery(api.cookbooks.list);
  const createCookbook = useMutation(api.cookbooks.create);

  const selectedCookbook = cookbooks?.find((c) => c._id === selectedCookbookId);
  const isLoading = cookbooks === undefined;

  // Animate in/out
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [visible, fadeAnim]);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedCookbookId(null);
    }
  }, [visible]);

  const handleCookbookSelect = (id: Id<'cookbooks'>) => {
    setSelectedCookbookId(id);
  };

  const handleCreateNew = () => {
    setShowCreateModal(true);
  };

  const handleCreateSubmit = useCallback(
    async (name: string, description?: string, imageUri?: string) => {
      setIsCreating(true);
      try {
        const newId = await createCookbook({
          name,
          description,
          coverImageUrl: imageUri,
        });
        setShowCreateModal(false);
        setSelectedCookbookId(newId);
      } finally {
        setIsCreating(false);
      }
    },
    [createCookbook]
  );

  const handleImport = () => {
    if (!selectedCookbookId || !selectedCookbook) return;
    onSubmit(selectedCookbookId, selectedCookbook.name);
  };

  if (!visible || !url) return null;

  const domain = getDomainFromUrl(url);
  const isValid = selectedCookbookId !== null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        {/* Safe area padding at top */}
        <View style={{ paddingTop: insets.top, backgroundColor: Colors.background.primary }}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={copy.cancel}
            >
              <Icon name="close" size={24} color={Colors.text.secondary} />
            </Pressable>
            <Text style={styles.headerTitle}>Importing Recipe</Text>
            <View style={{ width: 24 }} />
          </View>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* URL Preview */}
          <View style={styles.urlPreview}>
            <Icon name="link" size={20} color={Colors.accent} />
            <View style={styles.urlTextContainer}>
              <Text style={styles.urlDomain}>{copy.urlPreview} {domain}</Text>
              <Text style={styles.urlFull} numberOfLines={2}>
                {url}
              </Text>
            </View>
          </View>

          {/* Cookbook Selection Label */}
          <Text style={styles.sectionTitle}>{extractionCopy.selectCookbook}</Text>

          {/* Cookbook List */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={Colors.text.tertiary} />
            </View>
          ) : cookbooks && cookbooks.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{extractionCopy.noCookbooks}</Text>
            </View>
          ) : (
            <View style={styles.cookbookList}>
              {cookbooks?.map((cookbook) => (
                <Pressable
                  key={cookbook._id}
                  style={[
                    styles.cookbookItem,
                    selectedCookbookId === cookbook._id && styles.cookbookItemSelected,
                  ]}
                  onPress={() => handleCookbookSelect(cookbook._id)}
                >
                  <View style={styles.cookbookInfo}>
                    <Text
                      style={[
                        styles.cookbookName,
                        selectedCookbookId === cookbook._id && styles.cookbookNameSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {cookbook.name}
                    </Text>
                    <Text style={styles.cookbookCount}>
                      {cookbooksCopy.recipeCount(cookbook.recipeCount)}
                    </Text>
                  </View>
                  {selectedCookbookId === cookbook._id && (
                    <Icon name="checkmark-circle" size={24} color={Colors.accent} />
                  )}
                </Pressable>
              ))}
            </View>
          )}

          {/* Create New Cookbook Option */}
          <Pressable style={styles.createOption} onPress={handleCreateNew}>
            <Icon name="add-circle-outline" size={22} color={Colors.accent} />
            <Text style={styles.createOptionText}>{extractionCopy.createNew}</Text>
          </Pressable>
        </ScrollView>

        {/* Sticky Footer */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
          <Pressable
            style={[styles.importButton, isValid && styles.importButtonActive]}
            onPress={handleImport}
            disabled={!isValid}
            accessibilityRole="button"
            accessibilityLabel={copy.import}
          >
            <Icon
              name="download"
              size={20}
              color={isValid ? Colors.text.inverse : Colors.text.disabled}
            />
            <Text style={[styles.importButtonText, !isValid && styles.importButtonTextDisabled]}>
              {copy.import}
            </Text>
          </Pressable>
        </View>

        {/* Create Cookbook Modal */}
        <CreateCookbookModal
          visible={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateSubmit}
          isLoading={isCreating}
        />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
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
  headerTitle: {
    ...Typography.h2,
    color: Colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  urlPreview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
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
  sectionTitle: {
    ...Typography.label,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  loadingContainer: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  emptyState: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...Typography.body,
    color: Colors.text.tertiary,
  },
  cookbookList: {
    gap: Spacing.sm,
  },
  cookbookItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cookbookItemSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentLight,
  },
  cookbookInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  cookbookName: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  cookbookNameSelected: {
    color: Colors.accent,
    fontWeight: '600',
  },
  cookbookCount: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  createOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    marginTop: Spacing.md,
  },
  createOptionText: {
    ...Typography.label,
    color: Colors.accent,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background.primary,
  },
  importButton: {
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
