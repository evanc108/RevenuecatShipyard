import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Image } from 'expo-image';
import { AvatarSizes } from '@/constants/theme';
import { PageTurnButton } from '@/components/onboarding/PageTurnButton';
import { PageIndicator } from '@/components/onboarding/PageIndicator';
import { ONBOARDING_COPY } from '@/constants/onboarding';
import { Colors, NAV_BUTTON_SIZE, Spacing, Radius, Typography } from '@/constants/theme';
import { useProfileImageUpload } from '@/hooks/useProfileImageUpload';
import { useDebounce } from '@/hooks/useDebounce';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const copy = ONBOARDING_COPY.profileSetup;
  const insets = useSafeAreaInsets();
  const updateProfile = useMutation(api.users.updateProfile);
  const { pickAndUploadImage, isUploading } = useProfileImageUpload();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [storageId, setStorageId] = useState<Id<'_storage'> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const debouncedUsername = useDebounce(username, 300);
  const usernameCheck = useQuery(
    api.users.checkUsername,
    debouncedUsername.length >= 3 ? { username: debouncedUsername } : 'skip'
  );
  const isUsernameAvailable = usernameCheck?.available ?? false;

  const handlePickImage = async () => {
    const result = await pickAndUploadImage();
    if (result) {
      setLocalImageUri(result.localUri);
      setStorageId(result.storageId);
    }
  };

  const handleContinue = async () => {
    if (!firstName.trim() || !lastName.trim() || !username.trim() || !isUsernameAvailable) return;

    try {
      setIsSaving(true);
      await updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim().replace(/^@/, ''),
        storageId: storageId ?? undefined,
      });
      router.push('/(onboarding)/goals');
    } catch {
      // Error handled silently - user can retry
    } finally {
      setIsSaving(false);
    }
  };

  const canContinue =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    username.trim().length >= 3 &&
    isUsernameAvailable;
  const photoLabel = localImageUri ? copy.changePhoto : copy.addPhoto;

  const bottomBarContent = (
    <Animated.View
      entering={FadeInUp.delay(200).duration(400)}
      style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.sm }]}
    >
      <View style={styles.bottomLeft}>
        <PageIndicator current={1} total={3} />
      </View>
      <PageTurnButton
        label="Next >"
        onPress={handleContinue}
        disabled={!canContinue || isSaving}
      />
    </Animated.View>
  );

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

      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        bottomBar={bottomBarContent}
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text style={styles.headline}>{copy.headline}</Text>
          <Text style={styles.subhead}>{copy.subhead}</Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(100).duration(400)}
          style={styles.avatarSection}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Select profile photo"
            onPress={handlePickImage}
            disabled={isUploading}
            style={styles.avatarContainer}
          >
            {isUploading ? (
              <View style={styles.avatarPlaceholder}>
                <ActivityIndicator size="large" color={Colors.accent} />
              </View>
            ) : localImageUri ? (
              <Image
                source={{ uri: localImageUri }}
                style={styles.avatarImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Icon name="camera" size={40} color={Colors.text.tertiary} />
              </View>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={photoLabel}
            onPress={handlePickImage}
            hitSlop={8}
            disabled={isUploading}
          >
            <Text style={styles.photoLabel}>{photoLabel}</Text>
          </Pressable>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(150).duration(400)}
          style={styles.formSection}
        >
          <TextInput
            style={styles.textInput}
            placeholder={copy.firstNamePlaceholder}
            placeholderTextColor={Colors.text.tertiary}
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            autoCorrect={false}
            textContentType="givenName"
            returnKeyType="next"
            accessibilityLabel={copy.firstNamePlaceholder}
          />

          <TextInput
            style={styles.textInput}
            placeholder={copy.lastNamePlaceholder}
            placeholderTextColor={Colors.text.tertiary}
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            autoCorrect={false}
            textContentType="familyName"
            returnKeyType="next"
            accessibilityLabel={copy.lastNamePlaceholder}
          />

          <View style={styles.usernameContainer}>
            <TextInput
              style={[
                styles.textInput,
                styles.usernameInput,
                username.length >= 3 && !isUsernameAvailable && styles.inputError,
              ]}
              placeholder="@username"
              placeholderTextColor={Colors.text.tertiary}
              value={username}
              onChangeText={(text) => setUsername(text.replace(/\s/g, ''))}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              returnKeyType="done"
              accessibilityLabel="Username"
            />
            {username.length >= 3 && (
              <View style={styles.usernameStatus}>
                {usernameCheck === undefined ? (
                  <ActivityIndicator size="small" color={Colors.text.tertiary} />
                ) : isUsernameAvailable ? (
                  <Icon name="checkmark-circle" size={20} color={Colors.semantic.success} />
                ) : (
                  <Icon name="close-circle" size={20} color={Colors.semantic.error} />
                )}
              </View>
            )}
          </View>
          {username.length >= 3 && !isUsernameAvailable && usernameCheck !== undefined && (
            <Text style={styles.usernameError}>Username is already taken</Text>
          )}
        </Animated.View>
      </KeyboardAwareScrollView>
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
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  headline: {
    fontSize: 36,
    fontWeight: '400',
    color: Colors.text.primary,
    letterSpacing: -0.5,
    lineHeight: 50,
    marginBottom: Spacing.md,
  },
  subhead: {
    ...Typography.body,
    color: Colors.text.secondary,
    marginBottom: Spacing.xl,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  avatarContainer: {
    marginBottom: Spacing.sm,
  },
  avatarPlaceholder: {
    width: AvatarSizes.xl,
    height: AvatarSizes.xl,
    borderRadius: AvatarSizes.xl / 2,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  avatarImage: {
    width: AvatarSizes.xl,
    height: AvatarSizes.xl,
    borderRadius: AvatarSizes.xl / 2,
  },
  photoLabel: {
    ...Typography.body,
    color: Colors.accent,
    fontWeight: '600',
  },
  formSection: {
    gap: Spacing.md,
  },
  textInput: {
    height: 52,
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
  usernameError: {
    ...Typography.caption,
    color: Colors.semantic.error,
    marginTop: -Spacing.xs,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingLeft: Spacing.xl,
  },
  bottomLeft: {
    gap: Spacing.xs,
  },
});
