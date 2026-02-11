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
 * List all cookbooks for a specific user by userId, with recipe counts.
 */
export const listByUser = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const cookbooks = await ctx.db
      .query('cookbooks')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
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

    const now = Date.now();
    const cookbookId = await ctx.db.insert('cookbooks', {
      userId: user._id,
      name: args.name,
      description: args.description,
      coverImageUrl,
      createdAt: now,
      updatedAt: now,
    });

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
 * Get a single cookbook by ID. Any authenticated user can view any cookbook.
 * Returns an `isOwner` flag so the UI can conditionally show edit controls.
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
    if (!cookbook) return null;

    const recipes = await ctx.db
      .query('cookbookRecipes')
      .withIndex('by_cookbook', (q) => q.eq('cookbookId', cookbook._id))
      .collect();

    return {
      ...cookbook,
      recipeCount: recipes.length,
      isOwner: cookbook.userId === user._id,
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
 * Any authenticated user can view recipes in any cookbook.
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

    const cookbook = await ctx.db.get(args.cookbookId);
    if (!cookbook) return [];

    const cookbookRecipes = await ctx.db
      .query('cookbookRecipes')
      .withIndex('by_cookbook', (q) => q.eq('cookbookId', args.cookbookId))
      .collect();

    const recipes = await Promise.all(
      cookbookRecipes.map(async (cr) => {
        const recipe = await ctx.db.get(cr.recipeId);
        if (!recipe) return null;

        // Look up user's personal rating
        let userRating: number | null = null;
        if (user) {
          const rating = await ctx.db
            .query('ratings')
            .withIndex('by_user_recipe', (q) =>
              q.eq('userId', user._id).eq('recipeId', recipe._id)
            )
            .unique();
          userRating = rating?.value ?? null;
        }

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
          userRating,
        };
      })
    );

    return recipes.filter((r): r is NonNullable<typeof r> => r !== null);
  },
});

/**
 * Get the most recently cooked recipe in a cookbook.
 * Only returns data when the cookbook has more than 3 recipes
 * AND the cookbook owner has a post for at least one of them.
 * Returns the recipe data for the most recent post, or null.
 */
export const getRecentlyCooked = query({
  args: { cookbookId: v.id('cookbooks') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const cookbook = await ctx.db.get(args.cookbookId);
    if (!cookbook) return null;

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

    // Get cookbook owner's posts, newest first
    const posts = await ctx.db
      .query('posts')
      .withIndex('by_user', (q) => q.eq('userId', cookbook.userId))
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
      difficulty: recipe.difficulty,
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

/**
 * Remove a recipe from a cookbook.
 */
export const removeRecipe = mutation({
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

    const entry = await ctx.db
      .query('cookbookRecipes')
      .withIndex('by_cookbook_recipe', (q) =>
        q.eq('cookbookId', args.cookbookId).eq('recipeId', args.recipeId)
      )
      .unique();

    if (entry) {
      await ctx.db.delete(entry._id);
      await ctx.db.patch(args.cookbookId, { updatedAt: Date.now() });
    }
  },
});

/**
 * Move a recipe from one cookbook to another.
 */
export const moveRecipe = mutation({
  args: {
    recipeId: v.id('recipes'),
    fromCookbookId: v.id('cookbooks'),
    toCookbookId: v.id('cookbooks'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) throw new Error('User not found');

    const fromCookbook = await ctx.db.get(args.fromCookbookId);
    if (!fromCookbook || fromCookbook.userId !== user._id) throw new Error('Unauthorized');

    const toCookbook = await ctx.db.get(args.toCookbookId);
    if (!toCookbook || toCookbook.userId !== user._id) throw new Error('Unauthorized');

    // Remove from source cookbook
    const existing = await ctx.db
      .query('cookbookRecipes')
      .withIndex('by_cookbook_recipe', (q) =>
        q.eq('cookbookId', args.fromCookbookId).eq('recipeId', args.recipeId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    // Check if already in target cookbook
    const alreadyInTarget = await ctx.db
      .query('cookbookRecipes')
      .withIndex('by_cookbook_recipe', (q) =>
        q.eq('cookbookId', args.toCookbookId).eq('recipeId', args.recipeId)
      )
      .unique();

    if (!alreadyInTarget) {
      await ctx.db.insert('cookbookRecipes', {
        cookbookId: args.toCookbookId,
        recipeId: args.recipeId,
        addedAt: Date.now(),
      });
    }

    const now = Date.now();
    await ctx.db.patch(args.fromCookbookId, { updatedAt: now });
    await ctx.db.patch(args.toCookbookId, { updatedAt: now });
  },
});

/**
 * Check whether a recipe is in any of the user's cookbooks.
 * Returns true if the recipe exists in at least one cookbook.
 */
export const isRecipeInAnyCookbook = query({
  args: { recipeId: v.id('recipes') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) return false;

    // Get all cookbook-recipe entries for this recipe
    const entries = await ctx.db
      .query('cookbookRecipes')
      .withIndex('by_recipe', (q) => q.eq('recipeId', args.recipeId))
      .collect();

    // Check if any of those cookbooks belong to this user
    for (const entry of entries) {
      const cookbook = await ctx.db.get(entry.cookbookId);
      if (cookbook && cookbook.userId === user._id) {
        return true;
      }
    }

    return false;
  },
});
