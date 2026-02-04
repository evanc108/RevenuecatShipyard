# UI_STANDARDS.md — Nom App UI Design Standards

> Inspired by the warmth of **Hinge**, the clean ranking UI of **Beli**, and modern iOS design principles.
> Complements DESIGN_SYSTEM.md with app-specific patterns, screen compositions, and design inspiration.

---

## Design Inspiration & References

### From Hinge

Hinge defines its brand with four adjectives: **Warm, Sophisticated, Trustworthy, Aspirational**. Nom borrows this tone.

- **90/10 color rule** — 90% of any screen is neutral (white/grey/black). Accent color occupies no more than 10% of a given space. Color is punctuation, not a paragraph.
- **Content-first cards** — The content (photos, prompts) IS the interface. Cards aren't containers holding content; the content fills the card edge-to-edge.
- **Human illustrations** — Hinge describes their illustration style as "Human, Distinctive & Imperfect." Natural strokes and texture fills over clinical vector art. Our onboarding illustrations should feel handcrafted.
- **Restrained palette** — Hinge uses `#1A1A1A` and `#FFFEFD` as primary, with muted nature-inspired secondary colors. Nom follows the same restraint: our accent `#F2545B` appears only on interactive elements.
- **Typography with personality** — Bold, modern wordmarks that feel sophisticated yet friendly. Left-aligned headlines. CTAs generally grounded center.

