/**
 * Modern line-based icon component using Lucide icons
 * Instagram-style thin stroke icons for a clean, contemporary look
 */
import { memo } from 'react';
import type { LucideIcon } from 'lucide-react-native';
import {
  // Navigation
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  X,
  Menu,

  // Content & Actions
  Search,
  Plus,
  PlusCircle,
  XCircle,
  Check,
  CheckCircle,
  Star,
  Minus,

  // Social & Sharing
  Share2,
  Users,
  User,
  UserPlus,
  LogOut,

  // Content Types
  BookOpen,
  Grid3X3,
  Camera,
  Image,
  UtensilsCrossed,
  Flame,
  Sun,
  Moon,
  Cookie,
  ShoppingCart,

  // UI Elements
  AlertCircle,
  Lock,
  Link,
  Mail,
  Pencil,
  Trash2,
  Clock,
  Download,
  FileEdit,
  LayoutGrid,
  Layers,

  // Auth & Branding
  Apple,
  Chrome,

  // Additional
  Compass,
  Calendar,
  Home,
  Send,
  Code,
  Heart,
  Bookmark,
  Settings,
  MoreHorizontal,
  ExternalLink,
  Copy,
  Eye,
  EyeOff,
  Info,
  Bell,
  MessageCircle,
  Mic,
  MicOff,
  Volume2,
  Loader,
} from 'lucide-react-native';
import type { OpaqueColorValue, StyleProp, ViewStyle } from 'react-native';

// Map of icon names to Lucide components
const ICON_MAP = {
  // Navigation
  'chevron-back': ChevronLeft,
  'chevron-left': ChevronLeft,
  'chevron-forward': ChevronRight,
  'chevron-right': ChevronRight,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  'arrow-back': ArrowLeft,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'arrow-forward': ArrowRight,
  'arrow-up': ArrowUp,
  close: X,
  menu: Menu,

  // Content & Actions
  search: Search,
  add: Plus,
  plus: Plus,
  'add-circle': PlusCircle,
  'add-circle-outline': PlusCircle,
  'plus-circle': PlusCircle,
  'close-circle': XCircle,
  'x-circle': XCircle,
  checkmark: Check,
  check: Check,
  'checkmark-circle': CheckCircle,
  'check-circle': CheckCircle,
  star: Star,
  'star-outline': Star,
  remove: Minus,
  minus: Minus,

  // Social & Sharing
  share: Share2,
  'share-outline': Share2,
  people: Users,
  'people-outline': Users,
  users: Users,
  person: User,
  'person-outline': User,
  user: User,
  'user-plus': UserPlus,
  'person-add': UserPlus,
  'log-out': LogOut,
  'log-out-outline': LogOut,
  logout: LogOut,

  // Content Types
  book: BookOpen,
  'book-outline': BookOpen,
  'book-open': BookOpen,
  grid: Grid3X3,
  'grid-outline': Grid3X3,
  camera: Camera,
  'camera-outline': Camera,
  image: Image,
  'image-outline': Image,
  restaurant: UtensilsCrossed,
  'restaurant-outline': UtensilsCrossed,
  utensils: UtensilsCrossed,
  flame: Flame,
  sun: Sun,
  moon: Moon,
  cookie: Cookie,
  'shopping-cart': ShoppingCart,
  cart: ShoppingCart,
  'flame-outline': Flame,

  // UI Elements
  alert: AlertCircle,
  'alert-circle': AlertCircle,
  lock: Lock,
  'lock-closed': Lock,
  link: Link,
  'link-outline': Link,
  mail: Mail,
  'mail-outline': Mail,
  pencil: Pencil,
  edit: Pencil,
  trash: Trash2,
  'trash-outline': Trash2,
  time: Clock,
  'time-outline': Clock,
  clock: Clock,
  download: Download,
  'download-outline': Download,
  create: FileEdit,
  'create-outline': FileEdit,
  apps: LayoutGrid,
  'apps-outline': LayoutGrid,
  layers: Layers,

  // Auth & Branding
  'logo-apple': Apple,
  apple: Apple,
  'logo-google': Chrome,
  google: Chrome,

  // Additional icons
  compass: Compass,
  discover: Compass,
  'safari-fill': Compass,
  safari: Compass,
  calendar: Calendar,
  home: Home,
  'house-fill': Home,
  send: Send,
  code: Code,
  heart: Heart,
  'heart-outline': Heart,
  bookmark: Bookmark,
  'bookmark-outline': Bookmark,
  settings: Settings,
  'settings-outline': Settings,
  more: MoreHorizontal,
  'more-horizontal': MoreHorizontal,
  'external-link': ExternalLink,
  copy: Copy,
  eye: Eye,
  'eye-outline': Eye,
  'eye-off': EyeOff,
  'eye-off-outline': EyeOff,
  info: Info,
  'info-outline': Info,
  bell: Bell,
  'bell-outline': Bell,
  'message-circle': MessageCircle,
  'chatbubble-outline': MessageCircle,
  mic: Mic,
  'mic-outline': Mic,
  'mic-off': MicOff,
  'volume-2': Volume2,
  volume: Volume2,
  loader: Loader,
} as const;

export type IconName = keyof typeof ICON_MAP;

type IconProps = {
  name: IconName;
  size?: number;
  color: string | OpaqueColorValue;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
  filled?: boolean;
};

/**
 * Icon component using Lucide icons
 * Provides a consistent, modern line-based icon set
 */
function IconComponent({
  name,
  size = 24,
  color,
  strokeWidth = 1.5,
  style,
  filled = false,
}: IconProps): React.ReactElement | null {
  const IconElement = ICON_MAP[name] as LucideIcon | undefined;

  if (!IconElement) {
    console.warn(`Icon "${name}" not found in icon map`);
    return null;
  }

  return (
    <IconElement
      size={size}
      color={color as string}
      strokeWidth={strokeWidth}
      style={style}
      fill={filled ? (color as string) : 'none'}
    />
  );
}

export const Icon = memo(IconComponent);
