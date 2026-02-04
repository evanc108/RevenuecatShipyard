import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

/**
 * Create a new post - user shares that they cooked a recipe.
 */
export const create = mutation({
  args: {
    recipeId: v.id('recipes'),
    easeRating: v.number(),
    tasteRating: v.number(),
    presentationRating: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const currentUser = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!currentUser) throw new Error('User not found');

    // Validate ratings are between 1-5
    const { easeRating, tasteRating, presentationRating } = args;
    if (
      easeRating < 1 || easeRating > 5 ||
      tasteRating < 1 || tasteRating > 5 ||
      presentationRating < 1 || presentationRating > 5
    ) {
      throw new Error('Ratings must be between 1 and 5');
    }

    // Verify recipe exists
    const recipe = await ctx.db.get(args.recipeId);
    if (!recipe) throw new Error('Recipe not found');

    const postId = await ctx.db.insert('posts', {
      userId: currentUser._id,
      recipeId: args.recipeId,
      easeRating,
      tasteRating,
      presentationRating,
      notes: args.notes,
      createdAt: Date.now(),
    });

    return { success: true, postId };
  },
});

/**
 * List posts by a specific user (for profile display).
 * Returns posts with recipe data joined.
 */
export const listByUser = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const posts = await ctx.db
      .query('posts')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .order('desc')
      .collect();

    // Join with recipe data
    const postsWithRecipes = await Promise.all(
      posts.map(async (post) => {
        const recipe = await ctx.db.get(post.recipeId);
        return {
          ...post,
          recipe: recipe ? {
            _id: recipe._id,
            title: recipe.title,
            imageUrl: recipe.imageUrl,
            totalTimeMinutes: recipe.totalTimeMinutes,
          } : null,
        };
      })
    );

    // Filter out posts where recipe was deleted
    return postsWithRecipes.filter((post) => post.recipe !== null);
  },
});

/**
 * List posts for current user's profile.
 */
export const listMine = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const currentUser = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!currentUser) return [];

    const posts = await ctx.db
      .query('posts')
      .withIndex('by_user', (q) => q.eq('userId', currentUser._id))
      .order('desc')
      .collect();

    // Join with recipe data
    const postsWithRecipes = await Promise.all(
      posts.map(async (post) => {
        const recipe = await ctx.db.get(post.recipeId);
        return {
          ...post,
          recipe: recipe ? {
            _id: recipe._id,
            title: recipe.title,
            imageUrl: recipe.imageUrl,
            totalTimeMinutes: recipe.totalTimeMinutes,
          } : null,
        };
      })
    );

    return postsWithRecipes.filter((post) => post.recipe !== null);
  },
});

/**
 * Get post count for a user.
 */
export const countByUser = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const posts = await ctx.db
      .query('posts')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();

    return posts.length;
  },
});

/**
 * Get current user's post for a specific recipe (if exists).
 */
export const getMyPostForRecipe = query({
  args: { recipeId: v.id('recipes') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const currentUser = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!currentUser) return null;

    const posts = await ctx.db
      .query('posts')
      .withIndex('by_user', (q) => q.eq('userId', currentUser._id))
      .collect();

    return posts.find((post) => post.recipeId === args.recipeId) ?? null;
  },
});

/**
 * Update an existing post.
 */
export const update = mutation({
  args: {
    postId: v.id('posts'),
    easeRating: v.number(),
    tasteRating: v.number(),
    presentationRating: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const currentUser = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!currentUser) throw new Error('User not found');

    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error('Post not found');

    if (post.userId !== currentUser._id) {
      throw new Error('You can only update your own posts');
    }

    // Validate ratings are between 1-5
    const { easeRating, tasteRating, presentationRating } = args;
    if (
      easeRating < 1 || easeRating > 5 ||
      tasteRating < 1 || tasteRating > 5 ||
      presentationRating < 1 || presentationRating > 5
    ) {
      throw new Error('Ratings must be between 1 and 5');
    }

    await ctx.db.patch(args.postId, {
      easeRating,
      tasteRating,
      presentationRating,
      notes: args.notes,
    });

    return { success: true };
  },
});

/**
 * Delete a post (only owner can delete).
 */
export const remove = mutation({
  args: { postId: v.id('posts') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const currentUser = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!currentUser) throw new Error('User not found');

    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error('Post not found');

    if (post.userId !== currentUser._id) {
      throw new Error('You can only delete your own posts');
    }

    await ctx.db.delete(args.postId);
    return { success: true };
  },
});
