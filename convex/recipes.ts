import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { ingredientSchema, instructionSchema, extractionMethod } from './schema';

/**
 * Save a recipe URL for later extraction (used during onboarding).
 * Creates a pending entry that will be fully populated when extracted.
 */
export const saveUrl = mutation({
  args: {
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) throw new Error('User not found');

    // Check if recipe already exists
    const existingRecipe = await ctx.db
      .query('recipes')
      .withIndex('by_url', (q) => q.eq('url', args.url))
      .unique();

    if (existingRecipe) {
      // Just save to collection
      const existingSave = await ctx.db
        .query('userSavedRecipes')
        .withIndex('by_user_recipe', (q) =>
          q.eq('userId', user._id).eq('recipeId', existingRecipe._id)
        )
        .unique();

      if (!existingSave) {
        await ctx.db.insert('userSavedRecipes', {
          userId: user._id,
          recipeId: existingRecipe._id,
          savedAt: Date.now(),
        });
      }
      return existingRecipe._id;
    }

    // Create a pending recipe (will be fully extracted later)
    const recipeId = await ctx.db.insert('recipes', {
      url: args.url,
      createdAt: Date.now(),
      title: 'Pending extraction...',
      ingredients: [],
      instructions: [],
      methodUsed: 'metadata',
      ratingCount: 0,
      ratingSum: 0,
    });

    // Save to user's collection
    await ctx.db.insert('userSavedRecipes', {
      userId: user._id,
      recipeId,
      savedAt: Date.now(),
    });

    return recipeId;
  },
});

/**
 * Get a recipe by URL (for deduplication check).
 */
export const getByUrl = query({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query('recipes')
      .withIndex('by_url', (q) => q.eq('url', args.url))
      .unique();
  },
});

/**
 * Get a recipe by ID with average rating.
 */
export const get = query({
  args: { id: v.id('recipes') },
  handler: async (ctx, args) => {
    const recipe = await ctx.db.get(args.id);
    if (!recipe) return null;

    const averageRating =
      recipe.ratingCount > 0 ? recipe.ratingSum / recipe.ratingCount : null;

    return {
      ...recipe,
      averageRating,
    };
  },
});

/**
 * Save an extracted recipe (creates if new, returns existing if duplicate).
 * Also saves to the user's collection.
 */
export const saveExtracted = mutation({
  args: {
    url: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    cuisine: v.optional(v.string()),
    difficulty: v.optional(v.union(v.string(), v.number())),
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
    methodUsed: extractionMethod,
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
    let existingRecipe = await ctx.db
      .query('recipes')
      .withIndex('by_url', (q) => q.eq('url', args.url))
      .unique();

    let recipeId: Id<'recipes'>;

    if (existingRecipe) {
      // Recipe exists, use it
      recipeId = existingRecipe._id;
    } else {
      // Create new recipe
      recipeId = await ctx.db.insert('recipes', {
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
        equipment: args.equipment,
        creatorName: args.creatorName,
        creatorProfileUrl: args.creatorProfileUrl,
        ingredients: args.ingredients,
        instructions: args.instructions,
        methodUsed: args.methodUsed,
        ratingCount: 0,
        ratingSum: 0,
      });
    }

    // Check if user already has this recipe saved
    const existingSave = await ctx.db
      .query('userSavedRecipes')
      .withIndex('by_user_recipe', (q) =>
        q.eq('userId', user._id).eq('recipeId', recipeId)
      )
      .unique();

    if (!existingSave) {
      // Save to user's collection
      await ctx.db.insert('userSavedRecipes', {
        userId: user._id,
        recipeId,
        savedAt: Date.now(),
      });
    }

    return recipeId;
  },
});

/**
 * Save an existing recipe to the user's collection.
 */
export const saveToCollection = mutation({
  args: { recipeId: v.id('recipes') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) throw new Error('User not found');

    // Check if already saved
    const existing = await ctx.db
      .query('userSavedRecipes')
      .withIndex('by_user_recipe', (q) =>
        q.eq('userId', user._id).eq('recipeId', args.recipeId)
      )
      .unique();

    if (existing) {
      return existing._id;
    }

    return ctx.db.insert('userSavedRecipes', {
      userId: user._id,
      recipeId: args.recipeId,
      savedAt: Date.now(),
    });
  },
});

