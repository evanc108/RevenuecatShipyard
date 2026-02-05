import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';

/**
 * Get the grocery list for the current user.
 * Calculates adjusted quantities by subtracting pantry amounts.
 */
export const getList = query({
  args: {
    includeChecked: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) return [];

    const items = await ctx.db
      .query('groceryItems')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();

    // Filter out checked items if not requested
    const filteredItems = args.includeChecked
      ? items
      : items.filter((item) => !item.isChecked);

    // Get pantry items for deduction
    const pantryItems = await ctx.db
      .query('pantryItems')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();

    // Build a map of pantry items by normalized name
    const pantryMap = new Map<string, { quantity: number; unit: string }>();
    for (const pantryItem of pantryItems) {
      if (pantryItem.quantity !== undefined && pantryItem.unit !== undefined) {
        pantryMap.set(pantryItem.normalizedName, {
          quantity: pantryItem.quantity,
          unit: pantryItem.unit,
        });
      }
    }

    // Calculate adjusted quantities
    const enrichedItems = filteredItems.map((item) => {
      const pantryItem = pantryMap.get(item.normalizedName);
      let adjustedQuantity = item.totalQuantity;
      let pantryQuantity: number | undefined;
      let pantryUnit: string | undefined;

      // Only deduct if units match (simple comparison for now)
      if (pantryItem && pantryItem.unit.toLowerCase() === item.unit.toLowerCase()) {
        pantryQuantity = pantryItem.quantity;
        pantryUnit = pantryItem.unit;
        adjustedQuantity = Math.max(0, item.totalQuantity - pantryItem.quantity);
      }

      return {
        ...item,
        adjustedQuantity,
        pantryQuantity,
        pantryUnit,
        effectiveQuantity: item.userQuantityOverride ?? adjustedQuantity,
      };
    });

    // Sort by category, then by name
    return enrichedItems.sort((a, b) => {
      const catA = a.category ?? 'other';
      const catB = b.category ?? 'other';
      if (catA !== catB) return catA.localeCompare(catB);
      return a.name.localeCompare(b.name);
    });
  },
});

/**
 * Get count of unchecked grocery items (for badge display).
 */
export const getCount = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) return 0;

    const items = await ctx.db
      .query('groceryItems')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();

    return items.filter((item) => !item.isChecked).length;
  },
});

/**
 * Add ingredients from a recipe to the grocery list.
 * Aggregates with existing items by normalizedName.
 */
export const addFromRecipe = mutation({
  args: {
    recipeId: v.id('recipes'),
    servingsMultiplier: v.optional(v.number()),
    mealPlanEntryId: v.optional(v.id('mealPlanEntries')),
    scheduledDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) throw new Error('User not found');

    const recipe = await ctx.db.get(args.recipeId);
    if (!recipe) throw new Error('Recipe not found');

    const multiplier = args.servingsMultiplier ?? 1;
    const now = Date.now();
    let addedCount = 0;
    let updatedCount = 0;

    for (const ingredient of recipe.ingredients) {
      // Skip optional ingredients
      if (ingredient.optional) continue;

      const scaledQuantity = ingredient.quantity * multiplier;
      const source = {
        recipeId: args.recipeId,
        recipeName: recipe.title,
        quantity: scaledQuantity,
        unit: ingredient.unit,
        servingsMultiplier: multiplier,
        mealPlanEntryId: args.mealPlanEntryId,
        scheduledDate: args.scheduledDate,
      };

      // Check if item already exists
      const existingItem = await ctx.db
        .query('groceryItems')
        .withIndex('by_user_normalized', (q) =>
          q.eq('userId', user._id).eq('normalizedName', ingredient.normalizedName)
        )
        .unique();

      if (existingItem) {
        // Check if this exact source already exists (same recipe + meal plan entry)
        const sourceExists = existingItem.sources.some(
          (s) =>
            s.recipeId === args.recipeId &&
            s.mealPlanEntryId === args.mealPlanEntryId
        );

        if (!sourceExists) {
          // Add new source and update total
          const newSources = [...existingItem.sources, source];
          const newTotal = newSources.reduce((sum, s) => sum + s.quantity, 0);

          await ctx.db.patch(existingItem._id, {
            sources: newSources,
            totalQuantity: newTotal,
            updatedAt: now,
          });
          updatedCount++;
        }
      } else {
        // Create new item
        await ctx.db.insert('groceryItems', {
          userId: user._id,
          name: ingredient.name,
          normalizedName: ingredient.normalizedName,
          category: ingredient.category,
          totalQuantity: scaledQuantity,
          unit: ingredient.unit,
          sources: [source],
          isChecked: false,
          addedAt: now,
          updatedAt: now,
        });
        addedCount++;
      }
    }

    return { added: addedCount, updated: updatedCount };
  },
});

/**
 * Update a grocery item (quantity, checked status).
 */
export const updateItem = mutation({
  args: {
    itemId: v.id('groceryItems'),
    userQuantityOverride: v.optional(v.number()),
    isChecked: v.optional(v.boolean()),
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

    const updates: Partial<Doc<'groceryItems'>> = {
      updatedAt: Date.now(),
    };

    if (args.userQuantityOverride !== undefined) {
      updates.userQuantityOverride = args.userQuantityOverride;
    }
    if (args.isChecked !== undefined) {
      updates.isChecked = args.isChecked;
    }

    await ctx.db.patch(args.itemId, updates);
  },
});

/**
 * Remove a grocery item.
 */
export const removeItem = mutation({
  args: { itemId: v.id('groceryItems') },
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
 * Remove ingredients from a specific recipe source.
 * If no sources remain, deletes the item entirely.
 */
export const removeRecipeSource = mutation({
  args: {
    recipeId: v.id('recipes'),
    mealPlanEntryId: v.optional(v.id('mealPlanEntries')),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) throw new Error('User not found');

    const items = await ctx.db
      .query('groceryItems')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();

    let removedCount = 0;
    let updatedCount = 0;

    for (const item of items) {
      const matchingSources = item.sources.filter(
        (s) =>
          s.recipeId === args.recipeId &&
          (args.mealPlanEntryId === undefined ||
            s.mealPlanEntryId === args.mealPlanEntryId)
      );

      if (matchingSources.length > 0) {
        const remainingSources = item.sources.filter(
          (s) =>
            s.recipeId !== args.recipeId ||
            (args.mealPlanEntryId !== undefined &&
              s.mealPlanEntryId !== args.mealPlanEntryId)
        );

        if (remainingSources.length === 0) {
          await ctx.db.delete(item._id);
          removedCount++;
        } else {
          const newTotal = remainingSources.reduce((sum, s) => sum + s.quantity, 0);
          await ctx.db.patch(item._id, {
            sources: remainingSources,
            totalQuantity: newTotal,
            updatedAt: Date.now(),
          });
          updatedCount++;
        }
      }
    }

    return { removed: removedCount, updated: updatedCount };
  },
});

/**
 * Clear all grocery items for the current user.
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
      .query('groceryItems')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();

    await Promise.all(items.map((item) => ctx.db.delete(item._id)));

    return items.length;
  },
});

/**
 * Update Amazon Fresh URL for a grocery item.
 */
export const updateAmazonUrl = mutation({
  args: {
    itemId: v.id('groceryItems'),
    amazonFreshUrl: v.string(),
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

    await ctx.db.patch(args.itemId, {
      amazonFreshUrl: args.amazonFreshUrl,
      updatedAt: Date.now(),
    });
  },
});
