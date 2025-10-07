// src/core/services/themeImport.service.ts

import JSZip from 'jszip';
import { SECURITY_CONFIG } from '@/config/editorConfig';
import { validateThemePackage, sanitizeCSS } from './themeValidation.service';
import { saveCustomThemeBundle } from './assetStorage.service';
import type { ThemeInfo } from '@/core/types';

/**
 * Result of a theme import operation.
 */
export interface ThemeImportResult {
  success: boolean;
  themeName?: string;
  themeInfo?: ThemeInfo;
  errors?: string[];
  warnings?: string[];
}

/**
 * Converts a file size in bytes to a human-readable string.
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Imports a theme from a ZIP file.
 *
 * @param file The ZIP file to import
 * @param siteId The ID of the site to import the theme for
 * @returns Result of the import operation with theme info or errors
 */
export async function importThemeFromZip(
  file: File,
  siteId: string
): Promise<ThemeImportResult> {
  try {
    console.log(`[Theme Import] Starting import for site ${siteId}, file: ${file.name}`);

    // 1. Load ZIP
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(file);
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to load ZIP file: ${(error as Error).message}`]
      };
    }

    // 2. Check file count
    const fileCount = Object.keys(zip.files).length;
    if (fileCount > SECURITY_CONFIG.THEME_IMPORT_LIMITS.MAX_FILE_COUNT) {
      return {
        success: false,
        errors: [
          `Too many files in theme package: ${fileCount}. ` +
          `Maximum allowed: ${SECURITY_CONFIG.THEME_IMPORT_LIMITS.MAX_FILE_COUNT}`
        ]
      };
    }

    console.log(`[Theme Import] ZIP contains ${fileCount} files`);

    // 3. Extract files to Map
    const files = new Map<string, string>();
    let totalSize = 0;

    for (const [path, zipEntry] of Object.entries(zip.files)) {
      // Skip directories
      if (zipEntry.dir) continue;

      // Get compression info from internal data (if available)
      const compressedSize = (zipEntry as any)._data?.compressedSize || 0;
      const uncompressedSize = (zipEntry as any)._data?.uncompressedSize || 0;

      // Check decompression ratio (zip bomb protection)
      if (compressedSize > 0 && uncompressedSize > 0) {
        const ratio = uncompressedSize / compressedSize;
        if (ratio > SECURITY_CONFIG.THEME_IMPORT_LIMITS.MAX_DECOMPRESSION_RATIO) {
          return {
            success: false,
            errors: [
              `Suspicious compression ratio detected in "${path}": ${ratio.toFixed(1)}:1. ` +
              `Maximum allowed: ${SECURITY_CONFIG.THEME_IMPORT_LIMITS.MAX_DECOMPRESSION_RATIO}:1. ` +
              `This may indicate a zip bomb attack.`
            ]
          };
        }
      }

      // Extract file content
      const content = await zipEntry.async('string');
      const fileSize = content.length;

      // Check per-file size limit
      if (fileSize > SECURITY_CONFIG.THEME_IMPORT_LIMITS.MAX_FILE_SIZE) {
        return {
          success: false,
          errors: [
            `File too large: "${path}" (${formatFileSize(fileSize)}). ` +
            `Maximum allowed: ${formatFileSize(SECURITY_CONFIG.THEME_IMPORT_LIMITS.MAX_FILE_SIZE)}`
          ]
        };
      }

      totalSize += fileSize;
      files.set(path, content);
    }

    // 4. Check total size limit
    if (totalSize > SECURITY_CONFIG.THEME_IMPORT_LIMITS.MAX_TOTAL_SIZE) {
      return {
        success: false,
        errors: [
          `Total theme size too large: ${formatFileSize(totalSize)}. ` +
          `Maximum allowed: ${formatFileSize(SECURITY_CONFIG.THEME_IMPORT_LIMITS.MAX_TOTAL_SIZE)}`
        ]
      };
    }

    console.log(`[Theme Import] Extracted ${files.size} files, total size: ${formatFileSize(totalSize)}`);

    // 5. Validate theme package
    console.log('[Theme Import] Validating theme package...');
    const validation = await validateThemePackage(files);

    if (!validation.valid) {
      console.error('[Theme Import] Validation failed:', validation.errors);
      return {
        success: false,
        errors: validation.errors,
        warnings: validation.warnings
      };
    }

    if (!validation.manifest) {
      return {
        success: false,
        errors: ['Theme validation succeeded but manifest is missing']
      };
    }

    console.log('[Theme Import] Validation passed');

    // 6. Sanitize CSS files
    console.log('[Theme Import] Sanitizing CSS files...');
    for (const [path, content] of files.entries()) {
      if (path.endsWith('.css')) {
        const sanitized = sanitizeCSS(content);
        if (sanitized !== content) {
          console.log(`[Theme Import] Sanitized CSS: ${path}`);
          files.set(path, sanitized);
        }
      }
    }

    // 7. Generate theme ID from name
    const themeName = validation.manifest.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/^-+|-+$/g, '');     // Trim hyphens from start/end

    if (!themeName) {
      return {
        success: false,
        errors: ['Theme name could not be converted to valid ID']
      };
    }

    console.log(`[Theme Import] Theme ID: ${themeName}`);

    // 8. Save to storage
    console.log('[Theme Import] Saving to storage...');
    const fileMap: Record<string, string> = {};
    files.forEach((content, path) => {
      fileMap[path] = content;
    });

    await saveCustomThemeBundle(siteId, themeName, fileMap);

    // 9. Create theme info for manifest registration
    const themeInfo: ThemeInfo = {
      id: themeName,
      name: validation.manifest.name,
      path: themeName
    };

    console.log('[Theme Import] Import successful');

    return {
      success: true,
      themeName,
      themeInfo,
      warnings: validation.warnings
    };

  } catch (error) {
    console.error('[Theme Import] Import failed with exception:', error);
    return {
      success: false,
      errors: [`Theme import failed: ${(error as Error).message}`]
    };
  }
}

/**
 * Imports a theme from a GitHub repository.
 * (Future implementation)
 *
 * @param repoInfo Repository information (owner, repo, branch)
 * @param themePath Path within the repository to the theme directory
 * @param siteId The ID of the site to import the theme for
 */
export async function importThemeFromGitHub(
  repoInfo: { owner: string; repo: string; branch?: string },
  themePath: string,
  siteId: string
): Promise<ThemeImportResult> {
  // TODO: Phase 2 implementation
  return {
    success: false,
    errors: ['GitHub import not yet implemented. Please use ZIP upload.']
  };
}

/**
 * Imports a theme from a URL (direct ZIP download).
 * (Future implementation)
 *
 * @param url URL to the theme ZIP file
 * @param siteId The ID of the site to import the theme for
 */
export async function importThemeFromUrl(
  url: string,
  siteId: string
): Promise<ThemeImportResult> {
  // TODO: Phase 2 implementation
  return {
    success: false,
    errors: ['URL import not yet implemented. Please use ZIP upload.']
  };
}

/**
 * Validates a theme package without importing it.
 * Useful for providing feedback before actual import.
 *
 * @param file The ZIP file to validate
 * @returns Validation result with errors and warnings
 */
export async function validateThemeZip(file: File): Promise<ThemeImportResult> {
  try {
    // Load ZIP
    const zip = await JSZip.loadAsync(file);

    // Extract files
    const files = new Map<string, string>();
    for (const [path, zipEntry] of Object.entries(zip.files)) {
      if (!zipEntry.dir) {
        const content = await zipEntry.async('string');
        files.set(path, content);
      }
    }

    // Validate
    const validation = await validateThemePackage(files);

    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
        warnings: validation.warnings
      };
    }

    return {
      success: true,
      themeName: validation.manifest?.name,
      warnings: validation.warnings
    };

  } catch (error) {
    return {
      success: false,
      errors: [`Validation failed: ${(error as Error).message}`]
    };
  }
}
