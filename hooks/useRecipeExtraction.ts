/**
 * Hook for extracting recipes from video URLs.
 *
 * Calls the Python backend for extraction with SSE progress tracking,
 * then saves to Convex.
 */

import { useCallback, useRef, useState } from 'react';
import { useConvex, useMutation, useQuery } from 'convex/react';
// @ts-expect-error - react-native-sse lacks type declarations
import EventSource from 'react-native-sse';

import { api } from '@/convex/_generated/api';
import type {
  ExtractionMethod,
  Ingredient,
  Instruction,
  Recipe,
} from '@/types/recipe';

/** SSE message event shape */
type SSEMessageEvent = {
  type: string;
  data: string | null;
};

/** Backend API base URL */
const API_BASE_URL = process.env.EXPO_PUBLIC_EXTRACTION_API_URL ?? 'http://localhost:8000';

type ExtractionStatus = 'idle' | 'checking' | 'extracting' | 'saving' | 'complete' | 'error';

type ProgressInfo = {
  message: string;
  percent: number;
  tier: string | null;
};

type UseRecipeExtractionResult = {
  /** Submit a URL for extraction (checks for existing first) */
  extractRecipe: (url: string) => Promise<Recipe | null>;
  /** Current status */
  status: ExtractionStatus;
  /** Progress info during extraction */
  progress: ProgressInfo | null;
  /** Error message if failed */
  error: string | null;
  /** Whether the recipe already existed (was deduplicated) */
  wasExisting: boolean;
  /** Cancel ongoing extraction */
  cancel: () => void;
  /** Reset state */
  reset: () => void;
};

/** API response shape from POST endpoint */
type ExtractResponse = {
  success: boolean;
  recipe?: {
    title: string;
    description: string;
    cuisine: string;
    difficulty: string;
    servings: number | null;
    prep_time_minutes: number | null;
    cook_time_minutes: number | null;
    total_time_minutes: number | null;
    calories: number | null;
    protein_grams: number | null;
    carbs_grams: number | null;
    fat_grams: number | null;
    dietary_tags: string[];
    keywords: string[];
    equipment: string[];
    creator_name: string;
    creator_profile_url: string | null;
    ingredients: Array<{
      raw_text: string;
      name: string;
      normalized_name: string;
      quantity: number;
      unit: string;
      preparation: string;
      category: string;
      optional: boolean;
      sort_order: number;
    }>;
    instructions: Array<{
      step_number: number;
      text: string;
      time_seconds: number | null;
      temperature: string | null;
      tip: string | null;
    }>;
    method_used: 'metadata' | 'audio' | 'vision' | 'website';
    source_url: string | null;
    thumbnail_url: string | null;
  };
  error?: string;
  method_used?: string;
};

/** SSE event data shapes */
type SSEProgressEvent = {
  type: 'progress';
  message: string;
  percent: number;
  tier: string | null;
};

type SSECompleteEvent = {
  type: 'complete';
  recipe: ExtractResponse['recipe'];
};

type SSEErrorEvent = {
  type: 'error';
  message: string;
};

/**
 * Hook for extracting recipes from video URLs with SSE progress tracking.
 *
 * @example
 * ```tsx
 * function RecipeImport() {
 *   const { extractRecipe, status, progress, error, cancel } = useRecipeExtraction();
 *
 *   const handleSubmit = async (url: string) => {
 *     const recipe = await extractRecipe(url);
 *     if (recipe) {
 *       // Recipe saved to Convex, navigate to it
 *       router.push(`/recipe/${recipe.id}`);
 *     }
 *   };
 *
 *   return (
 *     <View>
 *       {progress && (
 *         <Text>{progress.message} ({Math.round(progress.percent * 100)}%)</Text>
 *       )}
 *       <Button
 *         onPress={() => handleSubmit(url)}
 *         disabled={status === 'extracting' || status === 'saving'}
 *       >
 *         {status === 'extracting' ? 'Extracting...' :
 *          status === 'saving' ? 'Saving...' : 'Import Recipe'}
 *       </Button>
 *       {status === 'extracting' && (
 *         <Button onPress={cancel}>Cancel</Button>
 *       )}
 *     </View>
 *   );
 * }
 * ```
 */
