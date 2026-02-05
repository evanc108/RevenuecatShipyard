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
 * List posts by a specific user with full enriched data for feed display.
 * Returns posts with user, recipe, likes, comments data.
 */
export const listByUserEnriched = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    // Get current user for checking isLiked/isSaved
    const currentUser = identity
      ? await ctx.db
          .query('users')
          .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
          .unique()
      : null;

    // Get the profile user
    const profileUser = await ctx.db.get(args.userId);
    if (!profileUser) return [];

    const posts = await ctx.db
      .query('posts')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .order('desc')
      .collect();

    // Join with recipe, likes, comments, and save data
    const postsWithData = await Promise.all(
      posts.map(async (post) => {
        const [recipe, likes, comments, savedByUser] = await Promise.all([
          ctx.db.get(post.recipeId),
          ctx.db
            .query('postLikes')
            .withIndex('by_post', (q) => q.eq('postId', post._id))
            .collect(),
          ctx.db
            .query('postComments')
            .withIndex('by_post', (q) => q.eq('postId', post._id))
            .collect(),
          currentUser
            ? ctx.db
                .query('savedPosts')
                .withIndex('by_post_user', (q) =>
                  q.eq('postId', post._id).eq('userId', currentUser._id)
                )
                .unique()
            : null,
        ]);

        const isLikedByUser = currentUser
          ? likes.some((like) => like.userId === currentUser._id)
          : false;

        return {
          ...post,
          user: {
            _id: profileUser._id,
            firstName: profileUser.firstName,
            lastName: profileUser.lastName,
            username: profileUser.username,
            imageUrl: profileUser.imageUrl,
          },
          recipe: recipe
            ? {
                _id: recipe._id,
                title: recipe.title,
                imageUrl: recipe.imageUrl,
                totalTimeMinutes: recipe.totalTimeMinutes,
                url: recipe.url,
              }
            : null,
          likeCount: likes.length,
          commentCount: comments.length,
          isLiked: isLikedByUser,
          isSaved: savedByUser !== null,
        };
      })
    );

    // Filter out posts where recipe was deleted
    return postsWithData.filter((post) => post.recipe !== null);
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

/**
 * Get social feed - posts from users the current user follows.
 * Returns posts in reverse chronological order with user and recipe data.
 */
export const socialFeed = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const currentUser = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!currentUser) return [];

    const limit = args.limit ?? 50;

    // Get list of users the current user follows
    const following = await ctx.db
      .query('follows')
      .withIndex('by_follower', (q) => q.eq('followerId', currentUser._id))
      .collect();

    const followingIds = following.map((f) => f.followingId);

    // If not following anyone, return empty
    if (followingIds.length === 0) return [];

    // Get all posts, sorted by creation date (newest first)
    const allPosts = await ctx.db
      .query('posts')
      .withIndex('by_created')
      .order('desc')
      .collect();

    // Filter to only posts from followed users
    const feedPosts = allPosts
      .filter((post) => followingIds.includes(post.userId))
      .slice(0, limit);

    // Join with user, recipe, likes, comments, and save data
    const postsWithData = await Promise.all(
      feedPosts.map(async (post) => {
        const [user, recipe, likes, comments, savedByUser] = await Promise.all([
          ctx.db.get(post.userId),
          ctx.db.get(post.recipeId),
          ctx.db
            .query('postLikes')
            .withIndex('by_post', (q) => q.eq('postId', post._id))
            .collect(),
          ctx.db
            .query('postComments')
            .withIndex('by_post', (q) => q.eq('postId', post._id))
            .collect(),
          ctx.db
            .query('savedPosts')
            .withIndex('by_post_user', (q) =>
              q.eq('postId', post._id).eq('userId', currentUser._id)
            )
            .unique(),
        ]);

        const isLikedByUser = likes.some((like) => like.userId === currentUser._id);

        return {
          ...post,
          user: user
            ? {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                imageUrl: user.imageUrl,
              }
            : null,
          recipe: recipe
            ? {
                _id: recipe._id,
                title: recipe.title,
                imageUrl: recipe.imageUrl,
                totalTimeMinutes: recipe.totalTimeMinutes,
                url: recipe.url,
              }
            : null,
          likeCount: likes.length,
          commentCount: comments.length,
          isLiked: isLikedByUser,
          isSaved: savedByUser !== null,
        };
      })
    );

    // Filter out posts where user or recipe was deleted
    return postsWithData.filter((post) => post.user !== null && post.recipe !== null);
  },
});
