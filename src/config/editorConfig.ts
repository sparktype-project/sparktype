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
 * - `type: 'single'`: A blueprint for a single piece of content (e.g., a blog post).
 * - `type: 'collection'`: A blueprint for a page that displays a list of other
 *   content items (e.g., a blog listing page).
 * ============================================================================
 */
export const CORE_LAYOUTS: LayoutInfo[] = [
  // --- Standard Page Layouts ---
  {
    id: 'page',
    name: 'Standard Page',
    type: 'single', // For individual content pages
    path: 'page',
    description: "A clean, single-column layout for standard pages like 'About Us'."
  },

  // --- "Blog" Content Layouts ---
  {
    id: 'blog-post',
    name: 'Blog Post',
    type: 'single', // A blueprint for one blog post
    path: 'blog-post', // Corresponds to the folder /public/layouts/blog-post/
    description: "The standard layout for an individual blog post article."
  },
  {
    id: 'blog-listing',
    name: 'Blog Listing',
    type: 'collection', // This layout is designed to display a list of items
    path: 'blog-listing', // Corresponds to the folder /public/layouts/blog-listing/
    description: "Displays a paginated list of items from a 'Blog' collection."
  },

  // --- "Portfolio" Content Layouts ---
  {
    id: 'portfolio-project',
    name: 'Portfolio Project',
    type: 'single', // A blueprint for one portfolio project
    path: 'portfolio-project',
    description: "The layout for a single, detailed portfolio project page."
  },
  {
    id: 'portfolio-grid',
    name: 'Portfolio Grid',
    type: 'collection', // This layout displays a list of portfolio projects
    path: 'portfolio-grid',
    description: "Displays a visual grid of items from a 'Portfolio' collection."
  },
];

/**
 * The master list of all built-in themes. 
 */
export const CORE_THEMES: ThemeInfo[] = [
  {
    id: 'default',
    name: 'Default theme',
    path: 'default'
  },
  {
    id: 'docs',
    name: 'Documentation',
    path: 'docs'
  },
];
// Note: CORE_BLOCKS removed - collection views now use layout partials directly

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
} as const;