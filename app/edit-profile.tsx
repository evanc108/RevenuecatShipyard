import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Avatar } from '@/components/ui/Avatar';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { useDebounce } from '@/hooks/useDebounce';
import { useProfileImageUpload } from '@/hooks/useProfileImageUpload';
import { Image } from 'expo-image';
import { AvatarSizes } from '@/constants/theme';
import { GOALS, DIETARY_RESTRICTIONS } from '@/constants/onboarding';
import type { Id } from '@/convex/_generated/dataModel';

function SelectableChip({
  label,
  isSelected,
  onPress,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      style={[styles.chip, isSelected && styles.chipSelected]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function RemovableChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}): React.ReactElement {
  return (
    <View style={styles.removableChip}>
      <Text style={styles.removableChipText}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${label}`}
        onPress={onRemove}
        hitSlop={4}
      >
        <Ionicons name="close-circle" size={18} color={Colors.text.tertiary} />
      </Pressable>
    </View>
  );
}

export default function EditProfileScreen(): React.ReactElement {
  const router = useRouter();
  const user = useQuery(api.users.current);
  const updateProfile = useMutation(api.users.updateProfile);
  const updatePreferences = useMutation(api.users.updatePreferences);
  const { pickAndUploadImage, isUploading } = useProfileImageUpload();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [storageId, setStorageId] = useState<Id<'_storage'> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Preferences state
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [ingredientDislikes, setIngredientDislikes] = useState<string[]>([]);
  const [dislikeInput, setDislikeInput] = useState('');

  const debouncedUsername = useDebounce(username, 300);
  const usernameCheck = useQuery(
    api.users.checkUsername,
    debouncedUsername.length >= 3 ? { username: debouncedUsername } : 'skip'
  );
  const isUsernameAvailable = usernameCheck?.available ?? false;

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName);
      setLastName(user.lastName);
      setUsername(user.username || '');
      setSelectedGoals(user.goals || []);
      setSelectedDietary(user.dietaryRestrictions || []);
      setIngredientDislikes(user.ingredientDislikes || []);
    }
  }, [user]);

  const handlePickImage = async () => {
    const result = await pickAndUploadImage();
    if (result) {
      setLocalImageUri(result.localUri);
      setStorageId(result.storageId);
    }
  };

  const toggleGoal = (goalId: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goalId) ? prev.filter((g) => g !== goalId) : [...prev, goalId]
    );
  };

  const toggleDietary = (restriction: string) => {
    setSelectedDietary((prev) =>
      prev.includes(restriction) ? prev.filter((r) => r !== restriction) : [...prev, restriction]
    );
  };

  const addDislike = () => {
    const trimmed = dislikeInput.trim().toLowerCase();
    if (trimmed && !ingredientDislikes.includes(trimmed)) {
      setIngredientDislikes((prev) => [...prev, trimmed]);
      setDislikeInput('');
    }
  };

  const removeDislike = (ingredient: string) => {
    setIngredientDislikes((prev) => prev.filter((d) => d !== ingredient));
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim() || !username.trim()) {
      setError('All fields are required');
      return;
    }

    if (username.length >= 3 && !isUsernameAvailable) {
      setError('Username is not available');
      return;
    }

    try {
      setIsSaving(true);
      setError('');

      await Promise.all([
        updateProfile({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          username: username.trim().replace(/^@/, ''),
          storageId: storageId ?? undefined,
        }),
        updatePreferences({
          goals: selectedGoals,
          dietaryRestrictions: selectedDietary,
          ingredientDislikes: ingredientDislikes,
        }),
      ]);

      router.back();
    } catch (err) {
      setError('Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (user === undefined) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (user === null) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.content}>
          <Text style={styles.errorText}>Unable to load profile</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Skip Clerk's default gradient avatars
  const isClerkDefaultAvatar = user.imageUrl?.includes('img.clerk.com');
  const currentAvatarUrl = isClerkDefaultAvatar ? null : user.imageUrl;
  const displayImageUri = localImageUri || currentAvatarUrl;

  const canSave =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    username.trim().length >= 3 &&
    isUsernameAvailable;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={28} color={Colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save"
            onPress={handleSave}
            disabled={!canSave || isSaving}
            hitSlop={8}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : (
              <Text style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}>
                Save
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.avatarSection}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
              onPress={handlePickImage}
              disabled={isUploading}
            >
              {isUploading ? (
                <View style={styles.avatarPlaceholder}>
                  <ActivityIndicator size="large" color={Colors.accent} />
                </View>
              ) : displayImageUri ? (
                <Image
                  source={{ uri: displayImageUri }}
                  style={styles.avatarImage}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <Avatar
                  firstName={user.firstName || 'U'}
                  lastName={user.lastName || 'N'}
                  size="xl"
                />
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change photo"
              onPress={handlePickImage}
              disabled={isUploading}
              hitSlop={8}
            >
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </Pressable>
          </View>

          <View style={styles.formSection}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>First Name</Text>
              <TextInput
                style={styles.textInput}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                autoCorrect={false}
                textContentType="givenName"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Last Name</Text>
              <TextInput
                style={styles.textInput}
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                autoCorrect={false}
                textContentType="familyName"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Username</Text>
              <View style={styles.usernameContainer}>
                <TextInput
                  style={[
                    styles.textInput,
                    styles.usernameInput,
                    username.length >= 3 && !isUsernameAvailable && styles.inputError,
                  ]}
                  value={username}
                  onChangeText={(text) => setUsername(text.replace(/\s/g, ''))}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="@username"
                  placeholderTextColor={Colors.text.tertiary}
                />
                {username.length >= 3 && (
                  <View style={styles.usernameStatus}>
                    {usernameCheck === undefined ? (
                      <ActivityIndicator size="small" color={Colors.text.tertiary} />
                    ) : isUsernameAvailable ? (
                      <Ionicons name="checkmark-circle" size={20} color={Colors.semantic.success} />
                    ) : (
                      <Ionicons name="close-circle" size={20} color={Colors.semantic.error} />
                    )}
                  </View>
                )}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <View style={styles.emailContainer}>
                <Text style={styles.emailText}>{user.email}</Text>
                <Ionicons name="lock-closed" size={16} color={Colors.text.tertiary} />
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.preferencesSection}>
            <Text style={styles.sectionTitle}>My Goals</Text>
            <View style={styles.chipsContainer}>
              {GOALS.map((goal) => (
                <SelectableChip
                  key={goal.id}
                  label={`${goal.emoji} ${goal.title}`}
                  isSelected={selectedGoals.includes(goal.id)}
                  onPress={() => toggleGoal(goal.id)}
                />
              ))}
            </View>
          </View>

          <View style={styles.preferencesSection}>
            <Text style={styles.sectionTitle}>Dietary Preferences</Text>
            <View style={styles.chipsContainer}>
              {DIETARY_RESTRICTIONS.map((restriction) => (
                <SelectableChip
                  key={restriction}
                  label={restriction}
                  isSelected={selectedDietary.includes(restriction)}
                  onPress={() => toggleDietary(restriction)}
                />
              ))}
            </View>
          </View>

          <View style={styles.preferencesSection}>
            <Text style={styles.sectionTitle}>Ingredients to Avoid</Text>
            <View style={styles.addIngredientRow}>
              <TextInput
                style={[styles.textInput, styles.ingredientInput]}
                placeholder="Add ingredient..."
                placeholderTextColor={Colors.text.tertiary}
                value={dislikeInput}
                onChangeText={setDislikeInput}
                onSubmitEditing={addDislike}
                returnKeyType="done"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add ingredient"
                style={[styles.addButton, dislikeInput.trim() && styles.addButtonActive]}
                onPress={addDislike}
                disabled={!dislikeInput.trim()}
              >
                <Ionicons name="add" size={22} color={dislikeInput.trim() ? Colors.accent : Colors.text.tertiary} />
              </Pressable>
            </View>
            {ingredientDislikes.length > 0 && (
              <View style={styles.chipsContainer}>
                {ingredientDislikes.map((ingredient) => (
                  <RemovableChip
                    key={ingredient}
                    label={ingredient}
                    onRemove={() => removeDislike(ingredient)}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  errorText: {
    ...Typography.body,
    color: Colors.text.secondary,
    marginTop: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
  },
  saveButton: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.accent,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  error: {
    ...Typography.bodySmall,
    color: Colors.semantic.error,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  avatarPlaceholder: {
    width: AvatarSizes.xl,
    height: AvatarSizes.xl,
    borderRadius: AvatarSizes.xl / 2,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: AvatarSizes.xl,
    height: AvatarSizes.xl,
    borderRadius: AvatarSizes.xl / 2,
  },
  changePhotoText: {
    ...Typography.body,
    color: Colors.accent,
    fontWeight: '600',
  },
  formSection: {
    gap: Spacing.lg,
  },
  inputGroup: {
    gap: Spacing.xs,
  },
  inputLabel: {
    ...Typography.bodySmall,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  textInput: {
    height: 48,
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
    color: Colors.text.primary,
  },
  usernameContainer: {
    position: 'relative',
  },
  usernameInput: {
    paddingRight: 44,
  },
  usernameStatus: {
    position: 'absolute',
    right: Spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  inputError: {
    borderWidth: 1,
    borderColor: Colors.semantic.error,
  },
  emailContainer: {
    height: 48,
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emailText: {
    ...Typography.body,
    color: Colors.text.tertiary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xl,
  },
  preferencesSection: {
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.label,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  addIngredientRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  ingredientInput: {
    flex: 1,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    backgroundColor: Colors.background.secondary,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentLight,
  },
  chip: {
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipSelected: {
    backgroundColor: Colors.accentLight,
    borderColor: Colors.accent,
  },
  chipText: {
    ...Typography.bodySmall,
    color: Colors.text.primary,
  },
  chipTextSelected: {
    color: Colors.accent,
    fontWeight: '500',
  },
  removableChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.full,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.sm,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  removableChipText: {
    ...Typography.bodySmall,
    color: Colors.text.primary,
  },
});
