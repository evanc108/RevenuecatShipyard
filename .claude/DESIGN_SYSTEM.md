# DESIGN_SYSTEM.md — Recipe App Design Language

## Design Philosophy

**Personality:** Confident, warm, photography-forward, quietly delightful

This app feels like a well-designed kitchen tool — functional but beautiful, serious about food but not pretentious. The UI stays out of the way to let food imagery shine, with moments of subtle delight in transitions and interactions.

**Core principles:**
1. **Content-first** — recipes and food photography are the hero, UI is the frame
2. **Quiet confidence** — no visual shouting, no desperate engagement tactics
3. **Tactile depth** — subtle shadows and layers create a physical, touchable feel
4. **Purposeful motion** — every animation earns its place

---

## Visual Language

### Cards & Containers

Cards are the primary content vessel. They feel lifted off the surface, tactile.

```typescript
// Standard card
card: {
  background: '#FFFFFF',
  borderRadius: 16,
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 3,
}

// Elevated card (focused/featured)
cardElevated: {
  background: '#FFFFFF',
  borderRadius: 20,
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.10,
  shadowRadius: 24,
  elevation: 8,
}

// Inset/recessed container (for inputs, secondary content)
cardInset: {
  background: '#F5F5F7',
  borderRadius: 12,
  borderWidth: 0,
}
```

**Rules:**
- No borders on cards — use shadow for separation
- Border radius: 12px (small elements), 16px (cards), 20px (modals/sheets)
- Consistent 16px internal padding

### Depth & Layering

Three elevation levels create spatial hierarchy:

| Level | Use | Shadow |
|-------|-----|--------|
| Ground | Page background, recessed areas | None |
| Surface | Cards, list items | `0 2px 8px rgba(0,0,0,0.06)` |
| Elevated | Modals, bottom sheets, FABs | `0 8px 24px rgba(0,0,0,0.10)` |

### Spacing Rhythm

Use an 8px base grid. All spacing is a multiple:

```typescript
spacing: {
  xs: 4,    // Tight inline elements
  sm: 8,    // Icon-to-text, tight groups
  md: 16,   // Standard padding, gaps
  lg: 24,   // Section separation
  xl: 32,   // Major sections
  xxl: 48,  // Page-level breathing room
}
```

**Key patterns:**
- Card internal padding: 16px
- Gap between cards in a list: 12px
- Section header to content: 16px
- Screen horizontal padding: 20px (not 16 — slightly more generous)

### Color Application

