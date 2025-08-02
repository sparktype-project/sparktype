// src/core/hooks/useMigration.ts

import { useCallback } from 'react';
import { useSiteStore } from '@/core/state/siteStore';
import type { MigrationResult } from '@/core/services/migration.service';

/**
 * Hook for triggering content migrations when layout schemas change
 */
export function useMigration() {
  const migrateLayoutChanges = useSiteStore(state => state.migrateLayoutChanges);

  /**
   * Migrates all content files using a specific layout
   */
  const migrateLayout = useCallback(async (siteId: string, layoutId: string): Promise<void> => {
    await migrateLayoutChanges(siteId, layoutId);
  }, [migrateLayoutChanges]);

  /**
   * Migrates blog posts to use the new date_published field
   */
  const migrateBlogPostDates = useCallback(async (siteId: string): Promise<void> => {
    await migrateLayoutChanges(siteId, 'blog-post');
  }, [migrateLayoutChanges]);

  return {
    migrateLayout,
    migrateBlogPostDates,
  };
}