import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

/**
 * List all cookbooks for the authenticated user, with recipe counts.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) return [];

    const cookbooks = await ctx.db
      .query('cookbooks')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();

    const cookbooksWithCounts = await Promise.all(
      cookbooks.map(async (cookbook) => {
        const recipes = await ctx.db
          .query('cookbookRecipes')
          .withIndex('by_cookbook', (q) => q.eq('cookbookId', cookbook._id))
          .collect();
        return {
          ...cookbook,
          recipeCount: recipes.length,
        };
      })
    );

    return cookbooksWithCounts;
  },
});

/**
 * Create a new cookbook for the authenticated user.
 * Accepts either a Convex storage ID (resolved to URL) or a direct image URL.
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    coverImageStorageId: v.optional(v.id('_storage')),
    coverImageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) throw new Error('User not found');

    let coverImageUrl: string | undefined = args.coverImageUrl;
    if (args.coverImageStorageId) {
      const url = await ctx.storage.getUrl(args.coverImageStorageId);
      if (url) {
        coverImageUrl = url;
      }
    }

    // Check if this is the user's first cookbook
    const existingCookbook = await ctx.db
      .query('cookbooks')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .first();

    const isFirstCookbook = existingCookbook === null;

    const now = Date.now();
    const cookbookId = await ctx.db.insert('cookbooks', {
      userId: user._id,
      name: args.name,
      description: args.description,
      coverImageUrl,
      createdAt: now,
      updatedAt: now,
    });

    // Auto-populate the first cookbook with all existing recipes
    if (isFirstCookbook) {
      const allRecipes = await ctx.db.query('recipes').collect();
      await Promise.all(
        allRecipes.map((recipe) =>
          ctx.db.insert('cookbookRecipes', {
            cookbookId,
            recipeId: recipe._id,
            addedAt: now,
          })
        )
      );
    }

    return cookbookId;
  },
});

/**
 * Update an existing cookbook (name, description, cover image).
 */