Beyond the accent color (#F2545B), here's how to apply color:

```typescript
// Semantic backgrounds
backgrounds: {
  primary: '#FFFFFF',      // Main surfaces
  secondary: '#F5F5F7',    // Recessed, inputs, tags
  tertiary: '#EBEBF0',     // Disabled states, skeletons
  overlay: 'rgba(0,0,0,0.4)', // Behind modals
}

// Text hierarchy
text: {
  primary: '#1A1A1A',      // Headings, primary content
  secondary: '#6B6B6B',    // Descriptions, metadata
  tertiary: '#9A9A9A',     // Timestamps, hints
  disabled: '#C5C5C5',     // Disabled labels
}

// Subtle accents (not the primary accent)
subtle: {
  warm: '#FFF8F0',         // Recipe card backgrounds (slight warmth)
  success: '#E8F5E9',      // Saved/success states
  highlight: '#FEF3F3',    // Accent tint for selected states
}
```

**Rules:**
- Never use pure black (#000000) for text — use #1A1A1A
- Accent color for interactive elements and key actions only
- Avoid colored backgrounds except for subtle states

---

## Typography System

### Type Scale

```typescript
typography: {
  // Display — hero moments only
  display: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  
  // Headings
  h1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  h2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  h3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: 0,
  },
  
  // Body
  bodyLarge: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '400',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  bodySmall: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  
  // Utility
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
}
```

**Rules:**
- Negative letter-spacing on headings (tighter = more refined)
- Positive letter-spacing on small labels (aids readability)
- Never use all-caps except for tiny labels (12px max)
- Maximum 2 weights per screen (typically 400 + 600)

---

## Animation Principles

### Timing Philosophy

Animations should feel **quick but not rushed, smooth but not floaty**.

```typescript
// Duration scale
duration: {
  instant: 100,    // Micro-feedback (button press)
  fast: 200,       // Small transitions (icon changes, toggles)
  normal: 300,     // Standard transitions (cards, modals)
  slow: 450,       // Large reveals (page transitions, bottom sheets)
}

// Easing curves
easing: {
  // Default — snappy entrance, gentle settle
  standard: 'cubic-bezier(0.25, 0.1, 0.25, 1.0)',
  
  // Entrances — starts slow, accelerates in
  enter: 'cubic-bezier(0.0, 0.0, 0.2, 1.0)',
  
  // Exits — quick start, decelerates out
  exit: 'cubic-bezier(0.4, 0.0, 1.0, 1.0)',
  
  // Bounce — for playful moments (use sparingly)
  bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1.0)',
}
```

### Signature Interactions

These are the moments that make the app feel crafted:

**1. Card Press**
```typescript
// On press down
transform: [{ scale: 0.98 }]
duration: 100ms
easing: standard

// On release
transform: [{ scale: 1.0 }]
duration: 200ms
easing: bounce (subtle)
```

**2. List Item Stagger**
When a list loads, items animate in with stagger:
```typescript
// Each item
opacity: 0 → 1
translateY: 12 → 0
duration: 300ms
stagger: 50ms per item (max 8 items animated)
```

**3. Bottom Sheet Rise**
```typescript
// Sheet enters
translateY: screenHeight → 0
duration: 450ms
easing: enter
opacity: overlay 0 → 0.4 (duration: 300ms)

// Content within sheet
opacity: 0 → 1
delay: 150ms (after sheet starts)
```

**4. Save/Favorite Action**
```typescript
// Icon scales up with bounce
transform: [{ scale: 1.3 }]
duration: 200ms
easing: bounce

// Then settles
transform: [{ scale: 1.0 }]
duration: 150ms
```

**5. Pull-to-Refresh**
Custom refresh indicator (not system default):
- Circular progress that draws as you pull
- Icon rotates subtly during refresh
- Smooth collapse on completion

### Motion Rules

- **No motion on first render** — don't animate what's already visible
- **Stagger has limits** — max 8 items, then instant
- **Match user intent** — fast gestures = fast response
- **Exit faster than enter** — dismissals are 20% quicker
- **One focal animation** — don't animate multiple things simultaneously

---

## Component Patterns

### Recipe Cards

**Feed card (vertical list):**
```
┌─────────────────────────────────┐
│  ┌───────────────────────────┐  │
│  │                           │  │
│  │      Recipe Image         │  │
│  │      (16:10 ratio)        │  │
│  │                           │  │
│  └───────────────────────────┘  │
│                                 │
│  Recipe Title                   │
│  Secondary info · Cook time     │
│                                 │
│  [Tag] [Tag]           [Save]   │
└─────────────────────────────────┘

- Image: 16:10 ratio, borderRadius top only (12px)
- Padding: 16px
- Title: h3 weight
- Meta: bodySmall, secondary color
- Tags: pill-shaped, secondary background
- Save: icon only, 44x44 touch target
```

**Grid card (2-column):**
```
┌───────────────┐
│               │
│  Recipe Image │
│  (1:1 ratio)  │
│               │
├───────────────┤
│ Title         │
│ Cook time     │
└───────────────┘

- Smaller, denser
- 8px gap between cards
- Title: 2 lines max, ellipsis
```

### Lists

**Standard list item:**
```
┌─────────────────────────────────────────┐
│  [48x48 img]  Title text here           │
│               Secondary · Tertiary    > │
└─────────────────────────────────────────┘

- Height: 72px
- Image: 48x48, borderRadius 8
- Chevron: 16x16, tertiary color
- Separator: 1px, starts after image (indented)
```

**Separator style:**
```typescript
separator: {
  height: 1,
  backgroundColor: '#F0F0F0',
  marginLeft: 80, // Indent to align with text, not image
}
```

### Buttons

**Primary (accent):**
```typescript
{
  height: 52,
  borderRadius: 14,
  backgroundColor: '#F2545B',
  paddingHorizontal: 24,
}
// Text: white, 16px, weight 600

// Pressed state
{
  backgroundColor: '#D94148', // Darker
  transform: [{ scale: 0.98 }],
}
```

**Secondary (outline):**
```typescript
{
  height: 52,
  borderRadius: 14,
  backgroundColor: 'transparent',
  borderWidth: 1.5,
  borderColor: '#E0E0E0',
}
// Text: primary color, 16px, weight 600

// Pressed state
{
  backgroundColor: '#F5F5F7',
}
```

**Tertiary (text only):**
```typescript
{
  height: 44,
  paddingHorizontal: 16,
}
// Text: accent color, 15px, weight 600
```

### Inputs

```typescript
// Default state
{
  height: 52,
  borderRadius: 12,
  backgroundColor: '#F5F5F7',
  paddingHorizontal: 16,
  borderWidth: 0,
}

// Focused state
{
  backgroundColor: '#FFFFFF',
  borderWidth: 2,
  borderColor: '#F2545B',
}

// Error state
{
  backgroundColor: '#FEF3F3',
  borderWidth: 2,
  borderColor: '#DC2626',
}
```

**Rules:**
- No borders in default state — use background color for depth
- Clear focus indication with accent border
- 16px horizontal padding minimum
- Label above input (not floating)

### Tags/Chips

```typescript
// Default tag
{
  height: 32,
  borderRadius: 16, // Fully rounded
  backgroundColor: '#F5F5F7',
  paddingHorizontal: 14,
}
// Text: 13px, weight 500, secondary color

// Selected tag
{
  backgroundColor: '#FEF3F3',
  borderWidth: 1.5,
  borderColor: '#F2545B',
}
// Text: accent color

// Category tag (with subtle color)
{
  backgroundColor: '#FFF8F0', // Warm
}
```

### Bottom Sheets

```typescript
{
  backgroundColor: '#FFFFFF',
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: -4 },
  shadowOpacity: 0.10,
  shadowRadius: 16,
}

// Handle indicator
{
  width: 36,
  height: 4,
  borderRadius: 2,
  backgroundColor: '#E0E0E0',
  alignSelf: 'center',
  marginTop: 8,
  marginBottom: 16,
}
```

---

## Iconography

### Style Guidelines

Use a consistent icon set (recommend: Lucide, Phosphor, or custom)

**Specifications:**
- Stroke weight: 1.5px (not 2px — feels lighter)
- Size: 20x20 (standard), 24x24 (navigation), 16x16 (inline)
- Corner radius: 2px on icon internals
- Style: Outlined, not filled (except active states)

### Icon Usage Rules

**Do:**
- Use icons to reinforce meaning alongside text
- Filled variant for selected/active states
- Consistent sizing within a context
- Adequate touch target (44x44 minimum) regardless of icon size

**Avoid:**
- Icons as decoration without purpose
- Multiple icon styles in one view
- Colored icons (use single color, vary opacity)
- Icon-only buttons without labels (except universal: close, back, search)

### Banned Icons

These appear in every AI-generated app. Do not use:
- Sparkles/magic wand (AI indicator cliché)
- Generic lightbulb
- Rocket ship
- Brain icon
- Robot/bot faces
- Floating circles/dots patterns
- Gradient-filled icons

### Recommended Icon Mapping

| Action | Icon | Notes |
|--------|------|-------|
| Save/bookmark | Bookmark | Not heart (overused) |
| Favorite | Heart | Fill on active |
| Share | Share (iOS style) | Not arrow-up-from-box |
| Timer/duration | Clock | Simple, not stopwatch |
| Ingredients | List | Not shopping cart |
| Steps | Layers or ListOrdered | |
| Search | Search/magnifying glass | Standard |
| Filter | Sliders | Not funnel |
| Add | Plus | In circle for FAB |
| Settings | Gear | Not sliders |
| Profile | User circle | Not generic person |

---

## Image Treatment

### Recipe Photography

**Aspect ratios:**
- Feed cards: 16:10 (landscape, generous)
- Grid cards: 1:1 (square)
- Hero/detail: 4:3 or full-width
- Thumbnails: 1:1

**Loading states:**
```typescript
// Skeleton
{
  backgroundColor: '#F0F0F0',
  borderRadius: same as final image,
}

// Blurhash placeholder
// Generate per image, warm-toned default:
blurhash: 'LKO2?U%2Tw=w]~RBVZRi};RTxuof'
```

**Image styling:**
```typescript
{
  borderRadius: 12, // Or 16 for larger cards
  overflow: 'hidden',
}

// Never apply:
// - Borders on images
// - Drop shadows directly on images
// - Overlay gradients (except for text legibility)
```

### Text Over Images

When text must appear over images:

```typescript
// Gradient overlay (bottom only)
{
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  height: '50%',
  background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
}

// Text on overlay
{
  color: '#FFFFFF',
  fontWeight: '600',
  textShadowColor: 'rgba(0,0,0,0.3)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
}
```

---

## Anti-Patterns (AI Slop Avoidance)

### Never Do This

**Layout:**
- Centered everything with no visual hierarchy
- Equal spacing between all elements (creates monotony)
- Cards with thick borders
- Drop shadows that are too dark or too spread
- Neon or vibrant gradients on backgrounds

**Typography:**
- ALL CAPS for body text or buttons
- More than 3 font sizes on one screen
- Centered body text (left-align for readability)
- Emoji as bullet points
- "Fun" fonts for UI text

**Color:**
- Rainbow of colors without purpose
- Gradients on buttons
- Dark mode that's pure black (#000000)
- Accent color on more than 10% of the screen

**Icons/Graphics:**
- Emoji scattered as decoration
- Generic stock illustrations (the "corporate Memphis" style)
- Icons with inconsistent stroke weights
- Filled and outlined icons mixed randomly

**Animation:**
- Everything bouncing on load
- Slow, floaty transitions (>500ms)
- Animations that block interaction
- Confetti, particles, or sparkle effects

**Components:**
- Skeuomorphic elements (fake 3D buttons)
- Thick rounded rectangles everywhere
- Toggle switches with faces
- Progress bars with stripes or animations

### Quality Checklist

Before finalizing any screen:

- [ ] Can you identify the single most important element?
- [ ] Is there clear visual hierarchy (3 levels max)?
- [ ] Would this look good as a screenshot in the App Store?
- [ ] Does it feel like Beli or does it feel like a template?
- [ ] Are animations purposeful or just decorative?
- [ ] Is the icon usage restrained (max 6-8 icons visible)?
- [ ] Could you explain why every color is there?

---

## Implementation Notes

### Gluestack Customization

Override Gluestack defaults to match this system:

```typescript
// gluestack.config.ts
const config = createConfig({
  tokens: {
    colors: {
      // Override default palette
      primary500: '#F2545B',
      primary600: '#D94148',
      // etc.
    },
    radii: {
      sm: 8,
      md: 12,
      lg: 16,
      xl: 20,
    },
    space: {
      // Match our spacing scale
      1: 4,
      2: 8,
      3: 12,
      4: 16,
      5: 20,
      6: 24,
      8: 32,
      10: 40,
      12: 48,
    },
  },
});
```

### Reanimated Presets

Create reusable animation presets:

```typescript
// src/utils/animations.ts
import { withSpring, withTiming, Easing } from 'react-native-reanimated';

export const TIMING = {
  fast: { duration: 200 },
  normal: { duration: 300 },
  slow: { duration: 450 },
};

export const SPRING = {
  snappy: { damping: 20, stiffness: 300 },
  bouncy: { damping: 12, stiffness: 200 },
  gentle: { damping: 20, stiffness: 150 },
};

export const EASING = {
  standard: Easing.bezier(0.25, 0.1, 0.25, 1.0),
  enter: Easing.bezier(0.0, 0.0, 0.2, 1.0),
  exit: Easing.bezier(0.4, 0.0, 1.0, 1.0),
};
```

### Shared Element Transitions

For recipe card → detail transitions:

```typescript
// Use expo-router's shared element API
<Link href={`/recipe/${id}`} asChild>
  <Pressable>
    <Image 
      sharedTransitionTag={`recipe-image-${id}`}
      source={{ uri: imageUrl }}
    />
  </Pressable>
</Link>
```

---

## Quick Reference

### Spacing
`4 · 8 · 12 · 16 · 20 · 24 · 32 · 48`

### Radii
`8 (small) · 12 (inputs/tags) · 16 (cards) · 20 (sheets)`

### Shadows
```
Surface: 0 2px 8px rgba(0,0,0,0.06)
Elevated: 0 8px 24px rgba(0,0,0,0.10)
```

### Timing
`100ms (instant) · 200ms (fast) · 300ms (normal) · 450ms (slow)`

### Type Sizes
`12 · 13 · 15 · 17 · 18 · 22 · 28 · 34`
