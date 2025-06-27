// src/core/services/siteSecrets.service.ts
import localforage from 'localforage';

const DB_NAME = 'SignumDB';

// This store is NEVER included in the site export.
const siteSecretsStore = localforage.createInstance({
  name: DB_NAME,
  storeName: 'siteSecrets',
});


/**
 * Defines the shape of the sensitive, non-public data for a site.
 * This data is stored separately and is not included in public site exports.
 */
export interface SiteSecrets {
  cloudinary?: {
    uploadPreset?: string;
  };
}

/**
 * Loads the secrets object for a specific site from the database.
 * @param siteId The ID of the site.
 * @returns A promise that resolves to the SiteSecrets object, or an empty object.
 */
export async function loadSiteSecretsFromDb(siteId: string): Promise<SiteSecrets> {
  return (await siteSecretsStore.getItem<SiteSecrets>(siteId)) || {};
}

/**
 * Saves the complete secrets object for a specific site to the database.
 * @param siteId The ID of the site.
 * @param secrets The SiteSecrets object to save.
 */
export async function saveSiteSecretsToDb(siteId: string, secrets: SiteSecrets): Promise<void> {
  await siteSecretsStore.setItem(siteId, secrets);
}

/**
 * Deletes all secrets for a specific site from the database.
 * This should be called when deleting a site to ensure sensitive data is properly purged.
 * @param siteId The ID of the site whose secrets should be deleted.
 */
export async function deleteSiteSecretsFromDb(siteId: string): Promise<void> {
  await siteSecretsStore.removeItem(siteId);
}