Reference: [Hinge Brand Guidelines](https://hinge-preview.vercel.app/brand)

### From Beli

Beli is a restaurant ranking app that makes categorization fun and social. Nom borrows its organizational patterns.

- **Clean ranked lists** — Every item feels organized and comparable. Rankings aren't just star ratings; they're relative comparisons that create hierarchy.
- **Social feed** — Shows friends' activity without overwhelming. Lead with the person, then the action, then the content.
- **Gamified engagement** — Streak counters, leaderboards, and stats that feel earned. Beli's city-specific leaderboards and dual scoring make ranking addictive.
- **Map-based discovery** — Pin clusters and geographic filtering as a first-class navigation pattern.
- **Stat displays** — Numbers are large and bold, labels are small and secondary. Stats feel like achievements.

### From iOS Clean Design

Inspired by clean vegetarian/food app aesthetics on iOS:

- **Generous whitespace** — Content breathes. Don't fill every pixel.
- **Left-aligned headlines** with large, confident type (36px display, 28px h1)
- **Minimal chrome** — No unnecessary borders, dividers, or decoration. Shadows do the work.
- **System-native feel** — Smooth transitions, haptic feedback, safe area respect
- **Bottom-aligned actions** for one-handed use on large phones

### From 2025-2026 Mobile Trends

- **Purposeful micro-interactions** — Every animation has a functional reason (feedback, transition, reveal). Not decorative.
- **Adaptive card layouts** — Flexible grids and modular components that handle varying content sizes gracefully.
- **Gesture-based navigation** — Swipes, pulls, and touches that feel natural. Bottom navigation within thumb reach.
- **Custom illustrations over stock** — Hand-drawn, warm illustrations that add personality (Dropbox, Duolingo approach).
- **Animated gradients** — Soft, multi-color gradients on cards create depth without overwhelming.

---

## Screen Composition Standards

### Standard Tab Screen

Every tab screen follows this vertical stack:

```
┌─────────────────────────────────────┐
│  SafeAreaView edges={['top']}       │
│                                     │
│  ┌─ Header ──────────────────────┐  │
│  │  [Icon 32px] Title     [Act.] │  │  ← 24px horizontal padding
│  │                               │  │     minHeight 52px
│  └───────────────────────────────┘  │
│                                     │
│  ┌─ Filter/Sort Bar (optional) ──┐  │
│  │  [Pill] [Pill] [Pill] [Pill]  │  │  ← 24px h-padding, 8px gap
│  └───────────────────────────────┘  │     fixed 32px height pills
│                                     │
│  ┌─ Content ─────────────────────┐  │
│  │  FlashList / ScrollView       │  │  ← content padding 20px
│  │                               │  │
│  └───────────────────────────────┘  │
│                                     │
│  [Tab Bar]                          │
└─────────────────────────────────────┘
```

**Rules:**
- Header padding: `top: 16, bottom: 24, horizontal: 24`
- Title icon: outlined style, 24-32px, primary color, 8px gap to text
- Action buttons (search, settings): absolute-positioned right
- No horizontal scroll in headers

### Onboarding Screen

```
┌─────────────────────────────────────┐
│                                     │
│  [← Back]                           │  ← chevron 28px, optional
│                                     │
│  Headline Text                      │  ← 36px, weight 400, left-aligned
│  (multi-line OK)                    │     -0.5 letter-spacing, 50px line
│  Optional subhead                   │  ← body, secondary color
│                                     │
│    ┌───────────────────────────┐    │
│    │                           │    │
│    │    [3D Illustration]      │    │  ← 280-360px square, centered
│    │                           │    │
│    └───────────────────────────┘    │
│                                     │
│  [Form / Selection content]         │  ← varies per screen
│                                     │
│                                     │
│  1/7               ┌──────────────┐ │
│                    │   Next >     │ │  ← PageTurnButton, black corner
│                    └──────────────┘ │
└─────────────────────────────────────┘
```

**Onboarding animation sequence:**
1. Headline: `FadeInDown.delay(0).duration(400)`
2. Illustration: `FadeInDown.delay(100).duration(400)`
3. Bottom bar: `FadeInUp.delay(200).duration(400)`
4. Selection cards: stagger 50ms per card

**PageTurnButton specs:**
- Width: 170px, positioned bottom-right
- Background: `#1A1A1A` (dark, NOT accent)
- `borderTopLeftRadius: 24` — asymmetric corner mimics cookbook page fold
- All other corners: 0
- Text: 17px, weight 600, 0.3 letter-spacing, white
- Press feedback: opacity 0.7 → 1.0
- Disabled: `Colors.text.disabled` background

**PageIndicator specs:**
- Current page: 28px, weight 800, -0.5 letter-spacing
- Total: 16px, weight 500, tertiary color
- Format: "3/7"

### Modal / Bottom Sheet Screen

```
┌─────────────────────────────────────┐
│                                     │
│  ████████████████████████████████   │  ← overlay fades in (not slide)
│  ████████████████████████████████   │
│  ████████████████████████████████   │
│  ┌─────────────────────────────┐    │
│  │          ─── handle ───     │    │  ← 36x4px handle bar
│  │                             │    │
│  │  Title              [Close] │    │  ← h2 + close icon
│  │                             │    │
│  │  ┌─ ScrollView ──────────┐ │    │
│  │  │  [Form content]       │ │    │  ← 24px h-padding
│  │  │                       │ │    │
│  │  └───────────────────────┘ │    │
│  │                             │    │
│  │  [ Primary Button         ] │    │  ← accent bg, bottom padding
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

**Rules:**
- Backdrop: `animationType="fade"` on Modal (NEVER slide)
- Content sheet: `Animated.spring` translateY 400→0 (tension 65, friction 11)
- Content slides independently of backdrop
- Max height: 80%
- Auto-focus first input after 250ms delay
- Handle: centered, 8px top margin
- Submit button padding-bottom: `Math.max(safeArea.bottom, 16px)`

---

## Cookbook Tab Specific Patterns

### Card Grid

```typescript
// FlashList config for cookbook grid
key={`${sortMode}-${hasSearchFilter}`}  // Remount on sort/filter change
numColumns={2}
contentContainerStyle={{
  paddingHorizontal: 20,  // lg - xs
  paddingTop: 4,
  paddingBottom: 48,
}}

// Grid item wrapper
gridItem: {
  flex: 1,
  padding: 4,      // xs
  minHeight: 10,   // FlashList v2 safety
}
```

### Cookbook Card (in grid)

Full-bleed image or gradient. The image IS the card.

```
┌───────────────────┐
│ 🍴 3              │  ← recipe badge: icon 18px + count 16px/700
│                   │     position: 12px from top-left edges
│  [Cover Image     │
│   or Gradient]    │
│                   │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  ← gradient: transparent → 0.1 → 0.6 black
│ Cookbook Name      │  ← 16px/700 white, text shadow
│ Description       │  ← 12px, 80% white, text shadow
└───────────────────┘

- Aspect ratio: 1.2
- Border radius: xl (20px)
- overflow: hidden
- Memoized component (memo HOC)
- No-image fallback: hash-based gradient from 8 preset pairs
```

### Create Card (ghost CTA)

```
┌───────────────────┐
│                 + │  ← 30px accent plus, top-right, text shadow
│                   │
│   [Illustration   │  ← centered cookbook icon (92% w, 78% h)
│    + SVG stroke]  │  ← organic blob shapes behind (#EEEEF3)
│                   │
│ ░░░░░░░░░░░░░░░░░ │  ← white gradient fade (80% height)
│ Add               │  ← 18px/700, primary text, bottom-left
│ Cookbook           │     with text shadow
└───────────────────┘

- Outer/inner pattern for shadow + clip
- Outer: shadow elevation 6, white bg, rounded xl
- Inner: overflow hidden, flex 1
- Static style on Pressable (no style callbacks in FlashList)
```

### Sort Pills

```typescript
// Container
sortBar: {
  flexDirection: 'row',
  paddingHorizontal: 24,
  gap: 8,
  marginBottom: 8,
}

// Each pill
sortPill: {
  flex: 1,
  height: 32,           // Fixed — prevents layout shift
  borderRadius: 9999,   // Fully rounded
  backgroundColor: '#FFFFFF',
  justifyContent: 'center',
  alignItems: 'center',
  // Surface shadow (no border)
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 6,
  elevation: 3,
}

// Active pill — swap background only
sortPillActive: {
  backgroundColor: '#FEE8E9',  // accentLight
}
// Text: accent color, weight 600
```

**Critical rules:**
- NO borders on pills — shadow only
- Fixed 32px height prevents card shift on sort change
- Active state changes background color only, not size
- Use `key={sortMode}` or similar on FlashList to force clean re-layout

### Search Bar (Animated)

```typescript
// Collapsed: circular icon button
{
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: '#FFFFFF',
  shadowOpacity: 0.08,
  shadowRadius: 6,
}

// Expanded: animates to 45% of available width
searchMaxWidth = (screenWidth - 48) * 0.45

// Animation: useSharedValue + withTiming(250ms)
// Input opacity: interpolate from 0.3-0.7 progress → 0-1
// Position: absolute right in header
```

---

## Social & Profile Patterns

### Profile Stats Row

```typescript
// Horizontal layout with dividers
{
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 24,
  paddingVertical: 4,
  paddingHorizontal: 16,
}

// Each stat: center-aligned
// Count: h3 (18px/600)
// Label: bodySmall (13px), secondary color

// Divider between stats
{
  width: 1,
  height: 32,
  backgroundColor: '#E5E7EB',
}
```

### User List Item

```typescript
{
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 10,
  paddingHorizontal: 24,
  gap: 16,
}
// Avatar: md (48px), circular
// Name: 15px, weight 600
// Subtitle: 13px, secondary, 2px top margin
// Optional: FollowButton on right side
```

### Follow Button

Two states, compact sizing:

```typescript
// Not following (CTA state)
{
  minWidth: 88,
  height: 32,
  borderRadius: 8,
  backgroundColor: '#F2545B',
  paddingHorizontal: 16,
}
// Text: 13px/600, white

// Following (muted state)
{
  backgroundColor: 'transparent',
  borderWidth: 1,
  borderColor: '#E5E7EB',
}
// Text: 13px/600, secondary color

// Loading: ActivityIndicator replaces text
```

---

## Selection Patterns (Onboarding)

### Goal Cards

Tappable cards with emoji + text + checkmark. Used for multi-select.

```typescript
// Default
{
  flexDirection: 'row',
  padding: 16,
  borderRadius: 16,
  borderWidth: 2,
  borderColor: 'transparent',
  backgroundColor: '#F5F5F7',
  gap: 12,
}
// Emoji: 28px | Title + description: flex 1 | Checkmark: 24px

// Selected
{
  backgroundColor: '#FEE8E9',
  borderColor: '#F2545B',
}
// Checkmark appears in accent color

// Press animation: scale withSpring(0.98)
// Stagger entrance: 50ms delay per card
```

### Dietary Chips

Pill-shaped toggles for dietary preferences:

```typescript
// Default chip
{
  height: 36,
  borderRadius: 9999,
  backgroundColor: '#F5F5F7',
  paddingHorizontal: 14,
}
// Text: 14px/500, secondary color

// Selected chip
{
  backgroundColor: '#FEE8E9',
  borderWidth: 1.5,
  borderColor: '#F2545B',
}
// Text: accent color

// Layout: flex row, wrap, 8px gap
```

### Removable Chips (Dislikes)

```typescript
{
  height: 36,
  borderRadius: 9999,
  backgroundColor: '#FEE8E9',
  borderWidth: 1.5,
  borderColor: '#F2545B',
  paddingLeft: 14,
  paddingRight: 10,
  gap: 6,
}
// Label: 14px/500, accent color
// Close icon: 16px, accent color
```

---

## Auth Screen Patterns

### Sign Up / Sign In

```
┌─────────────────────────────────────┐
│                                     │
│  Create your                        │  ← 36px display, left-aligned
│  account                            │
│                                     │
│    ┌───────────────────────────┐    │
│    │    [Illustration]         │    │
│    └───────────────────────────┘    │
│                                     │
│    ┌───────────────────────────┐    │
│    │ 🍎 Continue with Apple    │    │  ← DARK bg (#1A1A1A), white text
│    └───────────────────────────┘    │
│    ┌───────────────────────────┐    │
│    │ G  Continue with Google   │    │  ← DARK bg (#1A1A1A), white text
│    └───────────────────────────┘    │
│                                     │
│    Already have an account? Sign in │  ← body text + accent link
│                                     │
│  3/7               ┌──────────────┐ │
│                    │    Next >    │ │
│                    └──────────────┘ │
└─────────────────────────────────────┘
```

**Auth button specs:**
- Height: 52px
- Background: `#1A1A1A` (dark, NOT accent — distinguishes from primary actions)
- Border radius: md (12px)
- Icon + text layout, white color
- Gap: 12px between icon and label

---

## Accessibility Standards

### Touch Targets

- Minimum: 44x44pt for all interactive elements
- `hitSlop={8-12}` on compact icon buttons (close, back)
- Sort pills: full flex width ensures adequate target

### Labels

```typescript
// Every Pressable
accessibilityRole="button"
accessibilityLabel="Descriptive action text"

// State-aware
accessibilityState={{ disabled: boolean, selected: boolean }}

// Inputs
accessibilityLabel={placeholderText}
```

### Text Handling

- `numberOfLines` with `ellipsizeMode="tail"` for truncated content
- Minimum text size: 12px (caption)
- Sufficient contrast: primary text (#1A1A1A) on white meets WCAG AAA

---

## Performance Rules

### Images
- Always `expo-image` with `cachePolicy="memory-disk"`
- Never `react-native` Image component
- Transition: 200-300ms

### Lists
- Always FlashList, never FlatList
- FlashList v2: no `estimatedItemSize` prop (removed in v2)
- Static styles on Pressable items (no style callbacks)
- `key` prop changes on sort/filter state to force clean remount
- Memoize card components with `memo()`

### Animations
- `useNativeDriver: true` on all Animated API animations
- `react-native-reanimated` for gesture-driven and shared-value animations
- Never animate layout properties (width, height) on the JS thread

---

## File Organization

| Need | Location |
|------|----------|
| Theme tokens | `constants/theme.ts` |
| Shared UI components | `components/ui/` |
| Feature components | `components/features/` or `components/onboarding/` |
| Screen files | `app/(tabs)/`, `app/(onboarding)/` |
| Convex backend | `convex/` |
| Hooks | `hooks/` |
| User-facing strings | Constants at top of screen file (COPY object) |

### Component File Structure

```typescript
// 1. Imports (external → internal → types)
// 2. Types
// 3. Constants (COPY, config values)
// 4. Component (named export, not default — except screens)
// 5. Styles (StyleSheet.create at bottom)
```

---

## Quality Checklist

Before finalizing any screen, verify:

- [ ] Single most important element is immediately obvious
- [ ] Clear visual hierarchy (3 levels max)
- [ ] Would look good as an App Store screenshot
- [ ] Feels like Beli/Hinge, not a generic template
- [ ] Animations are purposeful, not decorative
- [ ] Icon usage is restrained (max 6-8 visible)
- [ ] Every color has a reason
- [ ] Accent under 10% of screen area
- [ ] All interactive elements meet 44x44 touch target
- [ ] Works on iPhone SE (375pt width)
- [ ] Body text is left-aligned
- [ ] No borders on cards (shadows only)
- [ ] No style callbacks on Pressables inside FlashList
- [ ] expo-image with cachePolicy on all images
- [ ] FlashList with proper key for sort/filter changes
