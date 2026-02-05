import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * Meal type enum values.
 */
export const mealType = v.union(
  v.literal('breakfast'),
  v.literal('lunch'),
  v.literal('dinner'),
  v.literal('snack')
);

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
    difficulty: v.optional(v.union(v.string(), v.number())),
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

  /**
   * Pre-populated recipes for the discover feed.
   * These are fetched from TheMealDB and enriched via OpenAI.
   */
  discoverRecipes: defineTable({
    // Unique identifier from source (e.g., TheMealDB ID or URL hash)
    sourceId: v.string(),
    sourceUrl: v.string(),

    // Core identification
    title: v.string(),
    description: v.optional(v.string()),
    cuisine: v.optional(v.string()),
    difficulty: v.optional(v.union(v.string(), v.number())),
    imageUrl: v.optional(v.string()),

    // Servings and timing
    servings: v.optional(v.number()),
    prepTimeMinutes: v.optional(v.number()),
    cookTimeMinutes: v.optional(v.number()),
    totalTimeMinutes: v.optional(v.number()),

    // Nutrition
    calories: v.optional(v.number()),
    proteinGrams: v.optional(v.number()),
    carbsGrams: v.optional(v.number()),
    fatGrams: v.optional(v.number()),

    // Tags and metadata
    dietaryTags: v.optional(v.array(v.string())),
    keywords: v.optional(v.array(v.string())),
    equipment: v.optional(v.array(v.string())),

    // Creator information
    creatorName: v.optional(v.string()),
    creatorProfileUrl: v.optional(v.string()),

    // Recipe content
    ingredients: v.array(ingredientSchema),
    instructions: v.array(instructionSchema),

    // Metadata
    createdAt: v.number(),
    isActive: v.boolean(), // Can be disabled if recipe is problematic
  })
    .index('by_source_id', ['sourceId'])
    .index('by_active', ['isActive'])
    .index('by_created', ['createdAt']),

  /**
   * Tracks which discover recipes a user has viewed (swiped on).
   * Used to avoid showing the same recipe twice.
   */
  userViewedRecipes: defineTable({
    userId: v.id('users'),
    discoverRecipeId: v.id('discoverRecipes'),
    viewedAt: v.number(),
    action: v.union(v.literal('skipped'), v.literal('saved')),
  })
    .index('by_user', ['userId'])
    .index('by_user_recipe', ['userId', 'discoverRecipeId']),

  /**
   * User posts - when a user shares that they cooked a recipe.
   * Stores only the recipe ID reference, not redundant recipe data.
   */
  posts: defineTable({
    userId: v.id('users'),
    recipeId: v.id('recipes'),
    // 3 rating dimensions (1-5 stars each)
    easeRating: v.number(), // How easy was it to cook?
    tasteRating: v.number(), // How tasty was it?
    presentationRating: v.number(), // How did it look?
    // Optional user notes
    notes: v.optional(v.string()),
    // Timestamps
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_recipe', ['recipeId'])
    .index('by_created', ['createdAt']),

  /**
   * Likes on posts.
   */
  postLikes: defineTable({
    postId: v.id('posts'),
    userId: v.id('users'),
    createdAt: v.number(),
  })
    .index('by_post', ['postId'])
    .index('by_user', ['userId'])
    .index('by_post_user', ['postId', 'userId']),

  /**
   * Comments on posts.
   */
  postComments: defineTable({
    postId: v.id('posts'),
    userId: v.id('users'),
    text: v.string(),
    createdAt: v.number(),
  })
    .index('by_post', ['postId'])
    .index('by_user', ['userId']),

  /**
   * Saved/bookmarked posts.
   */
  savedPosts: defineTable({
    postId: v.id('posts'),
    userId: v.id('users'),
    savedAt: v.number(),
  })
    .index('by_post', ['postId'])
    .index('by_user', ['userId'])
    .index('by_post_user', ['postId', 'userId']),

  /**
   * Meal plan entries — recipes assigned to specific days and meal types.
   */
  mealPlanEntries: defineTable({
    userId: v.id('users'),
    date: v.string(), // "YYYY-MM-DD"
    mealType: mealType,
    recipeId: v.id('recipes'),
    sortOrder: v.number(),
    addedAt: v.number(),
  })
    .index('by_user_date', ['userId', 'date'])
    .index('by_user_date_meal', ['userId', 'date', 'mealType']),
});
