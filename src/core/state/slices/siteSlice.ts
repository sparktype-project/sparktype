// src/core/state/slices/siteSlice.ts

import { type StateCreator } from 'zustand';
import { produce } from 'immer';
import {  type LocalSiteData,  type Manifest } from '@/core/types';
import * as localSiteFs from '@/core/services/localFileSystem.service';
import { loadSiteSecretsFromDb } from '@/core/services/siteSecrets.service';
import { toast } from 'sonner';

export interface SiteSlice {
  sites: LocalSiteData[];
  loadingSites: Set<string>;
  getSiteById: (siteId: string) => LocalSiteData | undefined;
  loadSite: (siteId: string) => Promise<void>;
  addSite: (siteData: LocalSiteData) => Promise<void>;
  updateManifest: (siteId: string, manifest: Manifest) => Promise<void>;
  deleteSiteAndState: (siteId: string) => Promise<void>;
  initializeSites: () => Promise<void>;
}

export const createSiteSlice: StateCreator<SiteSlice, [], [], SiteSlice> = (set, get) => ({
  sites: [],
  loadingSites: new Set(),
  getSiteById: (siteId) => get().sites.find(s => s.siteId === siteId),

  initializeSites: async () => {
    // ... (this function is correct, no changes needed)
    try {
      const manifests = await localSiteFs.loadAllSiteManifests();
      const initialSites: LocalSiteData[] = manifests.map(manifest => ({
        siteId: manifest.siteId,
        manifest: manifest,
      }));
      set({ sites: initialSites });
    } catch (error) {
      console.error("Failed to initialize sites from storage:", error);
      toast.error("Could not load your sites. Storage might be corrupted.");
    }
  },

  loadSite: async (siteId) => {
    // --- FIX: This logic is now non-destructive ---
    if (get().loadingSites.has(siteId)) return;
    
    const existingSite = get().getSiteById(siteId);
    // Only fetch if core content files aren't already loaded.
    if (existingSite && existingSite.contentFiles) return;
    
    set(produce(draft => { draft.loadingSites.add(siteId); }));

    try {
      const manifest = await localSiteFs.getManifestById(siteId);
      if (!manifest) throw new Error(`Failed to load manifest for siteId: ${siteId}`);
      
      const [contentFiles, layoutFiles, themeFiles, secrets] = await Promise.all([
        localSiteFs.getSiteContentFiles(siteId),
        localSiteFs.getSiteLayoutFiles(siteId),
        localSiteFs.getSiteThemeFiles(siteId),
        loadSiteSecretsFromDb(siteId)
      ]);

      const loadedData = { manifest, contentFiles, layoutFiles, themeFiles, secrets };

      set(produce((draft: SiteSlice) => {
        const siteIndex = draft.sites.findIndex(s => s.siteId === siteId);
        if (siteIndex > -1) {
          // Instead of replacing, we MERGE the loaded data into the existing object.
          // This preserves any other data that might already be in the in-memory state.
          draft.sites[siteIndex] = { ...draft.sites[siteIndex], ...loadedData };
        } else {
          // If it's a new site being loaded, add it.
          draft.sites.push({ siteId, ...loadedData });
        }
      }));
    } catch (error) {
      toast.error(`Could not load site data for ID: ${siteId}`);
      console.error(`[AppStore.loadSite] Error during load for ${siteId}:`, error);
    } finally {
      set(produce(draft => { draft.loadingSites.delete(siteId); }));
    }
  },
  
  // --- This action is now safe to use because loadSite is no longer destructive ---
  updateManifest: async (siteId, newManifest) => {
    await localSiteFs.saveManifest(siteId, newManifest);
    set(produce((draft: SiteSlice) => {
      const site = draft.sites.find(s => s.siteId === siteId);
      if (site) site.manifest = newManifest;
    }));
  },

  // ... (addSite and deleteSiteAndState remain the same)
  addSite: async (newSiteData) => {
    await localSiteFs.saveSite(newSiteData);
    set(produce((draft: SiteSlice) => {
      const siteIndex = draft.sites.findIndex(s => s.siteId === newSiteData.siteId);
      if (siteIndex > -1) {
        draft.sites[siteIndex] = newSiteData;
      } else {
        draft.sites.push(newSiteData);
      }
    }));
  },

  deleteSiteAndState: async (siteId) => {
    await localSiteFs.deleteSite(siteId);
    set(produce((draft: SiteSlice) => {
      draft.sites = draft.sites.filter(s => s.siteId !== siteId);
    }));
  },
});