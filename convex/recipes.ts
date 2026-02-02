import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

/**
 * Save a recipe URL for the authenticated user.
 */
export const save = mutation({
  args: {
    url: v.string(),
    title: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) throw new Error('User not found');

    return ctx.db.insert('recipes', {
      userId: user._id,
      url: args.url,
      title: args.title,
      source: args.source,
      createdAt: Date.now(),
    });
  },
});

/**
 * List all recipes for the authenticated user, newest first.
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

    return ctx.db
      .query('recipes')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .order('desc')
      .collect();
  },
});
