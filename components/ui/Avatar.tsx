import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Colors, Radius, AvatarSizes, AvatarFontSizes } from '@/constants/theme';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

type AvatarProps = {
  imageUrl?: string | null;
  firstName: string;
  lastName: string;
  size?: AvatarSize;
  onPress?: () => void;
};

function getInitials(firstName: string, lastName: string): string {
  const firstInitial = firstName.charAt(0).toUpperCase();
  const lastInitial = lastName.charAt(0).toUpperCase();
  return `${firstInitial}${lastInitial}`;
}

export function Avatar({
  imageUrl,
  firstName,
  lastName,
  size = 'md',
  onPress,
}: AvatarProps): React.ReactElement {
  const dimension = AvatarSizes[size];
  const fontSize = AvatarFontSizes[size];
  const initials = getInitials(firstName, lastName);

  const containerStyle = [
    styles.container,
    {
      width: dimension,
      height: dimension,
      borderRadius: Radius.full,
    },
  ];

  const content = imageUrl ? (
    <Image
      source={{ uri: imageUrl }}
      style={[styles.image, { width: dimension, height: dimension, borderRadius: Radius.full }]}
      contentFit="cover"
      transition={200}
      cachePolicy="memory-disk"
    />
  ) : (
    <View style={[styles.initialsContainer, containerStyle]}>
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${firstName} ${lastName} avatar`}
        onPress={onPress}
        style={containerStyle}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={containerStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  image: {
    backgroundColor: Colors.background.secondary,
  },
  initialsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  initials: {
    fontWeight: '600',
    color: Colors.text.secondary,
  },
});
