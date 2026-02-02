export type OnboardingData = {
  goals: string[];
  dietaryRestrictions: string[];
  ingredientDislikes: string[];
  firstRecipeUrl: string | null;
};

export type GoalOption = {
  id: string;
  emoji: string;
  title: string;
  description: string;
};
