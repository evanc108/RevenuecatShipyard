import { v } from 'convex/values';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import { ingredientSchema, instructionSchema } from './schema';

/**
 * Schema for a single populated recipe from the backend.
 */
export const populatedRecipeSchema = v.object({
  sourceId: v.string(),
  sourceUrl: v.string(),
  title: v.string(),
  description: v.optional(v.string()),
  cuisine: v.optional(v.string()),
  difficulty: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  servings: v.optional(v.number()),
  prepTimeMinutes: v.optional(v.number()),
  cookTimeMinutes: v.optional(v.number()),
  totalTimeMinutes: v.optional(v.number()),
  calories: v.optional(v.number()),
  proteinGrams: v.optional(v.number()),
  carbsGrams: v.optional(v.number()),
  fatGrams: v.optional(v.number()),
  dietaryTags: v.optional(v.array(v.string())),
  keywords: v.optional(v.array(v.string())),
  equipment: v.optional(v.array(v.string())),
  creatorName: v.optional(v.string()),
  creatorProfileUrl: v.optional(v.string()),
  ingredients: v.array(ingredientSchema),
  instructions: v.array(instructionSchema),
});

/**
 * Check if a recipe already exists by sourceId.
 * Used to avoid calling OpenAI for recipes we already have.
 */
export const checkRecipeExists = internalQuery({
  args: {
    sourceId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('discoverRecipes')
      .withIndex('by_source_id', (q) => q.eq('sourceId', args.sourceId))
      .unique();

    return existing !== null;
  },
});

/**
 * Internal mutation to store a single populated recipe.
 * Called by the populateFromBackend action.
 * Returns { id, isNew } to track actual new inserts vs updates.
 */
export const storeRecipe = internalMutation({
  args: {
    recipe: populatedRecipeSchema,
  },
  handler: async (ctx, args) => {
    const { recipe } = args;

    // Check if recipe already exists by sourceId
    const existing = await ctx.db
      .query('discoverRecipes')
      .withIndex('by_source_id', (q) => q.eq('sourceId', recipe.sourceId))
      .unique();

    if (existing) {
      // Update existing recipe - not a new insert
      await ctx.db.patch(existing._id, {
        title: recipe.title,
        description: recipe.description,
        cuisine: recipe.cuisine,
        difficulty: recipe.difficulty,
        imageUrl: recipe.imageUrl,
        servings: recipe.servings,
        prepTimeMinutes: recipe.prepTimeMinutes,
        cookTimeMinutes: recipe.cookTimeMinutes,
        totalTimeMinutes: recipe.totalTimeMinutes,
        calories: recipe.calories,
        proteinGrams: recipe.proteinGrams,
        carbsGrams: recipe.carbsGrams,
        fatGrams: recipe.fatGrams,
        dietaryTags: recipe.dietaryTags,
        keywords: recipe.keywords,
        equipment: recipe.equipment,
        creatorName: recipe.creatorName,
        creatorProfileUrl: recipe.creatorProfileUrl,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
      });
      return { id: existing._id, isNew: false };
    }

    // Insert new recipe
    const newId = await ctx.db.insert('discoverRecipes', {
      sourceId: recipe.sourceId,
      sourceUrl: recipe.sourceUrl,
      title: recipe.title,
      description: recipe.description,
      cuisine: recipe.cuisine,
      difficulty: recipe.difficulty,
      imageUrl: recipe.imageUrl,
      servings: recipe.servings,
      prepTimeMinutes: recipe.prepTimeMinutes,
      cookTimeMinutes: recipe.cookTimeMinutes,
      totalTimeMinutes: recipe.totalTimeMinutes,
      calories: recipe.calories,
      proteinGrams: recipe.proteinGrams,
      carbsGrams: recipe.carbsGrams,
      fatGrams: recipe.fatGrams,
      dietaryTags: recipe.dietaryTags,
      keywords: recipe.keywords,
      equipment: recipe.equipment,
      creatorName: recipe.creatorName,
      creatorProfileUrl: recipe.creatorProfileUrl,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      createdAt: Date.now(),
      isActive: true,
    });
    return { id: newId, isNew: true };
  },
});

/**
 * Get unviewed recipes for the current user.
 * Returns recipes from discoverRecipes that the user hasn't seen yet.
 */
export const getUnviewedRecipes = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      // Return empty for unauthenticated users
      return [];
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) {
      return [];
    }

    const limit = args.limit ?? 20;

    // Get all viewed recipe IDs for this user
    const viewedRecords = await ctx.db
      .query('userViewedRecipes')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();

    const viewedIds = new Set(viewedRecords.map((r) => r.discoverRecipeId));

    // Get active recipes, filtering out viewed ones
    const allRecipes = await ctx.db
      .query('discoverRecipes')
      .withIndex('by_active', (q) => q.eq('isActive', true))
      .order('desc')
      .collect();

    const unviewedRecipes = allRecipes
      .filter((recipe) => !viewedIds.has(recipe._id))
      .slice(0, limit);

    return unviewedRecipes;
  },
});

/**
 * Record that a user has viewed (swiped on) a recipe.
 */
export const recordView = mutation({
  args: {
    discoverRecipeId: v.id('discoverRecipes'),
    action: v.union(v.literal('skipped'), v.literal('saved')),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    // Check if already recorded
    const existing = await ctx.db
      .query('userViewedRecipes')
      .withIndex('by_user_recipe', (q) =>
        q.eq('userId', user._id).eq('discoverRecipeId', args.discoverRecipeId)
      )
      .unique();

    if (existing) {
      // Update existing record
      await ctx.db.patch(existing._id, {
        action: args.action,
        viewedAt: Date.now(),
      });
      return existing._id;
    }

    // Create new view record
    return await ctx.db.insert('userViewedRecipes', {
      userId: user._id,
      discoverRecipeId: args.discoverRecipeId,
      viewedAt: Date.now(),
      action: args.action,
    });
  },
});

/**
 * Get count of remaining unviewed recipes for the current user.
 * Used to determine when to trigger population of more recipes.
 */
export const getUnviewedCount = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return 0;
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) {
      return 0;
    }

    // Get count of all active discover recipes
    const allRecipes = await ctx.db
      .query('discoverRecipes')
      .withIndex('by_active', (q) => q.eq('isActive', true))
      .collect();

    // Get count of viewed recipes for this user
    const viewedRecords = await ctx.db
      .query('userViewedRecipes')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();

    const viewedIds = new Set(viewedRecords.map((r) => r.discoverRecipeId));
    const unviewedCount = allRecipes.filter((r) => !viewedIds.has(r._id)).length;

    return unviewedCount;
  },
});

/**
 * Get total count of discover recipes.
 * Used for admin/debugging purposes.
 */
export const getTotalCount = query({
  args: {},
  handler: async (ctx) => {
    const recipes = await ctx.db
      .query('discoverRecipes')
      .withIndex('by_active', (q) => q.eq('isActive', true))
      .collect();

    return recipes.length;
  },
});
