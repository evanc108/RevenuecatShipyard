import { memo, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadow } from '@/constants/theme';

type CookbookCardProps = {
  name: string;
  description?: string | null;
  recipeCount: number;
  coverImageUrl?: string | null;
  onPress: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

type CreateCookbookCardProps = {
  onPress: () => void;
};

// Beautiful gradient patterns for cookbooks without cover images
type GradientColors = readonly [string, string];

const GRADIENT_PATTERNS: readonly GradientColors[] = [
  ['#667eea', '#764ba2'], // Purple blue
  ['#f093fb', '#f5576c'], // Pink
  ['#4facfe', '#00f2fe'], // Blue cyan
  ['#43e97b', '#38f9d7'], // Green mint
  ['#fa709a', '#fee140'], // Pink yellow
  ['#a8edea', '#fed6e3'], // Soft teal pink
  ['#ff9a9e', '#fecfef'], // Soft pink
  ['#ffecd2', '#fcb69f'], // Peach
] as const;

function getGradientForName(name: string): GradientColors {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return GRADIENT_PATTERNS[hash % GRADIENT_PATTERNS.length] ?? GRADIENT_PATTERNS[0];
}

type OverflowMenuProps = {
  visible: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  anchorPosition: { x: number; y: number };
};

function OverflowMenu({
  visible,
  onClose,
  onEdit,
  onDelete,
  anchorPosition,
}: OverflowMenuProps): React.ReactElement {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 20,
          stiffness: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.menuOverlay} onPress={onClose}>
        <Animated.View
          style={[
            styles.menuContainer,
            {
              top: anchorPosition.y,
              right: 20,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {onEdit ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit cookbook"
              style={styles.menuItem}
              onPress={() => { onClose(); onEdit(); }}
            >
              <Ionicons name="pencil-outline" size={18} color={Colors.text.primary} />
              <Text style={styles.menuItemText}>Edit</Text>
            </Pressable>
          ) : null}

          {onEdit && onDelete ? <View style={styles.menuDivider} /> : null}

          {onDelete ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete cookbook"
              style={styles.menuItem}
              onPress={() => { onClose(); onDelete(); }}
            >
              <Ionicons name="trash-outline" size={18} color={Colors.semantic.error} />
              <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>Delete</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

export const CookbookCard = memo(function CookbookCard({
  name,
  description,
  recipeCount,
  coverImageUrl,
  onPress,
  onEdit,
  onDelete,
}: CookbookCardProps): React.ReactElement {
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const overflowRef = useRef<View>(null);

  const handleOverflowPress = () => {
    overflowRef.current?.measureInWindow((x, y, width, height) => {
      setMenuPosition({ x: x + width, y: y + height + 4 });
      setMenuVisible(true);
    });
  };

  const gradient = getGradientForName(name);
  const hasOverflowActions = onEdit !== undefined || onDelete !== undefined;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name} cookbook with ${recipeCount} recipes`}
        style={styles.card}
        onPress={onPress}
      >
        {/* Background */}
        {coverImageUrl ? (
          <Image
            source={{ uri: coverImageUrl }}
            style={styles.backgroundImage}
            contentFit="cover"
            transition={300}
            cachePolicy="memory-disk"
          />
        ) : (
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.backgroundGradient}
          />
        )}

        {/* Overlay gradient for text readability */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.6)']}
          locations={[0, 0.4, 1]}
          style={styles.overlay}
        />

        {/* Overflow button */}
        {hasOverflowActions ? (
          <View ref={overflowRef} style={styles.overflowContainer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="More options"
              style={styles.overflowButton}
              onPress={handleOverflowPress}
              hitSlop={12}
            >
              <BlurView intensity={40} tint="dark" style={styles.blurButton}>
                <Ionicons name="ellipsis-horizontal" size={18} color="white" />
              </BlurView>
            </Pressable>
          </View>
        ) : null}

        {/* Content */}
        <View style={styles.content}>
          {/* Main info */}
          <View style={styles.mainInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {name}
            </Text>
            {description ? (
              <Text style={styles.cardDescription} numberOfLines={2}>
                {description}
              </Text>
            ) : null}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.recipeCount}>
              <Ionicons name="book-outline" size={14} color="rgba(255,255,255,0.9)" />
              <Text style={styles.recipeCountText}>
                {recipeCount} {recipeCount === 1 ? 'recipe' : 'recipes'}
              </Text>
            </View>
            <View style={styles.viewButton}>
              <Text style={styles.viewButtonText}>View</Text>
              <Ionicons name="arrow-forward" size={14} color="white" />
            </View>
          </View>
        </View>
      </Pressable>

      <OverflowMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onEdit={onEdit}
        onDelete={onDelete}
        anchorPosition={menuPosition}
      />
    </>
  );
});

export const CreateCookbookCard = memo(function CreateCookbookCard({
  onPress,
}: CreateCookbookCardProps): React.ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Create new cookbook"
      style={styles.createCard}
      onPress={onPress}
    >
      <View style={styles.createIconWrapper}>
        <Ionicons name="add" size={20} color={Colors.accent} />
      </View>
      <Text style={styles.createText}>New Cookbook</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  // Cookbook Card Styles
  card: {
    width: '100%',
    aspectRatio: 1.9,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    backgroundColor: Colors.background.secondary,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overflowContainer: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    zIndex: 10,
  },
  overflowButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  blurButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: Spacing.lg,
  },
  mainInfo: {
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: 'white',
    letterSpacing: -0.5,
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.85)',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recipeCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
  },
  recipeCountText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'white',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
  },
  viewButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'white',
  },

  // Overflow Menu Styles
  menuOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  menuContainer: {
    position: 'absolute',
    backgroundColor: Colors.background.primary,
    borderRadius: Radius.md,
    minWidth: 140,
    paddingVertical: Spacing.xs,
    ...Shadow.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  menuItemText: {
    ...Typography.body,
    color: Colors.text.primary,
  },
  menuItemTextDanger: {
    color: Colors.semantic.error,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },

  // Create Card Styles
  createCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.background.secondary,
  },
  createIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createText: {
    ...Typography.label,
    color: Colors.text.primary,
  },
});
