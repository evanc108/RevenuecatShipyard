/**
 * Hook for extracting recipes from video URLs.
 *
 * Calls the Python backend for extraction with SSE progress tracking,
 * then saves to Convex.
 */

import { useCallback, useRef, useState } from 'react';
import { useConvex, useMutation, useQuery } from 'convex/react';
import EventSource from 'react-native-sse';

import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import type {
  ExtractionMethod,
  Ingredient,
  Instruction,
  Recipe,
} from '@/types/recipe';

/** SSE event with data field */
type SSEEvent = { data?: string | null };

/** Backend API base URL */
const API_BASE_URL = process.env.EXPO_PUBLIC_EXTRACTION_API_URL ?? 'http://localhost:8000';

/** API key for backend auth */
const API_KEY = process.env.EXPO_PUBLIC_EXTRACTION_API_KEY ?? '';

type ExtractionStatus = 'idle' | 'checking' | 'extracting' | 'saving' | 'complete' | 'error';

type ProgressInfo = {
  message: string;
  percent: number;
  tier: string | null;
};

type UseRecipeExtractionResult = {
  /** Submit a URL for extraction (checks for existing first) */
  extractRecipe: (url: string, cookbookId: Id<'cookbooks'>) => Promise<Recipe | null>;
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
  const addToCookbook = useMutation(api.cookbooks.addRecipe);

  const cancel = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStatus('idle');
    setProgress(null);
  }, []);

  const extractRecipe = useCallback(
    async (url: string, cookbookId: Id<'cookbooks'>): Promise<Recipe | null> => {
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
          // Recipe already exists - just save to user's collection and cookbook
          setStatus('saving');
          await saveToCollection({ recipeId: existingRecipe._id });
          await addToCookbook({ cookbookId, recipeId: existingRecipe._id });
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
      setProgress({ message: 'Connecting...', percent: 0, tier: null });

      return new Promise<Recipe | null>((resolve) => {
        const encodedUrl = encodeURIComponent(url);
        const streamUrl = `${API_BASE_URL}/api/v1/extract/stream?url=${encodedUrl}${API_KEY ? `&key=${API_KEY}` : ''}`;

        const eventSource = new EventSource(streamUrl);
        eventSourceRef.current = eventSource;

        // Track if we received a terminal event (complete or error)
        let receivedTerminalEvent = false;

        // Helper to handle complete event
        const handleComplete = async (eventData: string) => {
          receivedTerminalEvent = true;
          eventSource.close();
          eventSourceRef.current = null;

          try {
            const data: SSECompleteEvent = JSON.parse(eventData);
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

            // Add to cookbook
            await addToCookbook({ cookbookId, recipeId });

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
        };

        // Helper to handle error event
        const handleError = (errorMessage: string) => {
          receivedTerminalEvent = true;
          eventSource.close();
          eventSourceRef.current = null;
          setError(errorMessage);
          setStatus('error');
          resolve(null);
        };

        // Cast to any to work around react-native-sse type limitations
        // The library supports custom event names but types don't reflect this
        const es = eventSource as unknown as {
          addEventListener: (event: string, handler: (e: SSEEvent) => void) => void;
        };

        // Listen for named events (standard SSE)
        es.addEventListener('progress', (event: SSEEvent) => {
          const data = event.data;
          if (data) {
            try {
              const parsed: SSEProgressEvent = JSON.parse(data);
              setProgress({
                message: parsed.message,
                percent: parsed.percent,
                tier: parsed.tier,
              });
            } catch {
              // Ignore parse errors
            }
          }
        });

        es.addEventListener('complete', (event: SSEEvent) => {
          const data = event.data;
          if (data) {
            handleComplete(data);
          } else {
            handleError('No recipe data received');
          }
        });

        es.addEventListener('error', (event: SSEEvent) => {
          let message = 'Extraction failed';
          const data = event.data;
          if (data) {
            try {
              const parsed: SSEErrorEvent = JSON.parse(data);
              message = parsed.message;
            } catch {
              // Use default message
            }
          }
          handleError(message);
        });

        // Also listen for generic 'message' events as fallback
        // Some SSE libraries route all events through 'message'
        es.addEventListener('message', (event: SSEEvent) => {
          const data = event.data;
          if (!data) return;

          try {
            const parsed = JSON.parse(data);

            // Check for event type in the data itself
            if (parsed.type === 'progress') {
              setProgress({
                message: parsed.message,
                percent: parsed.percent,
                tier: parsed.tier,
              });
            } else if (parsed.type === 'complete') {
              handleComplete(data);
            } else if (parsed.type === 'error') {
              handleError(parsed.message || 'Extraction failed');
            }
          } catch {
            // Ignore parse errors
          }
        });

        // Handle connection open
        es.addEventListener('open', () => {
          setProgress({ message: 'Connected, starting extraction...', percent: 0.05, tier: null });
        });

        // Handle connection close
        es.addEventListener('close', () => {
          // Only treat as error if we're still extracting and haven't received a terminal event
          if (eventSourceRef.current && !receivedTerminalEvent) {
            handleError('Connection closed unexpectedly');
          }
        });
      });
    },
    [currentUser, convex, saveRecipe, saveToCollection, addToCookbook, cancel]
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
