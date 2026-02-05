/**
 * Horizontal scrollable row for pending imports on the dashboard.
 *
 * Shows:
 * - A list of active imports/uploads
 * - Progress status for each
 * - Disappears when no imports are pending
 */

import { useRouter } from 'expo-router';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import * as Progress from 'react-native-progress';

import { Icon } from '@/components/ui/Icon';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { PendingUpload, usePendingUploadsStore } from '@/stores/usePendingUploadsStore';

function ImportCard({ upload, onDismiss }: { upload: PendingUpload; onDismiss: (id: string) => void }) {
  const router = useRouter();
  const isComplete = upload.status === 'complete';
  const isError = upload.status === 'error';
  const isActive = !isComplete && !isError;

  const handlePress = () => {
    if (isComplete && upload.recipeId) {
      router.push(`/recipe/${upload.recipeId}`);
      onDismiss(upload.id);
    }
  };

  return (
    <Pressable
      style={[
        styles.card,
        isComplete && styles.cardComplete,
        isError && styles.cardError,
      ]}
      onPress={handlePress}
      disabled={isActive}
    >
      <View style={styles.iconContainer}>
        {isComplete ? (
          <Icon name="checkmark-circle" size={20} color={Colors.semantic.success} />
        ) : isError ? (
          <Icon name="alert-circle" size={20} color={Colors.semantic.error} />
        ) : (
          <Progress.Circle
            size={20}
            indeterminate={true}
            color={Colors.accent}
            borderWidth={2}
          />
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {isComplete ? 'Recipe ready' : isError ? 'Import failed' : 'Importing recipe...'}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {isComplete ? upload.recipeTitle : (upload.cookbookName ?? 'Adding to library')}
        </Text>
      </View>

      <Pressable
        style={styles.closeButton}
        onPress={() => onDismiss(upload.id)}
        hitSlop={8}
      >
        <Icon name="close" size={14} color={Colors.text.tertiary} />
      </Pressable>
    </Pressable>
  );
}

export function PendingImportRow(): React.ReactElement | null {
  const uploads = usePendingUploadsStore((s) => s.uploads);
  const removeUpload = usePendingUploadsStore((s) => s.removeUpload);

  const activeUploads = Object.values(uploads).sort((a, b) => b.createdAt - a.createdAt);

  if (activeUploads.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Imports</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {activeUploads.map((upload) => (
          <ImportCard
            key={upload.id}
            upload={upload}
            onDismiss={removeUpload}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  header: {
    ...Typography.label,
    color: Colors.text.secondary,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    width: 200,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardComplete: {
    backgroundColor: Colors.background.primary,
    borderColor: Colors.semantic.success,
  },
  cardError: {
    backgroundColor: Colors.background.primary,
    borderColor: Colors.semantic.error,
  },
  iconContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    ...Typography.label,
    fontSize: 13,
    color: Colors.text.primary,
  },
  subtitle: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.text.tertiary,
  },
  closeButton: {
    padding: 2,
    alignSelf: 'flex-start',
  },
});
