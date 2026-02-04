'use node';

import { action } from './_generated/server';
import { v } from 'convex/values';

const THEMEALDB_BASE_URL = 'https://www.themealdb.com/api/json/v1/1';

type TheMealDBMeal = {
  idMeal: string;
  strMeal: string;
  strDrinkAlternate: string | null;
  strCategory: string;
  strArea: string;
  strInstructions: string;
  strMealThumb: string;
  strTags: string | null;
  strYoutube: string | null;
  strSource: string | null;
  strImageSource: string | null;
  strCreativeCommonsConfirmed: string | null;
  dateModified: string | null;
  // Ingredients 1-20
  strIngredient1: string | null;
  strIngredient2: string | null;
  strIngredient3: string | null;
  strIngredient4: string | null;
  strIngredient5: string | null;
  strIngredient6: string | null;
  strIngredient7: string | null;
  strIngredient8: string | null;
  strIngredient9: string | null;
  strIngredient10: string | null;
  strIngredient11: string | null;
  strIngredient12: string | null;
  strIngredient13: string | null;
  strIngredient14: string | null;
  strIngredient15: string | null;
  strIngredient16: string | null;
  strIngredient17: string | null;
  strIngredient18: string | null;
  strIngredient19: string | null;
  strIngredient20: string | null;
  // Measures 1-20
  strMeasure1: string | null;
  strMeasure2: string | null;
  strMeasure3: string | null;
  strMeasure4: string | null;
  strMeasure5: string | null;
  strMeasure6: string | null;
  strMeasure7: string | null;
  strMeasure8: string | null;
  strMeasure9: string | null;
  strMeasure10: string | null;
  strMeasure11: string | null;
  strMeasure12: string | null;
  strMeasure13: string | null;
  strMeasure14: string | null;
  strMeasure15: string | null;
  strMeasure16: string | null;
  strMeasure17: string | null;
  strMeasure18: string | null;
  strMeasure19: string | null;
  strMeasure20: string | null;
};

/**
 * Ingredient type matching the recipes schema
 */
type Ingredient = {
  rawText: string;
  name: string;
  normalizedName: string;
  quantity: number;
  unit: string;
  preparation?: string;
  category?: string;
  optional?: boolean;
  sortOrder?: number;
};

/**
 * Instruction type matching the recipes schema
 */
type Instruction = {
  stepNumber: number;
  text: string;
  timeSeconds?: number;
  temperature?: string;
  tip?: string;
};

/**
 * TransformedRecipe matches the recipes table schema
 */
type TransformedRecipe = {
  // Canonical URL for deduplication
  url: string;

  // Core identification
  title: string;
  description?: string;
  cuisine?: string;
  difficulty?: string;
  imageUrl?: string;

  // Servings and timing
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  totalTimeMinutes?: number;

  // Nutrition (not available from TheMealDB)
  calories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;

  // Tags and metadata
  dietaryTags?: string[];
  keywords?: string[];
  equipment?: string[];

  // Creator information
  creatorName?: string;
  creatorProfileUrl?: string;

  // Recipe content
  ingredients: Ingredient[];
  instructions: Instruction[];

  // For display purposes (not stored in DB)
  mealDbId: string;
};

/**
 * Extract ingredients from TheMealDB's strIngredient1-20 and strMeasure1-20 fields
 */
function extractIngredients(meal: TheMealDBMeal): Ingredient[] {
  const ingredients: Ingredient[] = [];

  for (let i = 1; i <= 20; i++) {
    const ingredientKey = `strIngredient${i}` as keyof TheMealDBMeal;
    const measureKey = `strMeasure${i}` as keyof TheMealDBMeal;

    const ingredientName = meal[ingredientKey] as string | null;
    const measure = meal[measureKey] as string | null;

    // Stop when we hit empty ingredients
    if (!ingredientName || ingredientName.trim() === '') {
      break;
    }

    const trimmedName = ingredientName.trim();
    const trimmedMeasure = measure?.trim() ?? '';

    // Parse quantity and unit from measure string
    const { quantity, unit } = parseMeasure(trimmedMeasure);

    ingredients.push({
      rawText: trimmedMeasure ? `${trimmedMeasure} ${trimmedName}` : trimmedName,
      name: trimmedName,
      normalizedName: trimmedName.toLowerCase(),
      quantity,
      unit,
      sortOrder: i - 1,
    });
  }

  return ingredients;
}

