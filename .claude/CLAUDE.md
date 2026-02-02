# CLAUDE.md — React Native Expo Coding Standards

## Stack
- **Framework:** React Native 0.76+ / Expo SDK 52+
- **UI:** Gluestack UI v2
- **Backend:** Convex
- **Auth:** Clerk
- **Navigation:** Expo Router v4
- **State:** Zustand (client state) + Convex (server state)
- **Lists:** FlashList (not FlatList)
- **Images:** expo-image

---

## Project Structure

```
src/
├── app/                    # Expo Router screens
├── components/
│   ├── ui/                 # Gluestack primitives (styled)
│   └── features/           # Feature-specific components
├── hooks/                  # Custom hooks
├── stores/                 # Zustand stores
├── lib/
│   ├── convex/             # Convex client, helpers
│   └── clerk/              # Clerk config
├── constants/
│   ├── copy.ts             # All user-facing strings
│   ├── config.ts           # App config values
│   └── routes.ts           # Route constants
├── services/               # Business logic (no UI code)
├── types/                  # TypeScript types/interfaces
└── utils/                  # Pure utility functions
```

---

## Theme Configuration

Create `src/theme/index.ts`:

```typescript
export const theme = {
  colors: {
    accent: '#F2545B',
    accentLight: '#FEE8E9',
    accentDark: '#D94148',
    background: '#FFFFFF',
    surface: '#F8F9FA',
    border: '#E5E7EB',
    text: {
      primary: '#1A1A1A',
      secondary: '#6B7280',
      muted: '#9CA3AF',
      inverse: '#FFFFFF',
    },
    semantic: {
      error: '#DC2626',
      success: '#16A34A',
      warning: '#F59E0B',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    full: 9999,
  },
  typography: {
    sizes: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 24,
      xxl: 32,
    },
    weights: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
  },
} as const;

export type Theme = typeof theme;
```

**Rule:** Never hardcode colors, spacing, or sizes. Always import from theme.

---

## TypeScript Configuration

