// src/core/state/slices/secretsSlice.ts
import { type StateCreator } from 'zustand';
import { produce } from 'immer';
import { type SiteSlice } from './siteSlice';
import { type SiteSecrets, saveSiteSecretsToDb } from '@/core/services/siteSecrets.service';
import { toast } from 'sonner';

export interface SecretsSlice {
  /**
   * Updates the secrets for a site, persisting them to storage first
   * and then updating the in-memory state.
   * @param siteId The ID of the site to update.
   * @param secrets The new secrets object to save.
   */
  updateSiteSecrets: (siteId: string, secrets: SiteSecrets) => Promise<void>;
}

export const createSecretsSlice: StateCreator<SiteSlice & SecretsSlice, [], [], SecretsSlice> = (set) => ({
  updateSiteSecrets: async (siteId, newSecrets) => {
    try {
      await saveSiteSecretsToDb(siteId, newSecrets);
      set(produce((draft: SiteSlice) => {
        const site = draft.sites.find(s => s.siteId === siteId);
        if (site) {
          site.secrets = newSecrets;
        }
      }));
      toast.success("Secret settings saved successfully!");
    } catch (error) {
      console.error("Failed to save site secrets:", error);
      toast.error("Could not save secret settings.");
      throw error;
    }
  },
});