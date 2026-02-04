import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

/**
 * Toggle save/bookmark on a post.
 */
export const toggle = mutation({
  args: { postId: v.id('posts') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const currentUser = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!currentUser) throw new Error('User not found');

    // Check if post exists
    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error('Post not found');

    // Check if already saved
    const existingSave = await ctx.db
      .query('savedPosts')
      .withIndex('by_post_user', (q) =>
        q.eq('postId', args.postId).eq('userId', currentUser._id)
      )
      .unique();

    if (existingSave) {
      // Unsave
      await ctx.db.delete(existingSave._id);
      return { saved: false };
    } else {
      // Save
      await ctx.db.insert('savedPosts', {
        postId: args.postId,
        userId: currentUser._id,
        savedAt: Date.now(),
      });
      return { saved: true };
    }
  },
});

/**
 * Check if current user has saved a post.
 */
export const isSaved = query({
  args: { postId: v.id('posts') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;

    const currentUser = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!currentUser) return false;

    const saved = await ctx.db
      .query('savedPosts')
      .withIndex('by_post_user', (q) =>
        q.eq('postId', args.postId).eq('userId', currentUser._id)
      )
      .unique();

    return saved !== null;
  },
});

/**
 * Get saved posts for current user.
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

    const savedPosts = await ctx.db
      .query('savedPosts')
      .withIndex('by_user', (q) => q.eq('userId', currentUser._id))
      .order('desc')
      .collect();

    // Join with post data
    const postsWithData = await Promise.all(
      savedPosts.map(async (saved) => {
        const post = await ctx.db.get(saved.postId);
        if (!post) return null;

        const [user, recipe] = await Promise.all([
          ctx.db.get(post.userId),
          ctx.db.get(post.recipeId),
        ]);

        return {
          ...post,
          savedAt: saved.savedAt,
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
              }
            : null,
        };
      })
    );

    return postsWithData.filter(
      (post) => post !== null && post.user !== null && post.recipe !== null
    );
  },
});
