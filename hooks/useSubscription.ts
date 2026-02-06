import { useCallback, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQuery } from 'convex/react';

import { api } from '@/convex/_generated/api';
import { FREE_RECIPE_LIMIT, useSubscriptionStore } from '@/stores/useSubscriptionStore';

export type PaywallFeature = 'recipeLimit' | 'cook' | 'mealPlan';

/**
 * Combined subscription hook.
 * Reads pro status from Zustand store, recipe count from Convex.
 * Auto-refreshes subscription status when app comes to foreground.
 */
export function useSubscription() {
  const isPro = useSubscriptionStore((s) => s.isPro);
  const isLoading = useSubscriptionStore((s) => s.isLoading);
  const priceString = useSubscriptionStore((s) => s.priceString);
  const checkSubscription = useSubscriptionStore((s) => s.checkSubscription);
  const purchaseAction = useSubscriptionStore((s) => s.purchase);
  const restoreAction = useSubscriptionStore((s) => s.restore);

  const savedCount = useQuery(api.recipes.countSaved);
  const savedRecipeCount = savedCount?.count ?? 0;

  const freeRecipesRemaining = Math.max(0, FREE_RECIPE_LIMIT - savedRecipeCount);
  const canImportRecipe = isPro || savedRecipeCount < FREE_RECIPE_LIMIT;

  // Refresh subscription status on foreground
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        checkSubscription();
      }
    };
    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, [checkSubscription]);

  const purchase = useCallback(async () => {
    return purchaseAction();
  }, [purchaseAction]);

  const restore = useCallback(async () => {
    return restoreAction();
  }, [restoreAction]);

  return {
    isPro,
    isLoading,
    savedRecipeCount,
    freeRecipesRemaining,
    canImportRecipe,
    priceString,
    purchase,
    restore,
  };
}
