/**
 * Icon component using Lucide for modern, line-based icons
 * Maintains the IconSymbol API for backwards compatibility with tab navigation
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
import type { OpaqueColorValue, StyleProp, ViewStyle } from 'react-native';

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

type IconSymbolName = keyof typeof ICON_MAP;

type IconSymbolProps = {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
};

function IconSymbolComponent({
  name,
  size = 24,
  color,
  style,
}: IconSymbolProps): React.ReactElement | null {
  const IconElement = ICON_MAP[name as string];

  if (!IconElement) {
    console.warn(`IconSymbol "${String(name)}" not found`);
    return null;
  }

  return (
    <IconElement
      size={size}
      color={color as string}
      strokeWidth={1.5}
      style={style}
    />
  );
}

export const IconSymbol = memo(IconSymbolComponent);
