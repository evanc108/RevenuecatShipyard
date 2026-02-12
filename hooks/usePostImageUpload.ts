import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

const MAX_POST_IMAGES = 5;

type PostImageAsset = {
  storageId: Id<'_storage'>;
  localUri: string;
};

type UsePostImageUploadReturn = {
  pickImages: (currentCount: number) => Promise<string[] | null>;
  uploadImages: (uris: string[]) => Promise<PostImageAsset[]>;
  isUploading: boolean;
};

export function usePostImageUpload(): UsePostImageUploadReturn {
  const generateUploadUrl = useMutation(api.users.generateUploadUrl);
  const [isUploading, setIsUploading] = useState(false);

  const pickImages = async (currentCount: number): Promise<string[] | null> => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Please grant photo library access to add photos to your post.',
          );
          return null;
        }
      }

      const remaining = MAX_POST_IMAGES - currentCount;
      if (remaining <= 0) return null;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.7,
      });

      if (result.canceled || result.assets.length === 0) {
        return null;
      }

      return result.assets
        .filter((asset) => asset.uri)
        .map((asset) => asset.uri);
    } catch {
      Alert.alert('Error', 'Could not open photo library. Please try again.');
      return null;
    }
  };

  const uploadImages = async (uris: string[]): Promise<PostImageAsset[]> => {
    setIsUploading(true);
    try {
      const results = await Promise.all(
        uris.map(async (uri) => {
          const uploadUrl = await generateUploadUrl();

          const response = await fetch(uri);
          const blob = await response.blob();

          const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              'Content-Type': blob.type,
            },
            body: blob,
          });

          if (!uploadResponse.ok) {
            throw new Error('Failed to upload image');
          }

          const { storageId } = await uploadResponse.json();

          return {
            storageId: storageId as Id<'_storage'>,
            localUri: uri,
          };
        })
      );

      return results;
    } catch {
      Alert.alert('Upload Failed', 'Could not upload your photos. Please try again.');
      return [];
    } finally {
      setIsUploading(false);
    }
  };

  return { pickImages, uploadImages, isUploading };
}

export { MAX_POST_IMAGES };
