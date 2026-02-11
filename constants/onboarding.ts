import type { GoalOption } from '@/types/onboarding';

export const ONBOARDING_COPY = {
  welcome: {
    headline: 'Welcome to\nNom',
    subhead: 'Save & cook your favorite recipes from anywhere',
    signInPrompt: 'Already have an account? ',
    signInCta: 'Sign in',
  },
  info: {
    headline: 'Your recipes,\nall in one place',
    features: [
      'Save recipes from any app or website',
      'Plan meals for the week',
      'Get step-by-step cooking guidance',
    ],
  },
  auth: {
    signUpHeadline: 'Create your\naccount',
    signInHeadline: 'Welcome\nback',
    signInSubhead: 'Sign in to pick up where you left off',
    appleCta: 'Continue with Apple',
    googleCta: 'Continue with Google',
    dividerText: 'or',
    emailPlaceholder: 'Email address',
    passwordPlaceholder: 'Password',
    passwordHint: 'min 8 characters',
    signUpCta: 'Continue',
    signInCta: 'Sign In',
    forgotPassword: 'Forgot password?',
    signInTogglePrompt: 'Already have an account? ',
    signInToggleCta: 'Sign in',
    signUpTogglePrompt: "Don't have an account? ",
    signUpToggleCta: 'Sign up',
    legalPrefix: 'By continuing, you agree to our ',
    terms: 'Terms of Service',
    and: ' and ',
    privacy: 'Privacy Policy',
    verifyHeadline: 'Verify your\nemail',
    verifySubhead: 'Enter the code sent to',
    codePlaceholder: 'Verification code',
    verifyCta: 'Verify',
    resend: "Didn't get a code? Resend",
    resendSuccess: 'Code sent!',
    backToSignUp: 'Back',
    errorFallback: 'Something went wrong. Please try again.',
  },
  profileSetup: {
    headline: 'Set up your\nprofile',
    subhead: 'Add your name, username, and an optional photo',
    firstNamePlaceholder: 'First name',
    lastNamePlaceholder: 'Last name',
    usernamePlaceholder: '@username',
    addPhoto: 'Add photo',
    changePhoto: 'Change photo',
  },
  goals: {
    headline: 'What brings you\nto Nom?',
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
  terms: {
    title: 'Terms of Service',
  },
  privacy: {
    title: 'Privacy Policy',
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
