import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

/**
 * Toggle like on a post.
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

    // Check if already liked
    const existingLike = await ctx.db
      .query('postLikes')
      .withIndex('by_post_user', (q) =>
        q.eq('postId', args.postId).eq('userId', currentUser._id)
      )
      .unique();

    if (existingLike) {
      // Unlike
      await ctx.db.delete(existingLike._id);
      return { liked: false };
    } else {
      // Like
      await ctx.db.insert('postLikes', {
        postId: args.postId,
        userId: currentUser._id,
        createdAt: Date.now(),
      });
      return { liked: true };
    }
  },
});

/**
 * Check if current user has liked a post.
 */
export const isLiked = query({
  args: { postId: v.id('posts') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;

    const currentUser = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!currentUser) return false;

    const like = await ctx.db
      .query('postLikes')
      .withIndex('by_post_user', (q) =>
        q.eq('postId', args.postId).eq('userId', currentUser._id)
      )
      .unique();

    return like !== null;
  },
});

/**
 * Get like count for a post.
 */
export const count = query({
  args: { postId: v.id('posts') },
  handler: async (ctx, args) => {
    const likes = await ctx.db
      .query('postLikes')
      .withIndex('by_post', (q) => q.eq('postId', args.postId))
      .collect();

    return likes.length;
  },
});

/**
 * Get like status and count for a post (combined query for efficiency).
 */
export const getStatus = query({
  args: { postId: v.id('posts') },
  handler: async (ctx, args) => {
    const likes = await ctx.db
      .query('postLikes')
      .withIndex('by_post', (q) => q.eq('postId', args.postId))
      .collect();

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { count: likes.length, isLiked: false };
    }

    const currentUser = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!currentUser) {
      return { count: likes.length, isLiked: false };
    }

    const isLiked = likes.some((like) => like.userId === currentUser._id);

    return { count: likes.length, isLiked };
  },
});
