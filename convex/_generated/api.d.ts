/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as cookbooks from "../cookbooks.js";
import type * as discover from "../discover.js";
import type * as discoverFeed from "../discoverFeed.js";
import type * as discoverFeedActions from "../discoverFeedActions.js";
import type * as follows from "../follows.js";
import type * as postComments from "../postComments.js";
import type * as postLikes from "../postLikes.js";
import type * as posts from "../posts.js";
import type * as recipes from "../recipes.js";
import type * as savedPosts from "../savedPosts.js";
import type * as savedRecipes from "../savedRecipes.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  cookbooks: typeof cookbooks;
  discover: typeof discover;
  discoverFeed: typeof discoverFeed;
  discoverFeedActions: typeof discoverFeedActions;
  follows: typeof follows;
  postComments: typeof postComments;
  postLikes: typeof postLikes;
  posts: typeof posts;
  recipes: typeof recipes;
  savedPosts: typeof savedPosts;
  savedRecipes: typeof savedRecipes;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
