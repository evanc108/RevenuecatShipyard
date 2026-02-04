/**
 * Recipe extraction types for the Universal Recipe Extractor.
 *
 * These types mirror the backend Pydantic schemas and Convex schema
 * to ensure type safety across the stack.
 */

/**
 * Current state of an extraction job.
 */
export type ExtractionStatus =
  | 'pending'
  | 'scraping'
  | 'transcribing'
  | 'analyzing'
  | 'complete'
  | 'failed';

/**
 * The tier that successfully extracted the recipe.
 */
export type ExtractionMethod = 'metadata' | 'audio' | 'vision' | 'website';

/**
 * A single ingredient with comprehensive structured data.
 */
export type Ingredient = {
  /** Original ingredient text from source */
  rawText: string;
  /** Ingredient name (e.g., "olive oil", "garlic") */
  name: string;
  /** Standardized name for matching (e.g., "olive-oil", "garlic") */
  normalizedName: string;
  /** Numeric quantity */
  quantity: number;
  /** Unit of measurement (e.g., "cups", "tablespoons", "cloves", "") */
  unit: string;
  /** Prep instructions (e.g., "minced", "diced") */
  preparation?: string;
  /** Ingredient category (e.g., "produce", "dairy", "protein") */
  category?: string;
  /** Whether ingredient is optional */
  optional?: boolean;
  /** Display order in ingredients list */
  sortOrder?: number;
};

/**
 * A single cooking instruction step.
 */
export type Instruction = {
  /** Step number (1-indexed) */
  stepNumber: number;
  /** Instruction text */
  text: string;
  /** Duration for this step in seconds */
  timeSeconds?: number;
  /** Temperature if applicable (e.g., "350°F", "180°C") */
  temperature?: string;
  /** Optional tip for this step */
  tip?: string;
};

/**
 * Fully extracted recipe with comprehensive structured data.
 */
export type Recipe = {
  id: string;

  // Core identification
  title: string;
  description?: string;
  cuisine?: string;
  difficulty?: string;
  thumbnailUrl?: string;

  // Servings and timing
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  totalTimeMinutes?: number;

  // Nutrition
  calories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;

  // Tags and metadata
  dietaryTags?: string[];
  keywords?: string[];
  equipment?: string[];

  // Creator information
  creatorName?: string;
  creatorProfileUrl?: string;

  // Recipe content
  ingredients: Ingredient[];
  instructions: Instruction[];

  // Extraction metadata
  methodUsed: ExtractionMethod;
  sourceUrl: string;
  createdAt: number;

  // Rating (computed from all users)
  averageRating?: number;
};

/**
 * Extraction job status from Convex.
 */
export type ExtractionJob = {
  id: string;
  status: ExtractionStatus;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  recipe?: Recipe;
};

/**
 * Request payload for initiating recipe extraction.
 */
export type ExtractionRequest = {
  url: string;
  userId: string;
};

/**
 * Response from the extraction API.
 */
export type ExtractionResponse = {
  job_id: string;
  status: ExtractionStatus;
  message: string;
};

/**
 * Human-readable status messages for the UI.
 */
export const EXTRACTION_STATUS_LABELS: Record<ExtractionStatus, string> = {
  pending: 'Queued',
  scraping: 'Analyzing video...',
  transcribing: 'Transcribing audio...',
  analyzing: 'Processing video frames...',
  complete: 'Complete',
  failed: 'Failed',
};

/**
 * Check if an extraction is still in progress.
 */
export function isExtractionActive(status: ExtractionStatus): boolean {
  return (
    status === 'pending' ||
    status === 'scraping' ||
    status === 'transcribing' ||
    status === 'analyzing'
  );
}

/**
 * Format time in minutes to human-readable string.
 */
export function formatTime(minutes: number | undefined): string {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Get total time for a recipe.
 */
export function getTotalTime(recipe: Pick<Recipe, 'prepTimeMinutes' | 'cookTimeMinutes' | 'totalTimeMinutes'>): number | undefined {
  if (recipe.totalTimeMinutes) return recipe.totalTimeMinutes;
  if (recipe.prepTimeMinutes && recipe.cookTimeMinutes) {
    return recipe.prepTimeMinutes + recipe.cookTimeMinutes;
  }
  return recipe.prepTimeMinutes ?? recipe.cookTimeMinutes;
}
