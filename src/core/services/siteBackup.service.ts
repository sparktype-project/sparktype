// src/core/services/siteBackup.service.ts

/**
 * Public facade for site backup and restore.
 *
 * The implementation lives in `./backup/`:
 * - `backupFormat.ts` — archive layout constants and format rules
 * - `backupExport.ts` — `exportSiteBackup`
 * - `backupImport.ts` — `importSiteFromZip`
 * - `backupValidation.ts` — archive/manifest validation
 *
 * Importing is read-only: it returns the site data and the original images the
 * caller must persist. Replacing an existing site is the caller's decision, and
 * must clear the previous site's data before writing (see `finishImport` in
 * `HomePageDashboard.tsx`).
 */
export { exportSiteBackup } from './backup/backupExport';
export { importSiteFromZip, type ImportedSiteData } from './backup/backupImport';
