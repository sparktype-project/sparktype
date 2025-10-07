// src/config/editorConfig.ts
import type { ThemeInfo, LayoutInfo } from '@/core/types';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';

// Extended schema interface that includes our custom preset field
interface ExtendedSchemaProperty {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null';
  title?: string;
  description?: string;
  preset?: string;
  format?: string;
  default?: unknown;
  [key: string]: unknown;
}

// Extended schema that supports our custom preset field
interface ExtendedRJSFSchema extends Omit<RJSFSchema, 'properties'> {
  properties?: Record<string, ExtendedSchemaProperty>;
}

/**
 * The official version of the Sparktype generator client.
 */
export const GENERATOR_VERSION = 'SparktypeClient/1.3.0';

/**
 * The URL segment used to identify a new, unsaved content file.
 */
export const NEW_FILE_SLUG_MARKER = '_new';

/**
 * The delay in milliseconds for the autosave functionality in the content editor.
 */
export const AUTOSAVE_DELAY = 2500;

/**
 * The default layout `id` used for any new, single page. The system will
 * fall back to this if a more specific layout isn't defined.
 */
export const DEFAULT_PAGE_LAYOUT_PATH = 'page';

/**
 * Layout definitions
 *
 * NOTE: Layouts are now defined within themes (see theme.json -> layouts array).
 * This array is kept for backward compatibility but will be empty.
 * Use getAvailableLayouts() from configHelpers.service to get layouts from the active theme.
 * ============================================================================
 */
export const CORE_LAYOUTS: LayoutInfo[] = [];

/**
 * The master list of all built-in themes.
 */
export const CORE_THEMES: ThemeInfo[] = [
  {
    id: 'sparksite',
    name: 'Sparksite',
    path: 'sparksite'
  },
  {
    id: 'sparkdocs',
    name: 'Sparkdocs',
    path: 'sparkdocs'
  },
];

/**
 * Default configuration for a new site's homepage (index.md).
 */
export const DEFAULT_HOMEPAGE_CONFIG = {
  TITLE: 'Welcome to your new site!',
  /**
   * Generates the default markdown content for the homepage.
   * @param {string} siteTitle - The title of the site to include in the welcome message.
   * @returns {string} The formatted markdown string.
   */
  getContent: (siteTitle: string): string =>
    `## Welcome to ${siteTitle}\n\nThis is your new site's homepage. You can start editing it now.`
};

/**
 * The universal base schema for all content frontmatter.
 * This object is imported directly, eliminating network requests.
 */
export const BASE_SCHEMA: { schema: ExtendedRJSFSchema; uiSchema: UiSchema } = {
  schema: {
    type: 'object',
    properties: {
      featured_image: {
        title: 'Featured image',
        description: 'The main image for this content, used in listings and social sharing.',
        type: 'string', // The type is string, but the widget handles the ImageRef object
      },
      banner_image: {
        title: 'Banner image',
        description: 'A large, wide image for the top of the page.',
        type: 'string',
      },
      slug: {
        type: 'string',
        title: 'Slug (URL Path)',
        description: 'The URL-friendly version of the title. Auto-generated, but can be edited.',
      },
      menuTitle: {
        type: 'string',
        title: 'Menu title',
        description: 'Alternative title to use in navigation menus. If not set, the page title will be used.',
      },
      date: {
        type: 'string',
        title: 'Publication date',
        format: 'date',
      },
      published: {
        type: 'boolean',
        field_text: 'Published',
        title: 'Publishing status',
        default: true,
      },
      author: {
        type: 'string',
        title: 'Author',
      },
    },
  },
   uiSchema: {
    featured_image: {
      'ui:widget': 'imageUploader',
    },
    banner_image: {
      'ui:widget': 'imageUploader',
    },
    slug: {
      'ui:widget': 'hidden',
    },
    published: {
      'ui:widget': 'switch',
    },
  },
};

/**
 * Default image presets for common use cases.
 * These can be overridden or extended in site manifests.
 */
export const BASE_IMAGE_PRESETS = {
  // Primary display presets
  thumbnail: {
    width: 300,
    height: 200,
    crop: 'fill' as const,
    gravity: 'center' as const,
    description: 'Small thumbnail for cards and previews'
  },
  page_display: {
    width: 960,
    height: 360,
    crop: 'fill' as const,
    gravity: 'center' as const,
    description: 'Standard page image display'
  },
  hero: {
    width: 1200,
    height: 600,
    crop: 'fill' as const,
    gravity: 'center' as const,
    description: 'Large hero image for headers and landing pages'
  },
  original: {
    crop: 'scale' as const,
    gravity: 'center' as const,
    description: 'Original image with no resizing, only optimization'
  },
  
  // Social media presets
  social: {
    width: 1200,
    height: 630,
    crop: 'fill' as const,
    gravity: 'center' as const,
    description: 'Social sharing image (Open Graph, Twitter Card)'
  },
  
  // Specialized presets
  avatar: {
    width: 150,
    height: 150,
    crop: 'fill' as const,
    gravity: 'center' as const,
    description: 'Profile or author avatar'
  },
  gallery: {
    width: 400,
    height: 400,
    crop: 'fill' as const,
    gravity: 'center' as const,
    description: 'Square gallery grid image'
  },
  
  // Additional context-specific presets
  banner_small: {
    width: 600,
    height: 200,
    crop: 'fill' as const,
    gravity: 'center' as const,
    description: 'Small banner for list views'
  }
} as const;

/**
 * Configuration for image handling. This remains unchanged.
 */
