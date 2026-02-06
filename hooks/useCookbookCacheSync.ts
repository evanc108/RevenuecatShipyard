/**
 * Syncs the user's Convex cookbook list to App Groups UserDefaults
 * so the iOS share extension can display cached cookbooks without auth.
 *
 * Mount once inside AuthGuard (after Convex/Clerk are ready).
 */

import { useQuery } from 'convex/react';
import { useEffect, useRef } from 'react';

import { api } from '@/convex/_generated/api';
import { setCachedCookbooks } from '@/lib/appGroups';
import type { CachedCookbook } from '@/lib/appGroups';

export function useCookbookCacheSync(): void {
  const cookbooks = useQuery(api.cookbooks.list);
  const lastJsonRef = useRef<string>('');

  useEffect(() => {
    if (!cookbooks) return;

    const mapped: CachedCookbook[] = cookbooks.map((c) => ({
      id: c._id,
      name: c.name,
      recipeCount: c.recipeCount,
      coverImageUrl: c.coverImageUrl,
    }));

    const json = JSON.stringify(mapped);

    // Only write when the data actually changes
    if (json === lastJsonRef.current) return;
    lastJsonRef.current = json;

    setCachedCookbooks(mapped).catch(() => {
      // Silently ignore - this is expected in Expo Go where native module isn't available
    });
  }, [cookbooks]);
}
