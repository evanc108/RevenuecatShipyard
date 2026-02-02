import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

/**
 * Get the current authenticated user's record.
 * Returns null if not authenticated or user not yet created.
 */
export const current = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();
  },
});

/**
 * Create a user record if one doesn't exist for the authenticated Clerk user.
 * Returns the user's Convex ID (existing or newly created).
 */
export const createOrGet = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const existing = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (existing) return existing._id;

    const now = Date.now();
    return ctx.db.insert('users', {
      clerkId: identity.subject,
      email: args.email,
      name: args.name,
      imageUrl: args.imageUrl,
      hasCompletedOnboarding: false,
      goals: [],
      dietaryRestrictions: [],
      ingredientDislikes: [],
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Save onboarding preferences and mark onboarding as complete.
 * Called from the final onboarding screen.
 */
export const completeOnboarding = mutation({
  args: {
    goals: v.array(v.string()),
    dietaryRestrictions: v.array(v.string()),
    ingredientDislikes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) throw new Error('User not found');

    await ctx.db.patch(user._id, {
      hasCompletedOnboarding: true,
      goals: args.goals,
      dietaryRestrictions: args.dietaryRestrictions,
      ingredientDislikes: args.ingredientDislikes,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Update user preferences. All fields are optional — only provided
 * fields are updated. Used from the profile/settings screen.
 */
export const updatePreferences = mutation({
  args: {
    goals: v.optional(v.array(v.string())),
    dietaryRestrictions: v.optional(v.array(v.string())),
    ingredientDislikes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) throw new Error('User not found');

    await ctx.db.patch(user._id, {
      ...(args.goals !== undefined ? { goals: args.goals } : {}),
      ...(args.dietaryRestrictions !== undefined
        ? { dietaryRestrictions: args.dietaryRestrictions }
        : {}),
      ...(args.ingredientDislikes !== undefined
        ? { ingredientDislikes: args.ingredientDislikes }
        : {}),
      updatedAt: Date.now(),
    });
  },
});
