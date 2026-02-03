import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

/**
 * Generate an upload URL for Convex storage.
 * Used for profile image uploads.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Update user profile (name and optional image).
 * Called from the profile-setup onboarding screen.
 */
export const updateProfile = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    username: v.string(),
    storageId: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) throw new Error('User not found');

    // Check username availability (excluding current user)
    const usernameNormalized = args.username.toLowerCase().replace(/^@/, '');
    const existingUsername = await ctx.db
      .query('users')
      .withIndex('by_username', (q) => q.eq('username', usernameNormalized))
      .unique();

    if (existingUsername && existingUsername._id !== user._id) {
      throw new Error('Username is already taken');
    }

    let imageUrl: string | undefined;
    if (args.storageId) {
      imageUrl = await ctx.storage.getUrl(args.storageId) ?? undefined;
    }

    await ctx.db.patch(user._id, {
      firstName: args.firstName,
      lastName: args.lastName,
      username: usernameNormalized,
      ...(imageUrl ? { imageUrl } : {}),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Check if a username is available.
 */
export const checkUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { available: false };

    const usernameNormalized = args.username.toLowerCase().replace(/^@/, '');
    if (usernameNormalized.length < 3) return { available: false };

    const existing = await ctx.db
      .query('users')
      .withIndex('by_username', (q) => q.eq('username', usernameNormalized))
      .unique();

    // Available if no one has it, or if current user owns it
    const currentUser = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    const isOwn = existing && currentUser && existing._id === currentUser._id;
    return { available: !existing || isOwn };
  },
});

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
 * firstName/lastName default to empty strings - will be set during profile-setup onboarding.
 */
export const createOrGet = mutation({
  args: {
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
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
      firstName: args.firstName ?? '',
      lastName: args.lastName ?? '',
      username: '',
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
