/**
 * Icon component using Lucide for modern, line-based icons on iOS
 * Uses Lucide instead of SF Symbols for consistent cross-platform appearance
 */
import { memo } from 'react';
import {
  BookOpen,
  Compass,
  PlusCircle,
  Calendar,
  User,
  Home,
  Send,
  Code,
  ChevronRight,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { SymbolWeight } from 'expo-symbols';
import type { StyleProp, ViewStyle } from 'react-native';

// Map SF Symbol names to Lucide components
const ICON_MAP: Record<string, LucideIcon> = {
  'house.fill': Home,
  'paperplane.fill': Send,
  'chevron.left.forwardslash.chevron.right': Code,
  'chevron.right': ChevronRight,
  'safari.fill': Compass,
  'plus.circle.fill': PlusCircle,
  'book.fill': BookOpen,
  calendar: Calendar,
  'person.fill': User,
};

function IconSymbolComponent({
  name,
  size = 24,
  color,
  style,
}: {
  name: string;
  size?: number;
  color: string;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
}): React.ReactElement | null {
  const IconElement = ICON_MAP[name];

  if (!IconElement) {
    console.warn(`IconSymbol "${name}" not found`);
    return null;
  }

  return (
    <IconElement
      size={size}
      color={color}
      strokeWidth={1.5}
      style={style}
    />
  );
}

export const IconSymbol = memo(IconSymbolComponent);
