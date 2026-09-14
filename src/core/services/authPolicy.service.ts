// src/core/services/authPolicy.service.ts

import type { Manifest } from '@/core/types';
import { isTauriApp } from '@/core/utils/platform';

/**
 * Shown wherever edit protection would otherwise be offered. The desktop app
 * ships without a working passkey integration, so protecting a site is neither
 * offered nor enforced there.
 */
export const EDIT_PROTECTION_UNAVAILABLE_MESSAGE =
  'Edit protection is currently unavailable in the desktop app.';

/**
 * Whether the current platform can protect a site with edit protection.
 *
 * Edit protection relies on the browser WebAuthn API. This is the single place
 * that decides platform support: no caller should branch on `isTauriApp()`
 * itself.
 */
export function isEditProtectionSupported(): boolean {
  return !isTauriApp();
}

/**
 * Whether edit protection must be enforced for a site on the current platform.
 *
 * `manifest.auth` is never removed, nulled, or rewritten — a desktop user's
 * protected site still exports and backs up its auth block intact. Desktop
 * simply stops enforcing it.
 */
export function requiresAuthentication(manifest: Manifest): boolean {
  return isEditProtectionSupported() && manifest.auth?.requiresAuth === true;
}