export function useRecipeExtraction(): UseRecipeExtractionResult {
  const [status, setStatus] = useState<ExtractionStatus>('idle');
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wasExisting, setWasExisting] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const convex = useConvex();
  const currentUser = useQuery(api.users.current);
  const saveRecipe = useMutation(api.recipes.saveExtracted);
  const saveToCollection = useMutation(api.recipes.saveToCollection);

  const cancel = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStatus('idle');
    setProgress(null);
  }, []);

  const extractRecipe = useCallback(
    async (url: string): Promise<Recipe | null> => {
      if (!currentUser) {
        setError('You must be signed in to extract recipes');
        setStatus('error');
        return null;
      }

      // Cancel any existing extraction
      cancel();

      setError(null);
      setProgress(null);
      setWasExisting(false);
      setStatus('checking');

      // Check if recipe already exists
      try {
        const existingRecipe = await convex.query(api.recipes.getByUrl, { url });

        if (existingRecipe) {
          // Recipe already exists - just save to user's collection
          setStatus('saving');
          await saveToCollection({ recipeId: existingRecipe._id });
          setWasExisting(true);
          setStatus('complete');

          const averageRating =
            existingRecipe.ratingCount > 0
              ? existingRecipe.ratingSum / existingRecipe.ratingCount
              : undefined;

          return {
            id: existingRecipe._id,
            title: existingRecipe.title,
            description: existingRecipe.description,
            cuisine: existingRecipe.cuisine,
            difficulty: existingRecipe.difficulty,
            thumbnailUrl: existingRecipe.imageUrl,
            servings: existingRecipe.servings,
            prepTimeMinutes: existingRecipe.prepTimeMinutes,
            cookTimeMinutes: existingRecipe.cookTimeMinutes,
            totalTimeMinutes: existingRecipe.totalTimeMinutes,
            calories: existingRecipe.calories,
            proteinGrams: existingRecipe.proteinGrams,
            carbsGrams: existingRecipe.carbsGrams,
            fatGrams: existingRecipe.fatGrams,
            dietaryTags: existingRecipe.dietaryTags,
            keywords: existingRecipe.keywords,
            equipment: existingRecipe.equipment,
            creatorName: existingRecipe.creatorName,
            creatorProfileUrl: existingRecipe.creatorProfileUrl,
            ingredients: existingRecipe.ingredients.map((i): Ingredient => ({
              rawText: i.rawText,
              name: i.name,
              normalizedName: i.normalizedName,
              quantity: i.quantity,
              unit: i.unit,
              preparation: i.preparation,
              category: i.category,
              optional: i.optional,
              sortOrder: i.sortOrder,
            })),
            instructions: existingRecipe.instructions.map((inst): Instruction => ({
              stepNumber: inst.stepNumber,
              text: inst.text,
              timeSeconds: inst.timeSeconds,
              temperature: inst.temperature,
              tip: inst.tip,
            })),
            methodUsed: existingRecipe.methodUsed as ExtractionMethod,
            sourceUrl: url,
            createdAt: existingRecipe.createdAt,
            averageRating,
          };
        }
      } catch (err) {
        // Continue with extraction if check fails
        console.warn('Failed to check for existing recipe:', err);
      }

      setStatus('extracting');

      return new Promise<Recipe | null>((resolve) => {
        const encodedUrl = encodeURIComponent(url);
        const streamUrl = `${API_BASE_URL}/api/v1/extract/stream?url=${encodedUrl}`;

        const eventSource = new EventSource(streamUrl);
        eventSourceRef.current = eventSource;

        eventSource.addEventListener('progress', (event: SSEMessageEvent) => {
          if (event.data) {
            try {
              const data: SSEProgressEvent = JSON.parse(event.data);
              setProgress({
                message: data.message,
                percent: data.percent,
                tier: data.tier,
              });
            } catch {
              // Ignore parse errors
            }
          }
        });

        eventSource.addEventListener('complete', async (event: SSEMessageEvent) => {
          eventSource.close();
          eventSourceRef.current = null;

          if (!event.data) {
            setError('No recipe data received');
            setStatus('error');
            resolve(null);
            return;
          }

          try {
            const data: SSECompleteEvent = JSON.parse(event.data);
            const apiRecipe = data.recipe;

            if (!apiRecipe) {
              setError('No recipe found');
              setStatus('error');
              resolve(null);
              return;
            }

            setStatus('saving');

            // Save to Convex
            const recipeId = await saveRecipe({
              url,
              title: apiRecipe.title,
              description: apiRecipe.description,
              cuisine: apiRecipe.cuisine,
              difficulty: apiRecipe.difficulty,
              imageUrl: apiRecipe.thumbnail_url ?? undefined,
              servings: apiRecipe.servings ?? undefined,
              prepTimeMinutes: apiRecipe.prep_time_minutes ?? undefined,
              cookTimeMinutes: apiRecipe.cook_time_minutes ?? undefined,
              totalTimeMinutes: apiRecipe.total_time_minutes ?? undefined,
              calories: apiRecipe.calories ?? undefined,
              proteinGrams: apiRecipe.protein_grams ?? undefined,
              carbsGrams: apiRecipe.carbs_grams ?? undefined,
              fatGrams: apiRecipe.fat_grams ?? undefined,
              dietaryTags: apiRecipe.dietary_tags,
              keywords: apiRecipe.keywords,
              equipment: apiRecipe.equipment,
              creatorName: apiRecipe.creator_name,
              creatorProfileUrl: apiRecipe.creator_profile_url ?? undefined,
              ingredients: apiRecipe.ingredients.map((i) => ({
                rawText: i.raw_text,
                name: i.name,
                normalizedName: i.normalized_name,
                quantity: i.quantity,
                unit: i.unit,
                preparation: i.preparation,
                category: i.category,
                optional: i.optional,
                sortOrder: i.sort_order,
              })),
              instructions: apiRecipe.instructions.map((inst) => ({
                stepNumber: inst.step_number,
                text: inst.text,
                timeSeconds: inst.time_seconds ?? undefined,
                temperature: inst.temperature ?? undefined,
                tip: inst.tip ?? undefined,
              })),
              methodUsed: apiRecipe.method_used,
            });

            setStatus('complete');

            // Return the saved recipe
            resolve({
              id: recipeId,
              title: apiRecipe.title,
              description: apiRecipe.description,
              cuisine: apiRecipe.cuisine,
              difficulty: apiRecipe.difficulty,
              thumbnailUrl: apiRecipe.thumbnail_url ?? undefined,
              servings: apiRecipe.servings ?? undefined,
              prepTimeMinutes: apiRecipe.prep_time_minutes ?? undefined,
              cookTimeMinutes: apiRecipe.cook_time_minutes ?? undefined,
              totalTimeMinutes: apiRecipe.total_time_minutes ?? undefined,
              calories: apiRecipe.calories ?? undefined,
              proteinGrams: apiRecipe.protein_grams ?? undefined,
              carbsGrams: apiRecipe.carbs_grams ?? undefined,
              fatGrams: apiRecipe.fat_grams ?? undefined,
              dietaryTags: apiRecipe.dietary_tags,
              keywords: apiRecipe.keywords,
              equipment: apiRecipe.equipment,
              creatorName: apiRecipe.creator_name,
              creatorProfileUrl: apiRecipe.creator_profile_url ?? undefined,
              ingredients: apiRecipe.ingredients.map((i): Ingredient => ({
                rawText: i.raw_text,
                name: i.name,
                normalizedName: i.normalized_name,
                quantity: i.quantity,
                unit: i.unit,
                preparation: i.preparation,
                category: i.category,
                optional: i.optional,
                sortOrder: i.sort_order,
              })),
              instructions: apiRecipe.instructions.map((inst): Instruction => ({
                stepNumber: inst.step_number,
                text: inst.text,
                timeSeconds: inst.time_seconds ?? undefined,
                temperature: inst.temperature ?? undefined,
                tip: inst.tip ?? undefined,
              })),
              methodUsed: apiRecipe.method_used as ExtractionMethod,
              sourceUrl: url,
              createdAt: Date.now(),
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to save recipe';
            setError(message);
            setStatus('error');
            resolve(null);
          }
        });

        eventSource.addEventListener('error', (event: SSEMessageEvent) => {
          eventSource.close();
          eventSourceRef.current = null;

          let message = 'Extraction failed';
          if (event.data) {
            try {
              const data: SSEErrorEvent = JSON.parse(event.data);
              message = data.message;
            } catch {
              // Use default message
            }
          }

          setError(message);
          setStatus('error');
          resolve(null);
        });

        // Handle connection errors
        eventSource.addEventListener('close', () => {
          // Only treat as error if we're still extracting
          if (status === 'extracting') {
            setError('Connection closed unexpectedly');
            setStatus('error');
            resolve(null);
          }
        });
      });
    },
    [currentUser, convex, saveRecipe, saveToCollection, cancel, status]
  );

  const reset = useCallback(() => {
    cancel();
    setStatus('idle');
    setProgress(null);
    setError(null);
    setWasExisting(false);
  }, [cancel]);

  return {
    extractRecipe,
    status,
    progress,
    error,
    wasExisting,
    cancel,
    reset,
  };
}
