import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

/**
 * Pantry item category type for validation.
 */
export const pantryCategory = v.union(
  v.literal('produce'),
  v.literal('dairy'),
  v.literal('meat'),
  v.literal('pantry'),
  v.literal('spice'),
  v.literal('frozen'),
  v.literal('other')
);

/**
 * Get all pantry items for the current user.
 */
export const getItems = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) return [];

    const items = await ctx.db
      .query('pantryItems')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();

    return items;
  },
});

/**
 * Get pantry items grouped by category.
 */
export const getItemsByCategory = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return {};

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) return {};

    const items = await ctx.db
      .query('pantryItems')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();

    const grouped: Record<string, typeof items> = {};
    for (const item of items) {
      const category = item.category ?? 'other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(item);
    }

    return grouped;
  },
});

/**
 * Add a single pantry item.
 */
export const addItem = mutation({
  args: {
    name: v.string(),
    category: v.optional(pantryCategory),
    quantity: v.optional(v.number()),
    unit: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) throw new Error('User not found');

    const normalizedName = args.name.toLowerCase().trim();

    return ctx.db.insert('pantryItems', {
      userId: user._id,
      name: args.name.trim(),
      normalizedName,
      category: args.category,
      quantity: args.quantity,
      unit: args.unit,
      addedAt: Date.now(),
    });
  },
});

/**
 * Add multiple pantry items at once.
 */
export const addItems = mutation({
  args: {
    items: v.array(
      v.object({
        name: v.string(),
        category: v.optional(pantryCategory),
        quantity: v.optional(v.number()),
        unit: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) throw new Error('User not found');

    const insertedIds = await Promise.all(
      args.items.map((item) =>
        ctx.db.insert('pantryItems', {
          userId: user._id,
          name: item.name.trim(),
          normalizedName: item.name.toLowerCase().trim(),
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          addedAt: Date.now(),
        })
      )
    );

    return insertedIds;
  },
});

/**
 * Update a pantry item.
 */
export const updateItem = mutation({
  args: {
    itemId: v.id('pantryItems'),
    name: v.optional(v.string()),
    category: v.optional(pantryCategory),
    quantity: v.optional(v.number()),
    unit: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) throw new Error('User not found');

    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error('Item not found');

    if (item.userId !== user._id) {
      throw new Error('Not authorized to update this item');
    }

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) {
      updates.name = args.name.trim();
      updates.normalizedName = args.name.toLowerCase().trim();
    }
    if (args.category !== undefined) {
      updates.category = args.category;
    }
    if (args.quantity !== undefined) {
      updates.quantity = args.quantity;
    }
    if (args.unit !== undefined) {
      updates.unit = args.unit;
    }

    await ctx.db.patch(args.itemId, updates);
  },
});

/**
 * Remove a pantry item.
 */
export const removeItem = mutation({
  args: { itemId: v.id('pantryItems') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) throw new Error('User not found');

    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error('Item not found');

    if (item.userId !== user._id) {
      throw new Error('Not authorized to delete this item');
    }

    await ctx.db.delete(args.itemId);
  },
});

/**
 * Clear all pantry items for the current user.
 */
export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) throw new Error('User not found');

    const items = await ctx.db
      .query('pantryItems')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();

    await Promise.all(items.map((item) => ctx.db.delete(item._id)));

    return items.length;
  },
});
