import { readFileSync } from 'node:fs';

/** Prefix of the marker value that stands in for the real updater public key. */
export const UPDATER_PUBKEY_PLACEHOLDER = 'REPLACE_WITH_UPDATER_PUBLIC_KEY';

/**
 * True once `plugins.updater.pubkey` in the Tauri config holds a real key. Vite bakes this into
 * the desktop bundle as `__UPDATER_ENABLED__`, so a build with the placeholder key ships an
 * updater UI that is inert instead of one that fails signature verification at runtime.
 */
export function isUpdaterConfigured(tauriConfPath: string): boolean {
  try {
    const conf = JSON.parse(readFileSync(tauriConfPath, 'utf8')) as {
      plugins?: { updater?: { pubkey?: unknown } };
    };
    const pubkey = conf.plugins?.updater?.pubkey;
    return typeof pubkey === 'string' && pubkey.trim() !== '' && !pubkey.startsWith(UPDATER_PUBKEY_PLACEHOLDER);
  } catch {
    return false;
  }
}
