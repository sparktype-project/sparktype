// src/core/types/index.ts

export type StrictUiSchema = import('@rjsf/utils').UiSchema & { 'ui:groups'?: { title: string; fields: string[] }[] };
export type AssetFileType = 'manifest' | 'base' | 'template' | 'partial' | 'stylesheet' | 'script' | 'asset' | 'editor-preview';

export interface AssetFile {
  path: string;
  type: AssetFileType;
  name?: string;
}

export interface BaseAssetManifest {
  name: string;
  version: string;
  description?: string;
  icon?: string;
  files: AssetFile[];
}

export interface ThemeManifest extends BaseAssetManifest {
  appearanceSchema?: import('@rjsf/utils').RJSFSchema;
  themeDataSchema?: import('@rjsf/utils').RJSFSchema;
}

interface ImagePreset extends ImageTransformOptions {
    source: string;
}

interface DataFileDefinition {
  id: string;
  path_template: string;
  schema: import('@rjsf/utils').RJSFSchema;
  initial_content: unknown[];
}

interface DynamicRoute {
  data_source: { id: string; };
  path_template: string;
  layout: string;
  content_filter: {
    by_frontmatter_field: string;
    contains_value_from: string;
  };
}

export interface LayoutManifest extends BaseAssetManifest {
  id: string;
  layoutType: 'single' | 'collection';

  // Schema for the page using this layout
  schema?: import('@rjsf/utils').RJSFSchema;
  uiSchema?: StrictUiSchema;

  // Schema ONLY for items if layoutType is 'collection'
  itemSchema?: import('@rjsf/utils').RJSFSchema;
  itemUiSchema?: StrictUiSchema;

  display_options?: Record<string, DisplayOption>;
  image_presets?: Record<string, ImagePreset>;
  data_files?: DataFileDefinition[];
  dynamic_routes?: Record<string, DynamicRoute>;
}

/**
 * Represents a single choice within a `DisplayOption` variant group.
 * e.g., A "Grid View" option within a "Listing Style" variant.
 */
export interface DisplayOptionChoice {
  name: string;
  description?: string;
  template: string;
}

/**
 * Defines a group of user-selectable display variants in a layout manifest.
 * e.g., The "Listing Style" variant, which contains "List" and "Grid" options.
 */
export interface DisplayOption {
  name: string;
  description?: string;
  default: string;
  options: Record<string, DisplayOptionChoice>;
}

// ============================================================================
// COLLECTION TYPE SYSTEM
// ============================================================================

/**
 * Represents a layout option within a collection type.
 * e.g., 'Blog Listing', 'Featured Posts', 'Archive'
 */
export interface CollectionLayout {
  name: string;
  description?: string;
  template: string;
  supportsPagination?: boolean;
  maxItems?: number;
  display_options?: Record<string, DisplayOption>;
}

/**
 * Defines a collection type bundle (like themes) containing schemas and templates.
 * Collection types are discovered dynamically from the file system.
 */
export interface CollectionTypeManifest extends BaseAssetManifest {
  name: string;
  description?: string;
  
  // Template and partial files available in this collection type
  files: Array<{
    path: string;
    type: 'template' | 'partial';
  }>;
  
  // Content schema for collection items
  itemSchema: import('@rjsf/utils').RJSFSchema;
  itemUiSchema?: StrictUiSchema;
  
  // Available layouts this type provides
  layouts: Record<string, CollectionLayout>;
  
  // Default settings
  defaultSort?: {
    field: string;
    order: 'asc' | 'desc';
  };
}

/**
 * Represents a collection instance within a site.
 * Collections are named instances of collection types with a specific content folder.
 */
export interface Collection {
  id: string;
  name: string;
  contentPath: string;
  defaultItemLayout: string;
  settings?: Record<string, unknown>;
}

export interface CollectionItemRef {
  collectionId: string;
  slug: string;
  path: string;
  title: string;
  url: string;
}

/**
 * Represents the layout configuration stored in frontmatter for collection layouts.
 * Used when a page uses a collection type layout to display collection content.
 */
export interface LayoutConfig {
  collectionId: string;
  layout: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  maxItems?: number;
  itemsPerPage?: number;
  filterTags?: string[];
  pagination?: {
    enabled: boolean;
    itemsPerPage?: number;
  };
  templateVariables?: Record<string, unknown>;
  displayOptions?: Record<string, string>;
}

