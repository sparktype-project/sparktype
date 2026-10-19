// src/features/backup/useBackupExport.ts

import { useCallback } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '@/core/state/useAppStore';
import { downloadSiteBackup } from '@/core/services/backup/downloadSiteBackup';

/** Exports a backup of any site by id, with the same loading and messages the sites list uses. */
export function useBackupExport(): (siteId: string) => Promise<void> {
  return useCallback(async (siteId: string) => {
    toast.info('Preparing site backup...');
    try {
      const { loadSite, getSiteById } = useAppStore.getState();
      await loadSite(siteId);
      const site = getSiteById(siteId);
      if (!site) throw new Error('Could not load site data for export.');
      await downloadSiteBackup(site);
      toast.success('Site backup downloaded!');
    } catch (error) {
      console.error('Failed to export site:', error);
      toast.error(`Export failed: ${(error as Error).message}`);
    }
  }, []);
}
