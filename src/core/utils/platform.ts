// src/core/utils/platform.ts

/**
 * Utility to detect if the application is running in Tauri (desktop app) 
 * or in a web browser environment.
 */

declare global {
  interface Window {
    __TAURI__?: unknown;
    __TAURI_IPC__?: unknown;
    tauri?: unknown;
  }
}

/**
 * Checks if the application is running in the Tauri desktop environment.
 * Returns true for Tauri app, false for web browser.
 */
export function isTauriApp(): boolean {
  if (typeof window === 'undefined') return false;

  const tauriEnv = import.meta.env;

  return Boolean(
    window.__TAURI__ !== undefined ||
    window.__TAURI_IPC__ !== undefined ||
    window.tauri !== undefined ||
    navigator.userAgent.includes('Tauri') ||
    navigator.userAgent.includes('tauri') ||
    window.location.protocol === 'tauri:' ||
    document.documentElement.classList.contains('tauri') ||
    tauriEnv.TAURI_ENV_PLATFORM !== undefined ||
    tauriEnv.TAURI_ENV_ARCH !== undefined ||
    tauriEnv.TAURI_ENV_FAMILY !== undefined
  );
}

/**
 * Checks if the application is running in a web browser environment.
 * Returns true for web browser, false for Tauri app.
 */
export function isWebApp(): boolean {
  return !isTauriApp();
}
