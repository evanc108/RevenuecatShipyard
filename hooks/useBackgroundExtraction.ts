/**
 * Hook for background recipe extraction from video URLs.
 *
 * Decoupled from modal context - updates usePendingUploadsStore
 * for tracking progress across the app. Supports multiple concurrent
 * extractions.
 */

import { useConvex, useMutation, useQuery } from 'convex/react';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import EventSource from 'react-native-sse';

import { api } from '@/convex/_generated/api';
import { usePendingUploadsStore } from '@/stores/usePendingUploadsStore';

/** SSE event with data field */
type SSEEvent = { data?: string | null };

/** Backend API base URL */
const API_BASE_URL = process.env.EXPO_PUBLIC_EXTRACTION_API_URL ?? 'http://localhost:8000';

/** SSE event data shapes */
type SSEProgressEvent = {
  type: 'progress';
  message: string;
  percent: number;
  tier: string | null;
};

type SSECompleteEvent = {
  type: 'complete';
  recipe: {
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
};

type SSEErrorEvent = {
  type: 'error';
  message: string;
};

type UseBackgroundExtractionResult = {
  /** Start extraction for a URL with an upload ID */
  startExtraction: (uploadId: string) => void;
  /** Cancel extraction for a specific upload */
  cancelExtraction: (uploadId: string) => void;
  /** Cancel all active extractions */
  cancelAll: () => void;
};

/**
 * Background extraction hook that works with the pending uploads store.
 *
 * @example
 * ```tsx
 * function ImportButton() {
 *   const { startExtraction } = useBackgroundExtraction();
 *   const addUpload = usePendingUploadsStore(s => s.addUpload);
 *
 *   const handleImport = () => {
 *     const uploadId = addUpload(url, cookbookId, cookbookName);
 *     startExtraction(uploadId);
 *   };
 * }
 * ```
 */
export function useBackgroundExtraction(): UseBackgroundExtractionResult {
  const convex = useConvex();
  const currentUser = useQuery(api.users.current);
  const saveRecipe = useMutation(api.recipes.saveExtracted);
  const saveToCollection = useMutation(api.recipes.saveToCollection);
  const addToCookbook = useMutation(api.cookbooks.addRecipe);

  // Track active EventSource connections by upload ID
  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());

  // Store actions
  const updateStatus = usePendingUploadsStore((s) => s.updateStatus);
  const updateProgress = usePendingUploadsStore((s) => s.updateProgress);
  const setComplete = usePendingUploadsStore((s) => s.setComplete);
  const setError = usePendingUploadsStore((s) => s.setError);
  const getUpload = useCallback(
    (id: string) => usePendingUploadsStore.getState().uploads[id],
    []
  );

  // Handle app state changes (pause/resume extractions)
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        // App came to foreground - could reconnect if needed
        // For now, active connections continue as EventSource handles this
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  const cancelExtraction = useCallback((uploadId: string) => {
    const eventSource = eventSourcesRef.current.get(uploadId);
    if (eventSource) {
      eventSource.close();
      eventSourcesRef.current.delete(uploadId);
    }
  }, []);

  const cancelAll = useCallback(() => {
    eventSourcesRef.current.forEach((es) => es.close());
    eventSourcesRef.current.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAll();
    };
  }, [cancelAll]);

  const startExtraction = useCallback(
    async (uploadId: string) => {
      const upload = getUpload(uploadId);
      if (!upload) {
        console.warn(`Upload ${uploadId} not found in store`);
        return;
      }

      if (!currentUser) {
        setError(uploadId, 'You must be signed in to extract recipes');
        return;
      }

      const { url, cookbookId } = upload;

      // Cancel any existing extraction for this ID
      cancelExtraction(uploadId);

      updateStatus(uploadId, 'checking');
      updateProgress(uploadId, 0.05, 'Checking for existing recipe...');

      // Check if recipe already exists
      try {
        const existingRecipe = await convex.query(api.recipes.getByUrl, { url });

        if (existingRecipe) {
          // Recipe already exists - just save to user's collection and cookbook
          updateStatus(uploadId, 'saving');
          updateProgress(uploadId, 0.8, 'Adding to your collection...');

          await saveToCollection({ recipeId: existingRecipe._id });

          if (cookbookId) {
            await addToCookbook({ cookbookId, recipeId: existingRecipe._id });
          }

          setComplete(uploadId, existingRecipe._id, existingRecipe.title);
          return;
        }
      } catch (err) {
        // Continue with extraction if check fails
        console.warn('Failed to check for existing recipe:', err);
      }

      // Start SSE extraction
      updateStatus(uploadId, 'extracting');
      updateProgress(uploadId, 0.1, 'Connecting...');

      const encodedUrl = encodeURIComponent(url);
      const streamUrl = `${API_BASE_URL}/api/v1/extract/stream?url=${encodedUrl}`;

      const eventSource = new EventSource(streamUrl);
      eventSourcesRef.current.set(uploadId, eventSource);

      let receivedTerminalEvent = false;

      // Helper to handle complete event
      const handleComplete = async (eventData: string) => {
        receivedTerminalEvent = true;
        eventSource.close();
        eventSourcesRef.current.delete(uploadId);

        try {
          const data: SSECompleteEvent = JSON.parse(eventData);
          const apiRecipe = data.recipe;

          if (!apiRecipe) {
            setError(uploadId, 'No recipe found');
            return;
          }

          updateStatus(uploadId, 'saving');
          updateProgress(uploadId, 0.9, 'Saving recipe...');

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

          // Add to cookbook if selected
          if (cookbookId) {
            await addToCookbook({ cookbookId, recipeId });
          }

          setComplete(uploadId, recipeId, apiRecipe.title);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to save recipe';
          setError(uploadId, message);
        }
      };

      // Helper to handle error event
      const handleError = (errorMessage: string) => {
        receivedTerminalEvent = true;
        eventSource.close();
        eventSourcesRef.current.delete(uploadId);
        setError(uploadId, errorMessage);
      };

      // Cast to any to work around react-native-sse type limitations
      const es = eventSource as unknown as {
        addEventListener: (event: string, handler: (e: SSEEvent) => void) => void;
      };

      // Listen for named events (standard SSE)
      es.addEventListener('progress', (event: SSEEvent) => {
        const data = event.data;
        if (data) {
          try {
            const parsed: SSEProgressEvent = JSON.parse(data);
            updateProgress(uploadId, parsed.percent, parsed.message, parsed.tier);
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
      es.addEventListener('message', (event: SSEEvent) => {
        const data = event.data;
        if (!data) return;

        try {
          const parsed = JSON.parse(data);

          if (parsed.type === 'progress') {
            updateProgress(uploadId, parsed.percent, parsed.message, parsed.tier);
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
        updateProgress(uploadId, 0.1, 'Connected, starting extraction...');
      });

      // Handle connection close
      es.addEventListener('close', () => {
        if (eventSourcesRef.current.has(uploadId) && !receivedTerminalEvent) {
          handleError('Connection closed unexpectedly');
        }
      });
    },
    [
      currentUser,
      convex,
      saveRecipe,
      saveToCollection,
      addToCookbook,
      cancelExtraction,
      getUpload,
      updateStatus,
      updateProgress,
      setComplete,
      setError,
    ]
  );

  return {
    startExtraction,
    cancelExtraction,
    cancelAll,
  };
}
