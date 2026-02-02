/**
 * Matches the preference fields on the Convex `users` table.
 * Used to type onboarding params and the future profile editor.
 */
export type UserPreferences = {
  goals: string[];
  dietaryRestrictions: string[];
  ingredientDislikes: string[];
};

export type GoalOption = {
  id: string;
  emoji: string;
  title: string;
  description: string;
};