export const update = mutation({
  args: {
    cookbookId: v.id('cookbooks'),
    name: v.string(),
    description: v.optional(v.string()),
    coverImageStorageId: v.optional(v.id('_storage')),
    coverImageUrl: v.optional(v.string()),
    removeCoverImage: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const cookbook = await ctx.db.get(args.cookbookId);
    if (!cookbook) throw new Error('Cookbook not found');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user || cookbook.userId !== user._id) throw new Error('Unauthorized');

    let coverImageUrl: string | undefined = args.coverImageUrl ?? cookbook.coverImageUrl;
    if (args.coverImageStorageId) {
      const url = await ctx.storage.getUrl(args.coverImageStorageId);
      if (url) {
        coverImageUrl = url;
      }
    }
    if (args.removeCoverImage) {
      coverImageUrl = undefined;
    }

    await ctx.db.patch(args.cookbookId, {
      name: args.name,
      description: args.description,
      coverImageUrl,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Get a single cookbook by ID (must be owned by the authenticated user).
 */
export const getById = query({
  args: { cookbookId: v.id('cookbooks') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) return null;

    const cookbook = await ctx.db.get(args.cookbookId);
    if (!cookbook || cookbook.userId !== user._id) return null;

    const recipes = await ctx.db
      .query('cookbookRecipes')
      .withIndex('by_cookbook', (q) => q.eq('cookbookId', cookbook._id))
      .collect();

    return {
      ...cookbook,
      recipeCount: recipes.length,
    };
  },
});

/**
 * Delete a cookbook owned by the authenticated user.
 */
export const remove = mutation({
  args: { cookbookId: v.id('cookbooks') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const cookbook = await ctx.db.get(args.cookbookId);
    if (!cookbook) throw new Error('Cookbook not found');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user || cookbook.userId !== user._id) throw new Error('Unauthorized');

    // Remove all cookbook-recipe associations
    const cookbookRecipes = await ctx.db
      .query('cookbookRecipes')
      .withIndex('by_cookbook', (q) => q.eq('cookbookId', args.cookbookId))
      .collect();

    await Promise.all(
      cookbookRecipes.map((cr) => ctx.db.delete(cr._id))
    );

    await ctx.db.delete(args.cookbookId);
  },
});

/**
 * Get all recipes in a cookbook, with fields needed by the detail screen.
 * Returns a lightweight projection (no ingredients/instructions).
 */
export const getRecipes = query({
  args: { cookbookId: v.id('cookbooks') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) return [];

    const cookbook = await ctx.db.get(args.cookbookId);
    if (!cookbook || cookbook.userId !== user._id) return [];

    const cookbookRecipes = await ctx.db
      .query('cookbookRecipes')
      .withIndex('by_cookbook', (q) => q.eq('cookbookId', args.cookbookId))
      .collect();

    const recipes = await Promise.all(
      cookbookRecipes.map(async (cr) => {
        const recipe = await ctx.db.get(cr.recipeId);
        if (!recipe) return null;

        return {
          _id: recipe._id,
          title: recipe.title,
          description: recipe.description,
          cuisine: recipe.cuisine,
          difficulty: recipe.difficulty,
          imageUrl: recipe.imageUrl,
          totalTimeMinutes: recipe.totalTimeMinutes,
          prepTimeMinutes: recipe.prepTimeMinutes,
          cookTimeMinutes: recipe.cookTimeMinutes,
          servings: recipe.servings,
          calories: recipe.calories,
          createdAt: recipe.createdAt,
          addedAt: cr.addedAt,
        };
      })
    );

    return recipes.filter((r): r is NonNullable<typeof r> => r !== null);
  },
});

/**
 * Get the most recently cooked recipe in a cookbook.
 * Only returns data when the cookbook has more than 3 recipes
 * AND the user has a post for at least one of them.
 * Returns the recipe data for the most recent post, or null.
 */
export const getRecentlyCooked = query({
  args: { cookbookId: v.id('cookbooks') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) return null;

    const cookbook = await ctx.db.get(args.cookbookId);
    if (!cookbook || cookbook.userId !== user._id) return null;

    // Get all recipe IDs in this cookbook
    const cookbookRecipes = await ctx.db
      .query('cookbookRecipes')
      .withIndex('by_cookbook', (q) => q.eq('cookbookId', args.cookbookId))
      .collect();

    // Only show recently cooked when cookbook has more than 3 recipes
    if (cookbookRecipes.length <= 3) return null;

    const recipeIds = new Set(
      cookbookRecipes.map((cr) => cr.recipeId.toString())
    );

    // Get user posts, newest first
    const posts = await ctx.db
      .query('posts')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .order('desc')
      .collect();

    // Find the most recent post for a recipe in this cookbook
    const recentPost = posts.find((post) =>
      recipeIds.has(post.recipeId.toString())
    );
    if (!recentPost) return null;

    const recipe = await ctx.db.get(recentPost.recipeId);
    if (!recipe) return null;

    return {
      _id: recipe._id,
      title: recipe.title,
      imageUrl: recipe.imageUrl,
      totalTimeMinutes: recipe.totalTimeMinutes,
      cuisine: recipe.cuisine,
      cookedAt: recentPost.createdAt,
    };
  },
});

/**
 * Get or create the "Meal Prep" cookbook for the authenticated user.
 * Used when saving recipes from the "Plan from Pantry" feature.
 */
export const getOrCreateMealPrepCookbook = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) throw new Error('User not found');

    // Check if Meal Prep cookbook already exists
    const existingCookbook = await ctx.db
      .query('cookbooks')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .filter((q) => q.eq(q.field('name'), 'Meal Prep'))
      .unique();

    if (existingCookbook) {
      return existingCookbook._id;
    }

    // Create the Meal Prep cookbook
    const now = Date.now();
    const cookbookId = await ctx.db.insert('cookbooks', {
      userId: user._id,
      name: 'Meal Prep',
      description: 'Recipes generated from your pantry ingredients',
      createdAt: now,
      updatedAt: now,
    });

    return cookbookId;
  },
});

/**
 * Add a recipe to a cookbook.
 */
export const addRecipe = mutation({
  args: {
    cookbookId: v.id('cookbooks'),
    recipeId: v.id('recipes'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const cookbook = await ctx.db.get(args.cookbookId);
    if (!cookbook) throw new Error('Cookbook not found');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user || cookbook.userId !== user._id) throw new Error('Unauthorized');

    // Check if recipe is already in cookbook
    const existing = await ctx.db
      .query('cookbookRecipes')
      .withIndex('by_cookbook_recipe', (q) =>
        q.eq('cookbookId', args.cookbookId).eq('recipeId', args.recipeId)
      )
      .unique();

    if (existing) {
      return existing._id;
    }

    const id = await ctx.db.insert('cookbookRecipes', {
      cookbookId: args.cookbookId,
      recipeId: args.recipeId,
      addedAt: Date.now(),
    });

    await ctx.db.patch(args.cookbookId, { updatedAt: Date.now() });

    return id;
  },
});
