/**
 * Zustand store for tracking background recipe uploads/extractions.
 *
 * Manages the state of all pending, in-progress, and completed uploads
 * to enable background extraction with progress tracking.
 */

import { create } from 'zustand';
import type { Id } from '@/convex/_generated/dataModel';

export type UploadStatus = 'queued' | 'checking' | 'extracting' | 'saving' | 'complete' | 'error';

export type PendingUpload = {
  id: string;
  url: string;
  cookbookId: Id<'cookbooks'>;
  cookbookName: string;
  status: UploadStatus;
  progress: number;
  message: string;
  tier: string | null;
  recipeId: Id<'recipes'> | null;
  recipeTitle: string | null;
  error: string | null;
  createdAt: number;
  completedAt: number | null;
};

type PendingUploadsState = {
  uploads: Record<string, PendingUpload>;
  activeUploadId: string | null;

  // Actions
  addUpload: (url: string, cookbookId: Id<'cookbooks'>, cookbookName: string) => string;
  updateStatus: (id: string, status: UploadStatus) => void;
  updateProgress: (id: string, progress: number, message: string, tier?: string | null) => void;
  setComplete: (id: string, recipeId: Id<'recipes'>, recipeTitle: string) => void;
  setError: (id: string, error: string) => void;
  removeUpload: (id: string) => void;
  clearCompleted: () => void;

  // Selectors
  getActiveUploads: () => PendingUpload[];
  getCompletedUploads: () => PendingUpload[];
  getQueuedUploads: () => PendingUpload[];
};

/** Generate a unique upload ID */
function generateUploadId(): string {
  return `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export const usePendingUploadsStore = create<PendingUploadsState>((set, get) => ({
  uploads: {},
  activeUploadId: null,

  addUpload: (url, cookbookId, cookbookName) => {
    const id = generateUploadId();
    const upload: PendingUpload = {
      id,
      url,
      cookbookId,
      cookbookName,
      status: 'queued',
      progress: 0,
      message: 'Queued',
      tier: null,
      recipeId: null,
      recipeTitle: null,
      error: null,
      createdAt: Date.now(),
      completedAt: null,
    };

    set((state) => ({
      uploads: { ...state.uploads, [id]: upload },
      // Set as active if no active upload
      activeUploadId: state.activeUploadId ?? id,
    }));

    return id;
  },

  updateStatus: (id, status) => {
    set((state) => {
      const upload = state.uploads[id];
      if (!upload) return state;

      return {
        uploads: {
          ...state.uploads,
          [id]: { ...upload, status },
        },
      };
    });
  },

  updateProgress: (id, progress, message, tier = null) => {
    set((state) => {
      const upload = state.uploads[id];
      if (!upload) return state;

      return {
        uploads: {
          ...state.uploads,
          [id]: { ...upload, progress, message, tier },
        },
      };
    });
  },

  setComplete: (id, recipeId, recipeTitle) => {
    set((state) => {
      const upload = state.uploads[id];
      if (!upload) return state;

      const updatedUploads = {
        ...state.uploads,
        [id]: {
          ...upload,
          status: 'complete' as UploadStatus,
          progress: 1,
          message: 'Complete',
          recipeId,
          recipeTitle,
          completedAt: Date.now(),
        },
      };

      // Find next queued upload to activate
      const nextQueued = Object.values(updatedUploads).find(
        (u) => u.status === 'queued' && u.id !== id
      );

      return {
        uploads: updatedUploads,
        activeUploadId: nextQueued?.id ?? null,
      };
    });
  },

  setError: (id, error) => {
    set((state) => {
      const upload = state.uploads[id];
      if (!upload) return state;

      const updatedUploads = {
        ...state.uploads,
        [id]: {
          ...upload,
          status: 'error' as UploadStatus,
          error,
          completedAt: Date.now(),
        },
      };

      // Find next queued upload to activate
      const nextQueued = Object.values(updatedUploads).find(
        (u) => u.status === 'queued' && u.id !== id
      );

      return {
        uploads: updatedUploads,
        activeUploadId: nextQueued?.id ?? null,
      };
    });
  },

  removeUpload: (id) => {
    set((state) => {
      const { [id]: removed, ...remaining } = state.uploads;
      return {
        uploads: remaining,
        activeUploadId: state.activeUploadId === id ? null : state.activeUploadId,
      };
    });
  },

  clearCompleted: () => {
    set((state) => {
      const filtered = Object.fromEntries(
        Object.entries(state.uploads).filter(
          ([, upload]) => upload.status !== 'complete' && upload.status !== 'error'
        )
      );
      return { uploads: filtered };
    });
  },

  getActiveUploads: () => {
    const { uploads } = get();
    return Object.values(uploads).filter(
      (u) => u.status !== 'complete' && u.status !== 'error'
    );
  },

  getCompletedUploads: () => {
    const { uploads } = get();
    return Object.values(uploads).filter((u) => u.status === 'complete');
  },

  getQueuedUploads: () => {
    const { uploads } = get();
    return Object.values(uploads).filter((u) => u.status === 'queued');
  },
}));

/** Hook to get the currently active upload */
export function useActiveUpload(): PendingUpload | null {
  return usePendingUploadsStore((state) => {
    const { uploads, activeUploadId } = state;
    if (!activeUploadId) return null;
    return uploads[activeUploadId] ?? null;
  });
}

/** Hook to get count of in-progress uploads */
export function useUploadCount(): number {
  return usePendingUploadsStore((state) =>
    Object.values(state.uploads).filter(
      (u) => u.status !== 'complete' && u.status !== 'error'
    ).length
  );
}

/** Hook to get most recent completed upload (for success indicator) */
export function useRecentCompletedUpload(): PendingUpload | null {
  return usePendingUploadsStore((state) => {
    const completed = Object.values(state.uploads)
      .filter((u) => u.status === 'complete')
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
    return completed[0] ?? null;
  });
}
