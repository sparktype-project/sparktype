// src/core/state/useAppStore.ts
import { create, type StoreApi } from 'zustand';
import { enableMapSet } from 'immer';
import { type SiteSlice, createSiteSlice } from './slices/siteSlice';
import { type ContentSlice, createContentSlice } from './slices/contentSlice';
import { type SecretsSlice, createSecretsSlice } from './slices/secretsSlice';
import { type AuthSlice, createAuthSlice } from './slices/authSlice';

// Enable Immer for Map and Set support, which is good practice with Zustand.
enableMapSet();

/**
 * The full, combined type for the application's global store.
 * It's an intersection of all slice types plus root-level state.
 */
export type AppStore = SiteSlice & ContentSlice & SecretsSlice & AuthSlice & {
  isInitialized: boolean;
  initError: string | null;
  initialize: () => void;
  retryInitialize: () => void;
  clearInitError: () => void;
  activeSiteId: string | null;
  setActiveSiteId: (siteId: string | null) => void;

  // Slug change state tracking
  recentSlugChanges: Set<string>;
  markSlugChangeInProgress: (siteId: string) => void;
  markSlugChangeComplete: (siteId: string) => void;
  isSlugChangeInProgress: (siteId: string) => boolean;
};

/**
 * The main application store, built with Zustand.
 * It combines multiple "slices" of state for better organization.
 */
export const useAppStore = create<AppStore>()((set, get, api) => ({
  // --- Root State Properties ---
  isInitialized: false,
  initError: null,
  activeSiteId: null,

  // Slug change tracking
  recentSlugChanges: new Set<string>(),

  // --- Root State Actions ---

  /**
   * Initializes the application state. This should only be called once when the app loads.
   * It prevents re-initialization and triggers the hydration of sites from local storage.
   */
  initialize: () => {
    if (get().isInitialized) {
      return;
    }

    console.log('[AppStore] Initializing application state...');
    set({ initError: null });
    
    // Load persisted authentication sessions
    get().loadPersistedAuthSessions();

    const initializationPromise = get().initializeSites()
      .then(() => ({ status: 'ready' as const }))
      .catch((error) => ({ status: 'failed' as const, error }));

    const timeoutMs = 8000;
    const timeoutPromise = new Promise<{ status: 'timeout' }>((resolve) => {
      setTimeout(() => resolve({ status: 'timeout' }), timeoutMs);
    });

    Promise.race([initializationPromise, timeoutPromise]).then((result) => {
      if (result.status === 'ready') {
        set({ isInitialized: true, initError: null });
        console.log('[AppStore] State initialized.');
        return;
      }

      if (result.status === 'failed') {
        const errorMessage = result.error instanceof Error ? result.error.message : 'Could not load local site data.';
        console.error('[AppStore] Failed to initialize application state:', result.error);
        set({
          isInitialized: true,
          initError: `Sparktype could not open local site storage in this browser profile. ${errorMessage}`,
        });
        console.log('[AppStore] State initialized with errors.');
        return;
      }

      console.error('[AppStore] Initialization timed out.');
      set({
        isInitialized: true,
        initError: 'Sparktype could not open local site storage in this browser profile. Try retrying, closing other Sparktype tabs, or opening the app in another browser profile.',
      });
    });
  },

  retryInitialize: () => {
    set({ isInitialized: false, initError: null });
    get().initialize();
  },

  clearInitError: () => {
    set({ initError: null });
  },

  /**
   * Sets the currently active site ID for the application.
   * @param siteId The ID of the site to set as active, or null to clear it.
   */
  setActiveSiteId: (siteId) => {
    set({ activeSiteId: siteId });
  },

  /**
   * Marks a site as having a slug change in progress.
   * This prevents premature error messages during the transition.
   */
  markSlugChangeInProgress: (siteId) => {
    set((state) => ({
      recentSlugChanges: new Set([...state.recentSlugChanges, siteId])
    }));
  },

  /**
   * Marks a site's slug change as complete and removes it from tracking.
   */
  markSlugChangeComplete: (siteId) => {
    set((state) => {
      const newSet = new Set(state.recentSlugChanges);
      newSet.delete(siteId);
      return { recentSlugChanges: newSet };
    });
  },

  /**
   * Checks if a slug change is currently in progress for a site.
   */
  isSlugChangeInProgress: (siteId) => {
    return get().recentSlugChanges.has(siteId);
  },

  // --- Slices ---
  // The store is composed of smaller, focused slices of state.
  // --- FIX: Pass all three arguments (set, get, api) to each slice creator. ---
  // This satisfies the StateCreator type contract and resolves the build errors.
  ...createSiteSlice(set, get, api as StoreApi<AppStore>),
  ...createContentSlice(set, get, api as StoreApi<AppStore>),
  ...createSecretsSlice(set, get, api as StoreApi<AppStore>),
  ...createAuthSlice(set, get, api as StoreApi<AppStore>),
}));