/**
 * Represents metadata for a layout asset in the file system.
 */
export interface LayoutInfo {
  id: string;
  name:string;
  type: 'single' | 'collection';
  path: string;
  description?: string;
}

/**
 * Represents metadata for a block asset in the file system.
 */

export interface BlockInfo {
  id: string;
  name: string;   
  path: string;
  description?: string; 
}

/**
 * Represents a block instance in the editor with content, configuration, and nested regions.
 */
export interface Block {
  id: string;      // Unique instance ID, e.g., "a3b8z_1p"
  type: string;    // Manifest ID, e.g., "core:two_column"
  content: Record<string, unknown>; // Data corresponding to contentSchema
  config: Record<string, unknown>;  // Data corresponding to configSchema
  regions: Record<string, Block[]>; // Key is region name, value is nested blocks
}

export interface BlockManifest extends BaseAssetManifest {
  id: string; 
  
  // Content fields - data that is part of the block itself (e.g., text, images)
  contentSchema?: import('@rjsf/utils').RJSFSchema;
  contentUiSchema?: StrictUiSchema;
  
  // Config fields - settings that control block behavior (e.g., layout options, data sources)
  configSchema?: import('@rjsf/utils').RJSFSchema;
  configUiSchema?: StrictUiSchema;
  
  // Named droppable areas where other blocks can be nested
  regions?: string[];
  
  // Legacy schema support (deprecated - use contentSchema instead)
  schema?: import('@rjsf/utils').RJSFSchema;
  uiSchema?: StrictUiSchema;
}

// ============================================================================
// CORE DATA STRUCTURES
// ============================================================================

/**
 * Represents a node in the site's hierarchical structure, as defined in `manifest.json`.
 */
export interface StructureNode {
  type: 'page';
  title: string;
  menuTitle?: string;
  path: string;
  slug: string;
  navOrder?: number;
  children?: StructureNode[];
  [key: string]: unknown;
}

/**
 * Represents the theme-specific appearance configuration saved in the manifest.
 */
export interface ThemeConfig {
  name: string;
  config: Record<string, string | boolean | number>;
  themeData?: Record<string, unknown>;
}

/**
 * Represents metadata for a theme asset, used for populating UI selectors.
 */
export interface ThemeInfo {
  id: string;
  name: string;
  path: string;
}

/**
 * Represents the fields within a content file's YAML frontmatter.
 */
export interface MarkdownFrontmatter {
  title: string;
  layout: string; 
  layoutConfig?: LayoutConfig; // Collection layout configuration
  homepage?: boolean;
  [key: string]: unknown;
}

/**
 * Represents a raw markdown file that has been parsed from storage.
 */
export interface ParsedMarkdownFile {
  slug: string;
  path: string;
  frontmatter: MarkdownFrontmatter;
  content: string;
  hasBlocks?: boolean;
  blocks?: Block[];
}

/**
 * Represents a generic raw file (e.g., theme CSS, layout JSON) read from storage.
 */
export interface RawFile {
  path: string;
  content: string;
}

/**
 * Represents the data required for rendering pager controls.
 */
export interface PaginationData {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
    prevPageUrl?: string;
    nextPageUrl?: string;
}

/**
 * Represents the main `manifest.json` file for a single site.
 */
export interface Manifest {
  siteId: string;
  generatorVersion: string;
  title: string;
  description: string;
  author?: string;
  baseUrl?: string;
  theme: ThemeConfig;
  structure: StructureNode[];
  layouts?: LayoutInfo[];
  themes?: ThemeInfo[];
  blocks?: BlockInfo[];
  collections?: Collection[];
  collectionItems?: CollectionItemRef[];
  logo?: ImageRef;
  favicon?: ImageRef;
  settings?: {
    imageService?: 'local' | 'cloudinary';
    cloudinary?: {
      cloudName?: string;
    },
    [key: string]: unknown; 
  };
  publishingConfig?: {
    provider: 'zip' | 'netlify';
    netlify?: {
      siteId?: string;
      siteName?: string;
    };
  };
}

/**
 * Represents the complete data for a single site when held in the application's memory.
 */
