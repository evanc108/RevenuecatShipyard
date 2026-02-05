/**
 * Full-screen share extension UI component.
 *
 * Runs in the iOS share extension process (no Convex/Clerk auth).
 * Reads cached cookbooks from App Groups and writes pending imports
 * for the main app to pick up on foreground.
 *
 * Props come from Swift initialProperties (url, text, etc.).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import ShareExtensionBridge from '@/modules/share-extension-bridge';
import {
  addPendingImport,
  getCachedCookbooks,
} from '@/lib/appGroups';
import type { CachedCookbook } from '@/lib/appGroups';

// ---------------------------------------------------------------------------
// Inline theme tokens (matches constants/theme.ts but avoids heavy imports)
// ---------------------------------------------------------------------------

const C = {
  accent: '#ED7935',
  accentLight: '#ffa46a',
  bgPrimary: '#FFFFFF',
  bgSecondary: '#F5F5F7',
  bgTertiary: '#EBEBF0',
  textPrimary: '#1A1A1A',
  textSecondary: '#6B6B6B',
  textTertiary: '#9A9A9A',
  textDisabled: '#C5C5C5',
  textInverse: '#FFFFFF',
  border: '#E5E7EB',
  success: '#16A34A',
} as const;

const S = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
const R = { sm: 8, md: 12, lg: 16 } as const;

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

const COPY = {
  title: 'Save Recipe',
  selectCookbook: 'Choose a cookbook',
  save: 'Save',
  cancel: 'Cancel',
  urlPreview: 'Recipe from',
  createNew: 'Create New Cookbook',
  createPlaceholder: 'Cookbook name',
  createAndSave: 'Create & Save',
  orChooseExisting: 'or choose existing',
  noCookbooks: 'No cookbooks yet. Create your first one above!',
  successTitle: 'Recipe Saved!',
  successSubtitle: 'Check the app for your new recipe.',
  noUrl: 'No URL found to import.',
} as const;

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^[\]`]+/gi;

function extractUrlFromText(text: string): string | null {
  const matches = text.match(URL_REGEX);
  return matches?.[0] ?? null;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'link';
  }
}

// ---------------------------------------------------------------------------
// Props from Swift initialProperties
// ---------------------------------------------------------------------------

type ShareExtensionProps = {
  url?: string;
  text?: string;
  images?: string[];
  initialViewWidth?: number;
  initialViewHeight?: number;
};

type ScreenState = 'selecting' | 'success';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShareExtensionRoot(props: ShareExtensionProps): React.ReactElement {
  const { url: rawUrl, text } = props;

  // Resolve the shared URL
  const resolvedUrl = rawUrl ?? (text ? extractUrlFromText(text) : null);

  const [state, setState] = useState<ScreenState>('selecting');
  const [cookbooks, setCookbooks] = useState<CachedCookbook[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const inputRef = useRef<TextInput>(null);

  // Load cached cookbooks on mount
  useEffect(() => {
    getCachedCookbooks()
      .then(setCookbooks)
      .catch(() => setCookbooks([]));
  }, []);

  // Auto-focus create input when shown
  useEffect(() => {
    if (showCreate) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [showCreate]);

  const handleClose = useCallback(() => {
    ShareExtensionBridge.close();
  }, []);

  const handleSelectCookbook = useCallback((cookbookId: string) => {
    setSelectedId(cookbookId);
    setShowCreate(false);
    setNewName('');
  }, []);

  const handleSave = useCallback(async () => {
    if (!resolvedUrl) return;

    const payload: { url: string; cookbookId?: string; newCookbookName?: string } = {
      url: resolvedUrl,
    };

    if (selectedId) {
      payload.cookbookId = selectedId;
    } else {
      return; // Nothing selected
    }

    try {
      await addPendingImport(payload);
      setState('success');
    } catch {
      ShareExtensionBridge.close();
    }
  }, [resolvedUrl, selectedId]);

  const handleCreateAndSave = useCallback(async () => {
    const trimmedName = newName.trim();
    if (!resolvedUrl || trimmedName.length === 0) return;

    try {
      await addPendingImport({
        url: resolvedUrl,
        newCookbookName: trimmedName,
      });
      setState('success');
    } catch {
      ShareExtensionBridge.close();
    }
  }, [resolvedUrl, newName]);

  const canSave = resolvedUrl !== null && selectedId !== null;
  const canCreateAndSave = resolvedUrl !== null && newName.trim().length > 0;
  const domain = resolvedUrl ? getDomain(resolvedUrl) : '';

  if (state === 'success') {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          {/* Close button */}
          <Pressable
            style={styles.successCloseButton}
            onPress={handleClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.closeButton}>{'\u2715'}</Text>
          </Pressable>
          <View style={styles.successContainer}>
            <ExpoImage
              source={require('@/assets/images/loading_icon.svg')}
              style={styles.successImage}
              contentFit="contain"
            />
            <Text style={styles.successTitle}>{COPY.successTitle}</Text>
            <Text style={styles.successSubtitle}>{COPY.successSubtitle}</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={COPY.cancel}
          >
            <Text style={styles.closeButton}>{'\u2715'}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{COPY.title}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* URL Preview */}
          {resolvedUrl ? (
            <View style={styles.urlPreview}>
              <Text style={styles.urlIcon}>{'\uD83D\uDD17'}</Text>
              <View style={styles.urlTextContainer}>
                <Text style={styles.urlDomain}>
                  {COPY.urlPreview} {domain}
                </Text>
                <Text style={styles.urlFull} numberOfLines={2}>
                  {resolvedUrl}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.urlPreview}>
              <Text style={styles.emptyText}>{COPY.noUrl}</Text>
            </View>
          )}

          {/* Create New Cookbook Section */}
          {showCreate ? (
            <View style={styles.createForm}>
              <TextInput
                ref={inputRef}
                style={styles.createInput}
                placeholder={COPY.createPlaceholder}
                placeholderTextColor={C.textTertiary}
                value={newName}
                onChangeText={(val) => {
                  setNewName(val);
                  setSelectedId(null);
                }}
                maxLength={50}
                returnKeyType="done"
                onSubmitEditing={handleCreateAndSave}
                autoCapitalize="words"
              />
              <View style={styles.createActions}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowCreate(false);
                    setNewName('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>{COPY.cancel}</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.createAndSaveButton,
                    !canCreateAndSave && styles.createAndSaveButtonDisabled,
                  ]}
                  onPress={handleCreateAndSave}
                  disabled={!canCreateAndSave}
                >
                  <Text
                    style={[
                      styles.createAndSaveButtonText,
                      !canCreateAndSave && styles.createAndSaveButtonTextDisabled,
                    ]}
                  >
                    {COPY.createAndSave}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              style={styles.createNewButton}
              onPress={() => {
                setShowCreate(true);
                setSelectedId(null);
              }}
            >
              <View style={styles.createNewIconCircle}>
                <Text style={styles.createNewIconPlus}>+</Text>
              </View>
              <Text style={styles.createNewText}>{COPY.createNew}</Text>
            </Pressable>
          )}

          {/* Divider */}
          {cookbooks.length > 0 && (
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{COPY.orChooseExisting}</Text>
              <View style={styles.dividerLine} />
            </View>
          )}

          {/* Cookbook List */}
          {cookbooks.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{COPY.noCookbooks}</Text>
            </View>
          ) : (
            <View style={styles.cookbookList}>
              {cookbooks.map((cookbook) => {
                const isSelected = selectedId === cookbook.id;
                return (
                  <Pressable
                    key={cookbook.id}
                    style={({ pressed }) => [
                      styles.cookbookItem,
                      pressed && styles.cookbookItemPressed,
                      isSelected && styles.cookbookItemSelected,
                    ]}
                    onPress={() => handleSelectCookbook(cookbook.id)}
                  >
                    <View style={styles.cookbookItemContent}>
                      {cookbook.coverImageUrl ? (
                        <Image
                          source={{ uri: cookbook.coverImageUrl }}
                          style={styles.cookbookImage}
                        />
                      ) : (
                        <View style={[styles.cookbookImage, styles.cookbookImagePlaceholder]}>
                          <Text style={styles.bookIcon}>{'\uD83D\uDCD6'}</Text>
                        </View>
                      )}
                      <View style={styles.cookbookInfo}>
                        <Text style={styles.cookbookName} numberOfLines={1}>
                          {cookbook.name}
                        </Text>
                        <Text style={styles.cookbookCount}>
                          {cookbook.recipeCount} {cookbook.recipeCount === 1 ? 'recipe' : 'recipes'}
                        </Text>
                      </View>
                      {isSelected ? (
                        <Text style={styles.checkmark}>{'\u2713'}</Text>
                      ) : (
                        <Text style={styles.chevron}>{'\u203A'}</Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Footer - only show when a cookbook is selected (not creating) */}
        {selectedId !== null && !showCreate && (
          <View style={styles.footer}>
            <Pressable
              style={[styles.saveButton, canSave && styles.saveButtonActive]}
              onPress={handleSave}
              disabled={!canSave}
              accessibilityRole="button"
              accessibilityLabel={COPY.save}
            >
              <Text
                style={[
                  styles.saveButtonText,
                  !canSave && styles.saveButtonTextDisabled,
                ]}
              >
                {COPY.save}
              </Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bgPrimary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: S.lg,
    paddingVertical: S.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  closeButton: {
    fontSize: 20,
    color: C.textSecondary,
    lineHeight: 24,
  },
  headerTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    color: C.textPrimary,
    letterSpacing: -0.2,
  },
  headerSpacer: {
    width: 24,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: S.lg,
    paddingBottom: S.xl,
  },

  // URL Preview
  urlPreview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: C.bgSecondary,
    borderRadius: R.md,
    padding: S.md,
    marginBottom: S.lg,
    gap: S.sm,
  },
  urlIcon: {
    fontSize: 18,
    lineHeight: 24,
  },
  urlTextContainer: {
    flex: 1,
  },
  urlDomain: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: C.textPrimary,
    letterSpacing: 0.1,
  },
  urlFull: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: C.textTertiary,
    marginTop: 2,
    letterSpacing: 0.2,
  },

  // Create New Button (dashed border style matching CookbookSelectionModal)
  createNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    paddingVertical: S.md,
    paddingHorizontal: S.md,
    backgroundColor: '#FFF5EF',
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.accent,
    borderStyle: 'dashed',
  },
  createNewIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createNewIconPlus: {
    fontSize: 22,
    fontWeight: '500',
    color: C.accent,
    lineHeight: 24,
  },
  createNewText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: C.accent,
  },

  // Create Form (matching CookbookSelectionModal create form)
  createForm: {
    gap: S.md,
  },
  createInput: {
    fontSize: 15,
    lineHeight: 22,
    backgroundColor: C.bgPrimary,
    borderRadius: R.md,
    paddingHorizontal: S.md,
    paddingVertical: S.md,
    color: C.textPrimary,
    borderWidth: 1,
    borderColor: C.accent,
  },
  createActions: {
    flexDirection: 'row',
    gap: S.sm,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: S.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: R.md,
    backgroundColor: C.bgSecondary,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.textSecondary,
  },
  createAndSaveButton: {
    flex: 2,
    paddingVertical: S.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: R.md,
    backgroundColor: C.accent,
  },
  createAndSaveButtonDisabled: {
    backgroundColor: C.bgTertiary,
  },
  createAndSaveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.textInverse,
  },
  createAndSaveButtonTextDisabled: {
    color: C.textDisabled,
  },

  // Divider
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: S.lg,
    gap: S.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },
  dividerText: {
    fontSize: 12,
    lineHeight: 16,
    color: C.textTertiary,
  },

  // Empty state
  emptyState: {
    paddingVertical: S.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: C.textTertiary,
    textAlign: 'center',
  },

  // Cookbook list (matching CookbookSelectionModal card style)
  cookbookList: {
    gap: S.sm,
  },
  cookbookItem: {
    borderRadius: R.md,
  },
  cookbookItemPressed: {
    backgroundColor: C.bgSecondary,
  },
  cookbookItemSelected: {
    backgroundColor: '#FFF5EF',
  },
  cookbookItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    paddingVertical: S.sm,
    paddingHorizontal: S.sm,
  },
  cookbookImage: {
    width: 48,
    height: 48,
    borderRadius: R.sm,
  },
  cookbookImagePlaceholder: {
    backgroundColor: C.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookIcon: {
    fontSize: 20,
  },
  cookbookInfo: {
    flex: 1,
    gap: 2,
  },
  cookbookName: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    color: C.textPrimary,
  },
  cookbookCount: {
    fontSize: 12,
    lineHeight: 16,
    color: C.textTertiary,
  },
  chevron: {
    fontSize: 22,
    color: C.textTertiary,
    fontWeight: '300',
  },
  checkmark: {
    fontSize: 20,
    color: C.accent,
    fontWeight: '700',
  },

  // Footer
  footer: {
    paddingHorizontal: S.lg,
    paddingTop: S.md,
    paddingBottom: S.lg,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bgPrimary,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bgTertiary,
    borderRadius: R.md,
    paddingVertical: S.md,
    gap: S.sm,
  },
  saveButtonActive: {
    backgroundColor: C.accent,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: C.textInverse,
    letterSpacing: 0.1,
  },
  saveButtonTextDisabled: {
    color: C.textDisabled,
  },

  // Success
  successCloseButton: {
    position: 'absolute',
    top: S.lg,
    right: S.lg,
    zIndex: 1,
    padding: S.sm,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: S.xl,
  },
  successImage: {
    width: 180,
    height: 180,
    marginBottom: S.xl,
  },
  successTitle: {
    fontSize: 80,
    lineHeight: 96,
    fontWeight: '700',
    color: C.textPrimary,
    marginBottom: S.md,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 45,
    lineHeight: 56,
    color: C.textSecondary,
    textAlign: 'center',
  },
});