Use strict settings in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/convex/*": ["convex/*"]
    }
  }
}
```

### Navigation Typing

```typescript
// src/types/navigation.ts
export type RootStackParamList = {
  '(tabs)': undefined;
  'profile/[id]': { id: string };
  'venue/[id]': { id: string };
  'review/create': { venueId: string };
};

// Usage in components
import { useLocalSearchParams } from 'expo-router';
import type { RootStackParamList } from '@/types/navigation';

export default function VenueScreen() {
  const { id } = useLocalSearchParams<RootStackParamList['venue/[id]']>();
}
```

### Convex Typing

```typescript
// Convex queries/mutations are auto-typed via _generated
import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';

// Use Doc<"tableName"> for document types
type User = Doc<"users">;
type VenueId = Id<"venues">;
```

---

## Zustand Stores

Use Zustand for client-side state. Convex handles server state.

### When to Use Each

| Zustand | Convex |
|---------|--------|
| UI state (modals, tabs) | User data |
| Local preferences | Venues, reviews |
| Optimistic update cache | Relationships |
| Navigation state | Any persisted data |

### Store Pattern

```typescript
// src/stores/useAppStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AppState = {
  // State
  hasOnboarded: boolean;
  locationPermission: 'granted' | 'denied' | 'undetermined';
  
  // Actions
  setOnboarded: (value: boolean) => void;
  setLocationPermission: (status: AppState['locationPermission']) => void;
  reset: () => void;
};

const initialState = {
  hasOnboarded: false,
  locationPermission: 'undetermined' as const,
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      ...initialState,
      setOnboarded: (value) => set({ hasOnboarded: value }),
      setLocationPermission: (status) => set({ locationPermission: status }),
      reset: () => set(initialState),
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

### UI Store (Non-persisted)

```typescript
// src/stores/useUIStore.ts
import { create } from 'zustand';

type UIState = {
  activeModal: 'none' | 'filter' | 'sort' | 'share';
  searchQuery: string;
  setActiveModal: (modal: UIState['activeModal']) => void;
  setSearchQuery: (query: string) => void;
};

export const useUIStore = create<UIState>((set) => ({
  activeModal: 'none',
  searchQuery: '',
  setActiveModal: (modal) => set({ activeModal: modal }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}));
```

### Store Rules
- One store per domain (app, ui, user preferences)
- Actions defined inside store, not in components
- Use selectors to prevent unnecessary re-renders
- Persist only what's needed (preferences, onboarding state)

```typescript
// ✅ Good - selective subscription
const hasOnboarded = useAppStore((state) => state.hasOnboarded);

// ❌ Bad - subscribes to entire store
const store = useAppStore();
```

---

## System Design & Performance

### FlashList for All Lists

Never use FlatList. Always FlashList:

```typescript
import { FlashList } from '@shopify/flash-list';

<FlashList
  data={venues}
  renderItem={({ item }) => <VenueCard venue={item} />}
  estimatedItemSize={120} // Required - measure your actual item height
  keyExtractor={(item) => item._id}
/>
```

### Image Optimization

Use expo-image with caching:

```typescript
// src/components/ui/CachedImage.tsx
import { Image } from 'expo-image';

type CachedImageProps = {
  uri: string;
  width: number;
  height: number;
  borderRadius?: number;
};

const blurhash = 'LKN]Rv%2Tw=w]~RBVZRi};RTxuof'; // Generate per image ideally

export function CachedImage({ uri, width, height, borderRadius = 0 }: CachedImageProps) {
  return (
    <Image
      source={{ uri }}
      style={{ width, height, borderRadius }}
      placeholder={blurhash}
      contentFit="cover"
      transition={200}
      cachePolicy="memory-disk"
    />
  );
}
```

### Optimistic Updates with Convex

```typescript
// src/hooks/useOptimisticLike.ts
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useState } from 'react';

export function useOptimisticLike(initialLiked: boolean, initialCount: number) {
  const [optimistic, setOptimistic] = useState({ liked: initialLiked, count: initialCount });
  const likeMutation = useMutation(api.likes.toggle);

  const toggle = async (venueId: string) => {
    // Optimistic update
    setOptimistic((prev) => ({
      liked: !prev.liked,
      count: prev.liked ? prev.count - 1 : prev.count + 1,
    }));

    try {
      await likeMutation({ venueId });
    } catch {
      // Rollback on error
      setOptimistic({ liked: initialLiked, count: initialCount });
    }
  };

  return { ...optimistic, toggle };
}
```

### Pagination Pattern

```typescript
// convex/venues.ts
import { query } from './_generated/server';
import { v } from 'convex/values';

export const listPaginated = query({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    
    const results = await ctx.db
      .query('venues')
      .order('desc')
      .paginate({ cursor: args.cursor ?? null, numItems: limit });
    
    return {
      venues: results.page,
      nextCursor: results.continueCursor,
      hasMore: !results.isDone,
    };
  },
});

// Hook usage
export function useVenuesPaginated() {
  const [cursor, setCursor] = useState<string | undefined>();
  const result = useQuery(api.venues.listPaginated, { cursor, limit: 20 });
  
  const loadMore = () => {
    if (result?.nextCursor) {
      setCursor(result.nextCursor);
    }
  };
  
  return { venues: result?.venues ?? [], loadMore, hasMore: result?.hasMore ?? false };
}
```

### Debounced Search

```typescript
// src/hooks/useDebounce.ts
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Usage in search
function SearchScreen() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  
  const results = useQuery(
    api.venues.search,
    debouncedQuery.length >= 2 ? { query: debouncedQuery } : 'skip'
  );
}
```

### Memoization Rules

```typescript
// ✅ Memoize expensive list item components
const VenueCard = memo(function VenueCard({ venue }: { venue: Venue }) {
  return <View>...</View>;
});

// ✅ Memoize callbacks passed to children
const handlePress = useCallback(() => {
  navigation.navigate('venue', { id });
}, [id]);

// ✅ Memoize expensive computations
const sortedVenues = useMemo(
  () => venues.sort((a, b) => b.rating - a.rating),
  [venues]
);

// ❌ Don't memoize simple components or primitives
// ❌ Don't memoize if deps change every render
```

### Offline Consideration

For offline-first (like Beli), consider:

```typescript
// Store critical data locally with MMKV (faster than AsyncStorage)
import { MMKV } from 'react-native-mmkv';

export const storage = new MMKV();

// Cache recent venues for offline viewing
export function cacheVenues(venues: Venue[]) {
  storage.set('cached-venues', JSON.stringify(venues));
}

export function getCachedVenues(): Venue[] {
  const data = storage.getString('cached-venues');
  return data ? JSON.parse(data) : [];
}
```

### Error Handling Pattern

```typescript
// src/components/ui/QueryWrapper.tsx
import { ReactNode } from 'react';
import { View, Text } from 'react-native';
import { Button } from '@/components/ui';
import { COPY } from '@/constants/copy';

type QueryWrapperProps<T> = {
  data: T | undefined;
  error?: Error | null;
  loading?: boolean;
  onRetry?: () => void;
  children: (data: T) => ReactNode;
};

export function QueryWrapper<T>({ 
  data, 
  error, 
  loading, 
  onRetry, 
  children 
}: QueryWrapperProps<T>) {
  if (loading || data === undefined) {
    return <LoadingSpinner />;
  }
  
  if (error) {
    return (
      <View style={{ padding: 24, alignItems: 'center' }}>
        <Text>{COPY.errors.generic}</Text>
        {onRetry && <Button label="Retry" onPress={onRetry} />}
      </View>
    );
  }
  
  return <>{children(data)}</>;
}

// Usage
function VenueList() {
  const venues = useQuery(api.venues.list);
  
  return (
    <QueryWrapper data={venues}>
      {(data) => (
        <FlashList
          data={data}
          renderItem={({ item }) => <VenueCard venue={item} />}
          estimatedItemSize={120}
        />
      )}
    </QueryWrapper>
  );
}
```

### Network State Hook

```typescript
// src/hooks/useNetworkState.ts
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export function useNetworkState() {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? true);
    });
    return unsubscribe;
  }, []);

  return { isConnected };
}
```

---

## Gluestack Component Patterns

### Extending Gluestack Components

Create thin wrappers in `src/components/ui/` for consistency:

```typescript
// src/components/ui/Button.tsx
import { Button as GluestackButton, ButtonText } from '@gluestack-ui/themed';
import { theme } from '@/theme';

type ButtonProps = {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export function Button({ label, variant = 'primary', onPress, disabled, loading }: ButtonProps) {
  return (
    <GluestackButton
      onPress={onPress}
      isDisabled={disabled || loading}
      bg={variant === 'primary' ? theme.colors.accent : 'transparent'}
      borderWidth={variant === 'secondary' ? 1 : 0}
      borderColor={theme.colors.accent}
      borderRadius={theme.radius.md}
      opacity={disabled ? 0.5 : 1}
    >
      <ButtonText color={variant === 'primary' ? theme.colors.text.inverse : theme.colors.accent}>
        {loading ? 'Loading...' : label}
      </ButtonText>
    </GluestackButton>
  );
}
```

### Component Rules
- Props interface at top of file
- Destructure props with defaults
- No inline styles — use theme tokens
- Export named, not default

---

## Responsive Design

Use Gluestack's `useBreakpointValue` or this pattern:

```typescript
// src/hooks/useResponsive.ts
import { useWindowDimensions } from 'react-native';

export function useResponsive() {
  const { width } = useWindowDimensions();
  return {
    isSmall: width < 380,
    isMedium: width >= 380 && width < 428,
    isLarge: width >= 428,
    width,
  };
}
```

**Rules:**
- Test on iPhone SE (375pt) through iPhone Pro Max (430pt)
- Use percentage widths or flex for containers, fixed sizes only for icons/avatars
- Minimum touch target: 44x44pt
- Use `ScrollView` with `contentContainerStyle={{ flexGrow: 1 }}` for forms

---

## Business Logic Separation

### Services Pattern

```typescript
// src/services/matchService.ts
import { ConvexClient } from '@/lib/convex';

export const matchService = {
  async likeProfile(userId: string, targetId: string): Promise<boolean> {
    // Business logic here — no UI, no hooks
    const result = await ConvexClient.mutation('matches:like', { userId, targetId });
    return result.isMatch;
  },
  
  async getMatches(userId: string) {
    return ConvexClient.query('matches:list', { userId });
  },
};
```

### Hook Consumption

```typescript
// src/hooks/useMatches.ts
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

export function useMatches() {
  const matches = useQuery(api.matches.list);
  const likeMutation = useMutation(api.matches.like);
  
  const likeProfile = async (targetId: string) => {
    return likeMutation({ targetId });
  };
  
  return { matches, likeProfile, isLoading: matches === undefined };
}
```

**Rule:** Components call hooks. Hooks call services/Convex. Services contain logic.

---

## Constants & Copy

All user-facing text lives in `constants/copy.ts`:

```typescript
// src/constants/copy.ts
export const COPY = {
  auth: {
    signIn: 'Sign In',
    signUp: 'Create Account',
    forgotPassword: 'Forgot Password?',
    errors: {
      invalidEmail: 'Please enter a valid email',
      weakPassword: 'Password must be at least 8 characters',
    },
  },
  profile: {
    editProfile: 'Edit Profile',
    saveChanges: 'Save Changes',
  },
  errors: {
    generic: 'Something went wrong. Please try again.',
    network: 'Check your internet connection.',
  },
} as const;
```

**Rule:** Never write strings directly in components. Import from COPY.

---

## Convex Patterns

### Schema Definition

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    createdAt: v.number(),
  }).index('by_clerk_id', ['clerkId']),
});
```

### Query/Mutation Pattern

```typescript
// convex/users.ts
import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

export const getUser = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();
  },
});
```

**Rules:**
- Always use indexes for queries
- Validate all inputs with `v` validators
- Keep handlers thin — extract complex logic to helper functions

---

## Clerk Integration

```typescript
// src/lib/clerk/provider.tsx
import { ClerkProvider } from '@clerk/clerk-expo';
import { tokenCache } from './tokenCache';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={tokenCache}
    >
      {children}
    </ClerkProvider>
  );
}
```

### Protected Routes

```typescript
// src/app/(auth)/_layout.tsx
import { useAuth } from '@clerk/clerk-expo';
import { Redirect, Stack } from 'expo-router';

export default function AuthLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  
  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/sign-in" />;
  
  return <Stack />;
}
```

---

## Security Requirements

### Environment Variables
- All secrets in `.env` (never commit)
- Only `EXPO_PUBLIC_*` vars accessible client-side
- Sensitive keys only in Convex environment variables

### Input Validation
- Validate all user input with Zod before submission
- Sanitize text inputs (trim, limit length)
- Convex validators are server-side — still validate client-side for UX

### Authentication
- Never store tokens manually — let Clerk handle it
- Check `isSignedIn` before any protected action
- Use Clerk's `getToken` for Convex authentication

### Data Security
- Row-level security in Convex queries (always filter by authenticated user)
- Never expose user IDs in URLs — use Clerk's `userId`
- Audit sensitive operations (log who did what)

```typescript
// Always scope queries to authenticated user
export const getMyData = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');
    
    return ctx.db
      .query('data')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .collect();
  },
});
```

---

## Code Style Rules

### Naming
- **Files:** kebab-case (`user-profile.tsx`)
- **Components:** PascalCase (`UserProfile`)
- **Hooks:** camelCase with `use` prefix (`useUserProfile`)
- **Constants:** SCREAMING_SNAKE_CASE (`MAX_BIO_LENGTH`)
- **Types:** PascalCase with descriptive suffix (`UserProfileProps`, `MatchStatus`)

### Component Structure

```typescript
// 1. Imports (external, then internal, then types)
// 2. Types/interfaces
// 3. Constants
// 4. Component
// 5. Styles (if not using theme directly)

import { View } from 'react-native';
import { Text } from '@/components/ui';
import { useMatches } from '@/hooks/useMatches';
import type { Match } from '@/types';

type MatchCardProps = {
  match: Match;
  onPress: () => void;
};

export function MatchCard({ match, onPress }: MatchCardProps) {
  // hooks first
  const { likeProfile } = useMatches();
  
  // derived state
  const displayName = match.name || 'Anonymous';
  
  // handlers
  const handlePress = () => {
    onPress();
  };
  
  // render
  return (
    <View>
      <Text>{displayName}</Text>
    </View>
  );
}
```

### Banned Patterns
- ❌ `any` type — use `unknown` and narrow, or proper generics
- ❌ `as` type assertions — use type guards instead
- ❌ Non-null assertions (`!`) — handle null cases explicitly
- ❌ Inline styles — use theme tokens
- ❌ Magic numbers — define in theme or constants
- ❌ `console.log` in production — use proper error tracking
- ❌ Hardcoded strings — use COPY constants
- ❌ `useEffect` for derived state — compute directly or useMemo
- ❌ Index as key in lists — use stable IDs
- ❌ Nested ternaries — extract to variables or early returns
- ❌ FlatList — use FlashList
- ❌ `Image` from react-native — use expo-image
- ❌ Fetching in useEffect — use Convex's useQuery
- ❌ `any[]` for list data — type your arrays
- ❌ Optional chaining without fallback (`data?.name` in render) — provide defaults
- ❌ Async functions in useEffect without cleanup
- ❌ Direct AsyncStorage calls — abstract behind a service

### Required Patterns
- ✅ TypeScript strict mode (see tsconfig above)
- ✅ Explicit return types on exported functions
- ✅ Error boundaries around feature sections
- ✅ Loading and error states for all async operations
- ✅ Accessibility labels on interactive elements
- ✅ `satisfies` for type checking object literals
- ✅ Discriminated unions for state machines
- ✅ Zod for runtime validation of external data
- ✅ Proper cleanup in useEffect (abort controllers, subscriptions)
- ✅ FlashList with estimatedItemSize
- ✅ expo-image with cachePolicy
- ✅ Convex indexes for all queries
- ✅ Selective Zustand subscriptions

### Type Safety Patterns

```typescript
// ✅ Discriminated union for async state
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };

// ✅ Use satisfies for type-checked objects
const ROUTES = {
  home: '/(tabs)',
  profile: '/profile/[id]',
  venue: '/venue/[id]',
} satisfies Record<string, string>;

// ✅ Type guard instead of assertion
function isVenue(data: unknown): data is Venue {
  return (
    typeof data === 'object' &&
    data !== null &&
    'name' in data &&
    'rating' in data
  );
}

// ✅ Generic hook with proper constraints
function useAsync<T>(asyncFn: () => Promise<T>): AsyncState<T> {
  // implementation
}
```

---

## File Templates

When creating new files, follow these templates:

### New Screen
```typescript
// src/app/(tabs)/discover.tsx
import { SafeAreaView } from 'react-native-safe-area-context';
import { DiscoverFeed } from '@/components/features/discover';
import { COPY } from '@/constants/copy';

export default function DiscoverScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <DiscoverFeed />
    </SafeAreaView>
  );
}
```

### New Hook
```typescript
// src/hooks/useFeatureName.ts
import { useState, useCallback } from 'react';

export function useFeatureName() {
  const [state, setState] = useState<StateType>(initialState);
  
  const action = useCallback(() => {
    // logic
  }, [dependencies]);
  
  return { state, action };
}
```

---

## Quick Reference

| Need | Import From |
|------|-------------|
| Colors, spacing, typography | `@/theme` |
| UI components | `@/components/ui` |
| User-facing text | `@/constants/copy` |
| Route names | `@/constants/routes` |
| Types | `@/types` |
| Convex API | `@/convex/_generated/api` |
| Convex types (Doc, Id) | `@/convex/_generated/dataModel` |
| App state (persisted) | `@/stores/useAppStore` |
| UI state (ephemeral) | `@/stores/useUIStore` |
| Lists | `@shopify/flash-list` |
| Images | `expo-image` |
| Local storage | `react-native-mmkv` |

---

## API Rate Limits & Loop Prevention

External services (Clerk, Convex, etc.) enforce rate limits. Code that triggers excessive API calls will cause `429 Too Many Requests` errors and degrade the user experience.

### Rules
- **Never include rapidly-changing values in `useEffect` dependency arrays** if the effect triggers navigation or API calls. For example, `segments` from `useSegments()` changes on every route change — including it as a dependency alongside `router.replace()` creates an infinite loop.
- **Auth redirect effects** should only depend on auth state (`isSignedIn`, `isLoaded`), not navigation state.
- **Debounce or gate API calls** that can fire on every render (search inputs, polling, etc.).
- **Avoid redundant provider re-renders** — initialize clients (e.g. `new ConvexReactClient()`) outside components, not inside render functions.
- **Test auth flows** by signing in/out and watching the network tab — if you see repeated identical requests, there's a loop.

### Known Pitfalls
| Pattern | Problem | Fix |
|---------|---------|-----|
| `useEffect([segments])` + `router.replace()` | Infinite redirect loop | Remove `segments` from deps, read it inside the effect |
| `useQuery()` with changing args on every render | Excessive Convex reads | Memoize args or use `'skip'` when not ready |
| OAuth/SSO flow retries on error | Clerk rate limit hit | Show error to user, don't auto-retry |

---

## Before Committing Checklist

- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] No `any` types or non-null assertions
- [ ] No hardcoded strings, colors, or spacing
- [ ] Loading and error states handled
- [ ] Tested on small screen (375pt width)
- [ ] Accessibility labels on buttons/inputs
- [ ] No `console.log` statements
- [ ] Convex queries scoped to authenticated user
- [ ] FlashList used (not FlatList) with estimatedItemSize
- [ ] expo-image used (not RN Image) with cachePolicy
- [ ] Zustand selectors used (not full store subscription)
- [ ] Memoization applied to list items and callbacks
