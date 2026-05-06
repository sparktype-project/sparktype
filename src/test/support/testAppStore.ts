import { create, type StoreApi } from 'zustand';
import { enableMapSet } from 'immer';
import { createAuthSlice, type AuthSlice } from '@/core/state/slices/authSlice';
import { createContentSlice, type ContentSlice } from '@/core/state/slices/contentSlice';
import { createSiteSlice, type SiteSlice } from '@/core/state/slices/siteSlice';

enableMapSet();

export type TestAppStore = SiteSlice &
  ContentSlice &
  AuthSlice & {
    isInitialized: boolean;
    initError: string | null;
    activeSiteId: string | null;
    recentSlugChanges: Set<string>;
    initialize: () => void;
    retryInitialize: () => void;
    clearInitError: () => void;
    setActiveSiteId: (siteId: string | null) => void;
    markSlugChangeInProgress: (siteId: string) => void;
    markSlugChangeComplete: (siteId: string) => void;
    isSlugChangeInProgress: (siteId: string) => boolean;
  };

export function createTestAppStore() {
  return create<TestAppStore>()((set, get, api) => ({
    isInitialized: false,
    initError: null,
    activeSiteId: null,
    recentSlugChanges: new Set<string>(),
    initialize: () => {},
    retryInitialize: () => {},
    clearInitError: () => set({ initError: null }),
    setActiveSiteId: (siteId) => set({ activeSiteId: siteId }),
    markSlugChangeInProgress: (siteId) => {
      set((state) => ({ recentSlugChanges: new Set([...state.recentSlugChanges, siteId]) }));
    },
    markSlugChangeComplete: (siteId) => {
      set((state) => {
        const recentSlugChanges = new Set(state.recentSlugChanges);
        recentSlugChanges.delete(siteId);
        return { recentSlugChanges };
      });
    },
    isSlugChangeInProgress: (siteId) => get().recentSlugChanges.has(siteId),
    ...createSiteSlice(set, get, api as StoreApi<TestAppStore>),
    ...createContentSlice(set, get, api as StoreApi<TestAppStore>),
    ...createAuthSlice(set, get, api as StoreApi<TestAppStore>),
  }));
}
