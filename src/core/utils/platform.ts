// src/core/utils/platform.ts

/**
 * Utility to detect if the application is running in Tauri (desktop app) 
 * or in a web browser environment.
 */

declare global {
  interface Window {
    __TAURI__?: any;
  }
}

/**
 * Checks if the application is running in the Tauri desktop environment.
 * Returns true for Tauri app, false for web browser.
 */
export function isTauriApp(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Primary detection methods
  const isTauriEnvironment = (
    // Check for Tauri globals
    window.__TAURI__ !== undefined ||
    (window as any).__TAURI_IPC__ !== undefined ||
    (window as any).tauri !== undefined ||
    // Check user agent
    navigator.userAgent.includes('Tauri') ||
    navigator.userAgent.includes('tauri') ||
    // Check for Tauri-specific port (development)
    window.location.port === '5174' ||
    // Check if we're running in the Tauri protocol
    window.location.protocol === 'tauri:' ||
    // Check for Tauri app context
    document.documentElement.classList.contains('tauri') ||
    // Check Tauri environment variables
    (import.meta.env && (
      import.meta.env.TAURI_ENV_PLATFORM !== undefined ||
      import.meta.env.TAURI_ENV_ARCH !== undefined ||
      import.meta.env.TAURI_ENV_FAMILY !== undefined
    ))
  );
  
  // Debug logging (remove in production)
  if (process.env.NODE_ENV === 'development') {
    console.log('Platform detection - isTauriApp:', isTauriEnvironment);
  }
  
  return isTauriEnvironment;
}

/**
 * Checks if the application is running in a web browser environment.
 * Returns true for web browser, false for Tauri app.
 */
export function isWebApp(): boolean {
  return !isTauriApp();
}