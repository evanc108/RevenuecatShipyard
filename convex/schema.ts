import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * Extraction method enum values.
 */
export const extractionMethod = v.union(
  v.literal('metadata'),
  v.literal('audio'),
  v.literal('vision'),
  v.literal('website')
);

/**
 * Ingredient schema for structured recipe data.
 */
export const ingredientSchema = v.object({
  rawText: v.string(),
  name: v.string(),
  normalizedName: v.string(),
  quantity: v.number(),
  unit: v.string(),
  preparation: v.optional(v.string()),
  category: v.optional(v.string()),
  optional: v.optional(v.boolean()),
  sortOrder: v.optional(v.number()),
});

/**
 * Instruction schema for recipe steps.
 */
export const instructionSchema = v.object({
  stepNumber: v.number(),
  text: v.string(),
  timeSeconds: v.optional(v.number()),
  temperature: v.optional(v.string()),
  tip: v.optional(v.string()),
});

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

  /**
   * Shared recipes - one canonical entry per source URL.
   * Users save recipes to their collection via userSavedRecipes.
   */
  recipes: defineTable({
    // Canonical URL for deduplication
    url: v.string(),
    createdAt: v.number(),

    // Core identification
    title: v.string(),
    description: v.optional(v.string()),
    cuisine: v.optional(v.string()),
    difficulty: v.optional(v.string()),
    imageUrl: v.optional(v.string()),

    // Servings and timing
    servings: v.optional(v.number()),
    prepTimeMinutes: v.optional(v.number()),
    cookTimeMinutes: v.optional(v.number()),
    totalTimeMinutes: v.optional(v.number()),

    // Nutrition (optional)
    calories: v.optional(v.number()),
    proteinGrams: v.optional(v.number()),
    carbsGrams: v.optional(v.number()),
    fatGrams: v.optional(v.number()),

    // Tags and metadata
    dietaryTags: v.optional(v.array(v.string())),
    keywords: v.optional(v.array(v.string())),
    equipment: v.optional(v.array(v.string())),

    // Creator information (from source)
    creatorName: v.optional(v.string()),
    creatorProfileUrl: v.optional(v.string()),

    // Recipe content
    ingredients: v.array(ingredientSchema),
    instructions: v.array(instructionSchema),

    // Extraction metadata
    methodUsed: extractionMethod,

    // Denormalized rating stats (updated on rating changes)
    ratingCount: v.number(),
    ratingSum: v.number(),
  })
    .index('by_url', ['url'])
    .searchIndex('search_title', { searchField: 'title' }),

  /**
   * Join table: users who have saved a recipe to their collection.
   */
  userSavedRecipes: defineTable({
    userId: v.id('users'),
    recipeId: v.id('recipes'),
    savedAt: v.number(),
    // Optional user notes/modifications
    notes: v.optional(v.string()),
  })
    .index('by_user', ['userId'])
    .index('by_recipe', ['recipeId'])
    .index('by_user_recipe', ['userId', 'recipeId']),

  /**
   * User ratings for recipes (1-5 stars).
   */
  ratings: defineTable({
    userId: v.id('users'),
    recipeId: v.id('recipes'),
    value: v.number(), // 1-5
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_recipe', ['recipeId'])
    .index('by_user_recipe', ['userId', 'recipeId']),

  follows: defineTable({
    followerId: v.id('users'),
    followingId: v.id('users'),
    createdAt: v.number(),
  })
    .index('by_follower', ['followerId'])
    .index('by_following', ['followingId'])
    .index('by_follower_following', ['followerId', 'followingId']),

  /**
   * User-created cookbooks for organizing recipes.
   */
  cookbooks: defineTable({
    userId: v.id('users'),
    name: v.string(),
    description: v.optional(v.string()),
    coverImageUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),

  /**
   * Join table: recipes within a cookbook.
   */
  cookbookRecipes: defineTable({
    cookbookId: v.id('cookbooks'),
    recipeId: v.id('recipes'),
    addedAt: v.number(),
  })
    .index('by_cookbook', ['cookbookId'])
    .index('by_recipe', ['recipeId'])
    .index('by_cookbook_recipe', ['cookbookId', 'recipeId']),
});
