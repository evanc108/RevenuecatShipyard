import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

/**
 * Add a comment to a post.
 */
export const add = mutation({
  args: {
    postId: v.id('posts'),
    text: v.string(),
  },
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

    // Validate comment text
    const trimmedText = args.text.trim();
    if (trimmedText.length === 0) {
      throw new Error('Comment cannot be empty');
    }
    if (trimmedText.length > 500) {
      throw new Error('Comment must be 500 characters or less');
    }

    const commentId = await ctx.db.insert('postComments', {
      postId: args.postId,
      userId: currentUser._id,
      text: trimmedText,
      createdAt: Date.now(),
    });

    return { commentId };
  },
});

/**
 * Get comments for a post with user data.
 */
export const list = query({
  args: { postId: v.id('posts') },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query('postComments')
      .withIndex('by_post', (q) => q.eq('postId', args.postId))
      .collect();

    // Sort by creation time (oldest first for natural conversation flow)
    const sortedComments = comments.sort((a, b) => a.createdAt - b.createdAt);

    // Join with user data
    const commentsWithUsers = await Promise.all(
      sortedComments.map(async (comment) => {
        const user = await ctx.db.get(comment.userId);
        return {
          _id: comment._id,
          text: comment.text,
          createdAt: comment.createdAt,
          user: user
            ? {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                imageUrl: user.imageUrl,
              }
            : null,
        };
      })
    );

    // Filter out comments where user was deleted
    return commentsWithUsers.filter((comment) => comment.user !== null);
  },
});

/**
 * Delete a comment (owner only).
 */
export const remove = mutation({
  args: { commentId: v.id('postComments') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const currentUser = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!currentUser) throw new Error('User not found');

    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error('Comment not found');

    if (comment.userId !== currentUser._id) {
      throw new Error('You can only delete your own comments');
    }

    await ctx.db.delete(args.commentId);
    return { success: true };
  },
});

/**
 * Get comment count for a post.
 */
export const count = query({
  args: { postId: v.id('posts') },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query('postComments')
      .withIndex('by_post', (q) => q.eq('postId', args.postId))
      .collect();

    return comments.length;
  },
});