/**
 * Remove a recipe from the user's collection.
 */
export const removeFromCollection = mutation({
  args: { recipeId: v.id('recipes') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) throw new Error('User not found');

    const saved = await ctx.db
      .query('userSavedRecipes')
      .withIndex('by_user_recipe', (q) =>
        q.eq('userId', user._id).eq('recipeId', args.recipeId)
      )
      .unique();

    if (saved) {
      await ctx.db.delete(saved._id);
    }
  },
});

/**
 * Check if user has saved a recipe.
 */
export const isSaved = query({
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

/**
 * List all recipes saved by the authenticated user, newest first.
 */
export const listSaved = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) return [];

    const savedRecipes = await ctx.db
      .query('userSavedRecipes')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .order('desc')
      .collect();

    // Fetch full recipe data with ratings
    const recipes = await Promise.all(
      savedRecipes.map(async (saved) => {
        const recipe = await ctx.db.get(saved.recipeId);
        if (!recipe) return null;

        const averageRating =
          recipe.ratingCount > 0 ? recipe.ratingSum / recipe.ratingCount : null;

        return {
          ...recipe,
          savedAt: saved.savedAt,
          notes: saved.notes,
          averageRating,
        };
      })
    );

    return recipes.filter((r): r is NonNullable<typeof r> => r !== null);
  },
});

/**
 * Rate a recipe (1-5). Updates or creates rating.
 */
export const rate = mutation({
  args: {
    recipeId: v.id('recipes'),
    value: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.value < 1 || args.value > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) throw new Error('User not found');

    const recipe = await ctx.db.get(args.recipeId);
    if (!recipe) throw new Error('Recipe not found');

    const now = Date.now();

    // Check for existing rating
    const existingRating = await ctx.db
      .query('ratings')
      .withIndex('by_user_recipe', (q) =>
        q.eq('userId', user._id).eq('recipeId', args.recipeId)
      )
      .unique();

    if (existingRating) {
      // Update existing rating
      const oldValue = existingRating.value;
      await ctx.db.patch(existingRating._id, {
        value: args.value,
        updatedAt: now,
      });

      // Update denormalized stats (replace old value with new)
      await ctx.db.patch(args.recipeId, {
        ratingSum: recipe.ratingSum - oldValue + args.value,
      });
    } else {
      // Create new rating
      await ctx.db.insert('ratings', {
        userId: user._id,
        recipeId: args.recipeId,
        value: args.value,
        createdAt: now,
        updatedAt: now,
      });

      // Update denormalized stats
      await ctx.db.patch(args.recipeId, {
        ratingCount: recipe.ratingCount + 1,
        ratingSum: recipe.ratingSum + args.value,
      });
    }
  },
});

/**
 * Get the user's rating for a recipe.
 */
export const getUserRating = query({
  args: { recipeId: v.id('recipes') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) return null;

    const rating = await ctx.db
      .query('ratings')
      .withIndex('by_user_recipe', (q) =>
        q.eq('userId', user._id).eq('recipeId', args.recipeId)
      )
      .unique();

    return rating?.value ?? null;
  },
});

/**
 * Delete user's rating for a recipe.
 */
export const deleteRating = mutation({
  args: { recipeId: v.id('recipes') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) throw new Error('User not found');

    const rating = await ctx.db
      .query('ratings')
      .withIndex('by_user_recipe', (q) =>
        q.eq('userId', user._id).eq('recipeId', args.recipeId)
      )
      .unique();

    if (rating) {
      const recipe = await ctx.db.get(args.recipeId);
      if (recipe) {
        // Update denormalized stats
        await ctx.db.patch(args.recipeId, {
          ratingCount: Math.max(0, recipe.ratingCount - 1),
          ratingSum: Math.max(0, recipe.ratingSum - rating.value),
        });
      }

      await ctx.db.delete(rating._id);
    }
  },
});
