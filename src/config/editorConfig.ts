// src/config/editorConfig.ts
import type { ThemeInfo, LayoutInfo } from '@/core/types';
import type { RJSFSchema, UiSchema } from '@rjsf/utils'; 

/**
 * The official version of the Sparktype generator client.
 * This is written to the manifest.json on site creation and can be used
 * by the theme engine or other tools to check for compatibility.
 */
export const GENERATOR_VERSION = 'SparktypeClient/1.3.0';

/**
 * The URL segment used to identify a new, unsaved content file.
 * This allows the editor to distinguish between editing an existing file
 * and creating a new one.
 * e.g., /edit/site-id/content/blog/_new
 */
export const NEW_FILE_SLUG_MARKER = '_new';

/**
 * The delay in milliseconds for the autosave functionality in the content editor.
 * A longer delay reduces server/storage load but increases risk of data loss on close.
 * A shorter delay saves more often but can be more "chatty".
 */
export const AUTOSAVE_DELAY = 2500;

/**
 * The default layout path used for any new single page.
 * The system will fall back to this if a more specific layout isn't defined.
 * The path is relative to '/public/layouts/'.
 * e.g., 'page'
 */
export const DEFAULT_PAGE_LAYOUT_PATH = 'page';

/**
 * The default layout path used for any new collection page.
 */
export const DEFAULT_COLLECTION_LAYOUT_PATH = 'page';

/**
 * The master list of all built-in layouts. The system uses this
 * array to discover and load all core layout manifests.
 */
export const CORE_LAYOUTS: LayoutInfo[] = [
  // --- Page Layouts ---
  { 
    id: 'page', 
    name: 'Standard Page', 
    type: 'page', // This type is used for initial filtering in dialogs
    path: 'page', 
    description: "A clean, single-column page layout." 
  },
  
];

export const CORE_THEMES: ThemeInfo[] = [
  { id: 'default', name: 'Default Theme', path: 'default' },
];

/**
 * Default configuration for a new site's homepage (index.md).
 * Centralizes the initial title and content.
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
export const BASE_SCHEMA: { schema: RJSFSchema; uiSchema: UiSchema } = {
  schema: {
    title: 'Base content fields',
    type: 'object',
    properties: {
      // --- CORRECTED SECTION ---
      featured_image: {
        title: 'Featured image',
        description: 'The main image for this content, used in listings and social sharing.',
        type: 'string',
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
        title: 'Published',
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
      'ui:options': {
      }
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

export const MEMORY_CONFIG = {
  /**
   * The maximum file size in bytes for a single raster image upload (e.g., JPG, PNG).
   * This is a critical check to prevent memory spikes from loading large files.
   */
  MAX_UPLOAD_SIZE: 5 * 1024 * 1024,      // 5MB upload limit

  /**
   * A stricter, smaller size limit for SVG files, as they are text-based and can
   * contain excessively complex paths or malicious scripts.
   */
  MAX_SVG_SIZE: 512 * 1024,              // 512KB SVG limit

  /**
   * A list of supported image MIME types for backend validation.
   * This ensures the application only processes file types it understands.
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
   * This provides a better user experience by filtering files in the dialog.
   */
  SUPPORTED_EXTENSIONS: [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'
  ] as const,

} as const;