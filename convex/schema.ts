import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    // Identity (linked to Clerk)
    clerkId: v.string(),
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    username: v.string(),
    imageUrl: v.optional(v.string()),

    // Onboarding status
    hasCompletedOnboarding: v.boolean(),

    // Preferences (set during onboarding, editable in profile)
    goals: v.array(v.string()),
    dietaryRestrictions: v.array(v.string()),
    ingredientDislikes: v.array(v.string()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_clerk_id', ['clerkId'])
    .index('by_username', ['username']),

  recipes: defineTable({
    userId: v.id('users'),
    url: v.string(),
    title: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    source: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_user', ['userId']),

  follows: defineTable({
    followerId: v.id('users'),
    followingId: v.id('users'),
    createdAt: v.number(),
  })
    .index('by_follower', ['followerId'])
    .index('by_following', ['followingId'])
    .index('by_follower_following', ['followerId', 'followingId']),

  cookbooks: defineTable({
    userId: v.id('users'),
    name: v.string(),
    description: v.optional(v.string()),
    coverImageUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),
});
