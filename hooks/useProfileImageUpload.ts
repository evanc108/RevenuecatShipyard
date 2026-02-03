import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

type UploadResult = {
  storageId: Id<'_storage'>;
  localUri: string;
};

type UseProfileImageUploadReturn = {
  pickAndUploadImage: () => Promise<UploadResult | null>;
  isUploading: boolean;
};

export function useProfileImageUpload(): UseProfileImageUploadReturn {
  const generateUploadUrl = useMutation(api.users.generateUploadUrl);
  const [isUploading, setIsUploading] = useState(false);

  const pickAndUploadImage = async (): Promise<UploadResult | null> => {
    try {
      // Request permissions
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Please grant photo library access to add a profile picture.',
          );
          return null;
        }
      }

      // Launch picker with square crop
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      if (!asset?.uri) {
        return null;
      }

      setIsUploading(true);

      // Get upload URL from Convex
      const uploadUrl = await generateUploadUrl();

      // Fetch the image and upload to Convex storage
      const response = await fetch(asset.uri);
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
        localUri: asset.uri,
      };
    } catch (error) {
      Alert.alert('Upload Failed', 'Could not upload your photo. Please try again.');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  return { pickAndUploadImage, isUploading };
}
