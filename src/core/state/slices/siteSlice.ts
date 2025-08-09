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
    try {
      console.log('[initializeSites] Loading all site manifests...');
      const manifests = await localSiteFs.loadAllSiteManifests();
      console.log('[initializeSites] Found manifests:', manifests.map(m => m.siteId));
      
      const initialSites: LocalSiteData[] = manifests.map(manifest => ({
        siteId: manifest.siteId,
        manifest: manifest,
      }));
      set({ sites: initialSites });
      
      if (initialSites.length === 0) {
        console.log('[initializeSites] No sites found - storage may have been cleared');
      }
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
      console.log(`[loadSite] Loading site data for: ${siteId}`);
      const rawManifest = await localSiteFs.getManifestById(siteId);
      if (!rawManifest) {
        console.error(`[loadSite] No manifest found for siteId: ${siteId}`);
        throw new Error(`Failed to load manifest for siteId: ${siteId}`);
      }
      
      console.log(`[loadSite] Manifest loaded for: ${siteId}`, rawManifest);
      const manifest = rawManifest;

      // Check if authentication is required for this site
      if (manifest.auth?.requiresAuth) {
        const appStore = get() as any; // Cast to access auth slice methods
        const authStatus = appStore.getSiteAuthStatus(siteId, manifest);
        
        if (!authStatus.isAuthenticated) {
          console.log(`[loadSite] Authentication required for site: ${siteId}`);
          const authResult = await appStore.authenticateForSite(siteId, manifest.auth);
          
          if (!authResult.success) {
            throw new Error(`Authentication failed: ${authResult.error || 'Access denied'}`);
          }
          
          console.log(`[loadSite] Authentication successful for site: ${siteId}`);
        }
      }
      
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

      // Load block manifests for this site
      // Note: We access get() again because the state may have changed above
      const appStore = get() as any; // Cast to access other slice methods
      if (appStore.loadBlockManifests) {
        try {
          await appStore.loadBlockManifests(siteId, manifest);
        } catch (error) {
          console.warn(`[SiteSlice] Failed to load block manifests for ${siteId}:`, error);
          // Don't fail the entire site load for block manifests
        }
      }

      // Migration system available if needed in the future
      // Currently no automatic migrations are required
    } catch (error) {
      console.error(`[AppStore.loadSite] Error during load for ${siteId}:`, error);
      
      // Check if this is a missing site (corrupted storage)
      if (error instanceof Error && error.message.includes('Failed to load manifest')) {
        toast.error(`Site data missing for ID: ${siteId}. Storage may have been cleared. Please create a new site or restore from backup.`);
        
        // Remove the site from the sites list since it's corrupted
        set(produce((draft: SiteSlice) => {
          draft.sites = draft.sites.filter(s => s.siteId !== siteId);
        }));
      } else {
        toast.error(`Could not load site data for ID: ${siteId}`);
      }
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