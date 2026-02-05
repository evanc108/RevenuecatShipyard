import type { Id } from '@/convex/_generated/dataModel';

/**
 * Grocery list types for the shopping feature.
 */

/**
 * Category for grocery items.
 */
export type GroceryCategory =
  | 'produce'
  | 'dairy'
  | 'meat'
  | 'pantry'
  | 'spice'
  | 'frozen'
  | 'other';

/**
 * Source tracking for where a grocery item came from.
 */
export type GrocerySource = {
  recipeId: Id<'recipes'>;
  recipeName: string;
  quantity: number;
  unit: string;
  servingsMultiplier: number;
  mealPlanEntryId?: Id<'mealPlanEntries'>;
  scheduledDate?: string;
};

/**
 * A grocery item in the shopping list.
 */
export type GroceryItem = {
  _id: Id<'groceryItems'>;
  _creationTime: number;
  userId: Id<'users'>;
  name: string;
  normalizedName: string;
  category?: string;
  totalQuantity: number;
  unit: string;
  sources: GrocerySource[];
  isChecked: boolean;
  userQuantityOverride?: number;
  amazonFreshUrl?: string;
  addedAt: number;
  updatedAt: number;
};

/**
 * Enriched grocery item with computed fields.
 */
export type EnrichedGroceryItem = GroceryItem & {
  /** Quantity after pantry deduction */
  adjustedQuantity: number;
  /** Pantry quantity available (if any match) */
  pantryQuantity?: number;
  /** Pantry unit (if any match) */
  pantryUnit?: string;
  /** The quantity to display (user override or adjusted) */
  effectiveQuantity: number;
};

/**
 * Section data for SectionList display.
 */
export type GrocerySection = {
  title: string;
  category: GroceryCategory;
  data: EnrichedGroceryItem[];
};

/**
 * Result from adding recipe ingredients to grocery list.
 */
export type AddFromRecipeResult = {
  added: number;
  updated: number;
};

/**
 * Result from generating Amazon URLs.
 */
export type AmazonUrlResult = {
  itemId: string;
  url: string;
};

/**
 * Category display configuration.
 */
export const GROCERY_CATEGORY_CONFIG: Record<
  GroceryCategory,
  { label: string; icon: string; color: string }
> = {
  produce: { label: 'Produce', icon: 'leaf', color: '#E0F5E0' },
  dairy: { label: 'Dairy', icon: 'milk', color: '#DEE8FF' },
  meat: { label: 'Meat & Seafood', icon: 'drumstick', color: '#FFE0E0' },
  pantry: { label: 'Pantry Staples', icon: 'archive', color: '#FFF5D6' },
  spice: { label: 'Spices', icon: 'flame', color: '#FFE8D6' },
  frozen: { label: 'Frozen', icon: 'snowflake', color: '#D6F0FF' },
  other: { label: 'Other', icon: 'ellipsis-h', color: '#F5F5F7' },
};

/**
 * Get display label for a category.
 */
export function getCategoryLabel(category: string | undefined): string {
  if (!category) return 'Other';
  const config = GROCERY_CATEGORY_CONFIG[category as GroceryCategory];
  return config?.label ?? 'Other';
}

/**
 * Get category color for display.
 */
export function getCategoryColor(category: string | undefined): string {
  if (!category) return GROCERY_CATEGORY_CONFIG.other.color;
  const config = GROCERY_CATEGORY_CONFIG[category as GroceryCategory];
  return config?.color ?? GROCERY_CATEGORY_CONFIG.other.color;
}

/**
 * Format quantity for display (handles fractions).
 */
export function formatQuantity(quantity: number): string {
  if (Number.isInteger(quantity)) return quantity.toString();

  // Common fractions
  const fractions: Record<number, string> = {
    0.25: '\u00BC',
    0.33: '\u2153',
    0.5: '\u00BD',
    0.67: '\u2154',
    0.75: '\u00BE',
  };

  const whole = Math.floor(quantity);
  const decimal = quantity - whole;

  // Check for close matches to common fractions
  for (const [value, symbol] of Object.entries(fractions)) {
    if (Math.abs(decimal - parseFloat(value)) < 0.05) {
      return whole > 0 ? `${whole}${symbol}` : symbol;
    }
  }

  // Round to 1 decimal place for others
  return quantity.toFixed(1).replace(/\.0$/, '');
}

/**
 * Units that should not be pluralized (already plural or uncountable).
 */
const UNCOUNTABLE_UNITS = new Set([
  'oz',
  'lb',
  'lbs',
  'g',
  'kg',
  'ml',
  'l',
  'tsp',
  'tbsp',
  'fl oz',
  'pt',
  'qt',
  'gal',
  'bunch',
  'pinch',
  'dash',
  'to taste',
  'as needed',
]);

/**
 * Irregular plural forms for units.
 */
const IRREGULAR_PLURALS: Record<string, string> = {
  leaf: 'leaves',
  loaf: 'loaves',
  half: 'halves',
  knife: 'knives',
};

/**
 * Pluralize a unit based on quantity.
 */
export function pluralizeUnit(unit: string, quantity: number): string {
  // Don't pluralize if quantity is 1 or less, or if unit is empty
  if (quantity <= 1 || !unit.trim()) return unit;

  const lowerUnit = unit.toLowerCase().trim();

  // Check if already plural or uncountable
  if (UNCOUNTABLE_UNITS.has(lowerUnit)) return unit;
  if (lowerUnit.endsWith('s') && !lowerUnit.endsWith('ss')) return unit;

  // Check for irregular plurals
  if (IRREGULAR_PLURALS[lowerUnit]) {
    // Preserve original casing for first letter
    const plural = IRREGULAR_PLURALS[lowerUnit];
    return unit[0] === unit[0].toUpperCase()
      ? plural.charAt(0).toUpperCase() + plural.slice(1)
      : plural;
  }

  // Standard pluralization: add 's'
  return unit + 's';
}

/**
 * Format quantity with unit for display.
 * Shows "2x" for counts without units, "2 cups" for items with units.
 */
export function formatQuantityWithUnit(quantity: number, unit: string): string {
  const formattedQty = formatQuantity(quantity);

  // If no unit, show as count (e.g., "2x")
  if (!unit.trim()) {
    return `${formattedQty}x`;
  }

  // Otherwise show quantity + pluralized unit
  return `${formattedQty} ${pluralizeUnit(unit, quantity)}`;
}
