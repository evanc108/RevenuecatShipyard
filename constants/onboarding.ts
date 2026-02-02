import type { GoalOption } from '@/types/onboarding';

export const ONBOARDING_COPY = {
  welcome: {
    headline: 'Welcome to\nRecipeFlow!',
  },
  info: {
    headline: "Don't Let Your\nRecipes Collect Dust",
    subhead: 'Save recipes from TikTok, Instagram & YouTube in one tap',
  },
  signUp: {
    headline: 'Create your\naccount!',
    subhead: 'Save recipes across devices and share with friends',
    appleCta: 'Continue with Apple',
    googleCta: 'Continue with Google',
    legalPrefix: 'By continuing, you agree to our ',
    terms: 'Terms',
    and: ' and ',
    privacy: 'Privacy Policy',
    signInPrompt: 'Already have an account? ',
    signInCta: 'Sign in',
    dividerText: 'or',
    emailCta: 'Continue with email',
    emailPlaceholder: 'Email address',
    sendCode: 'Send verification code',
    backToOptions: 'All sign up options',
    verifyHeadline: 'Verify your\nemail',
    verifySubtitle: 'Enter the code sent to',
    codePlaceholder: 'Verification code',
    verify: 'Verify',
    resend: "Didn't receive a code? Resend",
    errorFallback: 'Something went wrong. Please try again.',
  },
  goals: {
    headline: 'What brings you to\nRecipeFlow?',
    subhead: 'This helps us personalize your experience',
    skip: 'Skip',
  },
  dietary: {
    headline: 'Any dietary\npreferences?',
    subhead: "We'll flag ingredients and suggest alternatives",
    restrictionsLabel: 'Restrictions',
    dislikesLabel: 'Ingredients to avoid',
    dislikesPlaceholder: 'Search ingredients...',
    skip: 'Skip',
  },
  firstRecipe: {
    headline: "You're all set!",
    subhead: 'Add your first recipe from TikTok, Instagram, or YouTube',
    inputPlaceholder: 'Paste recipe link...',
    orText: 'or',
    shareTitle: 'Share from app',
    shareDescription:
      'Open TikTok or Instagram and share a recipe to RecipeFlow',
    skip: 'Skip for now',
    start: 'Start',
    errorTitle: 'Oops',
    errorMessage: 'Something went wrong saving your preferences. Please try again.',
  },
} as const;

export const GOALS: GoalOption[] = [
  {
    id: 'learn',
    emoji: '\u{1F373}',
    title: 'Learn to cook',
    description: 'Build skills with guided recipes',
  },
  {
    id: 'save',
    emoji: '\u{1F4F1}',
    title: 'Save recipes I find',
    description: 'Stop losing TikToks and Reels I want to make',
  },
  {
    id: 'health',
    emoji: '\u{1F957}',
    title: 'Eat healthier',
    description: 'Track nutrition and cook more at home',
  },
  {
    id: 'social',
    emoji: '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}',
    title: 'Cook for family & friends',
    description: 'Impress loved ones with new dishes',
  },
];

export const DIETARY_RESTRICTIONS = [
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Dairy-Free',
  'Nut-Free',
  'Keto',
  'Paleo',
  'Halal',
  'Kosher',
  'Pescatarian',
  'Low-Carb',
  'Shellfish-Free',
] as const;
