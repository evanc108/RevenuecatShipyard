'use node';

import { v } from 'convex/values';
import { action } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';

const THEMEALDB_BASE_URL = 'https://www.themealdb.com/api/json/v1/1';

type TheMealDBMeal = {
  idMeal: string;
  strMeal: string;
  strCategory: string;
  strArea: string;
  strInstructions: string;
  strMealThumb: string;
  strTags: string | null;
  strSource: string | null;
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

type ExtractedRecipe = {
  title: string;
  description: string;
  cuisine: string;
  difficulty: string;
  servings: number | null;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  total_time_minutes: number | null;
  calories: number | null;
  protein_grams: number | null;
  carbs_grams: number | null;
  fat_grams: number | null;
  dietary_tags: string[];
  keywords: string[];
  equipment: string[];
  creator_name: string;
  creator_profile_url: string | null;
  ingredients: Array<{
    raw_text: string;
    name: string;
    normalized_name: string;
    quantity: number;
    unit: string;
    preparation: string;
    category: string;
    optional: boolean;
    sort_order: number;
  }>;
  instructions: Array<{
    step_number: number;
    text: string;
    time_seconds: number | null;
    temperature: string | null;
    tip: string | null;
  }>;
  thumbnail_url: string | null;
};

function generateSourceId(url: string): string {
  // Simple hash function for generating source ID
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0').slice(0, 16);
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
 * Check if meal contains any excluded ingredients
 */
function containsExcludedIngredients(
  meal: TheMealDBMeal,
  excludeList: string[]
): boolean {
  if (!excludeList || excludeList.length === 0) return false;

  for (let i = 1; i <= 20; i++) {
    const key = `strIngredient${i}` as keyof TheMealDBMeal;
    const ingredient = meal[key] as string | null;
    if (ingredient && ingredient.trim()) {
      const lowerIngredient = ingredient.toLowerCase();
      if (excludeList.some((ex) => lowerIngredient.includes(ex.toLowerCase()))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Filter meals based on dietary restrictions
 */
function matchesDietaryRestrictions(
  meal: TheMealDBMeal,
  restrictions: string[]
): boolean {
  if (!restrictions || restrictions.length === 0) return true;

  const category = meal.strCategory?.toLowerCase() ?? '';

  for (const restriction of restrictions) {
    const r = restriction.toLowerCase();

    if (r === 'vegetarian') {
      const meatCategories = ['beef', 'chicken', 'lamb', 'pork', 'goat', 'seafood'];
      if (meatCategories.some((c) => category.includes(c))) {
        return false;
      }
    }

    if (r === 'vegan') {
      const nonVeganCategories = ['beef', 'chicken', 'lamb', 'pork', 'goat', 'seafood', 'dessert'];
      if (nonVeganCategories.some((c) => category.includes(c))) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Action to populate discover recipes.
 * Fetches recipes from TheMealDB, then enriches each via the Python backend.
 */
export const populateFromBackend = action({
  args: {
    count: v.optional(v.number()),
    dietaryRestrictions: v.optional(v.array(v.string())),
    excludeIngredients: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const backendUrl = process.env.RECIPE_BACKEND_URL;
    if (!backendUrl) {
      throw new Error(
        'RECIPE_BACKEND_URL is not set. Add it to your Convex environment variables.'
      );
    }

    const count = args.count ?? 10;
    const maxAttempts = count * 5;
    let attempts = 0;

    console.log(`Fetching ${count} recipes from TheMealDB...`);

    // Collect unique meals from TheMealDB
    const meals: TheMealDBMeal[] = [];
    const seenIds = new Set<string>();

    while (meals.length < count * 2 && attempts < maxAttempts) {
      attempts++;

      const meal = await fetchRandomMeal();
      if (!meal) continue;

      if (seenIds.has(meal.idMeal)) continue;
      seenIds.add(meal.idMeal);

      // Apply dietary restrictions filter
      if (
        args.dietaryRestrictions &&
        !matchesDietaryRestrictions(meal, args.dietaryRestrictions)
      ) {
        continue;
      }

      // Apply ingredient exclusion filter
      if (
        args.excludeIngredients &&
        containsExcludedIngredients(meal, args.excludeIngredients)
      ) {
        continue;
      }

      meals.push(meal);
    }

    console.log(`Fetched ${meals.length} recipes from TheMealDB after ${attempts} calls`);

    // Enrich each recipe via the Python backend
    // Track both stored IDs and how many are actually NEW (not updates)
    const storedIds: Id<'discoverRecipes'>[] = [];
    let newlyInserted = 0;
    let skippedExisting = 0;

    for (const meal of meals) {
      if (storedIds.length >= count) break;

      const sourceUrl = meal.strSource ?? `https://www.themealdb.com/meal/${meal.idMeal}`;
      const sourceId = generateSourceId(sourceUrl);

      // SAFETY: Check if recipe already exists BEFORE calling OpenAI
      // This prevents wasting tokens on recipes we already have
      const alreadyExists = await ctx.runQuery(
        internal.discoverFeed.checkRecipeExists,
        { sourceId }
      );

      if (alreadyExists) {
        console.log(`Skipping ${meal.strMeal} - already exists in database`);
        skippedExisting++;
        continue;
      }

      try {
        console.log(`Enriching recipe: ${meal.strMeal}`);

        // Call Python backend to extract/enrich the recipe
        const extractResponse = await fetch(`${backendUrl}/api/v1/extract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: sourceUrl }),
        });

        if (!extractResponse.ok) {
          console.log(
            `Failed to extract ${sourceUrl}: ${extractResponse.status}`
          );
          continue;
        }

        const extractData = await extractResponse.json();

        if (!extractData.success || !extractData.recipe) {
          console.log(`No recipe extracted from ${sourceUrl}`);
          continue;
        }

        const recipe: ExtractedRecipe = extractData.recipe;

        // Store in Convex
        const result = await ctx.runMutation(internal.discoverFeed.storeRecipe, {
          recipe: {
            sourceId: sourceId,
            sourceUrl: sourceUrl,
            title: recipe.title,
            description: recipe.description || undefined,
            cuisine: recipe.cuisine || meal.strArea || undefined,
            difficulty: recipe.difficulty || undefined,
            imageUrl: recipe.thumbnail_url || meal.strMealThumb || undefined,
            servings: recipe.servings || undefined,
            prepTimeMinutes: recipe.prep_time_minutes || undefined,
            cookTimeMinutes: recipe.cook_time_minutes || undefined,
            totalTimeMinutes: recipe.total_time_minutes || undefined,
            calories: recipe.calories || undefined,
            proteinGrams: recipe.protein_grams || undefined,
            carbsGrams: recipe.carbs_grams || undefined,
            fatGrams: recipe.fat_grams || undefined,
            dietaryTags: recipe.dietary_tags || undefined,
            keywords: recipe.keywords || [meal.strCategory].filter(Boolean),
            equipment: recipe.equipment || undefined,
            creatorName: recipe.creator_name || 'TheMealDB',
            creatorProfileUrl: recipe.creator_profile_url || undefined,
            ingredients: recipe.ingredients.map((ing) => ({
              rawText: ing.raw_text,
              name: ing.name,
              normalizedName: ing.normalized_name,
              quantity: ing.quantity,
              unit: ing.unit,
              preparation: ing.preparation || undefined,
              category: ing.category || undefined,
              optional: ing.optional,
              sortOrder: ing.sort_order,
            })),
            instructions: recipe.instructions.map((inst) => ({
              stepNumber: inst.step_number,
              text: inst.text,
              timeSeconds: inst.time_seconds || undefined,
              temperature: inst.temperature || undefined,
              tip: inst.tip || undefined,
            })),
          },
        });

        storedIds.push(result.id);
        if (result.isNew) {
          newlyInserted++;
        }
        console.log(`Stored recipe: ${recipe.title} (new: ${result.isNew})`);
      } catch (error) {
        console.error(`Error processing recipe ${meal.strMeal}:`, error);
        continue;
      }
    }

    console.log(
      `Population complete: ${newlyInserted} new, ${storedIds.length - newlyInserted} updated, ${skippedExisting} skipped`
    );

    return {
      success: true,
      stored: storedIds.length,
      newlyInserted, // Only count actual NEW recipes for loop prevention
      skippedExisting,
      message: `Successfully stored ${newlyInserted} new recipes (${skippedExisting} already existed)`,
    };
  },
});