export const MEMORY_CONFIG = {
  /**
   * The maximum file size in bytes for a single raster image upload (e.g., JPG, PNG).
   */
  MAX_UPLOAD_SIZE: 5 * 1024 * 1024, // 5MB upload limit

  /**
   * A stricter, smaller size limit for SVG files.
   */
  MAX_SVG_SIZE: 512 * 1024, // 512KB SVG limit

  /**
   * A list of supported image MIME types for backend validation.
   */
  SUPPORTED_IMAGE_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ] as const,

  /**
   * A list of supported file extensions for the UI file picker.
   */
  SUPPORTED_EXTENSIONS: [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'
  ] as const,

} as const;

/**
 * Configuration for CSS bundling and assets.
 */
export const CSS_CONFIG = {
  /**
   * The path to the main stylesheet that should be bundled with exported sites.
   * This CSS file will be fetched via HTTP and included in all site exports.
   */
  MAIN_STYLESHEET_PATH: '/styles.css',

  /**
   * The path where the main stylesheet should be bundled in the exported site.
   * This determines where the CSS will be placed in the final site bundle.
   */
  EXPORT_BUNDLE_PATH: 'assets/css/styles.css',

  /**
   * Additional stylesheets that can be optionally bundled.
   * These could be theme-specific or feature-specific CSS files.
   */
  ADDITIONAL_STYLESHEETS: [
    // Example: '/css/print.css' -> 'assets/css/print.css'
  ] as const,
} as const;

/**
 * Configuration for authentication and security.
 */
export const AUTH_CONFIG = {
  /**
   * How long authentication sessions persist in localStorage (30 days)
   */
  SESSION_EXPIRY_MS: 30 * 24 * 60 * 60 * 1000,

  /**
   * The primary editing domain for WebAuthn passkey authentication.
   * Self-hosters can change this to their own domain.
   * In development, 'localhost' is automatically used instead.
   */
  EDITING_DOMAIN: 'app.sparktype.org',
} as const;

/**
 * Security configuration for external integrations and theme validation.
 * Controls which external resources themes can load and import security policies.
 */
export const SECURITY_CONFIG = {
  /**
   * Trusted CDN domains allowed for external scripts in themes.
   * These scripts will only load in published/exported sites, NOT in preview.
   *
   * External scripts must be declared in theme manifests and are subject to validation.
   */
  TRUSTED_SCRIPT_DOMAINS: [
    // CDN Providers
    'cdn.jsdelivr.net',
    'unpkg.com',
    'cdnjs.cloudflare.com',

    // E-commerce
    'cdn.snipcart.com',
    'js.stripe.com',
    'www.paypal.com',
    'cdn.paddle.com',

    // Analytics
    'www.google-analytics.com',
    'www.googletagmanager.com',
    'plausible.io',
    'cdn.usefathom.com',

    // Forms & Captcha
    'js.hcaptcha.com',
    'www.google.com', // reCAPTCHA

    // Social
    'platform.twitter.com',
    'connect.facebook.net',

    // Icon Libraries
    'kit.fontawesome.com',
    'use.fontawesome.com',
  ] as const,

  /**
   * Trusted font provider domains for CSS @import and url().
   * Includes both commercial and privacy-focused font services.
   *
   * Themes can use @import from these domains in CSS files.
   */
  TRUSTED_FONT_DOMAINS: [
    // Google Fonts
    'fonts.googleapis.com',
    'fonts.gstatic.com',

    // Adobe Fonts (Typekit)
    'use.typekit.net',
    'use.typekit.com', // Legacy domain

    // Fonts.com (Monotype)
    'fast.fonts.net',
    'fonts.com',

    // Bunny Fonts (Privacy-friendly Google Fonts alternative, GDPR-compliant)
    'fonts.bunny.net',

    // Font Awesome (when using CSS)
    'use.fontawesome.com',

    // Other popular font CDNs
    'fonts.adobe.com',
    'cloud.typography.com', // Hoefler & Co.
  ] as const,

  /**
   * File size limits for theme imports.
   * Prevents zip bombs and excessive resource usage.
   */
  THEME_IMPORT_LIMITS: {
    /** Maximum size for a single file within a theme (5MB) */
    MAX_FILE_SIZE: 5 * 1024 * 1024,

    /** Maximum total size for an entire theme package (20MB) */
    MAX_TOTAL_SIZE: 20 * 1024 * 1024,

    /** Maximum number of files in a theme package (500) */
    MAX_FILE_COUNT: 500,

    /** Maximum compression ratio to prevent zip bombs (100:1) */
    MAX_DECOMPRESSION_RATIO: 100,
  },

  /**
   * Allowed file extensions for theme imports.
   * Only files with these extensions can be included in theme packages.
   */
  THEME_ALLOWED_EXTENSIONS: [
    // Templates & Configuration
    '.hbs', '.json', '.css',

    // Fonts (including legacy .eot for older browser support)
    '.woff', '.woff2', '.ttf', '.otf', '.eot',

    // Images
    '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp',

    // Documentation
    '.md', '.txt',
  ] as const,

  /**
   * Blocked file extensions (security risk).
   * These file types are never allowed in theme packages.
   */
  THEME_BLOCKED_EXTENSIONS: [
    // JavaScript (themes must not ship executable code)
    '.js', '.mjs', '.ts', '.jsx', '.tsx',

    // Executables
    '.exe', '.sh', '.bat', '.cmd', '.app',

    // Server-side scripts
    '.php', '.py', '.rb', '.pl', '.asp', '.jsp',
  ] as const,
} as const;