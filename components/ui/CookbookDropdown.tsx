import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { COPY } from '@/constants/copy';
import { CreateCookbookModal } from './CreateCookbookModal';

const copy = COPY.extraction.cookbook;
const cookbooksCopy = COPY.cookbooks;

type CookbookDropdownProps = {
  selectedId: Id<'cookbooks'> | null;
  onSelect: (id: Id<'cookbooks'>) => void;
  disabled?: boolean;
  error?: boolean;
};

export function CookbookDropdown({
  selectedId,
  onSelect,
  disabled = false,
  error = false,
}: CookbookDropdownProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const cookbooks = useQuery(api.cookbooks.list);
  const createCookbook = useMutation(api.cookbooks.create);

  const selectedCookbook = cookbooks?.find((c) => c._id === selectedId);

  const handleOpen = () => {
    if (!disabled) {
      setIsOpen(true);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleSelect = (id: Id<'cookbooks'>) => {
    onSelect(id);
    setIsOpen(false);
  };

  const handleCreateNew = () => {
    setIsOpen(false);
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
        onSelect(newId);
      } finally {
        setIsCreating(false);
      }
    },
    [createCookbook, onSelect]
  );

  const isLoading = cookbooks === undefined;

  return (
    <>
      {/* Dropdown Trigger */}
      <View style={styles.container}>
        <Text style={styles.label}>{copy.selectCookbook}</Text>
        <TouchableOpacity
          style={[
            styles.trigger,
            disabled && styles.triggerDisabled,
            error && styles.triggerError,
          ]}
          onPress={handleOpen}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={copy.selectCookbook}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={Colors.text.tertiary} />
          ) : (
            <>
              <Text
                style={[
                  styles.triggerText,
                  !selectedCookbook && styles.triggerPlaceholder,
                ]}
                numberOfLines={1}
              >
                {selectedCookbook?.name ?? copy.selectPlaceholder}
              </Text>
              <Ionicons
                name="chevron-down"
                size={20}
                color={disabled ? Colors.text.disabled : Colors.text.secondary}
              />
            </>
          )}
        </TouchableOpacity>
        {error && <Text style={styles.errorText}>{copy.required}</Text>}
      </View>

      {/* Dropdown Modal */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={styles.modalContainer}>
          <View
            style={[
              styles.dropdown,
              { paddingBottom: Math.max(insets.bottom, Spacing.md) },
            ]}
          >
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>{copy.selectCookbook}</Text>
              <Pressable onPress={handleClose} hitSlop={12}>
                <Ionicons name="close" size={24} color={Colors.text.secondary} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.optionsList}
              showsVerticalScrollIndicator={false}
            >
              {cookbooks && cookbooks.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>{copy.noCookbooks}</Text>
                </View>
              ) : (
                cookbooks?.map((cookbook) => (
                  <TouchableOpacity
                    key={cookbook._id}
                    style={[
                      styles.option,
                      selectedId === cookbook._id && styles.optionSelected,
                    ]}
                    onPress={() => handleSelect(cookbook._id)}
                  >
                    <View style={styles.optionContent}>
                      <Text
                        style={[
                          styles.optionText,
                          selectedId === cookbook._id && styles.optionTextSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {cookbook.name}
                      </Text>
                      <Text style={styles.optionCount}>
                        {cookbooksCopy.recipeCount(cookbook.recipeCount)}
                      </Text>
                    </View>
                    {selectedId === cookbook._id && (
                      <Ionicons
                        name="checkmark"
                        size={20}
                        color={Colors.accent}
                      />
                    )}
                  </TouchableOpacity>
                ))
              )}

              {/* Create New Option */}
              <TouchableOpacity
                style={styles.createOption}
                onPress={handleCreateNew}
              >
                <Ionicons name="add-circle-outline" size={20} color={Colors.accent} />
                <Text style={styles.createOptionText}>{copy.createNew}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Create Cookbook Modal */}
      <CreateCookbookModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateSubmit}
        isLoading={isCreating}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  label: {
    ...Typography.label,
    color: Colors.text.primary,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  triggerDisabled: {
    opacity: 0.6,
  },
  triggerError: {
    borderColor: Colors.semantic.error,
  },
  triggerText: {
    ...Typography.body,
    color: Colors.text.primary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  triggerPlaceholder: {
    color: Colors.text.tertiary,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.semantic.error,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background.overlay,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dropdown: {
    backgroundColor: Colors.background.primary,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '60%',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dropdownTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
  },
  optionsList: {
    paddingHorizontal: Spacing.lg,
  },
  emptyState: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...Typography.body,
    color: Colors.text.tertiary,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  optionSelected: {
    backgroundColor: Colors.accentLight,
    marginHorizontal: -Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    borderBottomWidth: 0,
    marginBottom: 1,
  },
  optionContent: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  optionText: {
    ...Typography.body,
    color: Colors.text.primary,
  },
  optionTextSelected: {
    fontWeight: '600',
    color: Colors.accent,
  },
  optionCount: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  createOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    marginTop: Spacing.sm,
  },
  createOptionText: {
    ...Typography.label,
    color: Colors.accent,
  },
});
