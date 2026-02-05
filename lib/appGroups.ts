/**
 * Typed helpers for App Groups UserDefaults data.
 *
 * Used for sharing data between the main app and the iOS share extension:
 * - Cached cookbooks (main app writes, extension reads)
 * - Pending share imports (extension writes, main app reads)
 */

import ShareExtensionBridge from '@/modules/share-extension-bridge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CachedCookbook = {
  id: string;
  name: string;
  recipeCount: number;
  coverImageUrl?: string;
};

export type PendingShareImport = {
  id: string;
  url: string;
  cookbookId?: string;
  newCookbookName?: string;
  createdAt: number;
};

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

const KEYS = {
  cachedCookbooks: 'cachedCookbooks',
  pendingImports: 'pendingImports',
} as const;

// ---------------------------------------------------------------------------
// Cached Cookbooks (main app -> extension)
// ---------------------------------------------------------------------------

export async function setCachedCookbooks(
  cookbooks: CachedCookbook[],
): Promise<void> {
  await ShareExtensionBridge.setItem(
    KEYS.cachedCookbooks,
    JSON.stringify(cookbooks),
  );
}

export async function getCachedCookbooks(): Promise<CachedCookbook[]> {
  const raw = await ShareExtensionBridge.getItem(KEYS.cachedCookbooks);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as CachedCookbook[];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Pending Imports (extension -> main app)
// ---------------------------------------------------------------------------

export async function getPendingImports(): Promise<PendingShareImport[]> {
  const raw = await ShareExtensionBridge.getItem(KEYS.pendingImports);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PendingShareImport[];
  } catch {
    return [];
  }
}

export async function addPendingImport(
  data: Omit<PendingShareImport, 'id' | 'createdAt'>,
): Promise<void> {
  const existing = await getPendingImports();
  const entry: PendingShareImport = {
    ...data,
    id: `share_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    createdAt: Date.now(),
  };
  existing.push(entry);
  await ShareExtensionBridge.setItem(
    KEYS.pendingImports,
    JSON.stringify(existing),
  );
}

export async function clearPendingImports(): Promise<void> {
  await ShareExtensionBridge.removeItem(KEYS.pendingImports);
}
