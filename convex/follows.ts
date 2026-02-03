import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

/**
 * Follow a user. No-op if already following. Prevents self-follow.
 */
export const follow = mutation({
  args: { followingId: v.id('users') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const currentUser = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!currentUser) throw new Error('User not found');

    // Prevent self-follow
    if (currentUser._id === args.followingId) {
      return { success: false, reason: 'Cannot follow yourself' };
    }

    // Check if already following
    const existing = await ctx.db
      .query('follows')
      .withIndex('by_follower_following', (q) =>
        q.eq('followerId', currentUser._id).eq('followingId', args.followingId)
      )
      .unique();

    if (existing) {
      return { success: true, alreadyFollowing: true };
    }

    await ctx.db.insert('follows', {
      followerId: currentUser._id,
      followingId: args.followingId,
      createdAt: Date.now(),
    });

    return { success: true, alreadyFollowing: false };
  },
});

/**
 * Unfollow a user. No-op if not following.
 */
export const unfollow = mutation({
  args: { followingId: v.id('users') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const currentUser = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!currentUser) throw new Error('User not found');

    const existing = await ctx.db
      .query('follows')
      .withIndex('by_follower_following', (q) =>
        q.eq('followerId', currentUser._id).eq('followingId', args.followingId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { success: true, wasFollowing: true };
    }

    return { success: true, wasFollowing: false };
  },
});

/**
 * Check if current user follows a specific user.
 */
export const isFollowing = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;

    const currentUser = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!currentUser) return false;

    const existing = await ctx.db
      .query('follows')
      .withIndex('by_follower_following', (q) =>
        q.eq('followerId', currentUser._id).eq('followingId', args.userId)
      )
      .unique();

    return existing !== null;
  },
});

/**
 * Get follower and following counts for a user.
 */
export const stats = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const followers = await ctx.db
      .query('follows')
      .withIndex('by_following', (q) => q.eq('followingId', args.userId))
      .collect();

    const following = await ctx.db
      .query('follows')
      .withIndex('by_follower', (q) => q.eq('followerId', args.userId))
      .collect();

    return {
      followerCount: followers.length,
      followingCount: following.length,
    };
  },
});

/**
 * Get list of users who follow a specific user.
 */
export const listFollowers = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const follows = await ctx.db
      .query('follows')
      .withIndex('by_following', (q) => q.eq('followingId', args.userId))
      .collect();

    const users = await Promise.all(
      follows.map(async (follow) => {
        const user = await ctx.db.get(follow.followerId);
        return user;
      })
    );

    return users.filter((user): user is NonNullable<typeof user> => user !== null);
  },
});

/**
 * Get list of users that a specific user follows.
 */
export const listFollowing = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const follows = await ctx.db
      .query('follows')
      .withIndex('by_follower', (q) => q.eq('followerId', args.userId))
      .collect();

    const users = await Promise.all(
      follows.map(async (follow) => {
        const user = await ctx.db.get(follow.followingId);
        return user;
      })
    );

    return users.filter((user): user is NonNullable<typeof user> => user !== null);
  },
});
