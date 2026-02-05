import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { mealType } from './schema';

/**
 * Get all meal plan entries for a given date, joined with recipe data.
 */
export const getEntriesForDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) return [];

    const entries = await ctx.db
      .query('mealPlanEntries')
      .withIndex('by_user_date', (q) =>
        q.eq('userId', user._id).eq('date', args.date)
      )
      .collect();

    const enriched = await Promise.all(
      entries.map(async (entry) => {
        const recipe = await ctx.db.get(entry.recipeId);
        if (!recipe) return null;

        return {
          _id: entry._id,
          mealType: entry.mealType,
          sortOrder: entry.sortOrder,
          recipe: {
            _id: recipe._id,
            title: recipe.title,
            imageUrl: recipe.imageUrl,
            cuisine: recipe.cuisine,
            totalTimeMinutes: recipe.totalTimeMinutes,
            difficulty: recipe.difficulty,
          },
        };
      })
    );

    return enriched.filter((e) => e !== null);
  },
});

/**
 * Add a recipe to a meal slot on a given date.
 */
export const addEntry = mutation({
  args: {
    date: v.string(),
    mealType: mealType,
    recipeId: v.id('recipes'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) throw new Error('User not found');

    // Compute next sortOrder for this meal slot
    const existing = await ctx.db
      .query('mealPlanEntries')
      .withIndex('by_user_date_meal', (q) =>
        q
          .eq('userId', user._id)
          .eq('date', args.date)
          .eq('mealType', args.mealType)
      )
      .collect();

    const maxOrder = existing.reduce(
      (max, e) => Math.max(max, e.sortOrder),
      -1
    );

    return ctx.db.insert('mealPlanEntries', {
      userId: user._id,
      date: args.date,
      mealType: args.mealType,
      recipeId: args.recipeId,
      sortOrder: maxOrder + 1,
      addedAt: Date.now(),
    });
  },
});

/**
 * Remove a meal plan entry with ownership check.
 */
export const removeEntry = mutation({
  args: { entryId: v.id('mealPlanEntries') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) throw new Error('User not found');

    const entry = await ctx.db.get(args.entryId);
    if (!entry) throw new Error('Entry not found');

    if (entry.userId !== user._id) {
      throw new Error('Not authorized to delete this entry');
    }

    await ctx.db.delete(args.entryId);
  },
});
