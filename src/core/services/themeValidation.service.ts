// src/core/services/themeValidation.service.ts

import Handlebars from 'handlebars';
import { SECURITY_CONFIG } from '@/config/editorConfig';
import type { ThemeManifest } from '@/core/types';

/**
 * Validation result structure with detailed error and warning messages.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Complete theme package validation result.
 */
export interface ThemeValidationResult extends ValidationResult {
  manifest?: ThemeManifest;
  files?: Map<string, string | Blob>;
}

/**
 * Checks if a filename has an allowed extension.
 */
export function isAllowedFileType(filename: string): boolean {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return SECURITY_CONFIG.THEME_ALLOWED_EXTENSIONS.some(allowed => allowed === ext);
}

/**
 * Checks if a filename has a blocked extension.
 */
export function isBlockedFileType(filename: string): boolean {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return SECURITY_CONFIG.THEME_BLOCKED_EXTENSIONS.some(blocked => blocked === ext);
}

/**
 * Validates a file path for security issues.
 * Prevents path traversal and other malicious paths.
 */
export function validateFilePath(path: string): ValidationResult {
  const errors: string[] = [];

  // Block path traversal
  if (path.includes('..')) {
    errors.push(`Path traversal detected: ${path}`);
  }

  // Must be relative (no leading slash)
  if (path.startsWith('/')) {
    errors.push(`Absolute paths not allowed: ${path}`);
  }

  // Block special characters that could be dangerous
  if (/[<>:"|?*]/.test(path)) {
    errors.push(`Invalid characters in path: ${path}`);
  }

  // Block hidden files (except .gitkeep, .htaccess for web servers)
  if (path.split('/').some(segment => segment.startsWith('.') &&
      segment !== '.gitkeep' && segment !== '.htaccess')) {
    errors.push(`Hidden files not allowed: ${path}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates a Handlebars template for security issues.
 */
export function validateHandlebarsTemplate(content: string, templatePath: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Block <script> tags entirely
  if (/<script[\s>]/i.test(content)) {
    errors.push(`${templatePath}: Script tags are not allowed in theme templates`);
  }

  // 2. Block inline event handlers (onclick, onerror, etc.)
  const inlineEventPattern = /\son(click|dblclick|mouse(down|up|over|move|out|enter|leave)|key(down|up|press)|load|unload|error|abort|submit|reset|change|focus|blur)\s*=/i;
  if (inlineEventPattern.test(content)) {
    errors.push(`${templatePath}: Inline event handlers (onclick, onerror, etc.) are not allowed. Use AlpineJS x-on: instead.`);
  }

  // 3. Block javascript: URLs
  if (/(?:href|src)\s*=\s*["']?\s*javascript:/i.test(content)) {
    errors.push(`${templatePath}: javascript: URLs are not allowed`);
  }

  // 4. Warn about data: URLs (could be used maliciously but have legitimate uses)
  if (/(?:href|src)\s*=\s*["']?\s*data:/i.test(content)) {
    warnings.push(`${templatePath}: data: URLs detected. Ensure they are legitimate (e.g., base64 images).`);
  }

  // 5. Try to compile the template to catch syntax errors
  try {
    Handlebars.compile(content);
  } catch (error) {
    errors.push(`${templatePath}: Template compilation failed: ${(error as Error).message}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Validates CSS content for security issues.
 */
export function validateCSS(content: string, cssPath: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Check @import statements
  const importRegex = /@import\s+(?:url\()?['"]?([^'")\s]+)['"]?\)?/gi;
  const importMatches = [...content.matchAll(importRegex)];

  for (const match of importMatches) {
    const url = match[1];

    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      // Check if domain is in trusted font domains
      const isTrustedFont = SECURITY_CONFIG.TRUSTED_FONT_DOMAINS.some(domain => domain === hostname);

      if (!isTrustedFont) {
        errors.push(
          `${cssPath}: Unauthorized @import domain: ${hostname}. ` +
          `Only trusted font services are allowed.`
        );
      }
    } catch (e) {
      // Relative URLs are OK (self-hosted resources)
      if (!url.startsWith('/') && !url.startsWith('./') && !url.startsWith('../')) {
        errors.push(`${cssPath}: Invalid @import URL: ${url}`);
      }
    }
  }

  // 2. Check url() in CSS (for font files and images)
  const urlRegex = /url\s*\(\s*['"]?([^'")\s]+)['"]?\)/gi;
  const urlMatches = [...content.matchAll(urlRegex)];

  for (const match of urlMatches) {
    const url = match[1];

    // Skip data URLs (base64 fonts/images are OK)
    if (url.startsWith('data:')) continue;

    // Skip relative URLs (self-hosted resources)
    if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) continue;

    // Check external URLs
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      // Allow trusted font domains
      const isTrustedFont = SECURITY_CONFIG.TRUSTED_FONT_DOMAINS.some(domain => domain === hostname);

      if (!isTrustedFont) {
        warnings.push(
          `${cssPath}: External resource from untrusted domain: ${hostname}. ` +
          `Consider using a trusted CDN or self-hosting.`
        );
      }
    } catch (e) {
      // Invalid URL - let browser handle it
    }
  }

  // 3. Block javascript: and data:text/javascript URLs in CSS
  if (/url\s*\(\s*['"]?(javascript|data:text\/javascript):/i.test(content)) {
    errors.push(`${cssPath}: JavaScript URLs in CSS are not allowed`);
  }

  // 4. Warn about expression() (IE-specific, dangerous)
  if (/expression\s*\(/i.test(content)) {
    errors.push(`${cssPath}: CSS expression() is not allowed (legacy IE feature, security risk)`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Sanitizes CSS by removing unauthorized imports and dangerous patterns.
 */
export function sanitizeCSS(content: string): string {
  // Remove unauthorized @import statements
  let sanitized = content.replace(
    /@import\s+(?:url\()?['"]?([^'")\s]+)['"]?\)?;?/gi,
    (match, url) => {
      try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;

        // Keep trusted font imports
        const isTrustedFont = SECURITY_CONFIG.TRUSTED_FONT_DOMAINS.some(domain => domain === hostname);
        if (isTrustedFont) {
          return match;
        }
      } catch (e) {
        // Keep relative URLs
        if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
          return match;
        }
      }

      console.warn(`[CSS Sanitizer] Removed unauthorized @import: ${url}`);
      return ''; // Remove untrusted imports
    }
  );

  // Remove CSS expressions (IE-specific, dangerous)
  sanitized = sanitized.replace(/expression\s*\([^)]*\)/gi, (match) => {
    console.warn(`[CSS Sanitizer] Removed dangerous CSS expression: ${match}`);
    return '""'; // Replace with empty string value
  });

  return sanitized;
}

/**
 * Validates a theme manifest JSON structure.
 */
export function validateThemeManifest(manifestJson: string): ValidationResult & { manifest?: ThemeManifest } {
  const errors: string[] = [];
  const warnings: string[] = [];

  let manifest: ThemeManifest;

  // 1. Parse JSON
  try {
    manifest = JSON.parse(manifestJson);
  } catch (error) {
    return {
      valid: false,
      errors: [`Invalid JSON in theme.json: ${(error as Error).message}`]
    };
  }

  // 2. Check required fields
  if (!manifest.name || typeof manifest.name !== 'string') {
    errors.push('theme.json: Missing or invalid "name" field');
  }

  if (!manifest.version || typeof manifest.version !== 'string') {
    errors.push('theme.json: Missing or invalid "version" field');
  }

  if (!manifest.files || !Array.isArray(manifest.files)) {
    errors.push('theme.json: Missing or invalid "files" array');
  }

  // 3. Validate file references
  if (manifest.files) {
    const hasThemeManifest = manifest.files.some(f => f.path === 'theme.json' && f.type === 'manifest');
    if (!hasThemeManifest) {
      warnings.push('theme.json: Should include itself in files array');
    }

    const hasBase = manifest.files.some(f => f.path === 'base.hbs' && f.type === 'base');
    if (!hasBase) {
      errors.push('theme.json: Must declare base.hbs in files array');
    }
  }

  // 4. Validate layouts array (if present)
  if (manifest.layouts) {
    if (!Array.isArray(manifest.layouts)) {
      errors.push('theme.json: "layouts" must be an array');
    } else if (manifest.layouts.length === 0) {
      errors.push('theme.json: Must declare at least one layout');
    } else {
      // Layouts should now be an array of strings (layout IDs)
      manifest.layouts.forEach((layoutId, index) => {
        if (typeof layoutId !== 'string' || layoutId.trim() === '') {
          errors.push(`theme.json: Layout at index ${index} must be a non-empty string (layout ID)`);
        }
      });
    }
  }

  // 5. Validate external scripts (if present)
  if ((manifest as any).externalScripts) {
    if (!Array.isArray((manifest as any).externalScripts)) {
      errors.push('theme.json: "externalScripts" must be an array');
    } else {
      (manifest as any).externalScripts.forEach((script: any, index: number) => {
        if (!script.src || typeof script.src !== 'string') {
          errors.push(`theme.json: External script at index ${index} missing or invalid "src"`);
        } else {
          // Validate HTTPS
          if (!script.src.startsWith('https://')) {
            errors.push(`theme.json: External script "${script.src}" must use HTTPS`);
          }

          // Validate domain is in allowlist
          try {
            const url = new URL(script.src);
            const isTrusted = SECURITY_CONFIG.TRUSTED_SCRIPT_DOMAINS.some(domain => domain === url.hostname);
            if (!isTrusted) {
              errors.push(
                `theme.json: External script domain "${url.hostname}" is not in the trusted allowlist`
              );
            }
          } catch (e) {
            errors.push(`theme.json: Invalid script URL: ${script.src}`);
          }

          // Validate SRI if provided
          if (script.integrity && !/^sha(256|384|512)-[A-Za-z0-9+/=]+$/.test(script.integrity)) {
            errors.push(`theme.json: Invalid SRI hash format for script "${script.src}"`);
          }

          // Require crossorigin when using SRI
          if (script.integrity && !script.crossorigin) {
            errors.push(`theme.json: Script "${script.src}" uses SRI but missing crossorigin attribute`);
          }
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
    manifest: errors.length === 0 ? manifest : undefined
  };
}

/**
 * Validates the complete theme package structure.
 * Checks that all files referenced in manifest exist and are valid.
 */
export function validateThemeStructure(
  manifest: ThemeManifest,
  files: Map<string, string | Blob>
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Check that base.hbs exists
  if (!files.has('base.hbs')) {
    errors.push('Missing required file: base.hbs');
  }

  // 2. Check that theme.json exists
  if (!files.has('theme.json')) {
    errors.push('Missing required file: theme.json');
  }

  // 3. Validate all files declared in manifest exist
  if (manifest.files) {
    manifest.files.forEach(fileRef => {
      if (!files.has(fileRef.path)) {
        errors.push(`File declared in manifest not found: ${fileRef.path}`);
      }
    });
  }

  // 4. Check for layout directories using convention
  if (manifest.layouts && Array.isArray(manifest.layouts)) {
    const layoutDirs = new Set<string>();

    manifest.layouts.forEach(layoutId => {
      // Use convention: layouts are at layouts/{layoutId}/
      const layoutPath = `layouts/${layoutId}`;
      const layoutJsonPath = `${layoutPath}/layout.json`;
      const layoutTemplatePath = `${layoutPath}/index.hbs`;

      if (!files.has(layoutJsonPath)) {
        errors.push(`Layout manifest not found: ${layoutJsonPath}`);
      }

      if (!files.has(layoutTemplatePath)) {
        errors.push(`Layout template not found: ${layoutTemplatePath}`);
      }

      layoutDirs.add(layoutPath);
    });

    if (layoutDirs.size === 0) {
      errors.push('Theme must include at least one layout');
    }
  }

  // 5. Warn about unreferenced files (files in package but not in manifest)
  const referencedFiles = new Set(manifest.files?.map(f => f.path) || []);

  for (const filePath of files.keys()) {
    if (!referencedFiles.has(filePath) && !filePath.startsWith('layouts/')) {
      warnings.push(`File not referenced in manifest: ${filePath}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Main validation function for a complete theme package.
 * Orchestrates all validation checks.
 */
export async function validateThemePackage(
  files: Map<string, string | Blob>
): Promise<ThemeValidationResult> {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  // 1. Load and validate manifest
  const manifestContent = files.get('theme.json');
  if (!manifestContent) {
    return {
      valid: false,
      errors: ['theme.json not found in package']
    };
  }

  const manifestText = typeof manifestContent === 'string'
    ? manifestContent
    : await manifestContent.text();

  const manifestValidation = validateThemeManifest(manifestText);
  allErrors.push(...manifestValidation.errors);
  if (manifestValidation.warnings) {
    allWarnings.push(...manifestValidation.warnings);
  }

  if (!manifestValidation.valid || !manifestValidation.manifest) {
    return {
      valid: false,
      errors: allErrors,
      warnings: allWarnings.length > 0 ? allWarnings : undefined
    };
  }

  const manifest = manifestValidation.manifest;

  // 2. Validate theme structure
  const structureValidation = validateThemeStructure(manifest, files);
  allErrors.push(...structureValidation.errors);
  if (structureValidation.warnings) {
    allWarnings.push(...structureValidation.warnings);
  }

  // 3. Validate each file
  for (const [path, content] of files.entries()) {
    // Path validation
    const pathValidation = validateFilePath(path);
    if (!pathValidation.valid) {
      allErrors.push(...pathValidation.errors);
      continue; // Skip further validation for this file
    }

    // File type validation
    if (isBlockedFileType(path)) {
      allErrors.push(`Blocked file type: ${path}`);
      continue;
    }

    if (!isAllowedFileType(path)) {
      allErrors.push(`File type not allowed: ${path}`);
      continue;
    }

    // Content validation based on file type
    const textContent = typeof content === 'string' ? content : await content.text();

    if (path.endsWith('.hbs')) {
      const templateValidation = validateHandlebarsTemplate(textContent, path);
      allErrors.push(...templateValidation.errors);
      if (templateValidation.warnings) {
        allWarnings.push(...templateValidation.warnings);
      }
    }

    if (path.endsWith('.css')) {
      const cssValidation = validateCSS(textContent, path);
      allErrors.push(...cssValidation.errors);
      if (cssValidation.warnings) {
        allWarnings.push(...cssValidation.warnings);
      }
    }
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings.length > 0 ? allWarnings : undefined,
    manifest,
    files
  };
}
