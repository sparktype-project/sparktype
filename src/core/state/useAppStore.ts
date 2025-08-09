// src/core/state/useAppStore.ts
import { create, type StoreApi } from 'zustand';
import { enableMapSet } from 'immer';
import { type SiteSlice, createSiteSlice } from './slices/siteSlice';
import { type ContentSlice, createContentSlice } from './slices/contentSlice';
import { type SecretsSlice, createSecretsSlice } from './slices/secretsSlice';
import { type BlockSlice, createBlockSlice } from './slices/blockSlice';
import { type AuthSlice, createAuthSlice } from './slices/authSlice';

// Enable Immer for Map and Set support, which is good practice with Zustand.
enableMapSet();

/**
 * The full, combined type for the application's global store.
 * It's an intersection of all slice types plus root-level state.
 */
export type AppStore = SiteSlice & ContentSlice & SecretsSlice & BlockSlice & AuthSlice & {
  isInitialized: boolean;
  initialize: () => void;
  activeSiteId: string | null;
  setActiveSiteId: (siteId: string | null) => void;
};

/**
 * The main application store, built with Zustand.
 * It combines multiple "slices" of state for better organization.
 */
export const useAppStore = create<AppStore>()((set, get, api) => ({
  // --- Root State Properties ---
  isInitialized: false,
  activeSiteId: null,

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
    
    // Call the hydration action to load sites from storage.
    get().initializeSites().then(() => {
        set({ isInitialized: true });
        console.log('[AppStore] State initialized.');
    }).catch((error) => {
        console.error('[AppStore] Failed to initialize application state:', error);
        // Initialize anyway to prevent hanging
        set({ isInitialized: true });
        console.log('[AppStore] State initialized with errors.');
    });
  },

  /**
   * Sets the currently active site ID for the application.
   * @param siteId The ID of the site to set as active, or null to clear it.
   */
  setActiveSiteId: (siteId) => {
    set({ activeSiteId: siteId });
  },

  // --- Slices ---
  // The store is composed of smaller, focused slices of state.
  // --- FIX: Pass all three arguments (set, get, api) to each slice creator. ---
  // This satisfies the StateCreator type contract and resolves the build errors.
  ...createSiteSlice(set, get, api as StoreApi<AppStore>),
  ...createContentSlice(set, get, api as StoreApi<AppStore>),
  ...createSecretsSlice(set, get, api as StoreApi<AppStore>),
  ...createBlockSlice(set, get, api as StoreApi<AppStore>),
  ...createAuthSlice(set, get, api as StoreApi<AppStore>),
}));