export interface LocalSiteData {
  siteId: string;
  manifest: Manifest;
  contentFiles?: ParsedMarkdownFile[];
  layoutFiles?: RawFile[];
  themeFiles?: RawFile[];
  dataFiles?: Record<string, string>; // Added for storing data like categories.json
  secrets?: SiteSecrets;
}

// ============================================================================
// DERIVED & HELPER TYPES FOR RENDERING
// ============================================================================

/**
 * Represents a link used for rendering navigation menus.
 */
export interface NavLinkItem {
  href: string;
  label: string;
  isActive?: boolean;
  children?: NavLinkItem[];
}

/**
 * A runtime object to provide namespacing for page types, similar to an enum.
 * e.g., `PageType.SinglePage`
 */
export const PageType = {
  SinglePage: 'SinglePage',
  DynamicPage: 'DynamicPage',
  NotFound: 'NotFound',
} as const;

/**
 * A type derived from the PageType object's values.
 * This creates the union type: 'SinglePage' | 'DynamicPage' | 'NotFound'
 * This is fully erasable and perfect for discriminated unions.
 */
export type PageType = typeof PageType[keyof typeof PageType];


/**
 * Represents a single term from a taxonomy data file (e.g., a single category).
 */
export interface TaxonomyTerm {
  slug: string;
  name: string;
  description?: string;
  [key: string]: unknown; // Allows for other properties
}

/**
 * The base structure for a page resolution result, containing common properties.
 */
interface BasePageResolution {
  pageTitle: string;
  layoutPath: string;
  collectionItems?: ParsedMarkdownFile[]; 
  pagination?: PaginationData;
}

/**
 * Represents the resolved data for a standard, static page from the `structure.json`.
 */
interface SinglePageResolution extends BasePageResolution {
  type: typeof PageType.SinglePage; // Use `typeof` to reference the object's property type
  contentFile: ParsedMarkdownFile;
}

/**
 * Represents the resolved data for a dynamically generated page, like a category archive.
 * It includes the `term` (e.g., the specific category object) that this page represents.
 */
interface DynamicPageResolution extends BasePageResolution {
  type: typeof PageType.DynamicPage; // Use `typeof`
  /** The content file of the parent collection (e.g., the main 'blog' page). */
  contentFile: ParsedMarkdownFile;
  /** The specific taxonomy term object (e.g., the category) this page is for. */
  term: TaxonomyTerm;
}

/**
 * Represents the complete, resolved data package for any page render.
 * This is the primary object passed to the theme engine.
 */
export type PageResolutionResult = 
  | SinglePageResolution
  | DynamicPageResolution
  | {
      type: typeof PageType.NotFound; // Use `typeof`
      errorMessage: string;
    };


// ============================================================================
// IMAGE & SERVICE TYPES
// ============================================================================

/** The storable reference to an uploaded image. This goes in frontmatter. */
export interface ImageRef {
  serviceId: 'local' | 'cloudinary';
  src: string;
  alt?: string;
  width?: number;
  height?: number;
}

/** Transformation options requested by the theme engine. */
export interface ImageTransformOptions {
  width?: number;
  height?: number;
  crop?: 'fill' | 'fit' | 'scale';
  gravity?: 'center' | 'north' | 'south' | 'east' | 'west' | 'auto';
  format?: 'webp' | 'avif' | 'jpeg';
}

/** The interface/contract that all image services must implement. */
export interface ImageService {
  id: string;
  name: string;
  upload(file: File, siteId: string): Promise<ImageRef>;
  getDisplayUrl(manifest: Manifest, ref: ImageRef, options: ImageTransformOptions, isExport: boolean): Promise<string>;
  getExportableAssets(siteId: string, allImageRefs: ImageRef[]): Promise<{ path: string; data: Blob; }[]>;
}

/** Defines the shape of the sensitive, non-public data for a site. */
export interface SiteSecrets {
  cloudinary?: {
    uploadPreset?: string;
  };
  publishing?: {
    netlify?: {
      apiToken?: string;
    };
  };
}

/**
 * Represents the in-memory site bundle generated by the builder services.
 * It's a map of file paths to their content, which can be a string or a binary Blob.
 */
export interface SiteBundle {
  [filePath: string]: string | Blob;
}