import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

/**
 * List all cookbooks for the authenticated user.
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
      .query('cookbooks')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();
  },
});

/**
 * Create a new cookbook for the authenticated user.
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    coverImageStorageId: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) throw new Error('User not found');

    let coverImageUrl: string | undefined;
    if (args.coverImageStorageId) {
      const url = await ctx.storage.getUrl(args.coverImageStorageId);
      if (url) {
        coverImageUrl = url;
      }
    }

    const now = Date.now();
    return ctx.db.insert('cookbooks', {
      userId: user._id,
      name: args.name,
      description: args.description,
      coverImageUrl,
      createdAt: now,
      updatedAt: now,
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

    return cookbook;
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

    await ctx.db.delete(args.cookbookId);
  },
});
