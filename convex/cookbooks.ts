import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

/**
 * Create a new cookbook for the current user.
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    coverImageUrl: v.optional(v.string()),
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

    const now = Date.now();
    const cookbookId = await ctx.db.insert('cookbooks', {
      userId: user._id,
      name: args.name,
      description: args.description,
      coverImageUrl: args.coverImageUrl,
      createdAt: now,
      updatedAt: now,
    });

    return cookbookId;
  },
});

/**
 * List all cookbooks for the current user.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) {
      return [];
    }

    const cookbooks = await ctx.db
      .query('cookbooks')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();

    // Get recipe counts for each cookbook
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
 * Get a cookbook by ID.
 */
export const get = query({
  args: { id: v.id('cookbooks') },
  handler: async (ctx, args) => {
    const cookbook = await ctx.db.get(args.id);
    if (!cookbook) {
      return null;
    }

    // Get recipe count
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
 * Add a recipe to a cookbook.
 */
export const addRecipe = mutation({
  args: {
    cookbookId: v.id('cookbooks'),
    recipeId: v.id('recipes'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }

    // Verify the cookbook exists and belongs to the user
    const cookbook = await ctx.db.get(args.cookbookId);
    if (!cookbook) {
      throw new Error('Cookbook not found');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user || cookbook.userId !== user._id) {
      throw new Error('Unauthorized');
    }

    // Check if recipe is already in cookbook
    const existing = await ctx.db
      .query('cookbookRecipes')
      .withIndex('by_cookbook_recipe', (q) =>
        q.eq('cookbookId', args.cookbookId).eq('recipeId', args.recipeId)
      )
      .unique();

    if (existing) {
      // Already in cookbook, return existing
      return existing._id;
    }

    // Add recipe to cookbook
    const id = await ctx.db.insert('cookbookRecipes', {
      cookbookId: args.cookbookId,
      recipeId: args.recipeId,
      addedAt: Date.now(),
    });

    // Update cookbook's updatedAt
    await ctx.db.patch(args.cookbookId, { updatedAt: Date.now() });

    return id;
  },
});
