import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { ingredientSchema, instructionSchema } from './schema';

/**
 * Save a recipe from the discover feed.
 * Creates a recipe in the shared recipes table (if not exists) and links it to the user.
 */
export const saveRecipe = mutation({
  args: {
    // Canonical URL for deduplication
    url: v.string(),

    // Core identification
    title: v.string(),
    description: v.optional(v.string()),
    cuisine: v.optional(v.string()),
    difficulty: v.optional(v.string()),
    imageUrl: v.optional(v.string()),

    // Servings and timing
    servings: v.optional(v.number()),
    prepTimeMinutes: v.optional(v.number()),
    cookTimeMinutes: v.optional(v.number()),
    totalTimeMinutes: v.optional(v.number()),

    // Nutrition
    calories: v.optional(v.number()),
    proteinGrams: v.optional(v.number()),
    carbsGrams: v.optional(v.number()),
    fatGrams: v.optional(v.number()),

    // Tags and metadata
    dietaryTags: v.optional(v.array(v.string())),
    keywords: v.optional(v.array(v.string())),

    // Creator information
    creatorName: v.optional(v.string()),

    // Recipe content
    ingredients: v.array(ingredientSchema),
    instructions: v.array(instructionSchema),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) throw new Error('User not found');

    // Check if recipe already exists by URL
    let recipe = await ctx.db
      .query('recipes')
      .withIndex('by_url', (q) => q.eq('url', args.url))
      .unique();

    // If recipe doesn't exist, create it
    if (!recipe) {
      const recipeId = await ctx.db.insert('recipes', {
        url: args.url,
        createdAt: Date.now(),

        title: args.title,
        description: args.description,
        cuisine: args.cuisine,
        difficulty: args.difficulty,
        imageUrl: args.imageUrl,

        servings: args.servings,
        prepTimeMinutes: args.prepTimeMinutes,
        cookTimeMinutes: args.cookTimeMinutes,
        totalTimeMinutes: args.totalTimeMinutes,

        calories: args.calories,
        proteinGrams: args.proteinGrams,
        carbsGrams: args.carbsGrams,
        fatGrams: args.fatGrams,

        dietaryTags: args.dietaryTags,
        keywords: args.keywords,

        creatorName: args.creatorName,

        ingredients: args.ingredients,
        instructions: args.instructions,

        // Mark as discovered from TheMealDB
        methodUsed: 'website',

        // Initialize rating stats
        ratingCount: 0,
        ratingSum: 0,
      });

      recipe = await ctx.db.get(recipeId);
      if (!recipe) throw new Error('Failed to create recipe');
    }

    // Check if user has already saved this recipe
    const existingSave = await ctx.db
      .query('userSavedRecipes')
      .withIndex('by_user_recipe', (q) =>
        q.eq('userId', user._id).eq('recipeId', recipe._id)
      )
      .unique();

    if (existingSave) {
      // Already saved, return existing recipe ID
      return recipe._id;
    }

    // Create the user-recipe relationship
    await ctx.db.insert('userSavedRecipes', {
      userId: user._id,
      recipeId: recipe._id,
      savedAt: Date.now(),
    });

    return recipe._id;
  },
});

/**
 * List all recipes saved by the current user.
 * Returns full recipe data with save metadata.
 */
export const listSavedRecipes = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) return [];

    // Get all saved recipe relationships for this user
    const savedRecipes = await ctx.db
      .query('userSavedRecipes')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .order('desc')
      .collect();

    // Fetch full recipe data for each saved recipe
    const recipes = await Promise.all(
      savedRecipes.map(async (saved) => {
        const recipe = await ctx.db.get(saved.recipeId);
        if (!recipe) return null;

        return {
          ...recipe,
          savedAt: saved.savedAt,
          notes: saved.notes,
          userSavedRecipeId: saved._id,
        };
      })
    );

    // Filter out any null results (deleted recipes)
    return recipes.filter((r) => r !== null);
  },
});

/**
 * Remove a recipe from the user's saved collection.
 */
export const unsaveRecipe = mutation({
  args: { recipeId: v.id('recipes') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) throw new Error('User not found');

    // Find the user-recipe relationship
    const savedRecipe = await ctx.db
      .query('userSavedRecipes')
      .withIndex('by_user_recipe', (q) =>
        q.eq('userId', user._id).eq('recipeId', args.recipeId)
      )
      .unique();

    if (!savedRecipe) {
      throw new Error('Recipe not saved');
    }

    // Delete only the relationship, not the recipe itself
    await ctx.db.delete(savedRecipe._id);
  },
});

/**
 * Check if a recipe is saved by the current user.
 */
export const isRecipeSaved = query({
  args: { recipeId: v.id('recipes') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) return false;

    const saved = await ctx.db
      .query('userSavedRecipes')
      .withIndex('by_user_recipe', (q) =>
        q.eq('userId', user._id).eq('recipeId', args.recipeId)
      )
      .unique();

    return saved !== null;
  },
});