/**
 * Parse a measure string like "1 cup" or "2 tbsp" into quantity and unit
 */
function parseMeasure(measure: string): { quantity: number; unit: string } {
  if (!measure || measure.trim() === '') {
    return { quantity: 1, unit: '' };
  }

  // Match patterns like "1 cup", "1/2 tsp", "2.5 oz"
  const match = measure.match(/^([\d./]+)?\s*(.*)$/);

  if (match) {
    const quantityStr = match[1] ?? '1';
    const unit = match[2]?.trim() ?? '';

    // Handle fractions like "1/2"
    let quantity = 1;
    if (quantityStr.includes('/')) {
      const [num, denom] = quantityStr.split('/');
      quantity = parseFloat(num ?? '1') / parseFloat(denom ?? '1');
    } else {
      quantity = parseFloat(quantityStr) || 1;
    }

    return { quantity, unit };
  }

  return { quantity: 1, unit: measure };
}

/**
 * Parse instructions from a single string into structured steps
 */
function parseInstructions(instructionText: string): Instruction[] {
  if (!instructionText || instructionText.trim() === '') {
    return [];
  }

  // Split by common delimiters: numbered steps, newlines, or periods followed by capital letters
  const steps = instructionText
    .split(/(?:\r?\n)+|(?:\d+\.\s+)|(?:STEP\s+\d+:?\s*)/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 10); // Filter out very short fragments

  // If no good splits, try splitting on sentences
  if (steps.length <= 1) {
    const sentenceSteps = instructionText
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);

    if (sentenceSteps.length > 1) {
      return sentenceSteps.map((text, index) => ({
        stepNumber: index + 1,
        text,
      }));
    }
  }

  return steps.map((text, index) => ({
    stepNumber: index + 1,
    text,
  }));
}

/**
 * Estimate difficulty based on number of ingredients and instruction length
 */
function estimateDifficulty(meal: TheMealDBMeal): string {
  const ingredientCount = extractIngredients(meal).length;
  const instructionLength = meal.strInstructions?.length ?? 0;

  if (ingredientCount <= 5 && instructionLength < 500) return 'Easy';
  if (ingredientCount <= 10 && instructionLength < 1000) return 'Medium';
  return 'Hard';
}

/**
 * Transform TheMealDB meal to match the recipes table schema
 */
function transformRecipe(meal: TheMealDBMeal): TransformedRecipe {
  const ingredients = extractIngredients(meal);
  const instructions = parseInstructions(meal.strInstructions);

  // Parse tags from comma-separated string
  const tags = meal.strTags?.split(',').map((t) => t.trim()).filter(Boolean) ?? [];

  // Generate canonical URL
  const url = meal.strSource ?? `https://www.themealdb.com/meal/${meal.idMeal}`;

  return {
    url,
    mealDbId: meal.idMeal,
    title: meal.strMeal,
    description: `A delicious ${meal.strCategory} dish from ${meal.strArea} cuisine.`,
    cuisine: meal.strArea || 'International',
    difficulty: estimateDifficulty(meal),
    imageUrl: meal.strMealThumb,

    // TheMealDB doesn't provide timing or nutrition info
    servings: undefined,
    prepTimeMinutes: undefined,
    cookTimeMinutes: undefined,
    totalTimeMinutes: undefined,
    calories: undefined,
    proteinGrams: undefined,
    carbsGrams: undefined,
    fatGrams: undefined,

    dietaryTags: tags.length > 0 ? tags : undefined,
    keywords: [meal.strCategory].filter(Boolean),

    creatorName: 'TheMealDB',

    ingredients,
    instructions,
  };
}

/**
 * Fetch a single random meal from TheMealDB
 */
async function fetchRandomMeal(): Promise<TheMealDBMeal | null> {
  const url = `${THEMEALDB_BASE_URL}/random.php`;
  const response = await fetch(url);

  if (!response.ok) {
    console.error('TheMealDB API error:', response.status);
    return null;
  }

  const data = await response.json();
  const meals: TheMealDBMeal[] = data.meals ?? [];
  return meals[0] ?? null;
}

/**
 * Filter meals based on dietary restrictions
 * Note: TheMealDB doesn't have built-in dietary filtering, so we filter by category
 */
function matchesDietaryRestrictions(
  meal: TheMealDBMeal,
  restrictions: string[]
): boolean {
  if (!restrictions || restrictions.length === 0) return true;

  const category = meal.strCategory?.toLowerCase() ?? '';
  const tags = meal.strTags?.toLowerCase() ?? '';

  for (const restriction of restrictions) {
    const r = restriction.toLowerCase();

    // Check for vegetarian - exclude meat categories
    if (r === 'vegetarian') {
      const meatCategories = ['beef', 'chicken', 'lamb', 'pork', 'goat', 'seafood'];
      if (meatCategories.some((c) => category.includes(c))) {
        return false;
      }
    }

    // Check for vegan - exclude meat and dairy
    if (r === 'vegan') {
      const nonVeganCategories = ['beef', 'chicken', 'lamb', 'pork', 'goat', 'seafood', 'dessert'];
      if (nonVeganCategories.some((c) => category.includes(c))) {
        return false;
      }
    }

    // Check tags for other restrictions
    if (tags.includes(r)) {
      continue;
    }
  }

  return true;
}

/**
 * Check if meal contains any disliked ingredients
 */
function containsDislikedIngredients(
  meal: TheMealDBMeal,
  dislikes: string[]
): boolean {
  if (!dislikes || dislikes.length === 0) return false;

  const ingredients: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const key = `strIngredient${i}` as keyof TheMealDBMeal;
    const ingredient = meal[key] as string | null;
    if (ingredient && ingredient.trim()) {
      ingredients.push(ingredient.toLowerCase());
    }
  }

  return dislikes.some((dislike) =>
    ingredients.some((ing) => ing.includes(dislike.toLowerCase()))
  );
}

export const getRandomRecipes = action({
  args: {
    count: v.optional(v.number()),
    dietaryRestrictions: v.optional(v.array(v.string())),
    ingredientDislikes: v.optional(v.array(v.string())),
  },
  handler: async (_ctx, args): Promise<TransformedRecipe[]> => {
    const count = args.count ?? 10;
    const recipes: TransformedRecipe[] = [];
    const seenIds = new Set<string>();
    const maxAttempts = count * 5; // Limit API calls to prevent infinite loops
    let attempts = 0;

    console.log(`Fetching ${count} random recipes from TheMealDB...`);

    while (recipes.length < count && attempts < maxAttempts) {
      attempts++;

      const meal = await fetchRandomMeal();
      if (!meal) continue;

      // Skip duplicates
      if (seenIds.has(meal.idMeal)) continue;
      seenIds.add(meal.idMeal);

      // Apply dietary restrictions filter
      if (
        args.dietaryRestrictions &&
        !matchesDietaryRestrictions(meal, args.dietaryRestrictions)
      ) {
        continue;
      }

      // Apply ingredient dislikes filter
      if (
        args.ingredientDislikes &&
        containsDislikedIngredients(meal, args.ingredientDislikes)
      ) {
        continue;
      }

      recipes.push(transformRecipe(meal));
    }

    console.log(
      `Fetched ${recipes.length} recipes after ${attempts} API calls`
    );

    return recipes;
  },
});
