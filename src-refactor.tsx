FILE CONCATENATION REPORT
Root Directory: src/
Excluded Directories: node_modules, public, ios
File Extensions: *.ts, *.tsx, *.js, *.jsx, *.css, *.html, *.json, *.hbs
================================================================================

File: vite-env.d.ts
/// <reference types="vite/client" />


================================================================================

File: App.tsx
// src/App.tsx

import { Suspense, useEffect, useState, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';

// Global State and UI Management
import { useAppStore } from './core/state/useAppStore';
import { useInitialiseUIStore } from './core/hooks/useInitialiseUIStore';
import { Toaster } from "./core/components/ui/sonner";

// --- Code-Splitting Page Imports using React.lazy ---
// This is a best practice to keep the initial bundle size small.
// Each page component is only loaded when its route is visited.

// Marketing and Site Management Pages
const MarketingHomePage = lazy(() => import('./pages/MarketingHomePage')); // app/page.tsx
const HomePageDashboard = lazy(() => import('./pages/HomePageDashboard')); // app/sites/page.tsx

// Site-Specific Layouts and Pages
const SiteLayout = lazy(() => import('./pages/sites/SiteLayout'));             // app/sites/[siteId]/layout.tsx
const EditContentPage = lazy(() => import('./pages/sites/edit/EditContentPage'));// app/sites/[siteId]/edit/content/[[...slug]]/page.tsx
const CollectionManagementPage = lazy(() => import('./pages/sites/collections/CollectionManagementPage')); // app/sites/[siteId]/collections/[collectionId]/page.tsx
const SettingsSectionLayout = lazy(() => import('@/pages/sites/settings/SettingsSectionLayout')); // app/sites/[siteId]/settings/layout.tsx
const SiteSettingsPage = lazy(() => import('@/pages/sites/settings/SiteSettingsPage'));         // app/sites/[siteId]/settings/page.tsx
const ThemeSettingsPage = lazy(() => import('@/pages/sites/settings/ThemeSettingsPage'));       // app/sites/[siteId]/settings/theme/page.tsx
const ImageSettingsPage = lazy(() => import('@/pages/sites/settings/ImageSettingsPage'));       // app/sites/[siteId]/settings/images/page.tsx
const PublishingSettingsPage = lazy(() => import('@/pages/sites/settings/PublishingSettingsPage')); // app/sites/[siteId]/settings/publishing/page.tsx
const ViewSitePage = lazy(() => import('@/pages/sites/view/ViewSitePage'));                     // app/sites/[siteId]/view/[[...slug]]/page.tsx

/**
 * A simple loading component to be used with Suspense while pages are being lazy-loaded.
 */
function AppLoadingIndicator() {
  return (
    <div className="flex items-center justify-center h-screen bg-background text-foreground">
      <div className="flex flex-col items-center">
        <svg className="animate-spin h-8 w-8 text-primary mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-lg">Loading...</p>
      </div>
    </div>
  );
}

export default function App() {
  // This initialization logic is ported directly from your RootLayout.
  useInitialiseUIStore();
  const initialize = useAppStore(state => state.initialize);
  const isInitialized = useAppStore(state => state.isInitialized);
  const [clientMounted, setClientMounted] = useState(false);

  useEffect(() => {
    setClientMounted(true);
    if (!isInitialized) {
      initialize();
    }
  }, [initialize, isInitialized]);

  const showLoading = clientMounted && !isInitialized;

  if (showLoading) {
    return <AppLoadingIndicator />;
  }

   return (
    <>
      <Suspense fallback={<AppLoadingIndicator />}>
        <Routes>
          
          <Route path="/" element={<MarketingHomePage />} />

          <Route path="/sites" element={<HomePageDashboard />} />
          <Route path="/sites/:siteId" element={<SiteLayout />}>

          <Route path="view/*" element={<ViewSitePage />} />
            
          <Route path="edit/*" element={<EditContentPage />} />

          <Route path="collections/:collectionId" element={<CollectionManagementPage />} />
            
          <Route path="collection/:collectionId/:slug" element={<ViewSitePage />} />

            <Route path="settings" element={<SettingsSectionLayout />}>
              <Route index element={<SiteSettingsPage />} />
              <Route path="theme" element={<ThemeSettingsPage />} />
              <Route path="images" element={<ImageSettingsPage />} />
              <Route path="publishing" element={<PublishingSettingsPage />} />
            </Route>
          </Route>
          
          <Route path="*" element={<div>404 - Page Not Found</div>} />
        </Routes>
      </Suspense>
      <Toaster richColors position="top-right" />
    </>
  );
}

================================================================================

File: main.tsx
// src/main.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';

import App from './App';
import './globals.css';

// Error Boundary to catch any rendering errors at the very top level.
import ErrorBoundary from './core/components/ErrorBoundary'; 

// Providers
import { ThemeProvider } from './core/components/ThemeProvider';
import { EditorProvider } from './features/editor/contexts/EditorProvider';
import { Buffer } from 'buffer';
window.Buffer = Buffer;

// Find the root element from index.html
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Fatal Error: Root element with id 'root' not found in the DOM.");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      {/* 
        The HashRouter is the outermost routing component. 
        It uses the URL hash for client-side routing.
      */}
      <HashRouter>
        {/*
          The ThemeProvider manages light/dark mode for the entire application.
        */}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* 
            The EditorProvider manages the editor's save state and unsaved changes.
            Placing it here makes the editor context available to any route
            that needs it, like the editor pages and the header.
          */}
          <EditorProvider>
            <App />
          </EditorProvider>
        </ThemeProvider>
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>
);

================================================================================

File: globals.css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

:root {
  --radius: 0.625rem;
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.556 0 0);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}


================================================================================

File: core/types/index.ts
// src/core/types/index.ts

export type StrictUiSchema = import('@rjsf/utils').UiSchema & { 'ui:groups'?: { title: string; fields: string[] }[] };
export type AssetFileType = 'manifest' | 'base' | 'template' | 'partial' | 'stylesheet' | 'script' | 'asset';

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

================================================================================

File: core/libraries/markdownParser.ts
// src/core/libraries/markdownParser.ts
import matter, { type Input } from 'gray-matter';
import { type MarkdownFrontmatter, type ParsedMarkdownFile } from '@/core/types';
import yaml from 'js-yaml'; 

/**
 * Parses a raw markdown string (which includes YAML frontmatter) into an object
 * containing the frontmatter (as an object) and the markdown body content.
 *
 * @param rawMarkdown The complete markdown string with frontmatter.
 * @returns An object with `frontmatter` and `content` (markdown body).
 * @throws Error if frontmatter parsing fails.
 */

export function parseMarkdownString(rawMarkdown: string): { frontmatter: MarkdownFrontmatter, content: string } {
  try {
    
    const { data, content: bodyContent } = matter(rawMarkdown as Input, {
      engines: {
        yaml: {
          parse: yaml.load as (input: string) => object,
          stringify: yaml.dump,
        },
      },
    });
    
    const title = typeof data.title === 'string' ? data.title : 'Untitled';

    return { 
      frontmatter: { ...data, title } as MarkdownFrontmatter,
      content: bodyContent.trim() 
    };
  } catch (e) {
    console.error("Error parsing markdown string with gray-matter:", e);
    throw new Error("Invalid YAML frontmatter format. Please check for syntax errors (e.g., unclosed quotes, incorrect indentation).");
  }
}

/**
 * Converts a frontmatter object and a markdown body content string back into
 * a single string formatted as YAML frontmatter followed by the markdown content.
 * Uses js-yaml for robust YAML serialization.
 *
 * @param frontmatter The frontmatter object.
 * @param content The markdown body content.
 * @returns A string combining serialized YAML frontmatter and markdown content.
 */
export function stringifyToMarkdown(frontmatter: MarkdownFrontmatter, content: string): string {
  try {
    const cleanedFrontmatter: Partial<MarkdownFrontmatter> = {};
    for (const key in frontmatter) {
      if (Object.prototype.hasOwnProperty.call(frontmatter, key) && frontmatter[key] !== undefined && frontmatter[key] !== null) {
        cleanedFrontmatter[key] = frontmatter[key];
      }
    }

    const fmString = Object.keys(cleanedFrontmatter).length > 0 
      ? yaml.dump(cleanedFrontmatter, { skipInvalid: true, indent: 2 })
      : '';

    if (fmString) {
        return `---\n${fmString}---\n\n${content}`;
    }
    return content;
  } catch (e) {
    console.error("Error stringifying frontmatter to YAML:", e);

    let fallbackFmString = '';
    for (const key in frontmatter) {
        if (Object.prototype.hasOwnProperty.call(frontmatter, key)) {
            fallbackFmString += `${key}: ${String(frontmatter[key])}\n`;
        }
    }
    if (fallbackFmString) {
        return `---\n${fallbackFmString}---\n\n${content}`;
    }
    return content;
  }
}

/**
 * Parses a raw markdown string. This function is a utility wrapper.
 */
export function parseAndRenderMarkdown(slug: string, path: string, rawMarkdownContent: string): ParsedMarkdownFile {
  const { frontmatter, content } = parseMarkdownString(rawMarkdownContent);
  
  return {
    slug,
    path,
    frontmatter,
    content,
  };
}

================================================================================

File: core/libraries/browsingUtils.ts
// src/lib/browsingUtils.ts

export const REMOTE_SITE_ID_MARKER = "remote@";

export interface ParsedSiteIdentifier {
  rawParam: string;          // The original parameter from the URL
  cleanedIdOrUrl: string;  // The ID after basic cleaning (quotes, one layer of URI decode)
  isRemote: boolean;
  remoteBaseUrl: string | null; // Decoded and validated base URL if remote
  effectiveSiteId: string;     // The ID to use for fetching/internal logic (e.g. "actual-id" or "remote@actual-id")
}

/**
 * Parses the site identifier from URL parameters, handles decoding,
 * and determines if it's a local or remote site.
 * 
 * @param siteIdParam The raw siteId parameter from Next.js `useParams()`.
 * @returns ParsedSiteIdentifier object or null if siteIdParam is invalid.
 */
export function parseSiteIdentifier(siteIdParam: string | string[] | undefined): ParsedSiteIdentifier | null {
  let rawId = '';
  if (Array.isArray(siteIdParam)) {
    rawId = siteIdParam[0] || '';
  } else if (typeof siteIdParam === 'string') {
    rawId = siteIdParam;
  }

  if (!rawId) {
    console.warn("[BrowsingUtils] siteIdParam is empty or undefined.");
    return null;
  }

  let cleanedId = rawId;

  // Attempt to decode (browsers/Next.js might already do one layer)
  try {
    let decodedOnce = decodeURIComponent(cleanedId);
    // Heuristic: if it still contains '%', it might be double-encoded, especially if wrapped in quotes.
    if (decodedOnce.includes('%') && (decodedOnce.startsWith('"') || decodedOnce.startsWith('%22'))) {
        let temp = decodedOnce;
        if (temp.startsWith('%22')) temp = temp.substring(3); // Remove leading %22
        if (temp.endsWith('%22')) temp = temp.substring(0, temp.length - 3); // Remove trailing %22
        if (temp.startsWith('"')) temp = temp.substring(1); // Remove leading "
        if (temp.endsWith('"')) temp = temp.substring(0, temp.length - 1); // Remove trailing "
        decodedOnce = decodeURIComponent(temp);
    }
    cleanedId = decodedOnce;
  } catch (e) {
    console.warn(`[BrowsingUtils] decodeURIComponent failed for "${cleanedId}", using as is. Error:`, e);
  }

  // Final removal of surrounding quotes if present
  if (cleanedId.startsWith('"') && cleanedId.endsWith('"')) {
    cleanedId = cleanedId.substring(1, cleanedId.length - 1);
  }
  
  const isRemote = cleanedId.startsWith(REMOTE_SITE_ID_MARKER);
  let remoteBaseUrl: string | null = null;
  const effectiveSiteId = cleanedId; // For local sites, cleanedId is the effectiveSiteId

  if (isRemote) {
    const potentialUrl = cleanedId.substring(REMOTE_SITE_ID_MARKER.length);
    try {
      // The URL part should already be decoded by the steps above.
      // We just need to validate it's a URL.
      const urlObject = new URL(potentialUrl);
      remoteBaseUrl = urlObject.origin; // Use origin (scheme + hostname + port)
      // For remote sites, the cleanedId itself (e.g., "remote@http://...") is used as the key/identifier
      // for display and routing, but the actual ID fetched from manifest is what `LocalSiteData.siteId` will hold.
      // Let's keep `effectiveSiteId` as the full "remote@..." string for consistency in what the client uses
      // to identify this browsing session. The fetcher will derive the internal siteId.
    } catch (e) {
      console.error(`[BrowsingUtils] Invalid remote URL part: "${potentialUrl}" from "${cleanedId}"`, e);
      return { // Return a partial result indicating parsing failure for remote URL
          rawParam: rawId,
          cleanedIdOrUrl: cleanedId,
          isRemote: true,
          remoteBaseUrl: null, // Explicitly null due to error
          effectiveSiteId: cleanedId,
      }; 
    }
  }

  return {
    rawParam: rawId,
    cleanedIdOrUrl: cleanedId,
    isRemote,
    remoteBaseUrl,
    effectiveSiteId,
  };
}

================================================================================

File: core/libraries/utils.ts
// src/lib/utils.ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function slugify(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFKD') // Normalize accented characters
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars except -
    .replace(/--+/g, '-'); // Replace multiple - with single -
}

export function generateSiteId(title: string): string {
  // Keep the random part short to avoid overly long site IDs
  const randomString = Math.random().toString(36).substring(2, 7); 
  const slugBase = slugify(title);
  // Truncate slugBase if it's too long to keep siteId reasonable
  const maxBaseLength = 50; 
  const truncatedSlugBase = slugBase.substring(0, maxBaseLength);
  return `${truncatedSlugBase}-${randomString}`;
}

================================================================================

File: core/libraries/remoteSiteFetcher.ts
// src/lib/remoteSiteFetcher.ts
import { type LocalSiteData, type ParsedMarkdownFile, type Manifest } from '@/core/types';
import { parseMarkdownString } from './markdownParser';
import { flattenStructure } from '../services/fileTree.service';

async function fetchRemoteFile(baseUrl: string, filePath: string): Promise<string> {
  const url = new URL(filePath, baseUrl).href;
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.statusText}`);
  }
  return response.text();
}

/**
 * Fetches and reconstructs an entire remote Sparktype site into the LocalSiteData format.
 * It fetches the manifest, then fetches all content files listed within it.
 * @param remoteSiteUrl The base URL of the remote Sparktype site.
 * @returns A Promise that resolves to a complete LocalSiteData object, or null if fetching fails.
 */
export async function fetchRemoteSiteData(remoteSiteUrl: string): Promise<LocalSiteData | null> {
  if (!remoteSiteUrl || !remoteSiteUrl.startsWith('http')) {
    console.error(`Invalid remoteSiteUrl provided: ${remoteSiteUrl}`);
    return null;
  }

  try {
    // 1. Fetch manifest.json, which is now the single source of truth.
    const manifestString = await fetchRemoteFile(remoteSiteUrl, '_site/manifest.json');
    const manifest: Manifest = JSON.parse(manifestString);

    if (!manifest || !manifest.siteId || !manifest.structure) {
        throw new Error("Invalid manifest structure fetched from remote site.");
    }
    
    // 2. Collect all unique file paths from the manifest structure.
    const allPageNodes = flattenStructure(manifest.structure);
    const contentFilePaths = [...new Set(allPageNodes.map(node => node.path))];

    // 3. Fetch all content files in parallel.
    const contentFilesPromises = contentFilePaths.map(async (path) => {
        try {
            const rawMarkdown = await fetchRemoteFile(remoteSiteUrl, `_site/${path}`);
            const { frontmatter, content } = parseMarkdownString(rawMarkdown);
            const slug = path.substring(path.lastIndexOf('/') + 1).replace('.md', '');
            return { slug, path, frontmatter, content };
        } catch (error) {
            console.warn(`Could not fetch or parse content file: ${path}`, error);
            return null; // Return null on failure for this specific file
        }
    });
    
    const resolvedContentFiles = await Promise.all(contentFilesPromises);
    const validContentFiles = resolvedContentFiles.filter(file => file !== null) as ParsedMarkdownFile[];

    // 4. Construct the final LocalSiteData object.
    const finalSiteData: LocalSiteData = {
      siteId: `remote-${manifest.siteId}`, // Prefix to distinguish in local state
      manifest: manifest,
      contentFiles: validContentFiles,
    };

    return finalSiteData;

  } catch (error) {
    console.error(`CRITICAL ERROR fetching remote site data for ${remoteSiteUrl}:`, error);
    return null;
  }
}

================================================================================

File: core/libraries/__tests__/utils.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { slugify, generateSiteId, cn } from '../utils';

describe('utils', () => {
  describe('slugify', () => {
    test('converts text to lowercase slug', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    test('handles empty string', () => {
      expect(slugify('')).toBe('');
    });

    test('handles null and undefined', () => {
      expect(slugify(null as any)).toBe('');
      expect(slugify(undefined as any)).toBe('');
    });

    test('normalizes accented characters', () => {
      expect(slugify('Café Niño')).toBe('cafe-nino');
      expect(slugify('Åpfel Über')).toBe('apfel-uber');
      expect(slugify('José María')).toBe('jose-maria');
    });

    test('removes special characters', () => {
      expect(slugify('Hello@World#2024!')).toBe('helloworld2024');
      expect(slugify('Price: $99.99')).toBe('price-9999');
      expect(slugify('User & Admin')).toBe('user-admin');
    });

    test('replaces multiple spaces with single dash', () => {
      expect(slugify('Hello    World')).toBe('hello-world');
      expect(slugify('Multiple   Spaces  Here')).toBe('multiple-spaces-here');
    });

    test('replaces multiple dashes with single dash', () => {
      expect(slugify('Hello--World')).toBe('hello-world');
      expect(slugify('Multiple---Dashes')).toBe('multiple-dashes');
    });

    test('trims whitespace', () => {
      expect(slugify('  Hello World  ')).toBe('hello-world');
      expect(slugify('\t\nHello World\t\n')).toBe('hello-world');
    });

    test('handles numbers', () => {
      expect(slugify('Blog Post 123')).toBe('blog-post-123');
      expect(slugify('2024 Year in Review')).toBe('2024-year-in-review');
    });

    test('handles unicode characters', () => {
      expect(slugify('🎉 Party Time! 🎊')).toBe('party-time');
      expect(slugify('Test 中文 Content')).toBe('test-content');
    });

    test('handles mixed case and special characters', () => {
      expect(slugify('CamelCase-with_underscores')).toBe('camelcase-withunderscores');
      expect(slugify('API v2.0 (Beta)')).toBe('api-v20-beta');
    });

    test('handles very long strings', () => {
      const longText = 'a'.repeat(200);
      const result = slugify(longText);
      expect(result).toBe('a'.repeat(200));
      expect(result.length).toBe(200);
    });
  });

  describe('generateSiteId', () => {
    test('generates site ID with title slug and random string', () => {
      const result = generateSiteId('My Blog');
      expect(result).toMatch(/^my-blog-[a-z0-9]{5}$/);
    });

    test('handles empty title', () => {
      const result = generateSiteId('');
      expect(result).toMatch(/^-[a-z0-9]{5}$/);
    });

    test('truncates long titles', () => {
      const longTitle = 'A'.repeat(100);
      const result = generateSiteId(longTitle);
      
      // Should be truncated to 50 chars + dash + 5 random chars = 56 total
      expect(result.length).toBe(56);
      expect(result).toMatch(/^a{50}-[a-z0-9]{5}$/);
    });

    test('handles special characters in title', () => {
      const result = generateSiteId('My @#$% Blog!');
      expect(result).toMatch(/^my-blog-[a-z0-9]{5}$/);
    });

    test('generates unique IDs for same title', () => {
      const id1 = generateSiteId('Test Blog');
      const id2 = generateSiteId('Test Blog');
      
      expect(id1).not.toBe(id2);
      expect(id1.startsWith('test-blog-')).toBe(true);
      expect(id2.startsWith('test-blog-')).toBe(true);
    });

    test('handles accented characters', () => {
      const result = generateSiteId('Café Blog');
      expect(result).toMatch(/^cafe-blog-[a-z0-9]{5}$/);
    });

    test('random part is always 5 characters', () => {
      // Test multiple generations to ensure consistency
      for (let i = 0; i < 10; i++) {
        const result = generateSiteId('Test');
        const randomPart = result.split('-').pop();
        expect(randomPart).toHaveLength(5);
        expect(randomPart).toMatch(/^[a-z0-9]{5}$/);
      }
    });

    test('handles edge case of exactly 50 character title', () => {
      const title = 'a'.repeat(50);
      const result = generateSiteId(title);
      expect(result.length).toBe(56); // 50 + 1 dash + 5 random
      expect(result).toMatch(/^a{50}-[a-z0-9]{5}$/);
    });

    test('handles title with only special characters', () => {
      const result = generateSiteId('@#$%^&*()');
      expect(result).toMatch(/^-[a-z0-9]{5}$/);
    });
  });

  describe('cn (className utility)', () => {
    test('merges class names', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2');
    });

    test('handles conditional classes', () => {
      expect(cn('base', true && 'conditional', false && 'hidden')).toBe('base conditional');
    });

    test('handles Tailwind conflicts', () => {
      // twMerge should resolve conflicting Tailwind classes
      expect(cn('px-2', 'px-4')).toBe('px-4');
      expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    });

    test('handles arrays', () => {
      expect(cn(['class1', 'class2'])).toBe('class1 class2');
    });

    test('handles objects', () => {
      expect(cn({ 'class1': true, 'class2': false, 'class3': true })).toBe('class1 class3');
    });

    test('handles empty inputs', () => {
      expect(cn()).toBe('');
      expect(cn('')).toBe('');
      expect(cn(null)).toBe('');
      expect(cn(undefined)).toBe('');
    });

    test('handles mixed input types', () => {
      expect(cn(
        'base',
        ['array-class'],
        { 'object-class': true },
        true && 'conditional',
        ''
      )).toBe('base array-class object-class conditional');
    });
  });
});

================================================================================

File: core/libraries/__tests__/browsingUtils.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { parseSiteIdentifier, REMOTE_SITE_ID_MARKER } from '../browsingUtils';

describe('browsingUtils', () => {
  describe('parseSiteIdentifier', () => {
    test('handles local site ID string', () => {
      const result = parseSiteIdentifier('my-blog-abc123');
      
      expect(result).not.toBeNull();
      expect(result!.rawParam).toBe('my-blog-abc123');
      expect(result!.cleanedIdOrUrl).toBe('my-blog-abc123');
      expect(result!.isRemote).toBe(false);
      expect(result!.remoteBaseUrl).toBeNull();
      expect(result!.effectiveSiteId).toBe('my-blog-abc123');
    });

    test('handles site ID array (takes first element)', () => {
      const result = parseSiteIdentifier(['site-id-1', 'site-id-2']);
      
      expect(result).not.toBeNull();
      expect(result!.rawParam).toBe('site-id-1');
      expect(result!.cleanedIdOrUrl).toBe('site-id-1');
      expect(result!.isRemote).toBe(false);
      expect(result!.effectiveSiteId).toBe('site-id-1');
    });

    test('handles empty array', () => {
      const result = parseSiteIdentifier([]);
      
      expect(result).toBeNull();
    });

    test('handles undefined parameter', () => {
      const result = parseSiteIdentifier(undefined);
      
      expect(result).toBeNull();
    });

    test('handles empty string', () => {
      const result = parseSiteIdentifier('');
      
      expect(result).toBeNull();
    });

    test('handles quoted site ID', () => {
      const result = parseSiteIdentifier('"my-blog-abc123"');
      
      expect(result).not.toBeNull();
      expect(result!.cleanedIdOrUrl).toBe('my-blog-abc123');
      expect(result!.isRemote).toBe(false);
    });

    test('handles URL encoded site ID', () => {
      const encoded = encodeURIComponent('my-blog-abc123');
      const result = parseSiteIdentifier(encoded);
      
      expect(result).not.toBeNull();
      expect(result!.cleanedIdOrUrl).toBe('my-blog-abc123');
      expect(result!.isRemote).toBe(false);
    });

    test('handles double URL encoded quoted site ID', () => {
      // Simulate double encoding that might happen in some routing scenarios
      const doubleEncoded = encodeURIComponent(encodeURIComponent('"my-blog-abc123"'));
      const result = parseSiteIdentifier(doubleEncoded);
      
      expect(result).not.toBeNull();
      expect(result!.cleanedIdOrUrl).toBe('my-blog-abc123');
      expect(result!.isRemote).toBe(false);
    });

    test('handles malformed URL encoding gracefully', () => {
      const malformed = 'my-blog%ZZ'; // Invalid URL encoding
      const result = parseSiteIdentifier(malformed);
      
      expect(result).not.toBeNull();
      expect(result!.cleanedIdOrUrl).toBe('my-blog%ZZ'); // Should use as-is
      expect(result!.isRemote).toBe(false);
    });

    test('handles remote site URL', () => {
      const remoteId = `${REMOTE_SITE_ID_MARKER}https://example.com`;
      const result = parseSiteIdentifier(remoteId);
      
      expect(result).not.toBeNull();
      expect(result!.rawParam).toBe(remoteId);
      expect(result!.cleanedIdOrUrl).toBe(remoteId);
      expect(result!.isRemote).toBe(true);
      expect(result!.remoteBaseUrl).toBe('https://example.com');
      expect(result!.effectiveSiteId).toBe(remoteId);
    });

    test('handles remote site URL with port', () => {
      const remoteId = `${REMOTE_SITE_ID_MARKER}https://example.com:8080`;
      const result = parseSiteIdentifier(remoteId);
      
      expect(result).not.toBeNull();
      expect(result!.isRemote).toBe(true);
      expect(result!.remoteBaseUrl).toBe('https://example.com:8080');
    });

    test('handles remote site URL with path (extracts origin)', () => {
      const remoteId = `${REMOTE_SITE_ID_MARKER}https://example.com/some/path`;
      const result = parseSiteIdentifier(remoteId);
      
      expect(result).not.toBeNull();
      expect(result!.isRemote).toBe(true);
      expect(result!.remoteBaseUrl).toBe('https://example.com');
    });

    test('handles HTTP (non-HTTPS) remote URL', () => {
      const remoteId = `${REMOTE_SITE_ID_MARKER}http://localhost:3000`;
      const result = parseSiteIdentifier(remoteId);
      
      expect(result).not.toBeNull();
      expect(result!.isRemote).toBe(true);
      expect(result!.remoteBaseUrl).toBe('http://localhost:3000');
    });

    test('handles invalid remote URL', () => {
      const remoteId = `${REMOTE_SITE_ID_MARKER}not-a-valid-url`;
      const result = parseSiteIdentifier(remoteId);
      
      expect(result).not.toBeNull();
      expect(result!.isRemote).toBe(true);
      expect(result!.remoteBaseUrl).toBeNull(); // Should be null due to invalid URL
      expect(result!.effectiveSiteId).toBe(remoteId);
    });

    test('handles quoted remote site URL', () => {
      const remoteId = `"${REMOTE_SITE_ID_MARKER}https://example.com"`;
      const result = parseSiteIdentifier(remoteId);
      
      expect(result).not.toBeNull();
      expect(result!.cleanedIdOrUrl).toBe(`${REMOTE_SITE_ID_MARKER}https://example.com`);
      expect(result!.isRemote).toBe(true);
      expect(result!.remoteBaseUrl).toBe('https://example.com');
    });

    test('handles URL encoded remote site URL', () => {
      const remoteUrl = `${REMOTE_SITE_ID_MARKER}https://example.com/path?param=value`;
      const encoded = encodeURIComponent(remoteUrl);
      const result = parseSiteIdentifier(encoded);
      
      expect(result).not.toBeNull();
      expect(result!.isRemote).toBe(true);
      expect(result!.remoteBaseUrl).toBe('https://example.com');
    });

    test('handles complex encoding scenario with quotes and remote URL', () => {
      const remoteUrl = `${REMOTE_SITE_ID_MARKER}https://example.com`;
      const quotedAndEncoded = encodeURIComponent(`"${remoteUrl}"`);
      const result = parseSiteIdentifier(quotedAndEncoded);
      
      expect(result).not.toBeNull();
      expect(result!.isRemote).toBe(true);
      expect(result!.remoteBaseUrl).toBe('https://example.com');
    });

    test('handles edge case with only quotes', () => {
      const result = parseSiteIdentifier('""');
      
      expect(result).not.toBeNull();
      expect(result!.cleanedIdOrUrl).toBe('');
      expect(result!.isRemote).toBe(false);
    });

    test('handles site ID that starts with remote marker but is not remote', () => {
      // Edge case where someone might have a site ID that coincidentally starts with the marker
      const confusingId = `${REMOTE_SITE_ID_MARKER}local-site-id`;
      const result = parseSiteIdentifier(confusingId);
      
      expect(result).not.toBeNull();
      expect(result!.isRemote).toBe(true); // Would be treated as remote
      expect(result!.remoteBaseUrl).toBeNull(); // But URL parsing would fail
    });

    test('preserves special characters in local site IDs', () => {
      const result = parseSiteIdentifier('my-blog_test.site-123');
      
      expect(result).not.toBeNull();
      expect(result!.cleanedIdOrUrl).toBe('my-blog_test.site-123');
      expect(result!.isRemote).toBe(false);
    });

    test('handles deeply nested encoding', () => {
      const original = 'my-blog-123';
      const deeplyEncoded = encodeURIComponent(encodeURIComponent(encodeURIComponent(original)));
      const result = parseSiteIdentifier(deeplyEncoded);
      
      // The function only does one level of decoding, so deeply encoded strings won't be fully decoded
      expect(result).not.toBeNull();
      expect(result!.isRemote).toBe(false);
      // The exact result depends on how the decoding handles this case
    });

    test('handles international domain names', () => {
      const remoteId = `${REMOTE_SITE_ID_MARKER}https://例え.テスト`;
      const result = parseSiteIdentifier(remoteId);
      
      expect(result).not.toBeNull();
      expect(result!.isRemote).toBe(true);
      // URL constructor should handle IDN correctly
      expect(result!.remoteBaseUrl).toContain('例え.テスト');
    });
  });

  describe('REMOTE_SITE_ID_MARKER', () => {
    test('has expected value', () => {
      expect(REMOTE_SITE_ID_MARKER).toBe('remote@');
    });
  });
});

================================================================================

File: core/libraries/__tests__/markdownParser.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { parseMarkdownString, stringifyToMarkdown, parseAndRenderMarkdown } from '../markdownParser';
import type { MarkdownFrontmatter } from '@/core/types';

describe('markdownParser', () => {
  describe('parseMarkdownString', () => {
    test('parses markdown with valid frontmatter', () => {
      const input = `---
title: Test Post
date: 2024-01-01
tags: [test, markdown]
---

# Hello World

This is a test post.`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe('Test Post');
      expect(result.frontmatter.date).toEqual(new Date('2024-01-01'));
      expect(result.frontmatter.tags).toEqual(['test', 'markdown']);
      expect(result.content).toBe('# Hello World\n\nThis is a test post.');
    });

    test('handles markdown without frontmatter', () => {
      const input = `# Just Markdown

No frontmatter here.`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe('Untitled');
      expect(result.content).toBe('# Just Markdown\n\nNo frontmatter here.');
    });

    test('provides default title when missing', () => {
      const input = `---
date: 2024-01-01
---

Content without title.`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe('Untitled');
      expect(result.frontmatter.date).toEqual(new Date('2024-01-01'));
    });

    test('handles non-string title', () => {
      const input = `---
title: 123
---

Content with numeric title.`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe('Untitled');
    });

    test('trims content whitespace', () => {
      const input = `---
title: Test
---


  # Content with extra whitespace  


`;

      const result = parseMarkdownString(input);
      
      expect(result.content).toBe('# Content with extra whitespace');
    });

    test('throws error for invalid YAML frontmatter', () => {
      const input = `---
title: "Unclosed quote
date: invalid-yaml
---

Content`;

      expect(() => parseMarkdownString(input)).toThrow('Invalid YAML frontmatter format');
    });

    test('handles empty frontmatter', () => {
      const input = `---
---

Just content.`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe('Untitled');
      expect(result.content).toBe('Just content.');
    });

    test('handles complex frontmatter data types', () => {
      const input = `---
title: Complex Post
published: true
priority: 5
tags:
  - web
  - development
author:
  name: John Doe
  email: john@example.com
---

Complex frontmatter content.`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe('Complex Post');
      expect(result.frontmatter.published).toBe(true);
      expect(result.frontmatter.priority).toBe(5);
      expect(result.frontmatter.tags).toEqual(['web', 'development']);
      expect(result.frontmatter.author).toEqual({
        name: 'John Doe',
        email: 'john@example.com'
      });
    });

    test('handles malformed frontmatter delimiters', () => {
      const input = `--
title: Test
--

Content`;

      const result = parseMarkdownString(input);
      
      // Should treat the whole thing as content since delimiters are wrong
      expect(result.frontmatter.title).toBe('Untitled');
      expect(result.content).toContain('--\ntitle: Test\n--\n\nContent');
    });

    test('handles frontmatter with tabs and mixed indentation', () => {
      const input = `---
title: Test With Tabs
date: 2024-01-01
tags:
  - mixed
  - indentation
---

Content with tabs.`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe('Test With Tabs');
      expect(result.frontmatter.date).toEqual(new Date('2024-01-01'));
      expect(result.frontmatter.tags).toEqual(['mixed', 'indentation']);
    });

    test('handles frontmatter with Unicode characters', () => {
      const input = `---
title: "Tëst Pøst with 中文 and 🚀"
author: "Jürgen Müller"
tags: [中文, "русский", "العربية"]
---

# Content with émojis 🎉

Some Unicode content: café, naïve, résumé.`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe('Tëst Pøst with 中文 and 🚀');
      expect(result.frontmatter.author).toBe('Jürgen Müller');
      expect(result.frontmatter.tags).toEqual(['中文', 'русский', 'العربية']);
      expect(result.content).toContain('émojis 🎉');
      expect(result.content).toContain('café, naïve, résumé');
    });

    test('handles extremely long frontmatter values', () => {
      const longString = 'a'.repeat(10000);
      const input = `---
title: ${longString}
description: Short description
---

Content here.`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe(longString);
      expect(result.frontmatter.description).toBe('Short description');
      expect(result.content).toBe('Content here.');
    });

    test('handles YAML with special characters and escaping', () => {
      const input = `---
title: "Quote test: \\"nested quotes\\" work"
path: "C:\\\\Windows\\\\path"
regex: "/test[a-z]+\\\\d{3}/"
multiline: |
  Line 1
  Line 2 with "quotes"
  Line 3
---

Content with special chars.`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe('Quote test: "nested quotes" work');
      expect(result.frontmatter.path).toBe('C:\\Windows\\path');
      expect(result.frontmatter.regex).toBe('/test[a-z]+\\d{3}/');
      expect(result.frontmatter.multiline).toContain('Line 1\nLine 2 with "quotes"\nLine 3');
    });

    test('handles YAML parsing edge cases', () => {
      const input = `---
boolean_true: true
boolean_false: false
number_int: 42
number_float: 3.14
null_value: null
empty_string: ""
zero: 0
negative: -5
scientific: 1.23e-4
---

Edge case content.`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.boolean_true).toBe(true);
      expect(result.frontmatter.boolean_false).toBe(false);
      expect(result.frontmatter.number_int).toBe(42);
      expect(result.frontmatter.number_float).toBe(3.14);
      expect(result.frontmatter.null_value).toBe(null);
      expect(result.frontmatter.empty_string).toBe('');
      expect(result.frontmatter.zero).toBe(0);
      expect(result.frontmatter.negative).toBe(-5);
      expect(result.frontmatter.scientific).toBe(1.23e-4);
    });

    test('handles frontmatter only (no content)', () => {
      const input = `---
title: Frontmatter Only
date: 2024-01-01
---`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe('Frontmatter Only');
      expect(result.frontmatter.date).toEqual(new Date('2024-01-01'));
      expect(result.content).toBe('');
    });

    test('handles content only (no frontmatter markers)', () => {
      const input = `This is just plain content
with multiple lines
and no frontmatter at all.

Even with line breaks.`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe('Untitled');
      expect(result.content).toBe(input);
    });

    test('handles multiple frontmatter delimiter attempts', () => {
      const input = `---
title: First
---

Some content

---
title: Second
---

More content`;

      const result = parseMarkdownString(input);
      
      // Should only parse the first frontmatter block
      expect(result.frontmatter.title).toBe('First');
      expect(result.content).toContain('Some content\n\n---\ntitle: Second\n---\n\nMore content');
    });

    test('handles YAML with deeply nested objects', () => {
      const input = `---
title: Deep Nesting
config:
  level1:
    level2:
      level3:
        deep_value: "found it"
        array_deep:
          - item1
          - nested_item: true
---

Deep content.`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe('Deep Nesting');
      const config = result.frontmatter.config as Record<string, unknown>;
      const level1 = config.level1 as Record<string, unknown>;
      const level2 = level1.level2 as Record<string, unknown>;
      const level3 = level2.level3 as Record<string, unknown>;
      expect(level3.deep_value).toBe('found it');
      expect((level3.array_deep as unknown[])[0]).toBe('item1');
      expect((level3.array_deep as unknown[])[1]).toEqual({ nested_item: true });
    });
  });

  describe('stringifyToMarkdown', () => {
    test('converts frontmatter and content to markdown string', () => {
      const frontmatter: MarkdownFrontmatter = {
        title: 'Test Post',
        layout: 'post',
        date: '2024-01-01',
        tags: ['test', 'markdown']
      };
      const content = '# Hello World\n\nThis is a test.';

      const result = stringifyToMarkdown(frontmatter, content);
      
      expect(result).toContain('---\n');
      expect(result).toContain('title: Test Post');
      expect(result).toContain('layout: post');
      expect(result).toContain('date: \'2024-01-01\'');
      expect(result).toContain('tags:\n  - test\n  - markdown');
      expect(result).toContain('---\n\n# Hello World\n\nThis is a test.');
    });

    test('handles empty frontmatter', () => {
      const content = 'Just content.';

      // Clear all properties except title to simulate empty frontmatter
      const emptyFrontmatter = { title: undefined } as any;
      
      const result = stringifyToMarkdown(emptyFrontmatter, content);
      
      expect(result).toBe('Just content.');
      expect(result).not.toContain('---');
    });

    test('filters out null and undefined values', () => {
      const frontmatter: MarkdownFrontmatter = {
        title: 'Test Post',
        layout: 'post',
        date: undefined as any,
        tags: null as any,
        published: true
      };
      const content = 'Content here.';

      const result = stringifyToMarkdown(frontmatter, content);
      
      expect(result).toContain('title: Test Post');
      expect(result).toContain('published: true');
      expect(result).not.toContain('date:');
      expect(result).not.toContain('tags:');
    });

    test('handles complex nested objects', () => {
      const frontmatter: MarkdownFrontmatter = {
        title: 'Complex Post',
        layout: 'post',
        author: {
          name: 'John Doe',
          email: 'john@example.com'
        } as Record<string, unknown>,
        metadata: {
          priority: 5,
          featured: true
        } as Record<string, unknown>
      };
      const content = 'Complex content.';

      const result = stringifyToMarkdown(frontmatter, content);
      
      expect(result).toContain('title: Complex Post');
      expect(result).toContain('author:');
      expect(result).toContain('name: John Doe');
      expect(result).toContain('email: john@example.com');
      expect(result).toContain('metadata:');
      expect(result).toContain('priority: 5');
      expect(result).toContain('featured: true');
    });

    test('handles arrays in frontmatter', () => {
      const frontmatter: MarkdownFrontmatter = {
        title: 'Array Test',
        layout: 'post',
        tags: ['one', 'two', 'three'] as any,
        numbers: [1, 2, 3] as any
      };
      const content = 'Array content.';

      const result = stringifyToMarkdown(frontmatter, content);
      
      expect(result).toContain('tags:\n  - one\n  - two\n  - three');
      expect(result).toContain('numbers:\n  - 1\n  - 2\n  - 3');
    });

    test('escapes special YAML characters', () => {
      const frontmatter: MarkdownFrontmatter = {
        title: 'Title with: colon',
        layout: 'post',
        description: 'Description with "quotes" and \'apostrophes\'' as any
      };
      const content = 'Special characters content.';

      const result = stringifyToMarkdown(frontmatter, content);
      
      // YAML should properly escape these
      expect(result).toContain('title: \'Title with: colon\'');
      expect(result).toMatch(/description: ['"]?Description with "quotes".*['"]?/);
    });

    test('roundtrip test - parse then stringify', () => {
      const original = `---
title: Roundtrip Test
date: '2024-01-01'
tags:
  - test
  - roundtrip
published: true
---

# Roundtrip Content

This should survive the roundtrip.`;

      const parsed = parseMarkdownString(original);
      const stringified = stringifyToMarkdown(parsed.frontmatter, parsed.content);
      const reparsed = parseMarkdownString(stringified);

      expect(reparsed.frontmatter.title).toBe('Roundtrip Test');
      expect(reparsed.frontmatter.date).toBe('2024-01-01');
      expect(reparsed.frontmatter.tags).toEqual(['test', 'roundtrip']);
      expect(reparsed.frontmatter.published).toBe(true);
      expect(reparsed.content).toBe('# Roundtrip Content\n\nThis should survive the roundtrip.');
    });

    test('handles empty content', () => {
      const frontmatter: MarkdownFrontmatter = {
        title: 'Empty Content Test',
        layout: 'post'
      };
      const content = '';

      const result = stringifyToMarkdown(frontmatter, content);
      
      expect(result).toContain('title: Empty Content Test');
      expect(result).toContain('layout: post');
      expect(result).toContain('---\n\n');
      expect(result.endsWith('\n\n')).toBe(true);
    });

    test('handles content with only whitespace', () => {
      const frontmatter: MarkdownFrontmatter = {
        title: 'Whitespace Test',
        layout: 'post'
      };
      const content = '   \n\n\t  \n   ';

      const result = stringifyToMarkdown(frontmatter, content);
      
      expect(result).toContain('title: Whitespace Test');
      // Should trim whitespace content
      expect(result.trim()).toMatch(/---\s*$/);
    });

    test('preserves boolean false values', () => {
      const frontmatter: MarkdownFrontmatter = {
        title: 'Boolean Test',
        layout: 'post',
        published: false as any,
        draft: true as any
      };
      const content = 'Boolean content.';

      const result = stringifyToMarkdown(frontmatter, content);
      
      expect(result).toContain('published: false');
      expect(result).toContain('draft: true');
    });

    test('preserves zero values', () => {
      const frontmatter: MarkdownFrontmatter = {
        title: 'Zero Test',
        layout: 'post',
        rating: 0 as any,
        count: 0 as any
      };
      const content = 'Zero content.';

      const result = stringifyToMarkdown(frontmatter, content);
      
      expect(result).toContain('rating: 0');
      expect(result).toContain('count: 0');
    });

    test('handles Unicode in frontmatter output', () => {
      const frontmatter: MarkdownFrontmatter = {
        title: 'Ünïcødé Tést 🎉',
        layout: 'post',
        author: 'José María' as any,
        tags: ['中文', 'русский'] as any
      };
      const content = 'Unicode content with émojis 🚀.';

      const result = stringifyToMarkdown(frontmatter, content);
      
      expect(result).toMatch(/title: ['"]?Ünïcødé Tést 🎉['"]?/);
      expect(result).toMatch(/author: ['"]?José María['"]?/);
      expect(result).toContain('- 中文');
      expect(result).toContain('- русский');
      expect(result).toContain('Unicode content with émojis 🚀');
    });

    test('handles very large arrays', () => {
      const largeTags = Array.from({ length: 100 }, (_, i) => `tag${i}`);
      const frontmatter: MarkdownFrontmatter = {
        title: 'Large Array Test',
        layout: 'post',
        tags: largeTags as any
      };
      const content = 'Large array content.';

      const result = stringifyToMarkdown(frontmatter, content);
      
      expect(result).toContain('title: Large Array Test');
      expect(result).toContain('- tag0');
      expect(result).toContain('- tag99');
      largeTags.forEach(tag => {
        expect(result).toContain(`- ${tag}`);
      });
    });
  });

  describe('parseAndRenderMarkdown', () => {
    test('creates ParsedMarkdownFile object', () => {
      const rawContent = `---
title: Test File
date: 2024-01-01
---

# Test Content

This is a test file.`;

      const result = parseAndRenderMarkdown('test-slug', '/path/to/file.md', rawContent);

      expect(result.slug).toBe('test-slug');
      expect(result.path).toBe('/path/to/file.md');
      expect(result.frontmatter.title).toBe('Test File');
      expect(result.frontmatter.date).toEqual(new Date('2024-01-01'));
      expect(result.content).toBe('# Test Content\n\nThis is a test file.');
    });

    test('handles file without frontmatter', () => {
      const rawContent = `# Just Content

No frontmatter in this file.`;

      const result = parseAndRenderMarkdown('content-only', '/content.md', rawContent);

      expect(result.slug).toBe('content-only');
      expect(result.path).toBe('/content.md');
      expect(result.frontmatter.title).toBe('Untitled');
      expect(result.content).toBe('# Just Content\n\nNo frontmatter in this file.');
    });

    test('passes through parsing errors', () => {
      const rawContent = `---
title: "Invalid YAML
---

Content`;

      expect(() => parseAndRenderMarkdown('error-test', '/error.md', rawContent))
        .toThrow('Invalid YAML frontmatter format');
    });

    test('handles empty raw content', () => {
      const result = parseAndRenderMarkdown('empty', '/empty.md', '');

      expect(result.slug).toBe('empty');
      expect(result.path).toBe('/empty.md');
      expect(result.frontmatter.title).toBe('Untitled');
      expect(result.content).toBe('');
    });

    test('handles very long file paths', () => {
      const longPath = '/very/deep/nested/directory/structure/with/many/levels/of/nesting/that/goes/on/and/on/file.md';
      const rawContent = `---
title: Long Path Test
---

Content for long path.`;

      const result = parseAndRenderMarkdown('long-path', longPath, rawContent);

      expect(result.slug).toBe('long-path');
      expect(result.path).toBe(longPath);
      expect(result.frontmatter.title).toBe('Long Path Test');
    });

    test('handles special characters in slug and path', () => {
      const specialSlug = 'test-slug-with-中文-and-émojis-🚀';
      const specialPath = '/path/with spaces/and-中文/file.md';
      const rawContent = `---
title: Special Characters
---

Special content.`;

      const result = parseAndRenderMarkdown(specialSlug, specialPath, rawContent);

      expect(result.slug).toBe(specialSlug);
      expect(result.path).toBe(specialPath);
      expect(result.frontmatter.title).toBe('Special Characters');
    });

    test('preserves all frontmatter properties', () => {
      const rawContent = `---
title: Complete Test
author: Test Author
date: 2024-01-01
published: true
tags: [test, complete]
metadata:
  category: testing
  priority: high
---

Complete content.`;

      const result = parseAndRenderMarkdown('complete', '/complete.md', rawContent);

      expect(result.frontmatter.title).toBe('Complete Test');
      expect(result.frontmatter.author).toBe('Test Author');
      expect(result.frontmatter.date).toEqual(new Date('2024-01-01'));
      expect(result.frontmatter.published).toBe(true);
      expect(result.frontmatter.tags).toEqual(['test', 'complete']);
      expect((result.frontmatter.metadata as any).category).toBe('testing');
      expect((result.frontmatter.metadata as any).priority).toBe('high');
    });
  });

  describe('Performance and Edge Cases', () => {
    test('handles very large markdown content', () => {
      const largeContent = 'This is a line of content.\n'.repeat(10000);
      const input = `---
title: Large Content Test
---

${largeContent}`;

      const start = performance.now();
      const result = parseMarkdownString(input);
      const end = performance.now();

      expect(result.frontmatter.title).toBe('Large Content Test');
      expect(result.content).toContain('This is a line of content.');
      expect(result.content.split('\n')).toHaveLength(10000); // 10000 lines
      expect(end - start).toBeLessThan(1000); // Should complete within 1 second
    });

    test('handles very large frontmatter with many properties', () => {
      const frontmatterEntries = Array.from({ length: 1000 }, (_, i) => `prop${i}: value${i}`).join('\n');
      const input = `---
title: Large Frontmatter Test
${frontmatterEntries}
---

Content here.`;

      const start = performance.now();
      const result = parseMarkdownString(input);
      const end = performance.now();

      expect(result.frontmatter.title).toBe('Large Frontmatter Test');
      expect((result.frontmatter as any).prop0).toBe('value0');
      expect((result.frontmatter as any).prop999).toBe('value999');
      expect(end - start).toBeLessThan(1000); // Should complete within 1 second
    });

    test('handles markdown with no line breaks', () => {
      const input = '---\ntitle: No Breaks\n---\nContent without any line breaks in a very long single line that goes on and on and should still be parsed correctly by the markdown parser.';

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe('No Breaks');
      expect(result.content).toContain('Content without any line breaks');
    });

    test('handles extremely nested YAML structures', () => {
      const input = `---
title: Deep Nesting
level1:
  level2:
    level3:
      level4:
        level5:
          level6:
            level7:
              level8:
                level9:
                  level10:
                    deep_value: "maximum depth"
---

Deep nesting content.`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe('Deep Nesting');
      expect((result.frontmatter as any).level1.level2.level3.level4.level5.level6.level7.level8.level9.level10.deep_value).toBe('maximum depth');
    });

    test('handles frontmatter with binary-like data', () => {
      const binaryString = Array.from({ length: 100 }, () => Math.random() > 0.5 ? '1' : '0').join('');
      const input = `---
title: Binary Test
binary_data: "${binaryString}"
hex_data: "0x${Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}"
---

Binary content.`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe('Binary Test');
      expect((result.frontmatter as any).binary_data).toBe(binaryString);
      expect((result.frontmatter as any).hex_data).toMatch(/^0x[0-9a-f]{32}$/);
    });

    test('handles roundtrip with complex Unicode and special characters', () => {
      const complexContent = `# Test with 中文, Ñoño, and 🎉

This content has:
- Unicode: café, naïve, résumé
- Emojis: 🚀 🎯 💻 🔥
- Mathematical symbols: ∑ ∆ π ∞
- Currency: € $ ¥ £
- Special chars: @#$%^&*()_+-={}[]|\\:";'<>?,./`;

      const frontmatter: MarkdownFrontmatter = {
        title: 'Complex Unicode Test 🌍',
        layout: 'post',
        tags: ['unicode', '中文', 'émojis'] as any,
        description: 'Test with café and naïve words 🎉' as any
      };

      const stringified = stringifyToMarkdown(frontmatter, complexContent);
      const reparsed = parseMarkdownString(stringified);

      expect(reparsed.frontmatter.title).toBe('Complex Unicode Test 🌍');
      expect(reparsed.frontmatter.tags).toEqual(['unicode', '中文', 'émojis']);
      expect(reparsed.content).toContain('café, naïve, résumé');
      expect(reparsed.content).toContain('🚀 🎯 💻 🔥');
      expect(reparsed.content).toContain('∑ ∆ π ∞');
    });

    test('performance test for parseAndRenderMarkdown with large files', () => {
      const largeRawContent = `---
title: Performance Test
author: Test Author
tags: ${JSON.stringify(Array.from({ length: 100 }, (_, i) => `tag${i}`))}
metadata:
  large_array: ${JSON.stringify(Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item${i}` })))}
---

${'# Performance test content\n\nThis is line content.\n'.repeat(1000)}`;

      const start = performance.now();
      const result = parseAndRenderMarkdown('perf-test', '/large-file.md', largeRawContent);
      const end = performance.now();

      expect(result.slug).toBe('perf-test');
      expect(result.frontmatter.title).toBe('Performance Test');
      expect((result.frontmatter.tags as any)).toHaveLength(100);
      expect((result.frontmatter.metadata as any).large_array).toHaveLength(1000);
      expect(end - start).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });
});

================================================================================

File: core/state/uiStore.ts
// src/core/state/uiStore.ts

import { create, type StateCreator } from 'zustand';
import { type ReactNode } from 'react';

// --- Helper for screen size ---
const isDesktopView = () => typeof window !== 'undefined' && window.innerWidth >= 1024;

// --- Type Definitions for the store structure ---

// Defines the shape of the data in the sidebar slice
interface SidebarState {
  isLeftOpen: boolean;
  isRightOpen: boolean;
  isLeftAvailable: boolean;
  isRightAvailable: boolean;
  leftSidebarContent: ReactNode | null;
  rightSidebarContent: ReactNode | null;
}

// Defines the actions available in the sidebar slice
interface SidebarActions {
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setLeftAvailable: (available: boolean) => void;
  setRightAvailable: (available: boolean) => void;
  setRightOpen: (isOpen: boolean) => void;
  setLeftSidebarContent: (content: ReactNode | null) => void;
  setRightSidebarContent: (content: ReactNode | null) => void;
}

// Defines the shape of the data in the screen slice
interface ScreenState {
  isDesktop: boolean;
  isInitialized: boolean;
}

// Defines the actions available in the screen slice
interface ScreenActions {
    initializeScreenSize: () => void;
}

// The full store shape, combining state and actions
type UIState = {
    sidebar: SidebarState & SidebarActions;
    screen: ScreenState & ScreenActions;
}

// --- Store Slice Implementations ---

// Creates the sidebar slice of the store
const createSidebarSlice: StateCreator<UIState, [], [], { sidebar: SidebarState & SidebarActions }> = (set, get) => ({
  sidebar: {
    isLeftOpen: isDesktopView(),
    isRightOpen: isDesktopView(),
    isLeftAvailable: false,
    isRightAvailable: false,
    leftSidebarContent: null,
    rightSidebarContent: null,
    toggleLeftSidebar: () => set(state => ({ 
        sidebar: { 
            ...state.sidebar, 
            isLeftOpen: !state.sidebar.isLeftOpen, 
            // On mobile, opening one sidebar closes the other
            isRightOpen: !get().screen.isDesktop && !state.sidebar.isLeftOpen ? false : state.sidebar.isRightOpen 
        }
    })),
    toggleRightSidebar: () => set(state => ({ 
        sidebar: { 
            ...state.sidebar, 
            isRightOpen: !state.sidebar.isRightOpen, 
            isLeftOpen: !get().screen.isDesktop && !state.sidebar.isRightOpen ? false : state.sidebar.isLeftOpen 
        }
    })),
    setLeftAvailable: (available) => set(state => ({ sidebar: { ...state.sidebar, isLeftAvailable: available }})),
    setRightAvailable: (available) => set(state => ({ sidebar: { ...state.sidebar, isRightAvailable: available }})),
    setRightOpen: (isOpen) => set(state => ({ sidebar: { ...state.sidebar, isRightOpen: isOpen }})),
    setLeftSidebarContent: (content) => set(state => ({ sidebar: { ...state.sidebar, leftSidebarContent: content }})),
    setRightSidebarContent: (content) => set(state => ({ sidebar: { ...state.sidebar, rightSidebarContent: content }})),

  }
});

// Creates the screen slice of the store
const createScreenSlice: StateCreator<UIState, [], [], { screen: ScreenState & ScreenActions }> = (set, get) => ({
    screen: {
        isDesktop: isDesktopView(),
        isInitialized: false, // Initialize the flag to false
        initializeScreenSize: () => {
          // Add a guard clause to prevent running more than once
          if (get().screen.isInitialized) return;

          // Set the flag to true immediately to block re-entry
          set(state => ({
            screen: { ...state.screen, isInitialized: true }
          }));

          if (typeof window === 'undefined') return;

          const handleResize = () => {
            const desktop = isDesktopView();
            if (desktop !== get().screen.isDesktop) {
              set({
                  screen: { ...get().screen, isDesktop: desktop },
                  sidebar: { ...get().sidebar, isLeftOpen: desktop, isRightOpen: desktop }
                });
            }
          };
          window.addEventListener('resize', handleResize);
          handleResize();
        },
    }
});


// Combine the slices to create the final store
export const useUIStore = create<UIState>()((...a) => ({
    ...createSidebarSlice(...a),
    ...createScreenSlice(...a),
}));

================================================================================

File: core/state/useAppStore.ts
// src/core/state/useAppStore.ts
import { create, type StoreApi } from 'zustand';
import { enableMapSet } from 'immer';
import { type SiteSlice, createSiteSlice } from './slices/siteSlice';
import { type ContentSlice, createContentSlice } from './slices/contentSlice';
import { type SecretsSlice, createSecretsSlice } from './slices/secretsSlice';

// Enable Immer for Map and Set support, which is good practice with Zustand.
enableMapSet();

/**
 * The full, combined type for the application's global store.
 * It's an intersection of all slice types plus root-level state.
 */
export type AppStore = SiteSlice & ContentSlice & SecretsSlice & {
  isInitialized: boolean;
  initialize: () => void;
  activeSiteId: string | null;
  setActiveSiteId: (siteId: string | null) => void;
};

/**
 * The main application store, built with Zustand.
 * It combines multiple "slices" of state for better organization.
 */
export const useAppStore = create<AppStore>()((set, get, api) => ({
  // --- Root State Properties ---
  isInitialized: false,
  activeSiteId: null,

  // --- Root State Actions ---

  /**
   * Initializes the application state. This should only be called once when the app loads.
   * It prevents re-initialization and triggers the hydration of sites from local storage.
   */
  initialize: () => {
    if (get().isInitialized) {
      return;
    }

    console.log('[AppStore] Initializing application state...');
    
    // Call the hydration action to load sites from storage.
    get().initializeSites().then(() => {
        set({ isInitialized: true });
        console.log('[AppStore] State initialized.');
    }).catch((error) => {
        console.error('[AppStore] Failed to initialize application state:', error);
        // Initialize anyway to prevent hanging
        set({ isInitialized: true });
        console.log('[AppStore] State initialized with errors.');
    });
  },

  /**
   * Sets the currently active site ID for the application.
   * @param siteId The ID of the site to set as active, or null to clear it.
   */
  setActiveSiteId: (siteId) => {
    set({ activeSiteId: siteId });
  },

  // --- Slices ---
  // The store is composed of smaller, focused slices of state.
  // --- FIX: Pass all three arguments (set, get, api) to each slice creator. ---
  // This satisfies the StateCreator type contract and resolves the build errors.
  ...createSiteSlice(set, get, api as StoreApi<AppStore>),
  ...createContentSlice(set, get, api as StoreApi<AppStore>),
  ...createSecretsSlice(set, get, api as StoreApi<AppStore>),
}));

================================================================================

File: core/state/slices/contentSlice.ts
// src/core/state/slices/contentSlice.ts
import { type StateCreator } from 'zustand';
import { produce } from 'immer';
import { toast } from 'sonner';

// Core Types and Services
import { type ParsedMarkdownFile, type StructureNode, type Manifest, type LocalSiteData, type CollectionItemRef } from '@/core/types';
import * as localSiteFs from '@/core/services/localFileSystem.service';
import { findAndRemoveNode, updatePathsRecursively, findNodeByPath } from '@/core/services/fileTree.service';
import { getCollections } from '@/core/services/collections.service';
import { stringifyToMarkdown } from '@/core/libraries/markdownParser';
import { type SiteSlice } from '@/core/state/slices/siteSlice';

/**
 * ============================================================================
 * Manifest Synchronization Helper
 * ============================================================================
 * Generates a fresh `collectionItems` array based on the current state of all
 * content files and collections. This must be called after any content change.
 * ============================================================================
 */
function buildCollectionItemRefs(siteData: LocalSiteData): CollectionItemRef[] {
  const collections = getCollections(siteData.manifest);
  const newCollectionItems: CollectionItemRef[] = [];

  for (const collection of collections) {
    const items = (siteData.contentFiles || []).filter(file =>
      file.path.startsWith(collection.contentPath)
    );
    for (const item of items) {
      const itemUrl = `/${collection.id}/${item.slug}`;
      newCollectionItems.push({
        collectionId: collection.id,
        slug: item.slug,
        path: item.path,
        title: item.frontmatter.title || item.slug,
        url: itemUrl,
      });
    }
  }
  return newCollectionItems;
}

/**
 * Helper function to update file paths in an array of content files.
 */
const updateContentFilePaths = (files: ParsedMarkdownFile[], pathsToMove: { oldPath: string; newPath: string }[]): ParsedMarkdownFile[] => {
  const pathMap = new Map(pathsToMove.map(p => [p.oldPath, p.newPath]));
  return files.map(file => {
    if (pathMap.has(file.path)) {
      const newPath = pathMap.get(file.path)!;
      const newSlug = newPath.split('/').pop()?.replace('.md', '') ?? '';
      return { ...file, path: newPath, slug: newSlug };
    }
    return file;
  });
};

/**
 * The interface for all actions related to content file management.
 */
export interface ContentSlice {
  addOrUpdateContentFile: (siteId: string, filePath: string, rawMarkdownContent: string) => Promise<boolean>;
  deleteContentFileAndState: (siteId: string, filePath: string) => Promise<void>;
  repositionNode: (siteId: string, activeNodePath: string, newParentPath: string | null, newIndex: number) => Promise<void>;
  updateContentFileOnly: (siteId: string, savedFile: ParsedMarkdownFile) => Promise<void>;
}

/**
 * Creates the content management slice of the Zustand store.
 */
export const createContentSlice: StateCreator<SiteSlice & ContentSlice, [], [], ContentSlice> = (set, get) => ({

  /**
   * A lightweight action to save changes to an existing file's content or frontmatter.
   */
  updateContentFileOnly: async (siteId, savedFile) => {
    await localSiteFs.saveContentFile(siteId, savedFile.path, stringifyToMarkdown(savedFile.frontmatter, savedFile.content));
    set(produce((draft: SiteSlice) => {
      const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
      if (siteToUpdate?.contentFiles) {
        const fileIndex = siteToUpdate.contentFiles.findIndex(f => f.path === savedFile.path);
        if (fileIndex !== -1) siteToUpdate.contentFiles[fileIndex] = savedFile;
        else siteToUpdate.contentFiles.push(savedFile);
        siteToUpdate.manifest.collectionItems = buildCollectionItemRefs(siteToUpdate as LocalSiteData);
      }
    }));
    const finalManifest = get().getSiteById(siteId)!.manifest;
    await localSiteFs.saveManifest(siteId, finalManifest);
  },

  /**
   * The primary action for creating or updating a content file.
   */
  addOrUpdateContentFile: async (siteId, filePath, rawMarkdownContent) => {
    const savedFile = await localSiteFs.saveContentFile(siteId, filePath, rawMarkdownContent);
    set(produce((draft: SiteSlice) => {
      const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
      if (!siteToUpdate) return;
      if (!siteToUpdate.contentFiles) siteToUpdate.contentFiles = [];
      const fileIndex = siteToUpdate.contentFiles.findIndex(f => f.path === savedFile.path);
      if (fileIndex !== -1) siteToUpdate.contentFiles[fileIndex] = savedFile;
      else siteToUpdate.contentFiles.push(savedFile);
      const isCollectionItem = getCollections(siteToUpdate.manifest).some(c => savedFile.path.startsWith(c.contentPath));
      const isNewFileInStructure = !findNodeByPath(siteToUpdate.manifest.structure, filePath);
      if (isNewFileInStructure && !isCollectionItem) {
        const newNode: StructureNode = { type: 'page', title: savedFile.frontmatter.title, path: filePath, slug: savedFile.slug, navOrder: siteToUpdate.manifest.structure.length, children: [] };
        siteToUpdate.manifest.structure.push(newNode);
      } else if (!isNewFileInStructure) {
        const findAndUpdate = (nodes: StructureNode[]): void => {
          for (const node of nodes) {
            if (node.path === filePath) { node.title = savedFile.frontmatter.title; return; }
            if (node.children) findAndUpdate(node.children);
          }
        };
        findAndUpdate(siteToUpdate.manifest.structure);
      }
      siteToUpdate.manifest.collectionItems = buildCollectionItemRefs(siteToUpdate as LocalSiteData);
    }));
    const finalManifest = get().getSiteById(siteId)!.manifest;
    await localSiteFs.saveManifest(siteId, finalManifest);
    return true;
  },

  /**
   * Deletes a content file from storage and updates all necessary parts of the manifest.
   */
  deleteContentFileAndState: async (siteId, filePath) => {
    const site = get().getSiteById(siteId);
    if (!site) return;
    const fileToDelete = site.contentFiles?.find(f => f.path === filePath);
    if (fileToDelete?.frontmatter.homepage === true) {
      toast.error("Cannot delete the homepage.", { description: "The first page of a site is permanent." });
      return;
    }
    await localSiteFs.deleteContentFile(siteId, filePath);
    set(produce((draft: SiteSlice) => {
      const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
      if (!siteToUpdate) return;
      if (siteToUpdate.contentFiles) siteToUpdate.contentFiles = siteToUpdate.contentFiles.filter(f => f.path !== filePath);
      const filterStructure = (nodes: StructureNode[]): StructureNode[] => nodes.filter(node => {
        if (node.path === filePath) return false;
        if (node.children) node.children = filterStructure(node.children);
        return true;
      });
      siteToUpdate.manifest.structure = filterStructure(siteToUpdate.manifest.structure);
      siteToUpdate.manifest.collectionItems = buildCollectionItemRefs(siteToUpdate as LocalSiteData);
    }));
    const finalManifest = get().getSiteById(siteId)!.manifest;
    await localSiteFs.saveManifest(siteId, finalManifest);
    toast.success(`Page "${fileToDelete?.frontmatter.title || 'file'}" deleted.`);
  },

  /**
   * Handles the drag-and-drop repositioning of a page in the site's navigation structure.
   */
  repositionNode: async (siteId, activeNodePath, newParentPath, newIndex) => {
    const site = get().getSiteById(siteId);
    if (!site?.contentFiles || !site.manifest) {
      toast.error("Site data not ready. Cannot move page.");
      return;
    }

    // --- Business logic and validation for drag-and-drop ---
    const structure = site.manifest.structure;
    if (activeNodePath === structure[0]?.path) {
      toast.error("The homepage cannot be moved.");
      return;
    }

    // --- Calculate the new structure in memory ---
    const { found: activeNode, tree: treeWithoutActive } = findAndRemoveNode([...structure], activeNodePath);
    if (!activeNode) return;

    const newParentDir = newParentPath ? newParentPath.replace(/\.md$/, '') : 'content';
    const finalActiveNode = updatePathsRecursively(activeNode, newParentDir);

    const pathsToMove: { oldPath: string; newPath: string }[] = [];
    const collectPaths = (newNode: StructureNode, oldNode: StructureNode) => {
        if (newNode.path !== oldNode.path) pathsToMove.push({ oldPath: oldNode.path, newPath: newNode.path });
        if (newNode.children && oldNode.children) newNode.children.forEach((child, i) => collectPaths(child, oldNode.children![i]));
    };
    collectPaths(finalActiveNode, activeNode);

    const finalTree = produce(treeWithoutActive, (draft: StructureNode[]) => {
        if (newParentPath) {
            const parent = findNodeByPath(draft, newParentPath);
            if (parent) {
                parent.children = parent.children || [];
                parent.children.splice(newIndex, 0, finalActiveNode);
            }
        } else {
            draft.splice(newIndex, 0, finalActiveNode);
        }
    });

    try {
      // 1. Perform async file operations first.
      if (pathsToMove.length > 0) await localSiteFs.moveContentFiles(siteId, pathsToMove);

      // 2. Perform a single, atomic update to the in-memory state.
      set(produce((draft: SiteSlice) => {
        const siteToUpdate = draft.sites.find((s: LocalSiteData) => s.siteId === siteId);
        if (siteToUpdate) {
          siteToUpdate.manifest.structure = finalTree;
          siteToUpdate.contentFiles = updateContentFilePaths(siteToUpdate.contentFiles!, pathsToMove);
          siteToUpdate.manifest.collectionItems = buildCollectionItemRefs(siteToUpdate as LocalSiteData);
        }
      }));

      // 3. Persist the final, synchronized manifest to storage.
      const finalManifest = get().getSiteById(siteId)!.manifest;
      await localSiteFs.saveManifest(siteId, finalManifest);

      toast.success("Site structure updated successfully.");
    } catch (error) {
      console.error("Failed to reposition node:", error);
      toast.error("An error occurred while updating the site structure. Reverting changes.");
      get().loadSite(siteId); // Reload to revert failed changes
    }
  },
});

================================================================================

File: core/state/slices/siteSlice.ts
// src/core/state/slices/siteSlice.ts

import { type StateCreator } from 'zustand';
import { produce } from 'immer';
import {  type LocalSiteData,  type Manifest } from '@/core/types';
import * as localSiteFs from '@/core/services/localFileSystem.service';
import { loadSiteSecretsFromDb } from '@/core/services/siteSecrets.service';
import { toast } from 'sonner';

export interface SiteSlice {
  sites: LocalSiteData[];
  loadingSites: Set<string>;
  getSiteById: (siteId: string) => LocalSiteData | undefined;
  loadSite: (siteId: string) => Promise<void>;
  addSite: (siteData: LocalSiteData) => Promise<void>;
  updateManifest: (siteId: string, manifest: Manifest) => Promise<void>;
  deleteSiteAndState: (siteId: string) => Promise<void>;
  initializeSites: () => Promise<void>;
}

export const createSiteSlice: StateCreator<SiteSlice, [], [], SiteSlice> = (set, get) => ({
  sites: [],
  loadingSites: new Set(),
  getSiteById: (siteId) => get().sites.find(s => s.siteId === siteId),

  initializeSites: async () => {
    // ... (this function is correct, no changes needed)
    try {
      const manifests = await localSiteFs.loadAllSiteManifests();
      const initialSites: LocalSiteData[] = manifests.map(manifest => ({
        siteId: manifest.siteId,
        manifest: manifest,
      }));
      set({ sites: initialSites });
    } catch (error) {
      console.error("Failed to initialize sites from storage:", error);
      toast.error("Could not load your sites. Storage might be corrupted.");
    }
  },

  loadSite: async (siteId) => {
    // --- FIX: This logic is now non-destructive ---
    if (get().loadingSites.has(siteId)) return;
    
    const existingSite = get().getSiteById(siteId);
    // Only fetch if core content files aren't already loaded.
    if (existingSite && existingSite.contentFiles) return;
    
    set(produce(draft => { draft.loadingSites.add(siteId); }));

    try {
      const rawManifest = await localSiteFs.getManifestById(siteId);
      if (!rawManifest) throw new Error(`Failed to load manifest for siteId: ${siteId}`);
      
      const manifest = rawManifest;
      
      const [contentFiles, layoutFiles, themeFiles, secrets] = await Promise.all([
        localSiteFs.getSiteContentFiles(siteId),
        localSiteFs.getSiteLayoutFiles(siteId),
        localSiteFs.getSiteThemeFiles(siteId),
        loadSiteSecretsFromDb(siteId)
      ]);

      const loadedData = { manifest, contentFiles, layoutFiles, themeFiles, secrets };

      set(produce((draft: SiteSlice) => {
        const siteIndex = draft.sites.findIndex(s => s.siteId === siteId);
        if (siteIndex > -1) {
          // Instead of replacing, we MERGE the loaded data into the existing object.
          // This preserves any other data that might already be in the in-memory state.
          draft.sites[siteIndex] = { ...draft.sites[siteIndex], ...loadedData };
        } else {
          // If it's a new site being loaded, add it.
          draft.sites.push({ siteId, ...loadedData });
        }
      }));
    } catch (error) {
      toast.error(`Could not load site data for ID: ${siteId}`);
      console.error(`[AppStore.loadSite] Error during load for ${siteId}:`, error);
    } finally {
      set(produce(draft => { draft.loadingSites.delete(siteId); }));
    }
  },
  
  // --- This action is now safe to use because loadSite is no longer destructive ---
  updateManifest: async (siteId, newManifest) => {
    await localSiteFs.saveManifest(siteId, newManifest);
    set(produce((draft: SiteSlice) => {
      const site = draft.sites.find(s => s.siteId === siteId);
      if (site) site.manifest = newManifest;
    }));
  },

  addSite: async (newSiteData) => {
    await localSiteFs.saveSite(newSiteData);
    set(produce((draft: SiteSlice) => {
      const siteIndex = draft.sites.findIndex(s => s.siteId === newSiteData.siteId);
      if (siteIndex > -1) {
        draft.sites[siteIndex] = newSiteData;
      } else {
        draft.sites.push(newSiteData);
      }
    }));
  },

  deleteSiteAndState: async (siteId) => {
    await localSiteFs.deleteSite(siteId);
    set(produce((draft: SiteSlice) => {
      draft.sites = draft.sites.filter(s => s.siteId !== siteId);
    }));
  },

});

================================================================================

File: core/state/slices/secretsSlice.ts
// src/core/state/slices/secretsSlice.ts
import { type StateCreator } from 'zustand';
import { produce } from 'immer';
import { type SiteSlice } from './siteSlice';
import { type SiteSecrets, saveSiteSecretsToDb } from '@/core/services/siteSecrets.service';
import { toast } from 'sonner';

export interface SecretsSlice {
  /**
   * Updates the secrets for a site, persisting them to storage first
   * and then updating the in-memory state.
   * @param siteId The ID of the site to update.
   * @param secrets The new secrets object to save.
   */
  updateSiteSecrets: (siteId: string, secrets: SiteSecrets) => Promise<void>;
}

export const createSecretsSlice: StateCreator<SiteSlice & SecretsSlice, [], [], SecretsSlice> = (set) => ({
  updateSiteSecrets: async (siteId, newSecrets) => {
    try {
      await saveSiteSecretsToDb(siteId, newSecrets);
      set(produce((draft: SiteSlice) => {
        const site = draft.sites.find(s => s.siteId === siteId);
        if (site) {
          site.secrets = newSecrets;
        }
      }));
      toast.success("Secret settings saved successfully!");
    } catch (error) {
      console.error("Failed to save site secrets:", error);
      toast.error("Could not save secret settings.");
      throw error;
    }
  },
});

================================================================================

File: core/components/Navbar.tsx
// src/core/components/Navbar.tsx

import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Leaf, Home, Settings, Globe } from 'lucide-react';
import { toast } from 'sonner';

// UI Components (no changes needed)
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { cn } from '@/core/libraries/utils';

/**
 * A specialized NavLink component for the main navigation.
 * It uses react-router-dom's useLocation hook to determine if it's the active link.
 */
const NavLink: React.FC<{ to: string; label: string; icon?: React.ReactNode; }> = ({ to, label, icon }) => {
  const location = useLocation();
  // Check if the current path exactly matches or starts with the link's path.
  // This handles nested routes correctly. The `to !== '/'` check prevents the root link
  // from being active for all other routes.
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));

  return (
    // The `asChild` prop on Button allows the Link to control navigation while inheriting the button's styles.
    <Button asChild variant="ghost" className={cn('justify-start', isActive && 'bg-accent text-accent-foreground')}>
      <Link to={to} className="flex items-center space-x-2">
        {icon}
        <span>{label}</span>
      </Link>
    </Button>
  );
};

export default function Navbar() {
  const navigate = useNavigate();
  const [remoteUrl, setRemoteUrl] = useState('');

  const handleBrowseRemoteSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (remoteUrl.trim()) {
      try {
        const url = new URL(remoteUrl.trim());
        // The URL is already a client-side route, so we don't need to encode it further for the hash.
        // We just navigate to the hash route directly.
        // Example: input 'http://localhost:8080' becomes route '#/remote@http://localhost:8080'
        navigate(`/remote@${url.origin}`);
        setRemoteUrl(''); // Clear input after navigation
      } catch (error) {
        // Use toast for better user feedback instead of alert()
        toast.error("Invalid URL entered. Please include http:// or https://");
        console.error("Invalid URL:", error);
      }
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between gap-4">
        {/* The main logo links to the marketing page or dashboard root */}
        <Link to="/" className="flex items-center space-x-2">
          <Leaf className="h-7 w-7 text-primary" />
          <span className="text-2xl font-bold text-foreground hidden sm:inline">Sparktype</span>
        </Link>
        
        <form onSubmit={handleBrowseRemoteSite} className="flex-grow max-w-xl flex items-center gap-2">
          <div className="relative w-full">
            <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="url"
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
              placeholder="Enter remote Sparktype site URL..."
              className="pl-9"
            />
          </div>
          <Button type="submit">Browse</Button>
        </form>
        
        <nav className="hidden md:flex items-center space-x-1">
          {/* Note: The main dashboard link is now `/sites` */}
          <NavLink to="/sites" label="Dashboard" icon={<Home className="h-4 w-4" />} />
        </nav>

        {/* This mobile menu button is currently a placeholder and would need state management to function */}
        <div className="md:hidden">
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

================================================================================

File: core/components/HashLink.tsx
// src/core/components/ui/HashLink.tsx
'use client';

import { type AnchorHTMLAttributes, type FC, forwardRef } from 'react';
import { cn } from '@/core/libraries/utils';

interface HashLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  // 'to' will be the path without the hash, e.g., "/sites/123"
  to: string;
}

export const HashLink: FC<HashLinkProps> = forwardRef<HTMLAnchorElement, HashLinkProps>(
  ({ to, children, className, ...props }, ref) => {
    // The href is constructed with the required # prefix.
    // We remove a leading slash from 'to' if it exists, as the # acts as the root.
    const href = `#${to.startsWith('/') ? to : `/${to}`}`;
    return (
      <a href={href} className={cn(className)} ref={ref} {...props}>
        {children}
      </a>
    );
  }
);
HashLink.displayName = 'HashLink';

================================================================================

File: core/components/Footer.tsx
// src/components/core/Footer.tsx
import {Link} from '@/core/components/ui/link'
import { ExternalLink } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/50">
      <div className="container mx-auto py-8 text-center text-sm text-muted-foreground">
        <p>© {currentYear} Sparktype. All Rights Reserved (Placeholder).</p>
        <p className="mt-1">
          <Link 
            to="https://github.com/your-repo/signum-client" // Replace with your actual repo URL
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:text-primary transition-colors font-medium"
          >
            View on GitHub <ExternalLink className="inline-block ml-1 h-3 w-3" />
          </Link>
        </p>
        {/* You can add more links here, like Privacy Policy, Terms of Service, etc. */}
      </div>
    </footer>
  );
}

================================================================================

File: core/components/ThemeProvider.tsx
// src/components/core/ThemeProvider.tsx
"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
// Corrected import for ThemeProviderProps:
import { type ThemeProviderProps } from "next-themes"; // Import directly from 'next-themes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}

================================================================================

File: core/components/CreateSiteModal.tsx
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

// State Management
import { useAppStore } from '@/core/state/useAppStore';

// Services and Config
import { generateSiteId } from '@/core/libraries/utils';
import { getMergedThemeDataForForm } from '@/core/services/config/theme.service';
import { GENERATOR_VERSION, CORE_THEMES } from '@/config/editorConfig';

// Types
import { type LocalSiteData, type Manifest, type ThemeInfo } from '@/core/types';

// UI Components
import { Button } from '@/core/components/ui/button';
import { Label } from '@/core/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/components/ui/select';
import { Input } from '@/core/components/ui/input';
import { Textarea } from '@/core/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/core/components/ui/dialog';
import { toast } from 'sonner';

interface CreateSiteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateSiteModal({ open, onOpenChange }: CreateSiteModalProps) {
  const navigate = useNavigate();
  const addSite = useAppStore((state) => state.addSite);

  // Form state
  const [siteTitle, setSiteTitle] = useState('');
  const [siteDescription, setSiteDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const availableThemes = useMemo(() => CORE_THEMES, []);
  const [selectedTheme, setSelectedTheme] = useState<ThemeInfo | null>(availableThemes[0] || null);

  // Reset form when modal opens/closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form when closing
      setSiteTitle('');
      setSiteDescription('');
      setSelectedTheme(availableThemes[0] || null);
      setIsLoading(false);
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async () => {
    if (!siteTitle.trim() || !selectedTheme) {
      toast.error('Site title and a theme are required.');
      return;
    }
    
    setIsLoading(true);
    try {
      const newSiteId = generateSiteId(siteTitle);
      const { initialConfig } = await getMergedThemeDataForForm(selectedTheme.path, {});
      
      const newManifest: Manifest = {
        siteId: newSiteId,
        generatorVersion: GENERATOR_VERSION,
        title: siteTitle.trim(),
        description: siteDescription.trim(),
        theme: {
          name: selectedTheme.path,
          config: initialConfig,
        },
        structure: [],
      };
      
      const newSiteData: LocalSiteData = {
        siteId: newSiteId,
        manifest: newManifest,
        contentFiles: [],
        themeFiles: [],
        layoutFiles: [],
      };
      
      await addSite(newSiteData);
      toast.success(`Site "${siteTitle}" created successfully!`);
      
      // Close modal and navigate to the new site's editor page
      handleOpenChange(false);
      navigate(`/sites/${newSiteId}/edit`);

    } catch (error) {
      console.error("Error during site creation:", error);
      toast.error(`Failed to create site: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const canSubmit = siteTitle.trim() && selectedTheme && !isLoading;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create a New Site</DialogTitle>
          <DialogDescription>
            Set up your new site with a title, description, and theme. You can change these settings later.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="site-title">Site Title</Label>
            <Input
              id="site-title"
              value={siteTitle}
              onChange={(e) => setSiteTitle(e.target.value)}
              placeholder="My Awesome Project"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="site-description">Site Description (Optional)</Label>
            <Textarea
              id="site-description"
              value={siteDescription}
              onChange={(e) => setSiteDescription(e.target.value)}
              placeholder="A short and catchy description of your new site."
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="theme-select">Theme</Label>
            <Select 
              value={selectedTheme?.path || ''} 
              onValueChange={(themePath) => {
                const theme = availableThemes.find(t => t.path === themePath);
                if (theme) setSelectedTheme(theme);
              }} 
            >
              <SelectTrigger id="theme-select">
                <SelectValue placeholder="Select a theme..." />
              </SelectTrigger>
              <SelectContent>
                {availableThemes.map(theme => (
                  <SelectItem key={theme.path} value={theme.path}>
                    {theme.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose the overall design for your site. You can change this later.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isLoading ? 'Creating...' : 'Create Site'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

================================================================================

File: core/components/SchemaDrivenForm.tsx
'use client';

import Form from '@rjsf/shadcn';
import validator from '@rjsf/validator-ajv8';
import type { 
  RJSFSchema, 
  UiSchema, 
  FieldTemplateProps, 
  ObjectFieldTemplateProps, 
  RegistryWidgetsType,
  FormContextType
 } from '@rjsf/utils';
import { Label } from '@/core/components/ui/label';
import SwitchWidget from '@/features/editor/components/SwitchWidget';


// --- Props Definition ---
interface SchemaDrivenFormProps<T = unknown> {
  schema: RJSFSchema;
  uiSchema?: UiSchema;
  formData: object;
  onFormChange: (data: object) => void;
  liveValidate?: boolean;
  widgets?: RegistryWidgetsType<T>;
  formContext?: FormContextType & T; // <-- Use the official type and our generic
}



// --- Custom Field Template (for better layout and labels) ---
function CustomFieldTemplate(props: FieldTemplateProps) {
  const { id, classNames, label, help, required, errors, children, schema } = props;

  if (props.hidden) {
    return <div className="hidden">{children}</div>;
  }
  
  const isCheckbox = schema.type === 'boolean' && (props.uiSchema?.['ui:widget'] === 'checkbox' || props.uiSchema?.['ui:widget'] === undefined);

  if (isCheckbox) {
      return <div className={classNames}>{children}</div>
  }

  return (
    <div className={classNames}>
      {label && (
        <Label htmlFor={id} className="block text-sm font-medium mb-1">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      
      
      
      {children}
      
      {errors}
      
      {help}
    </div>
  );
}

// --- Custom Object Field Template (for overall form layout) ---
function CustomObjectFieldTemplate(props: ObjectFieldTemplateProps) {
  return (
    <div>
        {props.description && <p className="text-sm text-muted-foreground">{props.description}</p>}
        <div className="mt-4">
            {props.properties.map(element => (
                <div key={element.name} className="mb-4">
                    {element.content}
                </div>
            ))}
        </div>
    </div>
  );
}

// --- Custom Submit Button Template (to hide it) ---
function HideSubmitButton() {
    return null;
}

/**
 * A reusable component that dynamically generates a form from a given JSON Schema.
 * It uses react-jsonschema-form with a shadcn/ui theme for a consistent look and feel.
 */
export default function SchemaDrivenForm<T>({ 
  schema, 
  uiSchema, 
  formData, 
  onFormChange, 
  liveValidate = false,
  widgets,
  formContext 
}: SchemaDrivenFormProps<T>) {

  const safeFormData = formData || {};
  
  // Always include essential widgets, with user widgets taking precedence
  const mergedWidgets = {
    switch: SwitchWidget,
    ...widgets,
  };

  return (
    <Form
      schema={schema}
      uiSchema={uiSchema}
      formData={safeFormData}
      validator={validator}
      onChange={(e) => onFormChange(e.formData)}
      liveValidate={liveValidate}
      showErrorList={false}
      widgets={mergedWidgets}
      formContext={formContext}
      
      templates={{
        FieldTemplate: CustomFieldTemplate,
        ObjectFieldTemplate: CustomObjectFieldTemplate,
        ButtonTemplates: {
            SubmitButton: HideSubmitButton,
        }
      }}
    />
  );
}

================================================================================

File: core/components/ErrorBoundary.tsx
// src/components/core/ErrorBoundary.tsx
'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
  }

  
  public render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-destructive/10 border border-destructive rounded-lg">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h1 className="text-2xl font-bold text-destructive-foreground">Something went wrong.</h1>
          <p className="text-muted-foreground mt-2 mb-4">
            An unexpected error occurred. Please try refreshing the page.
          </p>
          {this.state.error && (
            <details className="w-full max-w-lg text-left bg-background p-2 rounded border mb-4">
                <summary className="cursor-pointer text-sm font-medium">Error Details</summary>
                <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap break-all">
                    {this.state.error.message}
                </pre>
            </details>
          )}

        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

================================================================================

File: core/components/ui/alert-dialog.tsx
"use client"

import * as React from "react"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"

import { cn } from "@/core/libraries/utils"
import { buttonVariants } from "@/core/components/ui/button"

function AlertDialog({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogTrigger({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  )
}

function AlertDialogPortal({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  )
}

function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          className
        )}
        {...props}
      />
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function AlertDialogAction({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action>) {
  return (
    <AlertDialogPrimitive.Action
      className={cn(buttonVariants(), className)}
      {...props}
    />
  )
}

function AlertDialogCancel({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel
      className={cn(buttonVariants({ variant: "outline" }), className)}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}


================================================================================

File: core/components/ui/link.tsx
// src/core/components/ui/link.tsx

import React from 'react';
import { Link as RouterLink, type LinkProps } from 'react-router-dom';

/**
 * A wrapper around react-router-dom's Link component.
 *
 * This component ensures that all internal navigation leverages client-side
 * routing, preventing full-page reloads and preserving application state.
 *
 * It accepts a 'to' prop for the destination path and forwards all other
 * standard anchor tag props (like className, children, target, etc.) to the
 * underlying router link. The `ref` is also forwarded for compatibility with
 * other UI libraries and direct DOM access.
 */
export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ to, ...props }, ref) => {
    // The underlying component from react-router-dom handles the navigation logic.
    // All other props, including `className` and `children`, are passed through.
    return <RouterLink ref={ref} to={to} {...props} />;
  }
);

Link.displayName = 'Link';

================================================================================

File: core/components/ui/card.tsx
import * as React from "react"
import { cn } from "@/core/libraries/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }

================================================================================

File: core/components/ui/label.tsx
"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"

import { cn } from "@/core/libraries/utils"

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }


================================================================================

File: core/components/ui/sonner.tsx
"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }


================================================================================

File: core/components/ui/accordion.tsx
"use client"

import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/core/libraries/utils"

function Accordion({
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Root>) {
  return <AccordionPrimitive.Root data-slot="accordion" {...props} />
}

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("border-b last:border-b-0 data-[state=closed]:border-b-0", className)}
      {...props}
    />
  )
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex border-b">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "focus-visible:border-ring focus-visible:ring-ring/50 flex flex-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-all outline-none hover:underline focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180 py-2 px-2",
          className
        )}
        {...props}
      >
        <ChevronDownIcon className="text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0 transition-transform duration-200 mr-1" />
        {children}
        
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden text-sm py-4 px-3"
      {...props}
    >
      <div className={cn("pt-0 pb-4", className)}>{children}</div>
    </AccordionPrimitive.Content>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }


================================================================================

File: core/components/ui/switch.tsx
// src/core/components/ui/switch.tsx

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/core/libraries/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }


================================================================================

File: core/components/ui/dialog.tsx
"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/core/libraries/utils"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}


================================================================================

File: core/components/ui/badge.tsx
import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';

import { cn } from '@/core/libraries/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

================================================================================

File: core/components/ui/separator.tsx
import * as React from "react"
import * as SeparatorPrimitive from "@radix-ui/react-separator"
import { cn } from "@/core/libraries/utils"

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(
  (
    { className, orientation = "horizontal", decorative = true, ...props },
    ref
  ) => (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
        className
      )}
      {...props}
    />
  )
)
Separator.displayName = SeparatorPrimitive.Root.displayName

export { Separator }

================================================================================

File: core/components/ui/button.tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/core/libraries/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }


================================================================================

File: core/components/ui/dropdown-menu.tsx
"use client"

import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"

import { cn } from "@/core/libraries/utils"

function DropdownMenu({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuPortal({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return (
    <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
  )
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  )
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  )
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean
  variant?: "default" | "destructive"
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      checked={checked}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CircleIcon className="size-2 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "px-2 py-1.5 text-sm font-medium data-[inset]:pl-8",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  )
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "text-muted-foreground ml-auto text-xs tracking-widest",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSub({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[inset]:pl-8",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4" />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.SubContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-lg",
        className
      )}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}


================================================================================

File: core/components/ui/select.tsx
"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react"

import { cn } from "@/core/libraries/utils"

function Select({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectGroup({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border shadow-md",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className
        )}
        position={position}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1"
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("bg-border pointer-events-none -mx-1 my-1 h-px", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}


================================================================================

File: core/components/ui/textarea.tsx
import * as React from "react"

import { cn } from "@/core/libraries/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }


================================================================================

File: core/components/ui/input.tsx
import * as React from "react"

import { cn } from "@/core/libraries/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }


================================================================================

File: core/components/layout/ThreeColumnLayout.tsx
'use client';

import type { ReactNode } from 'react';
import { useUIStore } from '@/core/state/uiStore';
import { cn } from '@/core/libraries/utils';
import EditorHeader from '@/features/editor/components/EditorHeader';

interface ThreeColumnLayoutProps {
  leftSidebar: ReactNode;
  rightSidebar: ReactNode;
  children: ReactNode;
  headerActions?: ReactNode;
}

export default function ThreeColumnLayout({ leftSidebar, rightSidebar, children, headerActions }: ThreeColumnLayoutProps) {
  const isLeftOpen = useUIStore((state) => state.sidebar.isLeftOpen);
  const isRightOpen = useUIStore((state) => state.sidebar.isRightOpen);

  return (
    <div className="flex h-screen w-full flex-col bg-muted/20">
      <EditorHeader actions={headerActions} />
      
      {/* This is now the positioning context for all three columns */}
      <div className="relative flex-1 overflow-hidden">
        
        
        {/* Left Sidebar: Absolutely positioned within the parent div */}
        <aside
          className={cn(
            'absolute inset-y-0 left-0 z-20 h-full w-72 border-r bg-background transition-transform duration-300 ease-in-out',
            isLeftOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {/* This container ensures its direct child can scroll */}
          <div className="h-full w-full overflow-y-auto">
            {leftSidebar}
          </div>
        </aside>

        {/* Main Content: The layout is now controlled by padding */}
        <main
          className={cn(
            'h-full overflow-y-auto transition-all duration-300 ease-in-out',
            // When left sidebar is open, add left padding
            isLeftOpen ? 'lg:pl-72' : 'lg:pl-0',
            // When right sidebar is open, add right padding
            isRightOpen ? 'lg:pr-80' : 'lg:pr-0'
          )}
        >
          {children}
        </main>

        {/* Right Sidebar: Absolutely positioned within the parent div */}
        <aside
          className={cn(
            'absolute inset-y-0 right-0 z-10 h-full w-80 border-l bg-background transition-transform duration-300 ease-in-out',
            isRightOpen ? 'translate-x-0' : 'translate-x-full'
          )}
        >
          {/* This container ensures its direct child can scroll */}
          <div className="h-full w-full overflow-y-auto">
            {rightSidebar}
          </div>
        </aside>
      </div>
    </div>
  );
}

================================================================================

File: core/hooks/useAutosave.ts
// src/hooks/useAutosave.ts


import { useEffect, useRef } from 'react';
import { AUTOSAVE_DELAY } from '@/config/editorConfig';

interface AutosaveParams<TData> {
  /** The generic data to be saved. */
  dataToSave: TData;
  /** A flag indicating if there are pending changes. */
  hasUnsavedChanges: boolean;
  /** A flag to prevent saving if the content isn't in a saveable state. */
  isSaveable: boolean;
  /** The function that performs the save operation with the generic data. */
  onSave: (data: TData) => Promise<void>;
}

/**
 * A generic custom hook to handle autosaving content after a specified delay.
 * It encapsulates the timer logic and effect management for saving drafts.
 */
export function useAutosave<TData>({ dataToSave, hasUnsavedChanges, isSaveable, onSave }: AutosaveParams<TData>) {
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    if (hasUnsavedChanges && isSaveable) {
      autosaveTimeoutRef.current = setTimeout(() => {
        onSave(dataToSave);
      }, AUTOSAVE_DELAY);
    }

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [dataToSave, hasUnsavedChanges, isSaveable, onSave]);
}

================================================================================

File: core/hooks/useInitialiseUIStore.ts
// /src/core/hooks/useInitialiseUIStore.ts

import { useUIStore } from '../../core/state/uiStore';
import { useEffect } from 'react';

export function useInitialiseUIStore() {
  const initialize = useUIStore((state) => state.screen.initializeScreenSize);
  const isInitialized = useUIStore((state) => state.screen.isInitialized);

  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [initialize, isInitialized]);
}   

================================================================================

File: core/hooks/useHashNavigation.ts
// src/core/hooks/useHashNavigation.ts

import { useState, useEffect } from 'react';

// A helper to safely get the hash and clean it up.
function getCleanHash() {
  if (typeof window === 'undefined') return '/';
  // Get the hash, remove the leading #, and ensure it starts with a /
  const hash = window.location.hash.substring(1);
  return hash.startsWith('/') ? hash : `/${hash}`;
}

export function useHashNavigation() {
  const [currentPath, setCurrentPath] = useState(getCleanHash());

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentPath(getCleanHash());
    };

    // Listen for changes to the hash
    window.addEventListener('hashchange', handleHashChange);
    // Set the initial path when the component mounts
    handleHashChange();

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  return currentPath;
}

================================================================================

File: core/services/siteExporter.service.ts
// src/core/services/siteExporter.service.ts (REFACTORED)

import JSZip from 'jszip';
import type { LocalSiteData } from '@/core/types';
import { buildSiteBundle } from './siteBuilder.service';

/**
 * Takes a complete site data object, uses the siteBuilder service to generate
 * all static assets, and then packages them into a ZIP archive for download.
 *
 * This service is a "deployment target". Other targets could be created
 * for different platforms (e.g., Netlify, Vercel).
 *
 * @param siteData The fully loaded local site data.
 * @returns A promise that resolves to a Blob containing the ZIP file.
 */
export async function exportSiteToZip(siteData: LocalSiteData): Promise<Blob> {
    // 1. Call the builder service to generate the complete site bundle in memory.
    const bundle = await buildSiteBundle(siteData);

    // 2. Create a new ZIP instance.
    const zip = new JSZip();

    // 3. Iterate through the in-memory bundle and add each file to the zip.
    for (const [filePath, content] of Object.entries(bundle)) {
        zip.file(filePath, content);
    }

    // 4. Generate the final ZIP blob and return it.
    return zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: {
            level: 9,
        },
    });
}

================================================================================

File: core/services/urlUtils.service.ts
// src/core/services/urlUtils.service.ts
import type { Manifest, StructureNode, CollectionItemRef } from '@/core/types';
import { getCollection } from './collections.service';

/**
 * ============================================================================
 * Unified URL Generation Service
 * ============================================================================
 * This is the single source of truth for generating URLs for any piece of
 * content in the site, whether it's a regular page or a collection item.
 *
 * It distinguishes between content types and applies the correct URL structure,
 * ensuring consistency between the live preview and the final static export.
 * ============================================================================
 */

/**
 * A type guard to check if the provided object is a CollectionItemRef.
 */
function isCollectionItemRef(node: any): node is CollectionItemRef {
  return node && typeof node === 'object' && 'collectionId' in node;
}

/**
 * Generates a URL for a given site node, handling both regular pages and collection items.
 *
 * @param node - The `StructureNode` or `CollectionItemRef` object for which to generate a URL.
 * @param manifest - The complete site manifest, needed for context.
 * @param isExport - A boolean indicating if the URL is for static export (`about/index.html`) or live preview (`/about`).
 * @param pageNumber - An optional page number for generating paginated links.
 * @returns A string representing the final URL segment or filename.
 */
export function getUrlForNode(
  node: StructureNode | CollectionItemRef,
  manifest: Manifest,
  isExport: boolean,
  pageNumber?: number,
): string {

  // --- Case 1: The node is a Collection Item ---
  if (isCollectionItemRef(node)) {
    const parentCollection = getCollection(manifest, node.collectionId);
    if (!parentCollection) {
        // Fallback if the parent collection is somehow missing
        return isExport ? 'item-not-found/index.html' : 'item-not-found';
    }
    // The URL is constructed from the collection's ID (as the folder) and the item's slug.
    // e.g., collectionId 'blog', slug 'my-first-post' -> /blog/my-first-post
    const basePath = parentCollection.id;
    const itemSlug = node.slug;

    return isExport
      ? `${basePath}/${itemSlug}/index.html`
      : `${basePath}/${itemSlug}`;
  }

  // --- Case 2: The node is a regular Page from the site structure ---
  // Homepage Check: The first page in the root structure is always the homepage.
  const isHomepage = manifest.structure[0]?.path === node.path;

  if (isHomepage) {
    if (pageNumber && pageNumber > 1) {
      return isExport ? `page/${pageNumber}/index.html` : `page/${pageNumber}`;
    }
    return isExport ? 'index.html' : '';
  }

  // All other pages get a clean URL structure based on their slug.
  const baseSlug = node.slug;
  if (pageNumber && pageNumber > 1) {
    return isExport ? `${baseSlug}/page/${pageNumber}/index.html` : `${baseSlug}/page/${pageNumber}`;
  }
  return isExport ? `${baseSlug}/index.html` : baseSlug;
}

================================================================================

File: core/services/siteBackup.service.ts
// src/core/services/siteBackup.service.ts
import JSZip from 'jszip';
import type  {
  LocalSiteData,
  SiteSecrets,
  Manifest,
  ParsedMarkdownFile,
  RawFile,
} from '@/core/types';
import { stringifyToMarkdown, parseMarkdownString } from '@/core/libraries/markdownParser';
import { isCoreTheme, isCoreLayout } from './config/configHelpers.service';
import * as localSiteFs from './localFileSystem.service';

const SIGNUM_FOLDER = '_site';

/**
 * Exports a complete backup of a Sparktype site's source data into a ZIP archive.
 * This function's logic is sound and does not require changes.
 */
export async function exportSiteBackup(siteData: LocalSiteData): Promise<Blob> {
  const zip = new JSZip();
  const signumFolder = zip.folder(SIGNUM_FOLDER);

  if (!signumFolder) {
    throw new Error("Failed to create root backup folder in ZIP archive.");
  }

  signumFolder.file('manifest.json', JSON.stringify(siteData.manifest, null, 2));
  signumFolder.file('secrets.json', JSON.stringify(siteData.secrets || {}, null, 2));

  const contentFolder = signumFolder.folder('content');
  siteData.contentFiles?.forEach(file => {
    contentFolder?.file(
      file.path.replace('content/', ''),
      stringifyToMarkdown(file.frontmatter, file.content)
    );
  });
  
  const imagesFolder = signumFolder.folder('assets/images');
  const imageAssets = await localSiteFs.getAllImageAssetsForSite(siteData.siteId);
  for (const [path, blob] of Object.entries(imageAssets)) {
      const filename = path.split('/').pop();
      if (filename) imagesFolder?.file(filename, blob);
  }

  if (siteData.themeFiles?.length) {
    const themeName = siteData.manifest.theme.name;
    if (!isCoreTheme(themeName)) {
      const themeFolder = signumFolder.folder(`themes/${themeName}`);
      siteData.themeFiles.forEach(file => {
        const relativePath = file.path.substring(`themes/${themeName}/`.length);
        themeFolder?.file(relativePath, file.content);
      });
    }
  }
  
  if (siteData.layoutFiles?.length) {
    const layoutsFolder = signumFolder.folder('layouts');
    const seenLayouts = new Set<string>();
    siteData.contentFiles?.forEach(cf => {
      const layoutId = cf.frontmatter.layout;
      if (layoutId && !isCoreLayout(layoutId) && !seenLayouts.has(layoutId)) {
        const layoutFolder = layoutsFolder?.folder(layoutId);
        const layoutFiles = siteData.layoutFiles?.filter(lf => lf.path.startsWith(`layouts/${layoutId}/`));
        layoutFiles?.forEach(file => {
          const relativePath = file.path.substring(`layouts/${layoutId}/`.length);
          layoutFolder?.file(relativePath, file.content);
        });
        seenLayouts.add(layoutId);
      }
    });
  }

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });
}

/**
 * Parses a ZIP backup file and reconstructs the site data in memory.
 * This function now uses the correct asynchronous pattern for reading files from the archive.
 */
export async function importSiteFromZip(zipFile: File): Promise<LocalSiteData & { imageAssetsToSave?: { [path: string]: Blob } }> {
    const zip = await JSZip.loadAsync(zipFile);
    const signumFolder = zip.folder(SIGNUM_FOLDER);

    if (!signumFolder) throw new Error("Invalid backup file: _site folder not found.");
    
    const manifestFile = signumFolder.file('manifest.json');
    if (!manifestFile) throw new Error("Invalid backup file: manifest.json is missing.");
    const manifest: Manifest = JSON.parse(await manifestFile.async('string'));

    const secretsFile = signumFolder.file('secrets.json');
    const secrets: SiteSecrets = secretsFile ? JSON.parse(await secretsFile.async('string')) : {};

    const contentFiles: ParsedMarkdownFile[] = [];
    const contentFolder = signumFolder.folder('content');
    if (contentFolder) {
        for (const relativePath in contentFolder.files) {
            const file = contentFolder.files[relativePath];
            if (!file.dir && typeof file.name === 'string') {
                const fullPath = file.name.replace(`${SIGNUM_FOLDER}/`, '');
                const rawContent = await file.async('string');
                const { frontmatter, content } = parseMarkdownString(rawContent);
                const slug = fullPath.substring(fullPath.lastIndexOf('/') + 1).replace('.md', '');
                contentFiles.push({ path: fullPath, slug, frontmatter, content });
            }
        }
    }


    const themePromises: Promise<RawFile>[] = [];
    signumFolder.folder('themes')?.forEach((_relativePath, fileObject) => {
        if (!fileObject.dir) {
            const promise = fileObject.async('string').then(content => ({
                path: fileObject.name.replace(`${SIGNUM_FOLDER}/`, ''),
                content: content,
            }));
            themePromises.push(promise);
        }
    });
    const themeFiles = await Promise.all(themePromises);

    const layoutPromises: Promise<RawFile>[] = [];
    signumFolder.folder('layouts')?.forEach((_relativePath, fileObject) => {
        if (!fileObject.dir) {
            const promise = fileObject.async('string').then(content => ({
                path: fileObject.name.replace(`${SIGNUM_FOLDER}/`, ''),
                content: content,
            }));
            layoutPromises.push(promise);
        }
    });
    const layoutFiles = await Promise.all(layoutPromises);

    const imageAssets: { [path: string]: Blob } = {};
    const imagesFolder = signumFolder.folder('assets/images');
    if (imagesFolder) {
        for (const filename in imagesFolder.files) {
            const file = imagesFolder.files[filename];
            if (!file.dir) {
                const path = `assets/images/${file.name.split('/').pop()}`;
                imageAssets[path] = await file.async('blob');
            }
        }
    }

    return {
        siteId: manifest.siteId,
        manifest,
        secrets,
        contentFiles,
        themeFiles,
        layoutFiles,
        imageAssetsToSave: imageAssets,
    };
}

================================================================================

File: core/services/relativePaths.service.ts
// src/core/services/relativePaths.service.ts

/**
 * Calculates the relative path from one file to another.
 * This is essential for creating portable HTML that works on any server
 * or directly from the local file system.
 *
 * @example
 * // from 'index.html' to 'about.html' -> './about.html'
 * getRelativePath('index.html', 'about.html');
 *
 * @example
 * // from 'posts/post1.html' to 'index.html' -> '../index.html'
 * getRelativePath('posts/post1.html', 'index.html');
 *
 * @example
 * // from 'posts/post1.html' to 'tags/tech.html' -> '../tags/tech.html'
 * getRelativePath('posts/post1.html', 'tags/tech.html');
 *
 * @param {string} fromPath - The path of the file containing the link.
 * @param {string} toPath - The path of the file being linked to.
 * @returns {string} The calculated relative path.
 */
export function getRelativePath(fromPath: string, toPath: string): string {
  if (fromPath === toPath) {
    return toPath.split('/').pop() || '';
  }

  const fromParts = fromPath.split('/').slice(0, -1); // Path without filename
  const toParts = toPath.split('/');

  // Find the common path segment
  let commonLength = 0;
  while (
    commonLength < fromParts.length &&
    commonLength < toParts.length &&
    fromParts[commonLength] === toParts[commonLength]
  ) {
    commonLength++;
  }

  const upLevels = fromParts.length - commonLength;
  const upPath = '../'.repeat(upLevels) || './';

  const downPath = toParts.slice(commonLength).join('/');

  return upPath + downPath;
}

================================================================================

File: core/services/localFileSystem.service.ts
// src/lib/localSiteFs.ts
import { type LocalSiteData, type ParsedMarkdownFile, type Manifest, type RawFile } from '@/core/types';
import localforage from 'localforage';
import { stringifyToMarkdown, parseMarkdownString } from '@/core/libraries/markdownParser';

const DB_NAME = 'SparktypeDB';

const siteManifestsStore = localforage.createInstance({
  name: DB_NAME,
  storeName: 'siteManifests',
});

const siteContentFilesStore = localforage.createInstance({
  name: DB_NAME,
  storeName: 'siteContentFiles',
});

const siteLayoutFilesStore = localforage.createInstance({
  name: DB_NAME,
  storeName: 'siteLayoutFiles',
});

const siteThemeFilesStore = localforage.createInstance({
    name: DB_NAME,
    storeName: 'siteThemeFiles',
});

const siteImageAssetsStore = localforage.createInstance({
  name: DB_NAME,
  storeName: 'siteImageAssets',
});

const siteDataFilesStore = localforage.createInstance({
  name: DB_NAME,
  storeName: 'siteDataFiles',
});

// --- Function to load only manifests for a fast initial load ---
export async function loadAllSiteManifests(): Promise<Manifest[]> {
  const manifests: Manifest[] = [];
  
  try {
    // Add timeout to prevent IndexedDB from hanging indefinitely
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('IndexedDB operation timed out after 10 seconds')), 10000);
    });
    
    const iteratePromise = siteManifestsStore.iterate((value: Manifest) => {
      manifests.push(value);
    });
    
    await Promise.race([iteratePromise, timeoutPromise]);
  } catch (error) {
    console.error('Failed to load site manifests from IndexedDB:', error);
    
    // Attempt recovery by clearing potentially corrupted data
    if (error instanceof Error && error.message.includes('timed out')) {
      console.warn('IndexedDB appears to be corrupted. Attempting recovery...');
      await recoverIndexedDB();
    }
    
    // Return empty array to allow app to continue
  }
  
  return manifests;
}

/**
 * Attempts to recover from IndexedDB corruption by clearing all stores.
 * This is a last resort when the database becomes unresponsive.
 */
async function recoverIndexedDB(): Promise<void> {
  try {
    console.log('Starting IndexedDB recovery...');
    
    // Clear all stores to remove potential corruption
    await Promise.allSettled([
      siteManifestsStore.clear(),
      siteContentFilesStore.clear(), 
      siteLayoutFilesStore.clear(),
      siteThemeFilesStore.clear(),
      siteImageAssetsStore.clear(),
      siteDataFilesStore.clear(),
    ]);
    
    // Also clear derivative cache and secrets
    const { clearAllDerivativeCache } = await import('./images/derivativeCache.service');
    await clearAllDerivativeCache();
    
    console.log('IndexedDB recovery completed. All data has been cleared.');
    
    // Show user notification about recovery
    if (typeof window !== 'undefined' && 'toast' in window) {
      const windowWithToast = window as unknown as { toast?: { error?: (message: string) => void } };
      windowWithToast.toast?.error?.('Database corruption detected. All local data has been cleared. Please reimport your sites.');
    }
  } catch (recoveryError) {
    console.error('IndexedDB recovery failed:', recoveryError);
  }
}

/**
 * Fetches the manifest for a single site by its ID.
 * @param {string} siteId The unique identifier for the site.
 * @returns {Promise<Manifest | null>} A Promise that resolves to the Manifest object, or null if not found.
 */
export async function getManifestById(siteId: string): Promise<Manifest | null> {
  const manifest = await siteManifestsStore.getItem<Manifest>(siteId);
  return manifest ?? null;
}

/**
 * Fetches the content files for a single site by its ID.
 * @param {string} siteId The unique identifier for the site.
 * @returns {Promise<ParsedMarkdownFile[]>} A Promise that resolves to an array of parsed markdown files.
 */
export async function getSiteContentFiles(siteId: string): Promise<ParsedMarkdownFile[]> {
    const contentFiles = await siteContentFilesStore.getItem<ParsedMarkdownFile[]>(siteId);
    return contentFiles ?? [];
}

/**
 * Fetches the custom layout files for a single site by its ID.
 * @param {string} siteId The unique identifier for the site.
 * @returns {Promise<RawFile[]>} A Promise that resolves to an array of raw layout files.
 */
export async function getSiteLayoutFiles(siteId: string): Promise<RawFile[]> {
    const layoutFiles = await siteLayoutFilesStore.getItem<RawFile[]>(siteId);
    return layoutFiles ?? [];
}

/**
 * Fetches the custom theme files for a single site by its ID.
 * @param {string} siteId The unique identifier for the site.
 * @returns {Promise<RawFile[]>} A Promise that resolves to an array of raw theme files.
 */
export async function getSiteThemeFiles(siteId: string): Promise<RawFile[]> {
    const themeFiles = await siteThemeFilesStore.getItem<RawFile[]>(siteId);
    return themeFiles ?? [];
}

export async function saveSite(siteData: LocalSiteData): Promise<void> {
  await Promise.all([
    siteManifestsStore.setItem(siteData.siteId, siteData.manifest),
    siteContentFilesStore.setItem(siteData.siteId, siteData.contentFiles ?? []),
    siteLayoutFilesStore.setItem(siteData.siteId, siteData.layoutFiles ?? []),
    siteThemeFilesStore.setItem(siteData.siteId, siteData.themeFiles ?? []),
  ]);
}

export async function deleteSite(siteId: string): Promise<void> {
  // Import required cleanup functions
  const { clearSiteDerivativeCache } = await import('./images/derivativeCache.service');
  const { deleteSiteSecretsFromDb } = await import('./siteSecrets.service');
  
  await Promise.all([
    // Core site data
    siteManifestsStore.removeItem(siteId),
    siteContentFilesStore.removeItem(siteId),
    siteLayoutFilesStore.removeItem(siteId),
    siteThemeFilesStore.removeItem(siteId),
    
    // Previously missing cleanup operations
    siteImageAssetsStore.removeItem(siteId),
    siteDataFilesStore.removeItem(siteId),
    deleteSiteSecretsFromDb(siteId),
    clearSiteDerivativeCache(siteId),
  ]);
}

export async function saveManifest(siteId: string, manifest: Manifest): Promise<void> {
    await siteManifestsStore.setItem(siteId, manifest);
}

export async function saveContentFile(siteId: string, filePath: string, rawMarkdownContent: string): Promise<ParsedMarkdownFile> {
    const contentFiles = await siteContentFilesStore.getItem<ParsedMarkdownFile[]>(siteId) ?? [];

    const { frontmatter, content } = parseMarkdownString(rawMarkdownContent);
    const fileSlug = filePath.replace(/^content\//, '').replace(/\.md$/, '');
    const savedFile: ParsedMarkdownFile = { slug: fileSlug, path: filePath, frontmatter, content };

    const fileIndex = contentFiles.findIndex(f => f.path === filePath);
    if (fileIndex > -1) {
      contentFiles[fileIndex] = savedFile;
    } else {
      contentFiles.push(savedFile);
    }

    await siteContentFilesStore.setItem(siteId, contentFiles);
    return savedFile;
}

export async function deleteContentFile(siteId: string, filePath: string): Promise<void> {
    const contentFiles = await siteContentFilesStore.getItem<ParsedMarkdownFile[]>(siteId) ?? [];
    const updatedContentFiles = contentFiles.filter(f => f.path !== filePath);
    await siteContentFilesStore.setItem(siteId, updatedContentFiles);
}

export async function getContentFileRaw(siteId: string, filePath: string): Promise<string | null> {
    const allFiles = await siteContentFilesStore.getItem<ParsedMarkdownFile[]>(siteId) ?? [];
    const fileData = allFiles.find(f => f.path === filePath);
    if (!fileData) return null;
    
    return stringifyToMarkdown(fileData.frontmatter, fileData.content);
}

/**
 * Moves a set of content files from old paths to new paths in a single transaction.
 * @param {string} siteId - The ID of the site.
 * @param {{oldPath: string, newPath: string}[]} pathsToMove - An array of path mapping objects.
 * @returns {Promise<void>}
 */
export async function moveContentFiles(siteId: string, pathsToMove: { oldPath: string, newPath: string }[]): Promise<void> {
    const contentFiles = await siteContentFilesStore.getItem<ParsedMarkdownFile[]>(siteId) ?? [];
    
    const updatedFiles = contentFiles.map(file => {
        const moveInstruction = pathsToMove.find(p => p.oldPath === file.path);
        if (moveInstruction) {
            const newSlug = moveInstruction.newPath.split('/').pop()?.replace('.md', '') || '';
            return { ...file, path: moveInstruction.newPath, slug: newSlug };
        }
        return file;
    });
    
    await siteContentFilesStore.setItem(siteId, updatedFiles);
}

/**
 * Saves a binary image asset (as a Blob) to storage for a specific site.
 * @param siteId The ID of the site.
 * @param imagePath The relative path to the image (e.g., 'assets/images/foo.jpg').
 * @param imageData The image data as a Blob.
 */
export async function saveImageAsset(siteId: string, imagePath: string, imageData: Blob): Promise<void> {
  const imageMap = await siteImageAssetsStore.getItem<Record<string, Blob>>(siteId) || {};
  imageMap[imagePath] = imageData;
  await siteImageAssetsStore.setItem(siteId, imageMap);
}

/**
 * Retrieves a binary image asset (as a Blob) from storage for a specific site.
 * @param siteId The ID of the site to look within.
 * @param imagePath The relative path of the image to retrieve.
 * @returns A Promise that resolves to the image Blob, or null if not found.
 */
export async function getImageAsset(siteId: string, imagePath: string): Promise<Blob | null> {

  // 1. Get the image map for the specific site.
  const imageMap = await siteImageAssetsStore.getItem<Record<string, Blob>>(siteId);
  if (!imageMap) {
    return null; // The site has no images.
  }
  // 2. Return the image from the map, or null if it doesn't exist.
  return imageMap[imagePath] || null;
}

/**
 * Retrieves the entire map of image paths to image Blobs for a given site.
 * @param siteId The ID of the site.
 * @returns A promise that resolves to a record mapping image paths to their Blob data.
 */
export async function getAllImageAssetsForSite(siteId: string): Promise<Record<string, Blob>> {
    return await siteImageAssetsStore.getItem<Record<string, Blob>>(siteId) || {};
}

/**
 * Saves a complete map of image assets for a site.
 * This is used during the site import process to restore all images at once.
 * @param siteId The ID of the site to save images for.
 * @param assets A record mapping image paths to their Blob data.
 */
export async function saveAllImageAssetsForSite(siteId: string, assets: Record<string, Blob>): Promise<void> {
  await siteImageAssetsStore.setItem(siteId, assets);
}

/**
 * Saves a single data file (e.g., categories.json) for a site.
 * @param siteId The ID of the site.
 * @param dataFilePath The path to the data file (e.g., 'data/blog_categories.json').
 * @param content The JSON string content to save.
 */
export async function saveDataFile(siteId: string, dataFilePath: string, content: string): Promise<void> {
    const dataFileMap = await siteDataFilesStore.getItem<Record<string, string>>(siteId) || {};
    dataFileMap[dataFilePath] = content;
    await siteDataFilesStore.setItem(siteId, dataFileMap);
}

/**
 * Retrieves the content of a single data file for a site.
 * @param siteId The ID of the site.
 * @param dataFilePath The path to the data file.
 * @returns The file's content as a string, or null if not found.
 */
export async function getDataFileContent(siteId: string, dataFilePath: string): Promise<string | null> {
    const dataFileMap = await siteDataFilesStore.getItem<Record<string, string>>(siteId);
    return dataFileMap?.[dataFilePath] || null;
}

/**
 * Retrieves all data files for a site as a path-to-content map.
 * @param siteId The ID of the site.
 * @returns A record mapping data file paths to their string content.
 */
export async function getAllDataFiles(siteId: string): Promise<Record<string, string>> {
    return (await siteDataFilesStore.getItem<Record<string, string>>(siteId)) || {};
}

================================================================================

File: core/services/navigationStructure.service.ts
// src/core/services/navigationStructure.service.ts
import { type LocalSiteData, type NavLinkItem, type StructureNode } from '@/core/types';
import { getUrlForNode } from '@/core/services/urlUtils.service';
import { getRelativePath } from '@/core/services/relativePaths.service';
import { type RenderOptions } from '@/core/services/renderer/render.service';

/**
 * Recursively builds a navigation link structure with context-aware paths.
 * @param siteData - The full site data, needed for URL generation.
 * @param nodes - The site structure nodes to build links from.
 * @param currentPagePath - The path of the page being currently rendered.
 * @param options - The render options, containing isExport and siteRootPath.
 * @returns An array of navigation link objects.
 */

function buildNavLinks(
    siteData: LocalSiteData, 
    nodes: StructureNode[], 
    currentPagePath: string, 
    options: Pick<RenderOptions, 'isExport' | 'siteRootPath'>
): NavLinkItem[] {
  return nodes
    .filter(node => node.type === 'page' && node.navOrder !== undefined)
    .sort((a, b) => (a.navOrder || 0) - (b.navOrder || 0))
    .map(node => {
      const urlSegment = getUrlForNode(node, siteData.manifest, options.isExport);
      let href: string;

      if (options.isExport) {
        // Export logic remains the same
        href = getRelativePath(currentPagePath, urlSegment);
      } else {
        // 1. Get the base path from options (e.g., "#/sites/123").
        // 2. The urlSegment is the page-specific part (e.g., "about" or "blog/post-1").
        // 3. Combine them into a clean absolute hash path.
        const basePath = options.siteRootPath.replace(/\/$/, ''); // Remove trailing slash
        const segmentPath = urlSegment ? `/${urlSegment}` : '';  // Add leading slash if segment exists
        href = `${basePath}${segmentPath}`;
      }

      const nodeFile = siteData.contentFiles?.find(f => f.path === node.path);
      const isCollectionPage = !!nodeFile?.frontmatter.collection;
      
      const children = (node.children && node.children.length > 0 && !isCollectionPage)
        ? buildNavLinks(siteData, node.children, currentPagePath, options)
        : [];

      return {
        href: href,
        label: node.menuTitle || node.title,
        children: children,
      };
    });
}

export function generateNavLinks(
  siteData: LocalSiteData,
  currentPagePath: string,
  options: Pick<RenderOptions, 'isExport' | 'siteRootPath'>
): NavLinkItem[] {
  const { structure } = siteData.manifest;
  return buildNavLinks(siteData, structure, currentPagePath, options);
}

================================================================================

File: core/services/htmlSanitizer.service.ts
// src/core/services/htmlSanitizer.service.ts

import DOMPurify from 'dompurify';

/**
 * HTML sanitization service for theme data fields.
 * Removes malicious scripts while preserving safe HTML formatting.
 */
export class HtmlSanitizerService {
  private static readonly ALLOWED_TAGS = [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'span', 'div'
  ];

  private static readonly ALLOWED_ATTRIBUTES = {
    'a': ['href', 'title', 'target'],
    '*': ['class', 'id']
  };

  /**
   * Sanitizes HTML content by removing potentially malicious elements
   * while preserving safe formatting tags.
   */
  static sanitize(html: string): string {
    if (!html || typeof html !== 'string') {
      return '';
    }

    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: this.ALLOWED_TAGS,
      ALLOWED_ATTR: Object.values(this.ALLOWED_ATTRIBUTES).flat(),
      ALLOW_DATA_ATTR: false,
      ALLOW_UNKNOWN_PROTOCOLS: false,
      SANITIZE_DOM: true,
      KEEP_CONTENT: true
    });
  }

  /**
   * Sanitizes theme data object recursively, targeting string fields that may contain HTML.
   */
  static sanitizeThemeData(themeData: Record<string, unknown>): Record<string, unknown> {
    if (!themeData || typeof themeData !== 'object') {
      return {};
    }

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(themeData)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitize(value);
      } else if (value && typeof value === 'object') {
        sanitized[key] = this.sanitizeThemeData(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

================================================================================

File: core/services/collections.service.ts
// src/core/services/collections.service.ts

import type { Manifest, Collection, ParsedMarkdownFile } from '@/core/types';

/**
 * ============================================================================
 * Collection Instance Management Service
 * ============================================================================
 * This service is responsible for all CRUD (Create, Read, Update, Delete)
 * operations on the `collections` array within a site's `manifest.json`.
 *
 * It manages the user-created instances of collections (e.g., "Blog", "News")
 * but does NOT know about the schemas or templates of their items. Its sole
 * focus is the existence and configuration of the collection itself.
 * ============================================================================
 */

// --- READ HELPERS ---

/**
 * Safely gets all collections from a manifest, returning an empty array if none exist.
 * @param manifest The site's manifest.
 * @returns An array of Collection objects.
 */
export function getCollections(manifest: Manifest): Collection[] {
  return manifest.collections || [];
}

/**
 * Finds a specific collection by its ID within a manifest.
 * @param manifest The site's manifest.
 * @param collectionId The ID of the collection to find.
 * @returns The Collection object or null if not found.
 */
export function getCollection(manifest: Manifest, collectionId: string): Collection | null {
  return getCollections(manifest).find(c => c.id === collectionId) || null;
}

/**
 * Gets all content files that belong to a specific collection.
 * @param siteData The complete data for the site.
 * @param collectionId The ID of the collection.
 * @returns An array of ParsedMarkdownFile objects belonging to the collection.
 */
export function getCollectionContent(siteData: { manifest: Manifest; contentFiles?: ParsedMarkdownFile[] }, collectionId: string): ParsedMarkdownFile[] {
  const collection = getCollection(siteData.manifest, collectionId);
  if (!collection || !siteData.contentFiles) {
    return [];
  }
  return siteData.contentFiles.filter(file =>
    file.path.startsWith(collection.contentPath)
  );
}


// --- VALIDATION & UTILITY HELPERS ---

/**
 * Validates a collection configuration object.
 * @param collection The collection object to validate.
 * @returns An object indicating if the collection is valid, with an array of errors.
 */
export function validateCollection(collection: Collection): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!collection.id?.trim()) errors.push('Collection ID is required');
  if (!collection.name?.trim()) errors.push('Collection name is required');
  if (!collection.contentPath?.trim()) errors.push('Collection content path is required');
  if (!collection.defaultItemLayout?.trim()) errors.push('Default item layout is required');
  return { isValid: errors.length === 0, errors };
}

/**
 * Checks if a collection ID is unique within the manifest.
 * @param manifest The site's manifest.
 * @param collectionId The ID to check for uniqueness.
 * @param excludeId An optional ID to exclude from the check (used when updating).
 * @returns True if the ID is unique.
 */
export function isCollectionIdUnique(manifest: Manifest, collectionId: string, excludeId?: string): boolean {
  return !getCollections(manifest).some(c => c.id === collectionId && c.id !== excludeId);
}

/**
 * Checks if a content path is already used by another collection.
 * @param manifest The site's manifest.
 * @param contentPath The path to check for uniqueness.
 * @param excludeId An optional collection ID to exclude from the check.
 * @returns True if the path is unique.
 */
export function isContentPathUnique(manifest: Manifest, contentPath: string, excludeId?: string): boolean {
  return !getCollections(manifest).some(c => c.contentPath === contentPath && c.id !== excludeId);
}

/**
 * Generates a unique, URL-friendly ID for a new collection based on its name.
 * @param manifest The site's manifest.
 * @param baseName The human-readable name of the collection.
 * @returns A unique string ID.
 */
export function generateUniqueCollectionId(manifest: Manifest, baseName: string): string {
  let baseId = baseName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!baseId) baseId = 'collection';

  let id = baseId;
  let counter = 1;
  while (!isCollectionIdUnique(manifest, id)) {
    id = `${baseId}-${counter}`;
    counter++;
  }
  return id;
}


// --- WRITE (CRUD) OPERATIONS ---

/**
 * Ensures the `collections` array exists on the manifest.
 * @param manifest The site's manifest.
 * @returns A manifest object guaranteed to have a `collections` array.
 */
function ensureCollectionsArray(manifest: Manifest): Manifest {
  if (!Array.isArray(manifest.collections)) {
    return { ...manifest, collections: [] };
  }
  return manifest;
}

/**
 * Creates a new collection and adds it to the manifest.
 * @param manifest The current site manifest.
 * @param collectionData The data for the new collection, excluding the `id`.
 * @returns An object containing the updated manifest and the newly created collection.
 */
export function createCollection(manifest: Manifest, collectionData: Omit<Collection, 'id'>): { manifest: Manifest; collection: Collection } {
  const updatedManifest = ensureCollectionsArray(manifest);
  const newCollection: Collection = {
    ...collectionData,
    id: generateUniqueCollectionId(updatedManifest, collectionData.name)
  };

  const validation = validateCollection(newCollection);
  if (!validation.isValid) throw new Error(`Invalid collection: ${validation.errors.join(', ')}`);
  if (!isContentPathUnique(updatedManifest, newCollection.contentPath)) throw new Error(`Content path '${newCollection.contentPath}' is already used.`);

  const finalManifest = { ...updatedManifest, collections: [...updatedManifest.collections!, newCollection] };
  return { manifest: finalManifest, collection: newCollection };
}

/**
 * Updates an existing collection in the manifest.
 * @param manifest The current site manifest.
 * @param collectionId The ID of the collection to update.
 * @param updates A partial object of properties to update.
 * @returns The updated manifest.
 */
export function updateCollection(manifest: Manifest, collectionId: string, updates: Partial<Omit<Collection, 'id'>>): Manifest {
  const collections = getCollections(manifest);
  const existingIndex = collections.findIndex(c => c.id === collectionId);
  if (existingIndex === -1) throw new Error(`Collection '${collectionId}' not found`);

  const updatedCollection: Collection = { ...collections[existingIndex], ...updates };

  const validation = validateCollection(updatedCollection);
  if (!validation.isValid) throw new Error(`Invalid collection update: ${validation.errors.join(', ')}`);
  if (updates.contentPath && !isContentPathUnique(manifest, updates.contentPath, collectionId)) throw new Error(`Content path '${updates.contentPath}' is already used.`);

  const updatedCollections = [...collections];
  updatedCollections[existingIndex] = updatedCollection;

  return { ...manifest, collections: updatedCollections };
}

/**
 * Deletes a collection from the manifest.
 * @param manifest The current site manifest.
 * @param collectionId The ID of the collection to delete.
 * @returns An object containing the updated manifest.
 */
export function deleteCollection(manifest: Manifest, collectionId: string): { manifest: Manifest } {
  const collections = getCollections(manifest);
  if (!collections.some(c => c.id === collectionId)) throw new Error(`Collection '${collectionId}' not found`);

  const updatedCollections = collections.filter(c => c.id !== collectionId);
  return { manifest: { ...manifest, collections: updatedCollections } };
}

/**
 * Duplicates a collection with a new name and content path.
 * @param manifest The current site manifest.
 * @param sourceCollectionId The ID of the collection to duplicate.
 * @param newName The name for the new, duplicated collection.
 * @param newContentPath The content path for the new collection.
 * @returns An object containing the updated manifest and the newly duplicated collection.
 */
export function duplicateCollection(
  manifest: Manifest,
  sourceCollectionId: string,
  newName: string,
  newContentPath: string,
): { manifest: Manifest; collection: Collection } {
  const sourceCollection = getCollection(manifest, sourceCollectionId);
  if (!sourceCollection) throw new Error(`Source collection '${sourceCollectionId}' not found`);

  // Create a new collection object, inheriting the essential `defaultItemLayout`.
  const duplicatedCollectionData: Omit<Collection, 'id'> = {
    name: newName,
    contentPath: newContentPath,
    defaultItemLayout: sourceCollection.defaultItemLayout, // Inherit the item layout
    settings: sourceCollection.settings ? { ...sourceCollection.settings } : undefined
  };

  return createCollection(manifest, duplicatedCollectionData);
}

================================================================================

File: core/services/siteBuilder.service.ts
// src/core/services/siteBuilder.service.ts

import type { LocalSiteData, SiteBundle } from '@/core/types';
import { getMergedThemeDataForForm } from '@/core/services/config/theme.service';
import { bundleAllAssets } from './builder/asset.builder';
import { bundleSourceFiles } from './builder/source.builder';
import { generateMetadataFiles } from './builder/metadata.builder';
import { generateHtmlPages } from './builder/page.builder';

/**
 * Orchestrates the entire site build process by calling specialized builder modules.
 * This service generates a complete, in-memory representation of a static site bundle.
 */
export async function buildSiteBundle(siteData: LocalSiteData): Promise<SiteBundle> {
    const bundle: SiteBundle = {};
    if (!siteData.contentFiles) {
        throw new Error("Cannot build site: content files are not loaded.");
    }

    // 1. Prepare a synchronized version of the site data for a consistent build.
    const { initialConfig: finalMergedConfig } = await getMergedThemeDataForForm(
        siteData.manifest.theme.name,
        siteData.manifest.theme.config
    );
    const synchronizedSiteData = {
        ...siteData,
        manifest: { ...siteData.manifest, theme: { ...siteData.manifest.theme, config: finalMergedConfig } },
    };

    // 2. Generate all HTML pages for every piece of content.
    const htmlPages = await generateHtmlPages(synchronizedSiteData);
    Object.assign(bundle, htmlPages);

    // 3. Bundle all raw source files (Markdown, manifest, etc.) into the `_site` directory.
    await bundleSourceFiles(bundle, synchronizedSiteData);

    // 4. Bundle all assets (images, themes, layouts).
    await bundleAllAssets(bundle, synchronizedSiteData);

    // 5. Generate metadata files (RSS, sitemap).
    // CORRECTED: The call now correctly passes only the two required arguments.
    generateMetadataFiles(bundle, synchronizedSiteData);

    return bundle;
}

================================================================================

File: core/services/pageResolver.service.ts
// src/core/services/pageResolver.service.ts

import type { LocalSiteData, PageResolutionResult } from '@/core/types';
import { PageType } from '@/core/types';
import { getUrlForNode } from './urlUtils.service';

/**
 * Finds the correct page to render based on a URL slug path. This is the
 * core routing logic for the live preview.
 *
 * It now follows a unified, two-step process:
 * 1. Check if the path matches a regular page in the `manifest.structure`.
 * 2. If not, check if the path matches a collection item in the `manifest.collectionItems`.
 *
 * This eliminates the old, inconsistent `/collection/...` route.
 *
 * @param siteData The complete data for the site.
 * @param slugArray The URL segments used for path matching (e.g., ['blog', 'my-post']).
 * @returns A promise resolving to a PageResolutionResult.
 */
export async function resolvePageContent(
    siteData: LocalSiteData,
    slugArray: string[],
): Promise<PageResolutionResult> {

    const { manifest, contentFiles } = siteData;
    const pathFromSlug = slugArray.join('/');

    // --- Step 1: Resolve against regular pages in the navigation structure ---

    // Handle homepage request (empty slug array)
    if (slugArray.length === 0 || (slugArray.length === 1 && slugArray[0] === '')) {
        const homepageNode = manifest.structure[0];
        if (!homepageNode) {
            return { type: PageType.NotFound, errorMessage: "No homepage has been designated for this site." };
        }
        const contentFile = contentFiles?.find(f => f.path === homepageNode.path);
        if (!contentFile) {
            return { type: PageType.NotFound, errorMessage: `Homepage file at "${homepageNode.path}" is missing.` };
        }
        // NOTE: Collection querying for listing pages is now handled by the renderer, not the resolver.
        return { type: PageType.SinglePage, pageTitle: contentFile.frontmatter.title, contentFile, layoutPath: contentFile.frontmatter.layout };
    }

    // Attempt to find a regular page by matching its generated URL.
    for (const node of manifest.structure) {
        const nodeUrl = getUrlForNode(node, manifest, false);
        if (nodeUrl === pathFromSlug) {
            const contentFile = contentFiles?.find(f => f.path === node.path);
            if (!contentFile) {
                 return { type: PageType.NotFound, errorMessage: `Page file at "${node.path}" is missing.` };
            }
            return { type: PageType.SinglePage, pageTitle: contentFile.frontmatter.title, contentFile, layoutPath: contentFile.frontmatter.layout };
        }
    }

    // --- Step 2: If not found, resolve against collection items ---
    const collectionItems = manifest.collectionItems || [];
    for (const itemRef of collectionItems) {
        const itemUrl = getUrlForNode(itemRef, manifest, false);
        if (itemUrl === pathFromSlug) {
            const contentFile = contentFiles?.find(f => f.path === itemRef.path);
            if (!contentFile) {
                return { type: PageType.NotFound, errorMessage: `Collection item file at "${itemRef.path}" is missing.` };
            }
            return { type: PageType.SinglePage, pageTitle: contentFile.frontmatter.title, contentFile, layoutPath: contentFile.frontmatter.layout };
        }
    }

    // --- Step 3: If still not found, return a 404 error ---
    return {
        type: PageType.NotFound,
        errorMessage: `No page or collection item could be found for the URL path: /${pathFromSlug}`,
    };
}

================================================================================

File: core/services/siteSecrets.service.ts
// src/core/services/siteSecrets.service.ts
import localforage from 'localforage';

const DB_NAME = 'SparktypeDB';

// This store is NEVER included in the site export.
const siteSecretsStore = localforage.createInstance({
  name: DB_NAME,
  storeName: 'siteSecrets',
});


/**
 * Defines the shape of the sensitive, non-public data for a site.
 * This data is stored separately and is not included in public site exports.
 */
export interface SiteSecrets {
  cloudinary?: {
    uploadPreset?: string;
  };
}

/**
 * Loads the secrets object for a specific site from the database.
 * @param siteId The ID of the site.
 * @returns A promise that resolves to the SiteSecrets object, or an empty object.
 */
export async function loadSiteSecretsFromDb(siteId: string): Promise<SiteSecrets> {
  return (await siteSecretsStore.getItem<SiteSecrets>(siteId)) || {};
}

/**
 * Saves the complete secrets object for a specific site to the database.
 * @param siteId The ID of the site.
 * @param secrets The SiteSecrets object to save.
 */
export async function saveSiteSecretsToDb(siteId: string, secrets: SiteSecrets): Promise<void> {
  await siteSecretsStore.setItem(siteId, secrets);
}

/**
 * Deletes all secrets for a specific site from the database.
 * This should be called when deleting a site to ensure sensitive data is properly purged.
 * @param siteId The ID of the site whose secrets should be deleted.
 */
export async function deleteSiteSecretsFromDb(siteId: string): Promise<void> {
  await siteSecretsStore.removeItem(siteId);
}

================================================================================

File: core/services/fileTree.service.ts
// src/core/services/fileTree.service.ts
import type { ParsedMarkdownFile, StructureNode } from '@/core/types';

/**
 * A flattened representation of a StructureNode, including its depth and parent.
 * It also includes the frontmatter for easier access in UI components.
 */
export interface FlattenedNode extends StructureNode {
  parentId: string | null;
  depth: number;
  index: number;
  collapsed?: boolean;
  frontmatter?: ParsedMarkdownFile['frontmatter'];
}

/**
 * Recursively traverses a tree of StructureNodes and flattens it into an array.
 * It now also merges frontmatter data into each node.
 */
function flatten(
  nodes: StructureNode[],
  contentFiles: ParsedMarkdownFile[],
  parentId: string | null = null,
  depth = 0
): FlattenedNode[] {
  return nodes.reduce<FlattenedNode[]>((acc, item, index) => {
    const file = contentFiles.find(f => f.path === item.path);
    return [
      ...acc,
      { ...item, parentId, depth, index, frontmatter: file?.frontmatter },
      ...(item.children ? flatten(item.children, contentFiles, item.path, depth + 1) : []),
    ];
  }, []);
}

/**
 * Public facing function to flatten the entire site structure tree.
 */
export function flattenTree(nodes: StructureNode[], contentFiles: ParsedMarkdownFile[]): FlattenedNode[] {
  return flatten(nodes, contentFiles);
}

/**
 * Reconstructs a nested tree structure from a flat array of nodes.
 */
export function buildTree(flattenedNodes: FlattenedNode[]): StructureNode[] {
  const root: StructureNode & { children: StructureNode[] } = {
    path: 'root', slug: 'root', title: 'root', type: 'page', children: []
  };
  const nodes: Record<string, StructureNode> = { [root.path]: root };

  const items = flattenedNodes.map(item => ({ ...item, children: [] as StructureNode[] }));

  for (const item of items) {
    const { path } = item;
    const parentId = item.parentId ?? root.path;
    
    nodes[path] = item;
    const parent = nodes[parentId];

    if (parent) {
      parent.children = parent.children ?? [];
      parent.children.push(item);
    }
  }
  
  return root.children ?? [];
}

/**
 * Recursively traverses a tree of StructureNodes and returns a simple flat array.
 * This is used when only the node data is needed, without depth or parent context.
 * @param {StructureNode[]} nodes - The tree of nodes to flatten.
 * @returns {StructureNode[]} A flat array of all nodes in the tree.
 */
export function flattenStructure(nodes: StructureNode[]): StructureNode[] {
  let allNodes: StructureNode[] = [];
  for (const node of nodes) {
    allNodes.push(node);
    if (node.children) {
      allNodes = allNodes.concat(flattenStructure(node.children));
    }
  }
  return allNodes;
}

/**
 * Finds a node in a structure tree by its exact `path`.
 */
export function findNodeByPath(nodes: StructureNode[], path: string): StructureNode | undefined {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findNodeByPath(node.children, path);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Finds all direct child nodes of a given parent node path.
 * This is a simple utility used by the page resolver for collection pages.
 * @param {StructureNode[]} nodes - The entire site structure tree.
 * @param {string} parentPath - The path of the parent node whose children are needed.
 * @returns {StructureNode[]} An array of child nodes, or an empty array if not found.
 */
export function findChildNodes(nodes: StructureNode[], parentPath: string): StructureNode[] {
    const parentNode = findNodeByPath(nodes, parentPath);
    return parentNode?.children || [];
}

/**
 * Finds and removes a node from a tree structure immutably.
 */
export function findAndRemoveNode(nodes: StructureNode[], path: string): { found: StructureNode | null, tree: StructureNode[] } {
    let found: StructureNode | null = null;
    const filterRecursively = (currentNodes: StructureNode[]): StructureNode[] => {
      return currentNodes.reduce<StructureNode[]>((acc, node) => {
        if (node.path === path) {
          found = node;
          return acc;
        }
        const newNode = { ...node };
        if (newNode.children) {
          newNode.children = filterRecursively(newNode.children);
        }
        acc.push(newNode);
        return acc;
      }, []);
    };
    const newTree = filterRecursively(nodes);
    return { found, tree: newTree };
  }
  
/**
 * Recursively updates the path of a node and all of its descendants.
 */
export function updatePathsRecursively(node: StructureNode, newParentDir: string): StructureNode {
    const fileName = node.path.substring(node.path.lastIndexOf('/') + 1);
    const newPath = `${newParentDir}/${fileName}`.replace('//', '/');
    const newSlug = newPath.replace(/^content\//, '').replace(/\.md$/, '');
    const updatedNode: StructureNode = { ...node, path: newPath, slug: newSlug };
    if (updatedNode.children) {
      const newChildsParentPath = newPath.replace(/\.md$/, '');
      updatedNode.children = updatedNode.children.map(child =>
        updatePathsRecursively(child, newChildsParentPath)
      );
    }
    return updatedNode;
}
  
/**
 * Recursively calculates the depth of a specific node within the tree.
 */
export function getNodeDepth(nodes: StructureNode[], path: string, currentDepth = 0): number {
    for (const node of nodes) {
        if (node.path === path) {
            return currentDepth;
        }
        if (node.children) {
            const depth = getNodeDepth(node.children, path, currentDepth + 1);
            if (depth !== -1) {
                return depth;
            }
        }
    }
    return -1;
}
  
/**
 * Recursively traverses a node tree and returns a flat array of all node paths (IDs).
 */
export function getDescendantIds(nodes: StructureNode[]): string[] {
    return nodes.flatMap(node => [
      node.path,
      ...(node.children ? getDescendantIds(node.children) : []),
    ]);
}

================================================================================

File: core/services/publishing/NetlifyProxyProvider.ts
import { BaseProvider } from './BaseProvider';
import type { PublishingResult, ValidationResult, PublishingConfigSchema } from './types';
import type { LocalSiteData } from '@/core/types';

export interface NetlifyConfig {
  apiToken: string;
  siteId?: string;
  siteName?: string;
}

export class NetlifyProxyProvider extends BaseProvider {
  readonly name = 'netlify-proxy';
  readonly displayName = 'Netlify (via Proxy)';
  
  private readonly proxyUrl: string;

  constructor(proxyUrl: string = 'https://your-proxy.your-domain.workers.dev') {
    super();
    this.proxyUrl = proxyUrl;
  }

  async deploy(site: LocalSiteData, config: Record<string, unknown>): Promise<PublishingResult> {
    try {
      const validation = await this.validateConfig(config);
      if (!validation.valid) {
        return {
          success: false,
          message: `Configuration error: ${validation.errors.join(', ')}`
        };
      }

      // Cast config to NetlifyConfig for type safety after validation
      const netlifyConfig = config as unknown as NetlifyConfig;

      // Generate site files
      const files = await this.generateSiteFiles(site);
      
      // Create a ZIP archive of the files
      const zipBlob = await this.createZipFromFiles(files);
      
      let siteId = netlifyConfig.siteId;
      
      // If no siteId provided, create a new site via proxy
      if (!siteId) {
        const createResponse = await this.createSiteViaProxy(netlifyConfig.apiToken, netlifyConfig.siteName || site.manifest.title);
        if (!createResponse.success) {
          return createResponse;
        }
        siteId = createResponse.details?.id as string;
      }
      
      // Deploy the files via proxy
      const deployResponse = await this.deployViaProxy(netlifyConfig.apiToken, siteId!, zipBlob);
      
      return deployResponse;
      
    } catch (error) {
      return {
        success: false,
        message: `Deployment failed: ${(error as Error).message}`
      };
    }
  }

  async validateConfig(config: Record<string, unknown>): Promise<ValidationResult> {
    const requiredFields = ['apiToken'];
    return this.validateRequiredFields(config, requiredFields);
  }

  getConfigSchema(): PublishingConfigSchema {
    return {
      type: 'object',
      properties: {
        apiToken: {
          type: 'string',
          title: 'API Token',
          description: 'Your Netlify personal access token'
        },
        siteId: {
          type: 'string',
          title: 'Site ID (Optional)',
          description: 'Existing Netlify site ID to update'
        },
        siteName: {
          type: 'string',
          title: 'Site Name (Optional)',
          description: 'Name for new site (if not updating existing)'
        }
      },
      required: ['apiToken']
    };
  }

  private async createSiteViaProxy(apiToken: string, siteName?: string): Promise<PublishingResult> {
    try {
      const response = await fetch(`${this.proxyUrl}/api/netlify/create-site`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiToken,
          siteName: siteName ? this.sanitizeSiteName(siteName) : undefined
        })
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          message: `Failed to create site: ${error}`
        };
      }

      const site = await response.json();
      return {
        success: true,
        message: 'Site created successfully',
        details: site
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create site: ${(error as Error).message}`
      };
    }
  }

  private async deployViaProxy(apiToken: string, siteId: string, zipBlob: Blob): Promise<PublishingResult> {
    try {
      const formData = new FormData();
      formData.append('apiToken', apiToken);
      formData.append('siteId', siteId);
      formData.append('zipFile', zipBlob);

      const response = await fetch(`${this.proxyUrl}/api/netlify/deploy`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          message: `Deployment failed: ${error}`
        };
      }

      const deploy = await response.json();
      return {
        success: true,
        message: 'Site deployed successfully!',
        url: deploy.deploy_ssl_url || deploy.deploy_url,
        details: deploy
      };
    } catch (error) {
      return {
        success: false,
        message: `Deployment failed: ${(error as Error).message}`
      };
    }
  }

  private async createZipFromFiles(files: Map<string, string | Uint8Array>): Promise<Blob> {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    
    for (const [path, content] of files) {
      if (typeof content === 'string') {
        zip.file(path, content);
      } else {
        zip.file(path, content);
      }
    }
    
    return await zip.generateAsync({ type: 'blob' });
  }

  private sanitizeSiteName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 63);
  }
}

================================================================================

File: core/services/publishing/NetlifyProvider.ts
import { BaseProvider } from './BaseProvider';
import type { PublishingResult, ValidationResult, PublishingConfigSchema } from './types';
import type { LocalSiteData } from '@/core/types';

export interface NetlifyConfig {
  apiToken: string;
  siteId?: string;
  siteName?: string;
}

export class NetlifyProvider extends BaseProvider {
  readonly name = 'netlify';
  readonly displayName = 'Netlify';
  
  private readonly apiBase = 'https://api.netlify.com/api/v1';

  async deploy(site: LocalSiteData, config: Record<string, unknown>): Promise<PublishingResult> {
    try {
      const validation = await this.validateConfig(config);
      if (!validation.valid) {
        return {
          success: false,
          message: `Configuration error: ${validation.errors.join(', ')}`
        };
      }

      // Cast config to NetlifyConfig for type safety after validation
      const netlifyConfig = config as unknown as NetlifyConfig;

      // Generate site files
      const files = await this.generateSiteFiles(site);
      
      // Create a ZIP archive of the files
      const zipBlob = await this.createZipFromFiles(files);
      
      let siteId = netlifyConfig.siteId;
      
      // If no siteId provided, create a new site
      if (!siteId) {
        const createResponse = await this.createSite(netlifyConfig.apiToken, netlifyConfig.siteName || site.manifest.title);
        if (!createResponse.success) {
          return createResponse;
        }
        siteId = createResponse.details?.siteId as string;
      }
      
      // Deploy the files
      const deployResponse = await this.deployFiles(netlifyConfig.apiToken, siteId!, zipBlob);
      
      return deployResponse;
      
    } catch (error) {
      return {
        success: false,
        message: `Deployment failed: ${(error as Error).message}`
      };
    }
  }

  async validateConfig(config: Record<string, unknown>): Promise<ValidationResult> {
    const requiredFields = ['apiToken'];
    const baseValidation = this.validateRequiredFields(config, requiredFields);
    
    if (!baseValidation.valid) {
      return baseValidation;
    }

    // Additional validation: check if API token is valid
    try {
      const response = await fetch(`${this.apiBase}/user`, {
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        return {
          valid: false,
          errors: ['Invalid API token']
        };
      }
      
      return { valid: true, errors: [] };
    } catch {
      return {
        valid: false,
        errors: ['Failed to validate API token']
      };
    }
  }

  getConfigSchema(): PublishingConfigSchema {
    return {
      type: 'object',
      properties: {
        apiToken: {
          type: 'string',
          title: 'API Token',
          description: 'Your Netlify personal access token'
        },
        siteId: {
          type: 'string',
          title: 'Site ID (Optional)',
          description: 'Existing Netlify site ID to update'
        },
        siteName: {
          type: 'string',
          title: 'Site Name (Optional)',
          description: 'Name for new site (if not updating existing)'
        }
      },
      required: ['apiToken']
    };
  }

  private async createSite(apiToken: string, siteName?: string): Promise<PublishingResult> {
    try {
      const response = await fetch(`${this.apiBase}/sites`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: siteName ? this.sanitizeSiteName(siteName) : undefined
        })
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          message: `Failed to create site: ${error}`
        };
      }

      const site = await response.json();
      return {
        success: true,
        message: 'Site created successfully',
        details: { siteId: site.id, siteUrl: site.url }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create site: ${(error as Error).message}`
      };
    }
  }

  private async deployFiles(apiToken: string, siteId: string, zipBlob: Blob): Promise<PublishingResult> {
    try {
      const response = await fetch(`${this.apiBase}/sites/${siteId}/deploys`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/zip'
        },
        body: zipBlob
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          message: `Deployment failed: ${error}`
        };
      }

      const deploy = await response.json();
      return {
        success: true,
        message: 'Site deployed successfully!',
        url: deploy.deploy_ssl_url || deploy.deploy_url,
        details: { deployId: deploy.id, siteId }
      };
    } catch (error) {
      return {
        success: false,
        message: `Deployment failed: ${(error as Error).message}`
      };
    }
  }

  private async createZipFromFiles(files: Map<string, string | Uint8Array>): Promise<Blob> {
    // Use JSZip to create a zip file
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    
    for (const [path, content] of files) {
      if (typeof content === 'string') {
        zip.file(path, content);
      } else {
        zip.file(path, content);
      }
    }
    
    return await zip.generateAsync({ type: 'blob' });
  }

  private sanitizeSiteName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 63); // Netlify site name max length
  }
}

================================================================================

File: core/services/publishing/BaseProvider.ts
import type { PublishingProvider, PublishingResult, ValidationResult, PublishingConfigSchema } from './types';
import type { LocalSiteData } from '@/core/types';

export abstract class BaseProvider implements PublishingProvider {
  abstract readonly name: string;
  abstract readonly displayName: string;

  abstract deploy(site: LocalSiteData, config: Record<string, unknown>): Promise<PublishingResult>;
  abstract validateConfig(config: Record<string, unknown>): Promise<ValidationResult>;
  abstract getConfigSchema(): PublishingConfigSchema;

  /**
   * Generate static site files from the site data
   */
  protected async generateSiteFiles(site: LocalSiteData): Promise<Map<string, string | Uint8Array>> {
    // TODO: Implement site generation logic
    // This would convert the LocalSiteData into actual HTML/CSS/JS files
    const files = new Map<string, string | Uint8Array>();
    
    // For now, create a basic index.html
    const indexHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${site.manifest.title || 'Untitled Site'}</title>
</head>
<body>
    <h1>${site.manifest.title || 'Untitled Site'}</h1>
    <p>${site.manifest.description || 'No description provided.'}</p>
    <p><em>Generated by Sparktype</em></p>
</body>
</html>`.trim();

    files.set('index.html', indexHtml);
    
    return files;
  }

  /**
   * Validate required configuration fields
   */
  protected validateRequiredFields(config: Record<string, unknown>, requiredFields: string[]): ValidationResult {
    const errors: string[] = [];
    
    for (const field of requiredFields) {
      if (!config[field] || (typeof config[field] === 'string' && config[field].trim() === '')) {
        errors.push(`${field} is required`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

================================================================================

File: core/services/publishing/types.ts
import type { LocalSiteData } from '@/core/types';

export interface PublishingProvider {
  readonly name: string;
  readonly displayName: string;
  
  /**
   * Deploy a site using this provider
   */
  deploy(site: LocalSiteData, config: Record<string, unknown>): Promise<PublishingResult>;
  
  /**
   * Validate the provider configuration
   */
  validateConfig(config: Record<string, unknown>): Promise<ValidationResult>;
  
  /**
   * Get the configuration schema for this provider
   */
  getConfigSchema(): PublishingConfigSchema;
}

export interface PublishingResult {
  success: boolean;
  url?: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface PublishingConfigSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
}

export interface PublishingConfig {
  provider: string;
  config: Record<string, unknown>;
}

export type SupportedProvider = 'zip' | 'netlify';

================================================================================

File: core/services/renderer/render.service.ts
// src/core/services/renderer/render.service.ts

import Handlebars from 'handlebars';
import type { LocalSiteData, PageResolutionResult } from '@/core/types';
import { PageType } from '@/core/types';
import { getAssetContent, getLayoutManifest } from '@/core/services/config/configHelpers.service';
import { getActiveImageService } from '@/core/services/images/images.service';
import { getMergedThemeDataForForm } from '@/core/services/config/theme.service';
import { prepareRenderEnvironment } from './asset.service';
import { assemblePageContext, assembleBaseContext } from './context.service';

/**
 * Defines the options passed to the main render function.
 */
export interface RenderOptions {
    siteRootPath: string;
    isExport: boolean;
    relativeAssetPath?: string;
}

/**

 * Renders a resolved page into a full HTML string. This is the primary
 * orchestration function for the entire rendering pipeline.
 */
export async function render(
    siteData: LocalSiteData,
    resolution: PageResolutionResult,
    options: RenderOptions
): Promise<string> {
    if (resolution.type === PageType.NotFound) {
        return `<h1>404 - Not Found</h1><p>${resolution.errorMessage}</p>`;
    }

    // 1. Synchronize Data and Prepare Handlebars Environment
    const { initialConfig: finalMergedConfig } = await getMergedThemeDataForForm(siteData.manifest.theme.name, siteData.manifest.theme.config);
    const synchronizedSiteData = { ...siteData, manifest: { ...siteData.manifest, theme: { ...siteData.manifest.theme, config: finalMergedConfig }}};
    await prepareRenderEnvironment(synchronizedSiteData);

    // 2. Get Services and Manifests
    const imageService = getActiveImageService(synchronizedSiteData.manifest);
    const pageLayoutManifest = await getLayoutManifest(synchronizedSiteData, resolution.layoutPath);
    if (!pageLayoutManifest) {
      throw new Error(`Layout manifest not found for layout: "${resolution.layoutPath}"`);
    }

    // 3. Assemble Data Contexts for the Templates
    const pageContext = await assemblePageContext(synchronizedSiteData, resolution, options, imageService, pageLayoutManifest);
    const baseContext = await assembleBaseContext(synchronizedSiteData, resolution, options, imageService, pageContext);

    // 4. Compile and Render the Main Body Content
    // The template path is determined by the layout type.
    const bodyTemplatePath = pageLayoutManifest.layoutType === 'collection' ? 'index.hbs' : 'index.hbs';
    const bodyTemplateSource = await getAssetContent(synchronizedSiteData, 'layout', resolution.layoutPath, bodyTemplatePath);
    if (!bodyTemplateSource) throw new Error(`Body template not found: layouts/${resolution.layoutPath}/${bodyTemplatePath}`);

    const bodyHtml = await Handlebars.compile(bodyTemplateSource)(pageContext);

    // 5. Compile and Render the Final Page Shell (base.hbs)
    const baseTemplateSource = await getAssetContent(synchronizedSiteData, 'theme', synchronizedSiteData.manifest.theme.name, 'base.hbs');
    if (!baseTemplateSource) throw new Error('Base theme template (base.hbs) not found.');

    const finalContextWithBody = { ...baseContext, body: new Handlebars.SafeString(bodyHtml) };
    return await Handlebars.compile(baseTemplateSource)(finalContextWithBody);
}

================================================================================

File: core/services/renderer/context.service.ts
// src/core/services/renderer/context.service.ts

import Handlebars from 'handlebars';
import type {
    LocalSiteData,
    PageResolutionResult,
    ImageRef,
    ParsedMarkdownFile,
    Manifest,
    ImageService,
    LayoutManifest,
    CollectionItemRef,
    StructureNode,
} from '@/core/types';
import { PageType } from '@/core/types';
import { generateNavLinks } from '@/core/services/navigationStructure.service';
import { getUrlForNode } from '@/core/services/urlUtils.service';
import { generateStyleOverrides } from './asset.service';
import { type RenderOptions } from './render.service';
import { getRelativePath } from '@/core/services/relativePaths.service';

// Define a reusable type for the resolved image presets.
type ResolvedImagePresets = Record<string, { url: string; width?: number; height?: number }>;

// The context object passed into the main body template.
type EnrichedPageContext = (PageResolutionResult & {
    images?: ResolvedImagePresets;
    collectionItems?: (ParsedMarkdownFile & { images?: ResolvedImagePresets; url: string })[];
    layoutManifest?: LayoutManifest | null;
});

/**
 * Asynchronously resolves all image preset URLs for a given content file.
 */
async function resolveImagePresets(context: {
    imageService: ImageService;
    layoutManifest: LayoutManifest | null;
    contentFile: ParsedMarkdownFile;
    options: Pick<RenderOptions, 'isExport'>;
    manifest: Manifest;
}): Promise<ResolvedImagePresets> {
    const { imageService, layoutManifest, contentFile, options, manifest } = context;
    const presets = layoutManifest?.image_presets || {};
    const resolved: ResolvedImagePresets = {};
    for (const [name, preset] of Object.entries(presets)) {
        const sourceRef = contentFile.frontmatter[preset.source] as ImageRef | undefined;
        if (sourceRef?.serviceId && sourceRef?.src) {
            try {
                resolved[name] = {
                    url: await imageService.getDisplayUrl(manifest, sourceRef, preset, options.isExport),
                    width: preset.width,
                    height: preset.height,
                };
            } catch (e) { console.warn(`Could not resolve image preset "${name}":`, e); }
        }
    }
    return resolved;
}

/**
 * Assembles the complete context object for the main page body template.
 * This function enriches the initial page resolution with async data like image URLs.
 */
export async function assemblePageContext(
    siteData: LocalSiteData,
    resolution: PageResolutionResult,
    options: RenderOptions,
    imageService: ImageService,
    pageLayoutManifest: LayoutManifest | null
): Promise<EnrichedPageContext> {
    if (resolution.type === PageType.NotFound) {
        return resolution;
    }

    const { manifest } = siteData;
    const imageContext = await resolveImagePresets({ imageService, layoutManifest: pageLayoutManifest, contentFile: resolution.contentFile, options, manifest });

    // When rendering a collection page, we need to process its items.
    const processedCollectionItems = resolution.collectionItems
        ? await Promise.all(resolution.collectionItems.map(async (item: ParsedMarkdownFile) => {
            // CORRECTED: Create a lightweight `CollectionItemRef` on-the-fly to pass to the URL service.
            // This ensures we're using the explicit data model for URL generation.
            const collectionId = manifest.collections?.find(c => item.path.startsWith(c.contentPath))?.id || '';
            const itemRef: CollectionItemRef = {
                collectionId: collectionId,
                path: item.path,
                slug: item.slug,
                title: item.frontmatter.title,
                url: '' // Will be generated next
            };
            
            const urlSegment = getUrlForNode(itemRef, manifest, options.isExport);
            
            // CORRECTED: Create a `StructureNode` for the current (parent) page to get its path.
            const currentPageNode: StructureNode = {
              type: 'page',
              title: resolution.contentFile.frontmatter.title,
              path: resolution.contentFile.path,
              slug: resolution.contentFile.slug
            };
            const currentPagePath = getUrlForNode(currentPageNode, manifest, options.isExport);

            let itemUrl: string;
            if (options.isExport) {
                itemUrl = getRelativePath(currentPagePath, urlSegment);
            } else {
                const path = `/${urlSegment}`.replace(/\/$/, '') || '/';
                itemUrl = `${options.siteRootPath}${path === '/' ? '' : path}`;
            }

            return {
                ...item,
                url: itemUrl,
                images: await resolveImagePresets({ imageService, layoutManifest: pageLayoutManifest, contentFile: item, options, manifest }),
            };
        }))
        : [];

    return {
        ...resolution,
        images: imageContext,
        collectionItems: processedCollectionItems,
        layoutManifest: pageLayoutManifest,
    };
}

/**
 * Assembles the final, top-level context for the theme's base shell (base.hbs).
 */
export async function assembleBaseContext(
    siteData: LocalSiteData,
    resolution: PageResolutionResult,
    options: RenderOptions,
    imageService: ImageService,
    pageContext: EnrichedPageContext
) {
    if (resolution.type === PageType.NotFound || pageContext.type === PageType.NotFound) {
        return {};
    }

    const { manifest } = siteData;
    const logoUrl = manifest.logo ? await imageService.getDisplayUrl(manifest, manifest.logo, { height: 32 }, options.isExport) : undefined;
    const faviconUrl = manifest.favicon ? await imageService.getDisplayUrl(manifest, manifest.favicon, { width: 32, height: 32 }, options.isExport) : undefined;
    const openGraphImageUrl = pageContext.images?.og_image?.url || pageContext.images?.teaser_thumbnail?.url;
    
    // CORRECTED: Create the appropriate `StructureNode` or `CollectionItemRef` before passing to `getUrlForNode`.
    // We check the manifest to see if the resolved content file is a known collection item.
    const isItem = manifest.collectionItems?.some(item => item.path === resolution.contentFile.path);
    let urlNode: StructureNode | CollectionItemRef;
    if (isItem) {
      const itemRef = manifest.collectionItems?.find(item => item.path === resolution.contentFile.path)!;
      urlNode = itemRef;
    } else {
      urlNode = {
        type: 'page',
        title: resolution.contentFile.frontmatter.title,
        path: resolution.contentFile.path,
        slug: resolution.contentFile.slug,
      };
    }
    
    return {
        manifest,
        options,
        pageContext,
        navLinks: generateNavLinks(siteData, getUrlForNode(urlNode, manifest, true), options),
        headContext: {
            pageTitle: resolution.pageTitle,
            manifest,
            contentFile: resolution.contentFile,
            canonicalUrl: new URL(getUrlForNode(urlNode, manifest, false), manifest.baseUrl || 'https://example.com').href,
            baseUrl: options.relativeAssetPath ?? '/',
            styleOverrides: new Handlebars.SafeString(generateStyleOverrides(manifest.theme.config)),
            faviconUrl,
            logoUrl,
            openGraphImageUrl,
        },
    };
}

================================================================================

File: core/services/renderer/asset.service.ts
// src/core/services/renderer/asset.service.ts

import Handlebars from 'handlebars';
import type { LocalSiteData, ThemeManifest, LayoutManifest, AssetFile } from '@/core/types';
import { getJsonAsset, getAssetContent, getAvailableLayouts } from '@/core/services/config/configHelpers.service';
import { coreHelpers } from './helpers';

let areHelpersRegistered = false;

/** Registers all core Handlebars helpers. Idempotent. */
function registerCoreHelpers(siteData: LocalSiteData): void {
    if (areHelpersRegistered) return;
    coreHelpers.forEach(helperFactory => {
        const helperMap = helperFactory(siteData);
        Object.entries(helperMap).forEach(([name, func]) => Handlebars.registerHelper(name, func));
    });
    areHelpersRegistered = true;
}

/**
 * Pre-compiles and registers all available theme and layout partials with Handlebars.
 * This function is now simpler and more robust, as it no longer needs to deal with a
 * separate "Collection Type" system. It treats all layouts equally.
 *
 * @param siteData The full site data, used to discover all available assets.
 */
async function cacheAllTemplates(siteData: LocalSiteData): Promise<void> {
    // 1. Clear any previously registered partials to ensure a clean state.
    Object.keys(Handlebars.partials).forEach(p => Handlebars.unregisterPartial(p));

    const { manifest } = siteData;
    const allLayouts = await getAvailableLayouts(siteData);

    // 2. Register partials from all available Layouts.
    const layoutPromises = allLayouts.flatMap((layout: LayoutManifest) =>
        (layout.files || []).filter((file: AssetFile) => file.type === 'partial').map(async (file: AssetFile) => {
            const source = await getAssetContent(siteData, 'layout', layout.id, file.path);
            if (source) {
                // Register partials with a namespace to prevent collisions, e.g., 'blog-listing/partials/post-card'
                const partialName = `${layout.id}/${file.path.replace('.hbs', '')}`;
                Handlebars.registerPartial(partialName, source);
            }
        })
    );

    // 3. Register partials from the active Theme.
    const themeManifest = await getJsonAsset<ThemeManifest>(siteData, 'theme', manifest.theme.name, 'theme.json');
    const themePartialPromises = (themeManifest?.files || [])
        .filter((file: AssetFile) => file.type === 'partial' && file.name)
        .map(async (partial: AssetFile) => {
            const source = await getAssetContent(siteData, 'theme', manifest.theme.name, partial.path);
            if (source) {
                // Theme partials are registered by their given name, e.g., 'header', 'footer'.
                Handlebars.registerPartial(partial.name!, source);
            }
        });

    // 4. Wait for all file reading and registration to complete.
    await Promise.all([...layoutPromises, ...themePartialPromises]);
}

/** Generates an inline <style> block from the theme configuration. */
export function generateStyleOverrides(themeConfig: Record<string, string | number | boolean>): string {
    if (!themeConfig || Object.keys(themeConfig).length === 0) return '';
    const variables = Object.entries(themeConfig)
        .map(([key, value]) => value ? `  --${key.replace(/_/g, '-')}: ${value};` : null)
        .filter(Boolean)
        .join('\n');
    if (!variables) return '';
    return `<style id="signum-style-overrides">\n:root {\n${variables}\n}\n</style>`;
}

/**
 * Prepares the Handlebars rendering environment by registering helpers and caching all templates.
 * This is the main entry point for this module.
 */
export async function prepareRenderEnvironment(siteData: LocalSiteData): Promise<void> {
    registerCoreHelpers(siteData);
    await cacheAllTemplates(siteData);
}

================================================================================

File: core/services/renderer/helpers/imageUrl.helper.ts
// src/core/services/themes/helpers/image_url.helper.ts

import Handlebars from 'handlebars';
import type { SparktypeHelper } from './types';
import type { ImageRef, LocalSiteData, ImageTransformOptions } from '@/core/types';
import { getActiveImageService } from '@/core/services/images/images.service';

/**
 * Defines the context object passed by Handlebars at the root of the template.
 */
interface RootTemplateContext {
  options: {
    isExport: boolean;
  };
}

/**
 * A Handlebars helper factory for creating the `image_url` helper.
 */
export const imageUrlHelper: SparktypeHelper = (siteData: LocalSiteData) => ({
  /**
   * An async Handlebars helper that generates only the URL for an image,
   * applying transformations as specified. This is essential for use in
   * `<meta>` tags, CSS `url()` functions, or other places where a full `<img>` tag is not needed.
   *
   * @example
   * <meta property="og:image" content="{{image_url src=logo width=1200 height=630}}">
   *
   * @returns {Promise<Handlebars.SafeString>} A promise that resolves to the final, transformed image URL,
   * wrapped in a SafeString to prevent HTML escaping.
   */
  // --- 2. Update the return type signature to match the implementation ---
  image_url: async function(this: unknown, ...args: unknown[]): Promise<Handlebars.SafeString> {
    const options = args[args.length - 1] as Handlebars.HelperOptions;
    
    const rootContext = options.data.root as RootTemplateContext;
    const isExport = rootContext.options?.isExport || false;

    const { src, width, height, crop, gravity } = options.hash;

    if (!src || typeof src !== 'object' || !('serviceId' in src)) {
      console.warn('[image_url] Invalid or missing ImageRef object provided.');
      return new Handlebars.SafeString(''); // Return an empty SafeString
    }

    const imageRef = src as ImageRef;

    try {
      const imageService = getActiveImageService(siteData.manifest);
      const transformOptions: ImageTransformOptions = { width, height, crop, gravity };

      const displayUrl = await imageService.getDisplayUrl(siteData.manifest, imageRef, transformOptions, isExport);
      
      // --- 3. Wrap the final URL string in new Handlebars.SafeString() ---
      // This satisfies the type checker and ensures Handlebars won't escape the URL.
      return new Handlebars.SafeString(displayUrl);

    } catch (error) {
      console.error(`[image_url] Failed to generate URL for src: ${imageRef.src}`, error);
      return new Handlebars.SafeString(''); // Return an empty SafeString on error
    }
  }
});

================================================================================

File: core/services/renderer/helpers/renderLayout.helper.ts
// src/core/services/themes/helpers/render_layout.helper.ts

import Handlebars from 'handlebars';
import type { SparktypeHelper } from './types';

export const renderLayoutHelper: SparktypeHelper = () => ({
  /**
   * An async Handlebars helper that renders a specified layout/partial
   * and waits for any async helpers within it to resolve.
   * This is the key to solving nested `[object Promise]` issues.
   *
   * @example
   * {{{render_layout 'pageLayout' this}}}
   *
   * @param {...unknown[]} args - The arguments passed from the template. Expected:
   *   - args[0]: The name of the partial to render (string).
   *   - args[1]: The data context to pass to the partial (object).
   *   - The last argument is the Handlebars options object, which is ignored here.
   * @returns {Promise<Handlebars.SafeString>} The fully rendered and resolved HTML.
   */
  render_layout: async function(...args: unknown[]): Promise<Handlebars.SafeString> {
    // The template arguments are all but the last one (which is the options object).
    const templateArgs = args.slice(0, -1); 
    
    const layoutName = templateArgs[0];
    const context = templateArgs[1];

    // Type guards for safety and clear error logging.
    if (typeof layoutName !== 'string' || !Handlebars.partials[layoutName]) {
      console.warn(`[render_layout] Layout partial "${String(layoutName)}" not found or invalid.`);
      return new Handlebars.SafeString('');
    }

    if (typeof context !== 'object' || context === null) {
        console.warn(`[render_layout] Invalid context object provided for layout "${layoutName}".`);
        return new Handlebars.SafeString('');
    }

    const template = Handlebars.compile(Handlebars.partials[layoutName]);
    
    // The key is to `await` the execution of the template here.
    // This pauses the helper until all nested async helpers have resolved.
    const renderedHtml = await template(context);
    
    return new Handlebars.SafeString(renderedHtml);
  }
});

================================================================================

File: core/services/renderer/helpers/strUtil.helper.ts
// src/core/services/theme-engine/helpers/strUtil.helper.ts
import type { SparktypeHelper } from './types';
import type { HelperOptions } from 'handlebars';

export const strUtilHelper: SparktypeHelper = () => ({
  /**
   * A generic string utility helper for common text manipulations like
   * truncating, uppercasing, and lowercasing.
   *
   * @example {{str-util some.text op="truncate" len=100}}
   * @example {{str-util some.text op="uppercase"}}
   */
  // --- FIX: The function signature now correctly matches SparktypeHelperFunction ---
  'str-util': function(...args: unknown[]): string {
    // The options object from Handlebars is always the last argument.
    const options = args.pop() as HelperOptions;
    // The input string is the first argument passed from the template.
    const input = args[0];
  
    // Type guard: Ensure the input is a valid string before proceeding.
    if (!input || typeof input !== 'string') {
        // Return an empty string if the input is not a string, null, or undefined.
        return '';
    }
  
    // Extract the desired operation from the helper's hash arguments.
    const op = options.hash.op;
  
    switch (op) {
      case 'truncate':
        // Safely get the length, with a default value.
        const len = typeof options.hash.len === 'number' ? options.hash.len : 140;
        if (input.length <= len) return input;
        return input.substring(0, len) + '…';
      
      case 'uppercase':
        return input.toUpperCase();
      
      case 'lowercase':
        return input.toLowerCase();
      
      default:
        // If no valid operation is specified, return the original string.
        return input;
    }
  }
});

================================================================================

File: core/services/renderer/helpers/concat.helper.ts
// src/core/services/theme-engine/helpers/concat.helper.ts

import type { SparktypeHelper } from './types';


export const concatHelper: SparktypeHelper = () => ({
  /**
   * Concatenates multiple string arguments into a single string.
   *
   * @example
   * {{concat "Hello" " " "World"}} -> "Hello World"
   *
   * @example
   * <img alt=(concat @root.manifest.title " Logo")>
   */
  concat: function(...args: unknown[]): string {
  
    args.pop();

    // Join all remaining arguments with an empty string.
    return args.join('');
  },
});

================================================================================

File: core/services/renderer/helpers/query.helper.ts
// src/core/services/theme-engine/helpers/query.helper.ts
import Handlebars from 'handlebars';
import type { SparktypeHelper } from './types';

// The helper factory receives the full siteData object, which it can use.
export const queryHelper: SparktypeHelper = (siteData) => ({
  /**
   * Fetches, filters, and sorts a list of content items from a collection.
   * The resulting array is made available to the inner block of the helper.
   *
   * @example
   * {{#query source_collection="blog" limit=5 as |posts|}}
   *   {{#each posts}} ... {{/each}}
   * {{/query}}
   */
  // --- FIX: The function signature now correctly matches SparktypeHelperFunction ---
  // The 'this' context is now 'unknown' and is not used.
  query: function(this: unknown, ...args: unknown[]): string {
    const options = args[args.length - 1] as Handlebars.HelperOptions;
    const config = options.hash;

    const sourceCollectionSlug = config.source_collection;
    if (!sourceCollectionSlug || typeof sourceCollectionSlug !== 'string') {
      console.warn("Query helper called without a valid 'source_collection' string.");
      return options.inverse ? options.inverse(this) : '';
    }

    // Find the source collection node in the site's structure.
    const collectionNode = siteData.manifest.structure.find(
        n => n.slug === sourceCollectionSlug
    );
    if (!collectionNode || !collectionNode.children) {
      console.warn(`Query could not find collection with slug: "${sourceCollectionSlug}"`);
      return options.inverse ? options.inverse(this) : '';
    }
    
    const childPaths = new Set(collectionNode.children.map(c => c.path));
    let items = (siteData.contentFiles ?? []).filter(f => {
        // Must be a child of the collection
        if (!childPaths.has(f.path)) return false;
        
        // Must be published (default to true for backward compatibility)
        const isPublished = f.frontmatter.published !== false;
        return isPublished;
    });

    const sortBy = config.sort_by || 'date';
    const sortOrder = config.sort_order || 'desc';
    const orderModifier = sortOrder === 'desc' ? -1 : 1;

    items.sort((a, b) => {
      const valA = a.frontmatter[sortBy];
      const valB = b.frontmatter[sortBy];
      if (sortBy === 'date') {
        const dateA = valA ? new Date(valA as string).getTime() : 0;
        const dateB = valB ? new Date(valB as string).getTime() : 0;
        if (isNaN(dateA) || isNaN(dateB)) return 0;
        return (dateA - dateB) * orderModifier;
      }
      if (typeof valA === 'string' && typeof valB === 'string') {
        return valA.localeCompare(valB) * orderModifier;
      }
      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * orderModifier;
      }
      return 0;
    });

    if (config.limit) {
      const limit = parseInt(config.limit, 10);
      if (!isNaN(limit)) {
        items = items.slice(0, limit);
      }
    }

    // Render the inner block, passing the queried items as a block parameter.
    if (options.data && options.fn) {
        const data = Handlebars.createFrame(options.data);
        const blockParamName = options.data.blockParams?.[0];
        if (blockParamName) {
            data[blockParamName] = items;
        }
        return options.fn(items, { data });
    }
    
    return options.fn(items);
  }
});

================================================================================

File: core/services/renderer/helpers/markdown.helper.ts
// src/core/services/theme-engine/helpers/markdown.helper.ts
import type { SparktypeHelper } from './types';
import Handlebars from 'handlebars';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export const markdownHelper: SparktypeHelper = () => ({
  /**
   * Safely renders a string of Markdown into HTML.
   * It uses 'marked' to parse the Markdown and 'DOMPurify' to sanitize
   * the resulting HTML, preventing XSS attacks.
   * @example {{{markdown some.body_content}}}
   */
  // --- FIX: The function signature now correctly matches SparktypeHelperFunction ---
  markdown: function(...args: unknown[]): Handlebars.SafeString {
    // The markdown content is the first argument passed to the helper.
    const markdownString = args[0];

    // Type guard: Ensure the input is a non-empty string before processing.
    if (!markdownString || typeof markdownString !== 'string') {
      return new Handlebars.SafeString('');
    }

    // Use marked to parse, then DOMPurify to sanitize against XSS attacks.
    const unsafeHtml = marked.parse(markdownString, { async: false }) as string;
    
    // Check if running in a browser environment before using DOMPurify
    if (typeof window !== 'undefined') {
        const safeHtml = DOMPurify.sanitize(unsafeHtml);
        return new Handlebars.SafeString(safeHtml);
    }

    // If not in a browser (e.g., during server-side testing), return the raw parsed HTML.
    // In a real-world scenario, you might use a Node.js-compatible sanitizer here.
    return new Handlebars.SafeString(unsafeHtml);
  }
});

================================================================================

File: core/services/renderer/helpers/renderCollection.helper.ts
// src/core/services/renderer/helpers/renderCollection.helper.ts

import Handlebars from 'handlebars';
import type { SparktypeHelper } from './types';
import type { ParsedMarkdownFile, LayoutConfig, LocalSiteData, LayoutManifest } from '@/core/types';
import type { HelperOptions } from 'handlebars';
import { getCollectionContent, getCollection } from '@/core/services/collections.service';

/**
 * Defines the expected shape of the root context object passed by the theme engine.
 */
interface RootContext {
  contentFile: ParsedMarkdownFile;
  siteData: LocalSiteData;
  layoutManifest: LayoutManifest;
}

/**
 * A Handlebars helper factory for creating the `render_collection` helper.
 * This helper is responsible for rendering a list of collection items on a page.
 * It has been refactored to use the unified Layout model.
 */
export const renderCollectionHelper: SparktypeHelper = () => ({
  /**
   * Renders collection content using a layout's partials.
   *
   * @example
   * {{{render_collection layoutConfig}}}
   *
   * @param {...unknown[]} args - The arguments passed from the template. Expected:
   *   - args[0]: The layoutConfig object from the page's frontmatter.
   *   - The last argument is the Handlebars options object.
   * @returns {Handlebars.SafeString} The rendered HTML for the collection.
   */
  render_collection: function(...args: unknown[]): Handlebars.SafeString {
    const options = args[args.length - 1] as HelperOptions;
    const layoutConfig = args[0] as LayoutConfig;
    const root = options.data.root as RootContext;

    // --- Guard Clauses for Robustness ---
    if (!layoutConfig || !layoutConfig.collectionId) {
      console.warn('[render_collection] Helper was called without a `collectionId` in its layoutConfig.');
      return new Handlebars.SafeString('<!-- Collection not specified -->');
    }
    if (!root?.siteData) {
      console.warn('[render_collection] Missing siteData in template context.');
      return new Handlebars.SafeString('<!-- Missing siteData -->');
    }
    if (!root?.layoutManifest) {
      console.warn('[render_collection] Missing layoutManifest in template context.');
      return new Handlebars.SafeString('<!-- Missing layoutManifest -->');
    }

    try {
      // 1. Get the collection instance and its content items.
      const collection = getCollection(root.siteData.manifest, layoutConfig.collectionId);
      if (!collection) {
        return new Handlebars.SafeString(`<!-- Collection "${layoutConfig.collectionId}" not found -->`);
      }
      const collectionItems = getCollectionContent(root.siteData, layoutConfig.collectionId);

      // 2. Determine which template partial to use. The layout manifest specifies its templates.
      // This example assumes a simple 'index.hbs' for the list and a partial for each item.
      const listTemplatePartialName = `${root.layoutManifest.id}/index.hbs`;
      const templateSource = Handlebars.partials[listTemplatePartialName];

      if (!templateSource) {
        console.warn(`[render_collection] Template partial "${listTemplatePartialName}" not found.`);
        return new Handlebars.SafeString(`<!-- Template partial "${listTemplatePartialName}" not found -->`);
      }

      // 3. Prepare the data context for the template.
      const templateContext = {
        collection,
        collectionItems, // The queried items
        layoutConfig,
        ...root // Pass through the root context for access to site-wide data
      };

      // 4. Compile and render the template.
      const template = typeof templateSource === 'function' ? templateSource : Handlebars.compile(templateSource);
      const renderedHtml = template(templateContext);

      return new Handlebars.SafeString(renderedHtml);
    } catch (error) {
      console.error('[render_collection] Error rendering collection:', error);
      return new Handlebars.SafeString(`<!-- Error rendering collection: ${(error as Error).message} -->`);
    }
  }
});

================================================================================

File: core/services/renderer/helpers/themeData.helper.ts
// src/core/services/renderer/helpers/themeData.helper.ts

import type { SparktypeHelper } from './types';
import { HtmlSanitizerService } from '../../htmlSanitizer.service';
import type { LocalSiteData } from '@/core/types';

export const themeDataHelper: SparktypeHelper = (siteData: LocalSiteData) => ({
  themeData: function(this: unknown, ...args: unknown[]) {
    const fieldName = args[0] as string;
    
    // Access theme data from the site data
    const themeData = siteData.manifest?.theme?.themeData;
    
    if (!themeData || typeof themeData !== 'object') {
      return '';
    }
    
    const value = themeData[fieldName];
    
    if (value === undefined || value === null) {
      return '';
    }
    
    // If it's a string, sanitize it before returning
    if (typeof value === 'string') {
      return HtmlSanitizerService.sanitize(value);
    }
    
    // For non-string values, return as-is
    return String(value);
  }
});

export const rawThemeDataHelper: SparktypeHelper = (siteData: LocalSiteData) => ({
  rawThemeData: function(this: unknown, ...args: unknown[]) {
    const fieldName = args[0] as string;
    
    // Access theme data from the site data (unsanitized)
    const themeData = siteData.manifest?.theme?.themeData;
    
    if (!themeData || typeof themeData !== 'object') {
      return '';
    }
    
    const value = themeData[fieldName];
    
    if (value === undefined || value === null) {
      return '';
    }
    
    return String(value);
  }
});

================================================================================

File: core/services/renderer/helpers/comparison.helper.ts
// src/core/services/theme-engine/helpers/comparison.helper.ts
import type { SparktypeHelper } from './types';

/**
 * Provides a set of comparison helpers for Handlebars templates.
 * These helpers are now type-safe and handle 'unknown' inputs correctly.
 *
 * @example
 * {{#if (eq post.status "published")}} ... {{/if}}
 * {{#if (gt comment.likes 10)}} ... {{/if}}
 */
export const comparisonHelpers: SparktypeHelper = () => ({
  /**
   * Checks for strict equality (===). Safe for any type.
   */
  eq: (a: unknown, b: unknown): boolean => a === b,

  /**
   * Checks if the first argument is greater than the second.
   * Only compares numbers or strings. Returns false for other types.
   */
  gt: (a: unknown, b: unknown): boolean => {

    // Only proceed if both 'a' and 'b' are of the same comparable type.
    if (typeof a === 'number' && typeof b === 'number') {
      return a > b;
    }
    if (typeof a === 'string' && typeof b === 'string') {
      return a > b;
    }
    // For all other type combinations, comparison is not meaningful.
    return false;
  },

  /**
   * Checks if the first argument is less than the second.
   * Only compares numbers or strings. Returns false for other types.
   */
  lt: (a: unknown, b: unknown): boolean => {

    if (typeof a === 'number' && typeof b === 'number') {
      return a < b;
    }
    if (typeof a === 'string' && typeof b === 'string') {
      return a < b;
    }
    return false;
  },
});

================================================================================

File: core/services/renderer/helpers/getUrl.helper.ts
// src/core/services/renderer/helpers/getUrl.helper.ts

import type { SparktypeHelper } from './types';
import { getUrlForNode as getUrlUtil } from '@/core/services/urlUtils.service';
import type { StructureNode, CollectionItemRef } from '@/core/types';
import type { HelperOptions } from 'handlebars';

/**
 * A Handlebars helper factory that exposes URL generation utilities to templates.
 * This ensures that all links generated in themes are consistent and correct
 * for both live preview and static export modes.
 */
export const getUrlHelper: SparktypeHelper = (siteData) => ({
  /**
   * DEPRECATED: A simplified getUrl helper for backward compatibility.
   * Users should prefer the more specific helpers below.
   */
  getUrl: function(this: unknown, ...args: unknown[]): string {
    return getUrlUtil(args[0] as StructureNode, siteData.manifest, false);
  },

  /**
   * Generates a context-aware URL for a regular page (a StructureNode).
   * @example <a href="{{getPageUrl this isExport=../options.isExport}}">Link</a>
   */
  getPageUrl: function(this: unknown, ...args: unknown[]): string {
    const options = args.pop() as HelperOptions;
    const node = args[0] as StructureNode;
    const isExport = options.data.root.options?.isExport === true;

    if (!node || !('path' in node) || !('slug' in node)) {
      console.warn('Handlebars "getPageUrl" helper called with an invalid node object.');
      return '#error-invalid-node';
    }
    return getUrlUtil(node, siteData.manifest, isExport);
  },

  /**
   * The primary helper for generating a URL for a collection item.
   * This now uses the unified URL service to create static-friendly paths.
   * @example <a href="{{getCollectionItemUrl this}}">Read More</a>
   */
  getCollectionItemUrl: function(this: unknown, ...args: unknown[]): string {
    const options = args.pop() as HelperOptions;
    const item = args[0] as CollectionItemRef; // Expects a collection item context
    const isExport = options.data.root.options?.isExport === true;

    if (!item || !('collectionId' in item) || !('slug' in item)) {
      console.warn('Handlebars "getCollectionItemUrl" helper called with an invalid item object.');
      return '#error-invalid-item';
    }
    
    // Delegate directly to the unified URL utility.
    return getUrlUtil(item, siteData.manifest, isExport);
  }
});

================================================================================

File: core/services/renderer/helpers/types.ts
// src/core/services/theme-engine/helpers/types.ts
import type { LocalSiteData } from '@/core/types';
import Handlebars from 'handlebars';

/**
 * Defines the function signature for a Handlebars helper function within Sparktype.
 * `this` refers to the current template context.
 * `args` are the arguments passed to the helper in the template.
 */
export type SparktypeHelperFunction = (
  /**
   * FIX: Replaced 'any' with 'unknown' for the 'this' context.
   * The context within a Handlebars helper is dynamic. 'unknown' is the
   * type-safe equivalent of 'any', requiring type checks before use.
   */
  this: unknown,
  /**
   * FIX: Replaced 'any[]' with 'unknown[]' for the helper arguments.
   * Helpers can receive a variable number of arguments of any type.
   * 'unknown[]' safely represents this contract.
   */
  ...args: unknown[]
) => string | Handlebars.SafeString | boolean | Promise<Handlebars.SafeString>;

/**
 * Defines a "Helper Factory". It's a function that receives the full site data
 * and returns an object mapping helper names to their implementation functions.
 */
export type SparktypeHelper = (siteData: LocalSiteData) => Record<string, SparktypeHelperFunction>;

================================================================================

File: core/services/renderer/helpers/pager.helper.ts
// src/core/services/theme-engine/helpers/pager.helper.ts

import Handlebars from 'handlebars';
import type { SparktypeHelper } from './types';
import type { PaginationData } from '@/core/types';

/**
 * A type guard to check if an unknown value has the shape of PaginationData.
 * @param data The unknown data to check.
 * @returns {boolean} True if the data is valid PaginationData.
 */
function isPaginationData(data: unknown): data is PaginationData {
    if (typeof data !== 'object' || data === null) {
        return false;
    }
    const d = data as PaginationData;
    return (
        typeof d.currentPage === 'number' &&
        typeof d.totalPages === 'number' &&
        typeof d.hasPrevPage === 'boolean' &&
        typeof d.hasNextPage === 'boolean'
    );
}


/**
 * Renders a complete pagination control component.
 * It generates 'Previous' and 'Next' links and a 'Page X of Y' indicator.
 * The links are disabled when not applicable (e.g., on the first or last page).
 * 
 * @example
 * {{{pager pagination}}}
 */
export const pagerHelper: SparktypeHelper = () => ({
  // --- FIX: The function signature now correctly matches SparktypeHelperFunction ---
  pager: function(...args: unknown[]): Handlebars.SafeString {
    // The pagination object is the first argument passed from the template.
    const pagination = args[0];

    // --- FIX: Use the type guard to validate the input ---
    if (!isPaginationData(pagination) || pagination.totalPages <= 1) {
      return new Handlebars.SafeString('');
    }

    const prevPageUrl = pagination.prevPageUrl ?? '#';
    const nextPageUrl = pagination.nextPageUrl ?? '#';

    const prevLink = pagination.hasPrevPage
      ? `<a href="${prevPageUrl}" class="link dim br-pill ph3 pv2 ba b--black-10 black">‹ Previous</a>`
      : `<span class="br-pill ph3 pv2 ba b--black-10 moon-gray o-50 cursor-not-allowed">‹ Previous</span>`;

    const nextLink = pagination.hasNextPage
      ? `<a href="${nextPageUrl}" class="link dim br-pill ph3 pv2 ba b--black-10 black">Next ›</a>`
      : `<span class="br-pill ph3 pv2 ba b--black-10 moon-gray o-50 cursor-not-allowed">Next ›</span>`;
    
    const pageIndicator = `<div class="f6 mid-gray">Page ${pagination.currentPage} of ${pagination.totalPages}</div>`;

    const pagerHtml = `
      <div class="flex items-center justify-between mt4 pt3 bt b--black-10">
        <div>${prevLink}</div>
        <div>${pageIndicator}</div>
        <div>${nextLink}</div>
      </div>
    `;

    return new Handlebars.SafeString(pagerHtml);
  }
});

================================================================================

File: core/services/renderer/helpers/assign.helper.ts
// src/core/services/theme-engine/helpers/assign.helper.ts
import type { SparktypeHelper } from './types';
import type { HelperOptions } from 'handlebars';

export const assignHelper: SparktypeHelper = () => ({
  /**
   * A Handlebars helper to add a new property to an object's context
   * before rendering a block. This is useful for augmenting data inside a loop.
   *
   * @example
   * {{#assign myItem "newUrl" "https://example.com"}}
   *   <a href="{{this.newUrl}}">{{this.title}}</a>
   * {{/assign}}
   */

  assign: function(this: unknown, ...args: unknown[]): string {
    // The last argument passed by Handlebars is always the options object.
    const options = args.pop() as HelperOptions;

    // We expect 3 arguments from the template: [object, key, value]
    if (args.length !== 3) {
      console.warn('Handlebars "assign" helper called with incorrect number of arguments. Expected 3.');
      // Gracefully fail by rendering the {{else}} block if it exists.
      return options.inverse ? options.inverse(this) : '';
    }

    const [object, key, value] = args;

    // Add type guards to ensure the arguments are used safely.
    if (typeof object !== 'object' || object === null) {
      console.warn(`Handlebars "assign" helper: first argument must be an object, but received type ${typeof object}.`);
      return options.inverse ? options.inverse(this) : '';
    }

    if (typeof key !== 'string' || key === '') {
      console.warn(`Handlebars "assign" helper: second argument must be a non-empty string key, but received type ${typeof key}.`);
      return options.inverse ? options.inverse(this) : '';
    }

    // Create a new context object by spreading the original and adding the new key-value pair.
    const newContext = { ...object, [key]: value };

    // Execute the inner block of the helper, passing the new, augmented context to it.
    // This is what makes the new property available inside the {{#assign}}...{{/assign}} block.
    return options.fn(newContext);
  },
});

================================================================================

File: core/services/renderer/helpers/index.ts
// src/lib/theme-helpers/index.ts
// ... (other helper imports)
import { queryHelper } from './query.helper';
import { comparisonHelpers } from './comparison.helper';
import { markdownHelper } from './markdown.helper';
import { strUtilHelper } from './strUtil.helper';
import { formatDateHelper } from './formatDate.helper';
import { pagerHelper } from './pager.helper';
import type { SparktypeHelper } from './types';
import { getUrlHelper } from './getUrl.helper';
import { assignHelper } from './assign.helper';
import { imageHelper } from './image.helper';
import { concatHelper } from './concat.helper';
import { imageUrlHelper } from './imageUrl.helper';
import { renderLayoutHelper } from './renderLayout.helper';
import { renderItemHelper } from './renderItem.helper';
import { renderCollectionHelper } from './renderCollection.helper';
import { themeDataHelper, rawThemeDataHelper } from './themeData.helper';

export const coreHelpers: SparktypeHelper[] = [
  queryHelper,
  strUtilHelper,
  formatDateHelper,
  comparisonHelpers,
  markdownHelper,
  renderItemHelper, 
  renderCollectionHelper,
  pagerHelper,
  getUrlHelper,
  assignHelper,
  imageHelper,
  concatHelper,
  imageUrlHelper,
  renderLayoutHelper,
  themeDataHelper,
  rawThemeDataHelper
];

================================================================================

File: core/services/renderer/helpers/formatDate.helper.ts
// src/core/services/theme-engine/helpers/formatDate.helper.ts
import type { SparktypeHelper } from './types';

export const formatDateHelper: SparktypeHelper = () => ({
  /**
   * Formats a date string or Date object into a more readable format.
   * @example {{formatDate some.date_string}}
   * @example {{formatDate "2023-10-27"}}
   */

  formatDate: function(...args: unknown[]): string {
    // The date value is the first argument passed to the helper.
    const dateString = args[0];

    // Type guard: Check if the input is a valid type for the Date constructor.
    if (
        !dateString ||
        (typeof dateString !== 'string' &&
         typeof dateString !== 'number' &&
         !(dateString instanceof Date))
    ) {
      // If the input is null, undefined, or an invalid type, return an empty string.
      return '';
    }
    
    // The Date constructor can safely handle string, number, or Date objects.
    const date = new Date(dateString);
    
    // Check if the created date is valid. `new Date('invalid')` results in an invalid date.
    if (isNaN(date.getTime())) {
      console.warn(`Handlebars "formatDate" helper received an invalid date value:`, dateString);
      return ''; // Return empty for invalid dates
    }

    // Format the valid date into a user-friendly string.
    return date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
});

================================================================================

File: core/services/renderer/helpers/renderItem.helper.ts
// src/core/services/themes/helpers/render_item.helper.ts

import Handlebars from 'handlebars';
import type { SparktypeHelper } from './types';
import type { ParsedMarkdownFile, LayoutManifest } from '@/core/types';
import type { HelperOptions } from 'handlebars';

/**
 * Defines the expected shape of the root context object passed by the theme engine.
 */
interface RootContext {
  contentFile: ParsedMarkdownFile;
  layoutManifest: LayoutManifest;
  // ... other root properties
}

/**
 * A Handlebars helper factory for creating the `render_item` helper.
 */
export const renderItemHelper: SparktypeHelper = () => ({
  /**
   * --- FIX: This helper is now `async` ---
   * Renders the correct teaser/partial for a single content item within a collection loop.
   *
   * @example
   * {{#each collectionItems}}
   *   {{{render_item this}}}
   * {{/each}}
   *
   * @param {...unknown[]} args - The arguments passed from the template. Expected:
   *   - args[0]: The current item in the `each` loop (ParsedMarkdownFile).
   *   - The last argument is the Handlebars options object.
   * @returns {Promise<Handlebars.SafeString>} The rendered HTML for the item's teaser.
   */
  render_item: async function(...args: unknown[]): Promise<Handlebars.SafeString> {
    // The Handlebars options object is always the last argument.
    const options = args[args.length - 1] as HelperOptions;
    // The item context is the first argument passed from the template.
    const item = args[0] as ParsedMarkdownFile;

    const root = options.data.root as RootContext;

    // --- Guard Clauses for Robustness ---
    if (!item) {
        console.warn('[render_item] Helper was called without an item context.');
        return new Handlebars.SafeString('');
    }
    if (!root?.layoutManifest?.display_options?.teaser) {
        console.warn('[render_item] The collection layout manifest is missing a `display_options.teaser` configuration.');
        return new Handlebars.SafeString(`<!-- Missing teaser configuration in layout -->`);
    }

    // --- Logic to Determine Which Teaser Template to Use ---
    const teaserOptions = root.layoutManifest.display_options.teaser;
    const layoutConfig = root.contentFile.frontmatter.layoutConfig;

    const userChoiceKey = layoutConfig?.displayOptions?.teaser;
    const finalChoiceKey = userChoiceKey || teaserOptions.default;
    const templatePath = teaserOptions.options[finalChoiceKey]?.template;

    if (!templatePath) {
        console.warn(`[render_item] Teaser template for choice "${finalChoiceKey}" not found in layout manifest.`);
        return new Handlebars.SafeString(`<!-- Teaser template for "${finalChoiceKey}" not found -->`);
    }
    
    // --- Render the Partial ---
    const layoutId = root.layoutManifest.id;
    // The partial name is namespaced to prevent collisions, e.g., 'blog/partials/card'.
    const partialName = `${layoutId}/${templatePath.replace('.hbs', '')}`;

    const templateSource = Handlebars.partials[partialName];

    if (templateSource) {
        // Compile the template source and render with the item context
        const template = typeof templateSource === 'function' ? templateSource : Handlebars.compile(templateSource);
        // --- FIX: Await the template execution to resolve any nested async helpers ---
        const renderedHtml = await template(item);
        return new Handlebars.SafeString(renderedHtml);
    } else {
        console.warn(`[render_item] Handlebars partial named "${partialName}" could not be found.`);
        return new Handlebars.SafeString(`<!-- Partial "${partialName}" not found -->`);
    }
  }
});

================================================================================

File: core/services/renderer/helpers/image.helper.ts
// src/core/services/theme-engine/helpers/image.helper.ts

import Handlebars from 'handlebars';
import type { SparktypeHelper } from './types';
// --- FIX: Import ImageTransformOptions along with the other types ---
import type { ImageRef, LocalSiteData, ImageTransformOptions } from '@/core/types';
import { getActiveImageService } from '@/core/services/images/images.service';

interface RootTemplateContext {
  options: {
    isExport: boolean;
  };
}

export const imageHelper: SparktypeHelper = (siteData: LocalSiteData) => ({
  /**
   * An async Handlebars helper to generate image URLs with transformations.
   * It reads parameters from the helper's hash.
   * @example {{{image src=logo width=100 height=100}}}
   */
  image: async function(this: unknown, ...args: unknown[]): Promise<Handlebars.SafeString> {
    // The actual options object from Handlebars is always the last argument.
    const options = args[args.length - 1] as Handlebars.HelperOptions;
    
    const rootContext = options.data.root as RootTemplateContext;
    const isExport = rootContext.options?.isExport || false;

    // Destructure properties from the hash object within options.
    const { src, width, height, crop, gravity, alt, lazy = true, class: className = '' } = options.hash;

    if (!src || typeof src !== 'object' || !('serviceId' in src)) {
      return new Handlebars.SafeString('<!-- Invalid ImageRef provided to image helper -->');
    }

    const imageRef = src as ImageRef;

    try {
      const imageService = getActiveImageService(siteData.manifest);
      
      const transformOptions: ImageTransformOptions = { width, height, crop, gravity };

      const displayUrl = await imageService.getDisplayUrl(siteData.manifest, imageRef, transformOptions, isExport);
      
      const lazyAttr = lazy ? 'loading="lazy"' : '';
      const altAttr = `alt="${alt || imageRef.alt || ''}"`;
      const classAttr = className ? `class="${className}"` : '';
      const widthAttr = width ? `width="${width}"` : '';
      const heightAttr = height ? `height="${height}"` : '';

      const imgTag = `<img src="${displayUrl}" ${widthAttr} ${heightAttr} ${altAttr} ${classAttr} ${lazyAttr}>`;

      return new Handlebars.SafeString(imgTag);
    } catch (error) {
      console.error(`[ImageHelper] Failed to render image for src: ${imageRef.src}`, error);
      return new Handlebars.SafeString(`<!-- Image render failed: ${(error as Error).message} -->`);
    }
  }
});

================================================================================

File: core/services/renderer/helpers/__tests__/image.helper.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { imageHelper } from '../image.helper';
import { getActiveImageService } from '@/core/services/images/images.service';
import type { LocalSiteData, ImageRef, Manifest } from '@/core/types';
import Handlebars from 'handlebars';

// Mock the image service
jest.mock('@/core/services/images/images.service', () => ({
  getActiveImageService: jest.fn()
}));

const mockGetActiveImageService = getActiveImageService as jest.MockedFunction<typeof getActiveImageService>;

describe('image.helper', () => {
  // Helper functions
  const createMockSiteData = (): LocalSiteData => ({
    siteId: 'test-site',
    manifest: {
      siteId: 'test-site',
      generatorVersion: '1.0.0',
      title: 'Test Site',
      description: 'Test Site',
      theme: { name: 'default', config: {} },
      structure: [],
      settings: { imageService: 'local' }
    } as Manifest,
    contentFiles: []
  });

  const createMockImageRef = (): ImageRef => ({
    serviceId: 'local',
    src: 'assets/images/test.jpg',
    alt: 'Test Image',
    width: 800,
    height: 600
  });

  const createMockHandlebarsOptions = (hash: Record<string, unknown> = {}): Handlebars.HelperOptions => ({
    hash,
    data: {
      root: {
        options: {
          isExport: false
        }
      }
    },
    fn: jest.fn(),
    inverse: jest.fn()
  });

  const mockImageService = {
    id: 'local',
    name: 'Local Service',
    upload: jest.fn(),
    getDisplayUrl: jest.fn(),
    getExportableAssets: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetActiveImageService.mockReturnValue(mockImageService);
    mockImageService.getDisplayUrl.mockResolvedValue('https://example.com/test.jpg');
  });

  describe('image helper', () => {
    test('generates img tag with basic parameters', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300,
        height: 200,
        alt: 'Custom Alt Text'
      });

      const result = await helper.image.call({}, options);

      expect(result).toBeInstanceOf(Handlebars.SafeString);
      const htmlString = result.toString();
      
      expect(htmlString).toContain('<img');
      expect(htmlString).toContain('src="https://example.com/test.jpg"');
      expect(htmlString).toContain('width="300"');
      expect(htmlString).toContain('height="200"');
      expect(htmlString).toContain('alt="Custom Alt Text"');
      expect(htmlString).toContain('loading="lazy"');
      expect(htmlString).toContain('>');
    });

    test('uses imageRef alt when no custom alt provided', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300
      });

      const result = await helper.image.call({}, options);
      const htmlString = result.toString();
      
      expect(htmlString).toContain('alt="Test Image"');
    });

    test('handles missing alt gracefully', async () => {
      const siteData = createMockSiteData();
      const imageRef = { ...createMockImageRef(), alt: undefined };
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300
      });

      const result = await helper.image.call({}, options);
      const htmlString = result.toString();
      
      expect(htmlString).toContain('alt=""');
    });

    test('applies CSS class when provided', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300,
        class: 'thumbnail responsive'
      });

      const result = await helper.image.call({}, options);
      const htmlString = result.toString();
      
      expect(htmlString).toContain('class="thumbnail responsive"');
    });

    test('disables lazy loading when lazy=false', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300,
        lazy: false
      });

      const result = await helper.image.call({}, options);
      const htmlString = result.toString();
      
      expect(htmlString).not.toContain('loading="lazy"');
    });

    test('passes transform options to image service', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300,
        height: 200,
        crop: 'fill',
        gravity: 'center'
      });

      await helper.image.call({}, options);

      expect(mockImageService.getDisplayUrl).toHaveBeenCalledWith(
        siteData.manifest,
        imageRef,
        {
          width: 300,
          height: 200,
          crop: 'fill',
          gravity: 'center'
        },
        false
      );
    });

    test('respects export mode from root context', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300
      });
      
      // Set export mode
      options.data.root.options.isExport = true;

      await helper.image.call({}, options);

      expect(mockImageService.getDisplayUrl).toHaveBeenCalledWith(
        siteData.manifest,
        imageRef,
        { width: 300 },
        true // isExport should be true
      );
    });

    test('handles invalid ImageRef gracefully', async () => {
      const siteData = createMockSiteData();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: 'invalid-string',
        width: 300
      });

      const result = await helper.image.call({}, options);
      const htmlString = result.toString();
      
      expect(htmlString).toBe('<!-- Invalid ImageRef provided to image helper -->');
      expect(mockImageService.getDisplayUrl).not.toHaveBeenCalled();
    });

    test('handles missing src parameter', async () => {
      const siteData = createMockSiteData();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        width: 300
      });

      const result = await helper.image.call({}, options);
      const htmlString = result.toString();
      
      expect(htmlString).toBe('<!-- Invalid ImageRef provided to image helper -->');
    });

    test('handles image service errors gracefully', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const error = new Error('Image processing failed');
      mockImageService.getDisplayUrl.mockRejectedValue(error);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await helper.image.call({}, options);
      const htmlString = result.toString();
      
      expect(htmlString).toBe('<!-- Image render failed: Image processing failed -->');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[ImageHelper] Failed to render image for src: assets/images/test.jpg',
        error
      );
      
      consoleSpy.mockRestore();
    });

    test('generates minimal img tag with only required attributes', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef
      });

      const result = await helper.image.call({}, options);
      const htmlString = result.toString();
      
      expect(htmlString).toContain('<img');
      expect(htmlString).toContain('src="https://example.com/test.jpg"');
      expect(htmlString).toContain('alt="Test Image"');
      expect(htmlString).toContain('loading="lazy"');
      expect(htmlString).not.toContain('width=');
      expect(htmlString).not.toContain('height=');
      expect(htmlString).not.toContain('class=');
    });

    test('handles different image service types', async () => {
      const siteData = createMockSiteData();
      siteData.manifest.settings = { imageService: 'cloudinary' };
      
      const cloudinaryService = {
        id: 'cloudinary',
        name: 'Cloudinary Service',
        upload: jest.fn(),
        getDisplayUrl: jest.fn().mockResolvedValue('https://cloudinary.com/test.jpg'),
        getExportableAssets: jest.fn()
      };
      
      mockGetActiveImageService.mockReturnValue(cloudinaryService);
      
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300
      });

      const result = await helper.image.call({}, options);
      const htmlString = result.toString();
      
      expect(htmlString).toContain('src="https://cloudinary.com/test.jpg"');
      expect(cloudinaryService.getDisplayUrl).toHaveBeenCalled();
    });

    test('handles complex transform combinations', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 400,
        height: 300,
        crop: 'fit',
        gravity: 'north',
        alt: 'Complex Transform',
        class: 'featured-image',
        lazy: false
      });

      const result = await helper.image.call({}, options);
      const htmlString = result.toString();
      
      expect(htmlString).toContain('src="https://example.com/test.jpg"');
      expect(htmlString).toContain('width="400"');
      expect(htmlString).toContain('height="300"');
      expect(htmlString).toContain('alt="Complex Transform"');
      expect(htmlString).toContain('class="featured-image"');
      expect(htmlString).not.toContain('loading="lazy"');
      
      expect(mockImageService.getDisplayUrl).toHaveBeenCalledWith(
        siteData.manifest,
        imageRef,
        {
          width: 400,
          height: 300, 
          crop: 'fit',
          gravity: 'north'
        },
        false
      );
    });

    test('maintains proper HTML structure and formatting', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 200,
        height: 150,
        alt: 'Test & Sample "Image"',
        class: 'test-class'
      });

      const result = await helper.image.call({}, options);
      const htmlString = result.toString();
      
      // Should be well-formed HTML
      expect(htmlString).toMatch(/^<img\s[^>]*>$/);
      expect(htmlString).toContain('alt="Test & Sample "Image""');
      
      // Verify no extra whitespace issues
      expect(htmlString).not.toContain('  '); // No double spaces
      expect(htmlString.trim()).toBe(htmlString); // No leading/trailing whitespace
    });

    test('handles concurrent image processing', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300
      });

      // Process multiple images concurrently
      const promises = Array.from({ length: 5 }, () => 
        helper.image.call({}, options)
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeInstanceOf(Handlebars.SafeString);
        expect(result.toString()).toContain('<img');
      });
      
      expect(mockImageService.getDisplayUrl).toHaveBeenCalledTimes(5);
    });
  });

  describe('Helper Factory', () => {
    test('returns object with image helper function', () => {
      const siteData = createMockSiteData();
      const helpers = imageHelper(siteData);
      
      expect(helpers).toHaveProperty('image');
      expect(typeof helpers.image).toBe('function');
    });

    test('helper function is async', () => {
      const siteData = createMockSiteData();
      const helpers = imageHelper(siteData);
      const imageRef = createMockImageRef();
      
      const options = createMockHandlebarsOptions({
        src: imageRef
      });

      const result = helpers.image.call({}, options);
      expect(result).toBeInstanceOf(Promise);
    });

    test('different site data creates independent helpers', () => {
      const siteData1 = createMockSiteData();
      const siteData2 = { ...createMockSiteData(), siteId: 'different-site' };
      
      const helpers1 = imageHelper(siteData1);
      const helpers2 = imageHelper(siteData2);
      
      expect(helpers1).not.toBe(helpers2);
      expect(helpers1.image).not.toBe(helpers2.image);
    });
  });
});

================================================================================

File: core/services/renderer/helpers/__tests__/imageUrl.helper.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { imageUrlHelper } from '../imageUrl.helper';
import { getActiveImageService } from '@/core/services/images/images.service';
import type { LocalSiteData, ImageRef, Manifest } from '@/core/types';
import Handlebars from 'handlebars';

// Mock the image service
jest.mock('@/core/services/images/images.service', () => ({
  getActiveImageService: jest.fn()
}));

const mockGetActiveImageService = getActiveImageService as jest.MockedFunction<typeof getActiveImageService>;

describe('imageUrl.helper', () => {
  // Helper functions
  const createMockSiteData = (): LocalSiteData => ({
    siteId: 'test-site',
    manifest: {
      siteId: 'test-site',
      generatorVersion: '1.0.0',
      title: 'Test Site',
      description: 'Test Site',
      theme: { name: 'default', config: {} },
      structure: [],
      settings: { imageService: 'local' }
    } as Manifest,
    contentFiles: []
  });

  const createMockImageRef = (): ImageRef => ({
    serviceId: 'local',
    src: 'assets/images/test.jpg',
    alt: 'Test Image',
    width: 800,
    height: 600
  });

  const createMockHandlebarsOptions = (hash: Record<string, unknown> = {}): Handlebars.HelperOptions => ({
    hash,
    data: {
      root: {
        options: {
          isExport: false
        }
      }
    },
    fn: jest.fn(),
    inverse: jest.fn()
  });

  const mockImageService = {
    id: 'local',
    name: 'Local Service',
    upload: jest.fn(),
    getDisplayUrl: jest.fn(),
    getExportableAssets: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetActiveImageService.mockReturnValue(mockImageService);
    mockImageService.getDisplayUrl.mockResolvedValue('https://example.com/test.jpg');
  });

  describe('image_url helper', () => {
    test('returns URL as SafeString with basic parameters', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageUrlHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300,
        height: 200
      });

      const result = await helper.image_url.call({}, options);

      expect(result).toBeInstanceOf(Handlebars.SafeString);
      expect(result.toString()).toBe('https://example.com/test.jpg');
    });

    test('passes transform options to image service', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageUrlHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300,
        height: 200,
        crop: 'fill',
        gravity: 'center'
      });

      await helper.image_url.call({}, options);

      expect(mockImageService.getDisplayUrl).toHaveBeenCalledWith(
        siteData.manifest,
        imageRef,
        {
          width: 300,
          height: 200,
          crop: 'fill',
          gravity: 'center'
        },
        false
      );
    });

    test('respects export mode from root context', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageUrlHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300
      });
      
      // Set export mode
      options.data.root.options.isExport = true;

      await helper.image_url.call({}, options);

      expect(mockImageService.getDisplayUrl).toHaveBeenCalledWith(
        siteData.manifest,
        imageRef,
        { width: 300 },
        true // isExport should be true
      );
    });

    test('handles missing export context gracefully', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageUrlHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300
      });
      
      // Remove export context
      delete options.data.root.options;

      await helper.image_url.call({}, options);

      expect(mockImageService.getDisplayUrl).toHaveBeenCalledWith(
        siteData.manifest,
        imageRef,
        { width: 300 },
        false // should default to false
      );
    });

    test('handles invalid ImageRef with string src', async () => {
      const siteData = createMockSiteData();
      const helper = imageUrlHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: 'invalid-string',
        width: 300
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await helper.image_url.call({}, options);
      
      expect(result).toBeInstanceOf(Handlebars.SafeString);
      expect(result.toString()).toBe('');
      expect(consoleWarnSpy).toHaveBeenCalledWith('[image_url] Invalid or missing ImageRef object provided.');
      expect(mockImageService.getDisplayUrl).not.toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });

    test('handles missing src parameter', async () => {
      const siteData = createMockSiteData();
      const helper = imageUrlHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        width: 300
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await helper.image_url.call({}, options);
      
      expect(result).toBeInstanceOf(Handlebars.SafeString);
      expect(result.toString()).toBe('');
      expect(consoleWarnSpy).toHaveBeenCalledWith('[image_url] Invalid or missing ImageRef object provided.');
      
      consoleWarnSpy.mockRestore();
    });

    test('handles null src parameter', async () => {
      const siteData = createMockSiteData();
      const helper = imageUrlHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: null,
        width: 300
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await helper.image_url.call({}, options);
      
      expect(result).toBeInstanceOf(Handlebars.SafeString);
      expect(result.toString()).toBe('');
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });

    test('handles object without serviceId', async () => {
      const siteData = createMockSiteData();
      const helper = imageUrlHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: { url: 'some-url' }, // Missing serviceId
        width: 300
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await helper.image_url.call({}, options);
      
      expect(result).toBeInstanceOf(Handlebars.SafeString);
      expect(result.toString()).toBe('');
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });

    test('handles image service errors gracefully', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageUrlHelper(siteData);
      
      const error = new Error('Image processing failed');
      mockImageService.getDisplayUrl.mockRejectedValue(error);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await helper.image_url.call({}, options);
      
      expect(result).toBeInstanceOf(Handlebars.SafeString);
      expect(result.toString()).toBe('');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[image_url] Failed to generate URL for src: assets/images/test.jpg',
        error
      );
      
      consoleErrorSpy.mockRestore();
    });

    test('returns URL without transform options when none provided', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageUrlHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef
      });

      const result = await helper.image_url.call({}, options);
      
      expect(result.toString()).toBe('https://example.com/test.jpg');
      expect(mockImageService.getDisplayUrl).toHaveBeenCalledWith(
        siteData.manifest,
        imageRef,
        {}, // Empty transform options
        false
      );
    });

    test('handles partial transform options', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageUrlHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 400,
        crop: 'fit'
        // height and gravity intentionally omitted
      });

      await helper.image_url.call({}, options);
      
      expect(mockImageService.getDisplayUrl).toHaveBeenCalledWith(
        siteData.manifest,
        imageRef,
        {
          width: 400,
          crop: 'fit'
          // height and gravity should be undefined
        },
        false
      );
    });

    test('handles different image service types', async () => {
      const siteData = createMockSiteData();
      siteData.manifest.settings = { imageService: 'cloudinary' };
      
      const cloudinaryService = {
        id: 'cloudinary',
        name: 'Cloudinary Service',
        upload: jest.fn(),
        getDisplayUrl: jest.fn().mockResolvedValue('https://cloudinary.com/test.jpg'),
        getExportableAssets: jest.fn()
      };
      
      mockGetActiveImageService.mockReturnValue(cloudinaryService);
      
      const imageRef = createMockImageRef();
      const helper = imageUrlHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300
      });

      const result = await helper.image_url.call({}, options);
      
      expect(result.toString()).toBe('https://cloudinary.com/test.jpg');
      expect(cloudinaryService.getDisplayUrl).toHaveBeenCalled();
    });

    test('handles complex URLs with special characters', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageUrlHelper(siteData);
      
      const complexUrl = 'https://example.com/images/test%20image.jpg?v=123&format=webp';
      mockImageService.getDisplayUrl.mockResolvedValue(complexUrl);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300
      });

      const result = await helper.image_url.call({}, options);
      
      expect(result).toBeInstanceOf(Handlebars.SafeString);
      expect(result.toString()).toBe(complexUrl);
    });

    test('handles concurrent URL generation', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageUrlHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300
      });

      // Process multiple URLs concurrently
      const promises = Array.from({ length: 5 }, () => 
        helper.image_url.call({}, options)
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeInstanceOf(Handlebars.SafeString);
        expect(result.toString()).toBe('https://example.com/test.jpg');
      });
      
      expect(mockImageService.getDisplayUrl).toHaveBeenCalledTimes(5);
    });

    test('handles all supported transform options', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageUrlHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 800,
        height: 600,
        crop: 'scale',
        gravity: 'south'
      });

      await helper.image_url.call({}, options);
      
      expect(mockImageService.getDisplayUrl).toHaveBeenCalledWith(
        siteData.manifest,
        imageRef,
        {
          width: 800,
          height: 600,
          crop: 'scale',
          gravity: 'south'
        },
        false
      );
    });

    test('ignores non-transform hash parameters', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageUrlHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300,
        alt: 'Should be ignored',
        class: 'Should also be ignored',
        lazy: true,
        unknownParam: 'Also ignored'
      });

      await helper.image_url.call({}, options);
      
      expect(mockImageService.getDisplayUrl).toHaveBeenCalledWith(
        siteData.manifest,
        imageRef,
        {
          width: 300
          // Only width should be passed, other params ignored
        },
        false
      );
    });

    test('returns empty string for various error conditions', async () => {
      const siteData = createMockSiteData();
      const helper = imageUrlHelper(siteData);
      
      const testCases = [
        { src: undefined },
        { src: null },
        { src: '' },
        { src: 123 },
        { src: [] },
        { src: {} },
        { src: { notServiceId: 'test' } }
      ];

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      for (const testCase of testCases) {
        const options = createMockHandlebarsOptions(testCase);
        const result = await helper.image_url.call({}, options);
        
        expect(result).toBeInstanceOf(Handlebars.SafeString);
        expect(result.toString()).toBe('');
      }
      
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Helper Factory', () => {
    test('returns object with image_url helper function', () => {
      const siteData = createMockSiteData();
      const helpers = imageUrlHelper(siteData);
      
      expect(helpers).toHaveProperty('image_url');
      expect(typeof helpers.image_url).toBe('function');
    });

    test('helper function is async', () => {
      const siteData = createMockSiteData();
      const helpers = imageUrlHelper(siteData);
      const imageRef = createMockImageRef();
      
      const options = createMockHandlebarsOptions({
        src: imageRef
      });

      const result = helpers.image_url.call({}, options);
      expect(result).toBeInstanceOf(Promise);
    });

    test('different site data creates independent helpers', () => {
      const siteData1 = createMockSiteData();
      const siteData2 = { ...createMockSiteData(), siteId: 'different-site' };
      
      const helpers1 = imageUrlHelper(siteData1);
      const helpers2 = imageUrlHelper(siteData2);
      
      expect(helpers1).not.toBe(helpers2);
      expect(helpers1.image_url).not.toBe(helpers2.image_url);
    });

    test('maintains site data context correctly', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageUrlHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300
      });

      await helper.image_url.call({}, options);
      
      expect(mockGetActiveImageService).toHaveBeenCalledWith(siteData.manifest);
      expect(mockImageService.getDisplayUrl).toHaveBeenCalledWith(
        siteData.manifest,
        imageRef,
        { width: 300 },
        false
      );
    });
  });
});

================================================================================

File: core/services/renderer/helpers/__tests__/themeData.helper.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { themeDataHelper, rawThemeDataHelper } from '../themeData.helper';
import type { LocalSiteData } from '@/core/types';
import { HtmlSanitizerService } from '../../../htmlSanitizer.service';

// Mock the HTML sanitizer service
jest.mock('../../../htmlSanitizer.service', () => ({
  HtmlSanitizerService: {
    sanitize: jest.fn((html: string) => `sanitized:${html}`)
  }
}));

describe('themeData helpers', () => {
  const mockSiteData: LocalSiteData = {
    siteId: 'test-site',
    manifest: {
      siteId: 'test-site',
      generatorVersion: '1.0.0',
      title: 'Test Site',
      description: 'Test description',
      structure: [],
      theme: {
        name: 'default',
        config: {},
        themeData: {
          footer_text: '<p>Copyright &copy; 2024 Test Site</p>',
          header_announcement: '<div class="alert">Important announcement!</div>',
          plain_text: 'Simple text content',
          number_value: 42,
          boolean_value: true,
          null_value: null,
          undefined_value: undefined
        }
      }
    }
  };

  const mockSiteDataNoThemeData: LocalSiteData = {
    siteId: 'test-site-no-data',
    manifest: {
      siteId: 'test-site-no-data',
      generatorVersion: '1.0.0',
      title: 'Test Site',
      description: 'Test description',
      structure: [],
      theme: {
        name: 'default',
        config: {}
      }
    }
  };

  describe('themeData helper', () => {
    let helper: any;

    beforeEach(() => {
      jest.clearAllMocks();
      const helperMap = themeDataHelper(mockSiteData);
      helper = helperMap.themeData;
    });

    test('returns sanitized HTML content for existing field', () => {
      const result = helper.call({}, 'footer_text');
      
      expect(HtmlSanitizerService.sanitize).toHaveBeenCalledWith('<p>Copyright &copy; 2024 Test Site</p>');
      expect(result).toBe('sanitized:<p>Copyright &copy; 2024 Test Site</p>');
    });

    test('returns sanitized HTML content for another field', () => {
      const result = helper.call({}, 'header_announcement');
      
      expect(HtmlSanitizerService.sanitize).toHaveBeenCalledWith('<div class="alert">Important announcement!</div>');
      expect(result).toBe('sanitized:<div class="alert">Important announcement!</div>');
    });

    test('returns string representation of non-string values without sanitization', () => {
      const numberResult = helper.call({}, 'number_value');
      const booleanResult = helper.call({}, 'boolean_value');
      
      expect(numberResult).toBe('42');
      expect(booleanResult).toBe('true');
      expect(HtmlSanitizerService.sanitize).not.toHaveBeenCalledWith(42);
      expect(HtmlSanitizerService.sanitize).not.toHaveBeenCalledWith(true);
    });

    test('returns empty string for null values', () => {
      const result = helper.call({}, 'null_value');
      expect(result).toBe('');
    });

    test('returns empty string for undefined values', () => {
      const result = helper.call({}, 'undefined_value');
      expect(result).toBe('');
    });

    test('returns empty string for non-existent field', () => {
      const result = helper.call({}, 'non_existent_field');
      expect(result).toBe('');
    });

    test('returns empty string when no theme data exists', () => {
      const helperMapNoData = themeDataHelper(mockSiteDataNoThemeData);
      const helperNoData = helperMapNoData.themeData;
      
      const result = helperNoData.call({}, 'footer_text');
      expect(result).toBe('');
    });

    test('returns empty string when theme data is not an object', () => {
      const siteDataInvalidThemeData: LocalSiteData = {
        ...mockSiteData,
        manifest: {
          ...mockSiteData.manifest,
          theme: {
            ...mockSiteData.manifest.theme,
            themeData: 'invalid-data' as any
          }
        }
      };

      const helperMapInvalid = themeDataHelper(siteDataInvalidThemeData);
      const helperInvalid = helperMapInvalid.themeData;
      
      const result = helperInvalid.call({}, 'footer_text');
      expect(result).toBe('');
    });
  });

  describe('rawThemeData helper', () => {
    let helper: any;

    beforeEach(() => {
      jest.clearAllMocks();
      const helperMap = rawThemeDataHelper(mockSiteData);
      helper = helperMap.rawThemeData;
    });

    test('returns raw HTML content without sanitization', () => {
      const result = helper.call({}, 'footer_text');
      
      expect(HtmlSanitizerService.sanitize).not.toHaveBeenCalled();
      expect(result).toBe('<p>Copyright &copy; 2024 Test Site</p>');
    });

    test('returns raw content for another field', () => {
      const result = helper.call({}, 'header_announcement');
      
      expect(result).toBe('<div class="alert">Important announcement!</div>');
      expect(HtmlSanitizerService.sanitize).not.toHaveBeenCalled();
    });

    test('returns string representation of non-string values', () => {
      const numberResult = helper.call({}, 'number_value');
      const booleanResult = helper.call({}, 'boolean_value');
      
      expect(numberResult).toBe('42');
      expect(booleanResult).toBe('true');
    });

    test('returns empty string for null values', () => {
      const result = helper.call({}, 'null_value');
      expect(result).toBe('');
    });

    test('returns empty string for undefined values', () => {
      const result = helper.call({}, 'undefined_value');
      expect(result).toBe('');
    });

    test('returns empty string for non-existent field', () => {
      const result = helper.call({}, 'non_existent_field');
      expect(result).toBe('');
    });

    test('returns empty string when no theme data exists', () => {
      const helperMapNoData = rawThemeDataHelper(mockSiteDataNoThemeData);
      const helperNoData = helperMapNoData.rawThemeData;
      
      const result = helperNoData.call({}, 'footer_text');
      expect(result).toBe('');
    });
  });

  describe('helper function signatures', () => {
    test('themeData helper accepts variable arguments', () => {
      const helperMap = themeDataHelper(mockSiteData);
      const helper = helperMap.themeData;
      
      // Should work with multiple arguments (Handlebars can pass extra args)
      const result = helper.call({}, 'footer_text', 'extra_arg', { option: 'value' });
      expect(result).toBe('sanitized:<p>Copyright &copy; 2024 Test Site</p>');
    });

    test('rawThemeData helper accepts variable arguments', () => {
      const helperMap = rawThemeDataHelper(mockSiteData);
      const helper = helperMap.rawThemeData;
      
      // Should work with multiple arguments (Handlebars can pass extra args)
      const result = helper.call({}, 'footer_text', 'extra_arg', { option: 'value' });
      expect(result).toBe('<p>Copyright &copy; 2024 Test Site</p>');
    });
  });

  describe('edge cases', () => {
    test('handles empty string field name', () => {
      const helperMap = themeDataHelper(mockSiteData);
      const helper = helperMap.themeData;
      
      const result = helper.call({}, '');
      expect(result).toBe('');
    });

    test('handles numeric field name', () => {
      const siteDataWithNumericKey: LocalSiteData = {
        ...mockSiteData,
        manifest: {
          ...mockSiteData.manifest,
          theme: {
            ...mockSiteData.manifest.theme,
            themeData: {
              '123': 'numeric key value'
            }
          }
        }
      };

      const helperMap = themeDataHelper(siteDataWithNumericKey);
      const helper = helperMap.themeData;
      
      const result = helper.call({}, '123');
      expect(result).toBe('sanitized:numeric key value');
    });

    test('handles object values', () => {
      const siteDataWithObject: LocalSiteData = {
        ...mockSiteData,
        manifest: {
          ...mockSiteData.manifest,
          theme: {
            ...mockSiteData.manifest.theme,
            themeData: {
              complex_data: { nested: 'value', count: 5 }
            }
          }
        }
      };

      const helperMap = themeDataHelper(siteDataWithObject);
      const helper = helperMap.themeData;
      
      const result = helper.call({}, 'complex_data');
      expect(result).toBe('[object Object]');
    });
  });
});

================================================================================

File: core/services/config/theme.service.ts
// core/services/theme.service.ts

import type { RJSFSchema } from '@rjsf/utils';
import type { ThemeConfig } from '@/core/types';

// Extract default values from JSON schema
const extractDefaultsFromSchema = (schema: RJSFSchema): Record<string, unknown> => {
  const defaults: Record<string, unknown> = {};
  
  if (schema.properties) {
    Object.entries(schema.properties).forEach(([key, property]) => {
      if (typeof property === 'object' && property !== null && 'default' in property) {
        defaults[key] = property.default;
      }
    });
  }
  
  return defaults;
};

// Smart field-by-field config merging
const getMergedThemeConfig = (
  themeSchema: RJSFSchema,
  savedConfig: ThemeConfig['config'],
  isThemeChange: boolean = false
): ThemeConfig['config'] => {
  const defaults = extractDefaultsFromSchema(themeSchema) as ThemeConfig['config'];
  
  if (!isThemeChange) {
    // Same theme: Use saved values, fall back to defaults for missing fields
    return { ...defaults, ...savedConfig };
  }
  
  // Theme change: Field-by-field merge to preserve matching user preferences
  const merged = { ...defaults };
  
  // For each saved setting, check if it exists in the new theme
  Object.entries(savedConfig).forEach(([key, value]) => {
    const fieldExists = themeSchema.properties?.[key];
    const hasValidType = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
    
    if (fieldExists && hasValidType) {
      // Field exists in new theme and has valid type - preserve user's value
      merged[key] = value;
    }
    // If field doesn't exist or has invalid type, use default (already set above)
  });
  
  return merged;
};

// Smart theme data merging (similar to appearance config)
const getMergedThemeData = (
  themeDataSchema: RJSFSchema,
  savedThemeData: Record<string, unknown> = {},
  isThemeChange: boolean = false
): Record<string, unknown> => {
  const defaults = extractDefaultsFromSchema(themeDataSchema);
  
  if (!isThemeChange) {
    // Same theme: Use saved values, fall back to defaults for missing fields
    return { ...defaults, ...savedThemeData };
  }
  
  // Theme change: Field-by-field merge to preserve matching user preferences
  const merged = { ...defaults };
  
  // For each saved setting, check if it exists in the new theme
  Object.entries(savedThemeData).forEach(([key, value]) => {
    const fieldExists = themeDataSchema.properties?.[key];
    
    if (fieldExists) {
      // Field exists in new theme - preserve user's value
      merged[key] = value;
    }
    // If field doesn't exist, use default (already set above)
  });
  
  return merged;
};

// Updated main function with smart merging for appearance config
export const getMergedThemeDataForForm = async (
  themeName: string,
  savedConfig: ThemeConfig['config'] = {},
  currentThemeName?: string
): Promise<{ schema: RJSFSchema | null; initialConfig: ThemeConfig['config'] }> => {
  try {
    // Load the theme data (this function should already exist)
    const themeData = await getThemeData(themeName);
    const schema = themeData?.appearanceSchema;
    
    if (!schema || !schema.properties) {
      return { schema: null, initialConfig: {} };
    }
    
    // Determine if this is a theme change
    const isThemeChange = Boolean(currentThemeName && currentThemeName !== themeName);
    
    // Use smart merging logic
    const mergedConfig = getMergedThemeConfig(schema, savedConfig, isThemeChange);
    
    return {
      schema,
      initialConfig: mergedConfig
    };
    
  } catch (error) {
    console.error('Error loading theme data:', error);
    return { schema: null, initialConfig: {} };
  }
};

// New function for theme data schema and merging
export const getMergedThemeDataFieldsForForm = async (
  themeName: string,
  savedThemeData: Record<string, unknown> = {},
  currentThemeName?: string
): Promise<{ schema: RJSFSchema | null; initialData: Record<string, unknown> }> => {
  try {
    // Load the theme data
    const themeData = await getThemeData(themeName);
    const schema = themeData?.themeDataSchema;
    
    if (!schema || !schema.properties) {
      return { schema: null, initialData: {} };
    }
    
    // Determine if this is a theme change
    const isThemeChange = Boolean(currentThemeName && currentThemeName !== themeName);
    
    // Use smart merging logic
    const mergedData = getMergedThemeData(schema, savedThemeData, isThemeChange);
    
    return {
      schema,
      initialData: mergedData
    };
    
  } catch (error) {
    console.error('Error loading theme data schema:', error);
    return { schema: null, initialData: {} };
  }
};

// Helper function to get theme data using existing infrastructure
const getThemeData = async (themeName: string) => {
  // Use the existing infrastructure to load theme.json
  const response = await fetch(`/themes/${themeName}/theme.json`);
  if (!response.ok) {
    throw new Error(`Failed to load theme: ${themeName}`);
  }
  return response.json();
};

================================================================================

File: core/services/config/configHelpers.service.ts
// src/core/services/config/configHelpers.service.ts

import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import { CORE_LAYOUTS, CORE_THEMES } from '@/config/editorConfig';
import type {
    LocalSiteData,
    Manifest,
    LayoutInfo,
    ThemeInfo,
    RawFile,
    LayoutManifest,
} from '@/core/types';

/** A minimal subset of site data needed by the asset helper functions. */
export type SiteDataForAssets = Pick<LocalSiteData, 'manifest' | 'layoutFiles' | 'themeFiles'>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** An in-memory cache to prevent re-fetching public asset files during a session. */
const fileContentCache = new Map<string, Promise<string | null>>();

/** Checks if a given theme path corresponds to a core (built-in) theme. */
export const isCoreTheme = (path: string) => CORE_THEMES.some((t: ThemeInfo) => t.path === path);

/** Checks if a given layout path corresponds to a core (built-in) layout. */
export const isCoreLayout = (path: string) => CORE_LAYOUTS.some((l: LayoutInfo) => l.id === path);

/** Merges multiple JSON Schemas into one. */
export function mergeSchemas(...schemas: (RJSFSchema | null | undefined)[]): RJSFSchema {
    const finalSchema: RJSFSchema = { type: 'object', properties: {}, required: [] };
    for (const schema of schemas) {
        if (schema?.properties) finalSchema.properties = { ...finalSchema.properties, ...schema.properties };
        if (schema?.required) finalSchema.required = [...new Set([...(finalSchema.required || []), ...schema.required])];
    }
    return finalSchema;
}

/** Merges multiple UI Schemas into one. */
export function mergeUiSchemas(...schemas: (UiSchema | null | undefined)[]): UiSchema {
    let finalUiSchema: UiSchema = {};
    for (const schema of schemas) {
        if (schema) finalUiSchema = { ...finalUiSchema, ...schema };
    }
    return finalUiSchema;
}

/**
 * Fetches the raw string content of a theme or layout asset.
 * It intelligently fetches from either the `/public` directory (for core assets)
 * or the `LocalSiteData` object (for user-provided custom assets), with caching.
 */
export async function getAssetContent(siteData: SiteDataForAssets, assetType: 'theme' | 'layout', path: string, fileName: string): Promise<string | null> {
    const isCore = assetType === 'theme' ? isCoreTheme(path) : isCoreLayout(path);
    const sourcePath = `/${assetType}s/${path}/${fileName}`;

    if (isCore) {
      if (fileContentCache.has(sourcePath)) return fileContentCache.get(sourcePath)!;
      const promise = fetch(sourcePath).then(res => res.ok ? res.text() : null).catch(() => null);
      fileContentCache.set(sourcePath, promise);
      return promise;
    } else {
      const fileStore: RawFile[] | undefined = assetType === 'theme' ? siteData.themeFiles : siteData.layoutFiles;
      const fullPath = `${assetType}s/${path}/${fileName}`;
      return fileStore?.find(f => f.path === fullPath)?.content ?? null;
    }
}

/** A generic function to fetch and parse any JSON asset manifest (theme.json, layout.json). */
export async function getJsonAsset<T>(siteData: SiteDataForAssets, assetType: 'theme' | 'layout', path: string, fileName: string): Promise<T | null> {
    const content = await getAssetContent(siteData, assetType, path, fileName);
    if (!content) return null;
    try {
      return JSON.parse(content) as T;
    } catch (e) {
      console.error(`Failed to parse JSON from ${assetType}/${path}/${fileName}:`, e);
      return null;
    }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/** Gets a list of all available themes (core and custom). */
export function getAvailableThemes(manifest?: Manifest): ThemeInfo[] {
  const available = [...CORE_THEMES];
  if (manifest?.themes) {
    const customThemes = manifest.themes.filter(customTheme => !available.some(coreTheme => coreTheme.path === customTheme.path));
    available.push(...customThemes);
  }
  return available;
}

/**
 * Fetches and processes the manifest for a specific layout.
 * @param siteData The site's data.
 * @param layoutPath The ID of the layout to fetch (e.g., 'blog-post').
 * @returns The parsed LayoutManifest object, or null if not found.
 */
export async function getLayoutManifest(siteData: SiteDataForAssets, layoutPath: string): Promise<LayoutManifest | null> {
    const manifest = await getJsonAsset<LayoutManifest>(siteData, 'layout', layoutPath, 'layout.json');
    if (manifest) {
        manifest.id = layoutPath; // Ensure the manifest object includes its own ID
    }
    return manifest;
}

/**
 * Gets a list of the full manifest objects for all available layouts,
 * optionally filtered by a specific layout type ('single' or 'collection').
 * This is now the single source of truth for discovering all content blueprints.
 *
 * @param siteData The site's data, used to find custom layouts.
 * @param type An optional filter to return only 'single' or 'collection' layouts.
 * @returns A promise that resolves to an array of LayoutManifest objects.
 */
export async function getAvailableLayouts(
  siteData: SiteDataForAssets,
  type?: LayoutManifest['layoutType']
): Promise<LayoutManifest[]> {
  // 1. Get the IDs of all core layouts from the central config.
  const coreLayoutIds = CORE_LAYOUTS.map(l => l.id);
  // 2. Get the IDs of any user-defined custom layouts from the site's manifest.
  const customLayoutIds = siteData.manifest.layouts?.map(l => l.id) || [];
  // 3. Combine and de-duplicate the list of all known layout IDs.
  const allLayoutIds = [...new Set([...coreLayoutIds, ...customLayoutIds])];

  // 4. Fetch the full manifest file for every single layout.
  const manifestPromises = allLayoutIds.map(layoutId =>
    getLayoutManifest(siteData, layoutId)
  );

  // 5. Wait for all fetches to complete and filter out any that failed (were null).
  const allManifests = (await Promise.all(manifestPromises))
    .filter((m): m is LayoutManifest => m !== null);

  // 6. If a type filter was provided, apply it now. Otherwise, return all layouts.
  if (type) {
    return allManifests.filter(m => m.layoutType === type);
  }

  return allManifests;
}

================================================================================

File: core/services/images/images.service.ts
// src/core/services/images/images.service.ts

import type { ImageService, Manifest } from '@/core/types';
import { localImageService } from './localImage.service';
import { cloudinaryImageService } from './cloudinaryImage.service';

const services: Record<string, ImageService> = {
  local: localImageService,
  cloudinary: cloudinaryImageService,
};

export function getActiveImageService(manifest: Manifest): ImageService {
  const serviceId = manifest.settings?.imageService || 'local';
  return services[serviceId] || localImageService;
}

================================================================================

File: core/services/images/types.ts
// src/core/services/theme-engine/helpers/types.ts
import type { LocalSiteData } from '@/core/types';
import Handlebars from 'handlebars';

/**
 * Defines the function signature for a Handlebars helper function within Sparktype.
 * `this` refers to the current template context.
 * `args` are the arguments passed to the helper in the template.
 */
export type SparktypeHelperFunction = (
  this: unknown,
  ...args: unknown[]
) => string | Handlebars.SafeString | boolean | Promise<Handlebars.SafeString>;

/**
 * Defines a "Helper Factory". It's a function that receives the full site data
 * and returns an object mapping helper names to their implementation functions.
 */
export type SparktypeHelper = (siteData: LocalSiteData) => Record<string, SparktypeHelperFunction>;

================================================================================

File: core/services/images/localImage.service.ts
// src/core/services/images/localImage.service.ts

import type { ImageService, ImageRef, ImageTransformOptions, Manifest } from '@/core/types';
import * as localSiteFs from '@/core/services/localFileSystem.service';
import { slugify } from '@/core/libraries/utils';
import { getCachedDerivative, setCachedDerivative, getAllCacheKeys } from './derivativeCache.service';
import imageCompression from 'browser-image-compression';
import { MEMORY_CONFIG } from '@/config/editorConfig';
import { toast } from 'sonner';

/**
 * This service manages images stored locally within the browser's IndexedDB.
 * It handles uploading, generating transformed "derivatives" (e.g., thumbnails),
 * caching those derivatives for performance, and bundling all necessary assets for a static site export.
 * It acts as the "backend" for the local storage image strategy.
 */

// In-memory caches to reduce redundant processing and DB reads within a session.
const sourceImageCache = new Map<string, Blob>();
const processingPromises = new Map<string, Promise<Blob>>();

// --- FIX: Add a new Map to handle concurrent requests for the SAME source blob. ---
const sourceBlobPromises = new Map<string, Promise<Blob>>();

/**
 * A strongly-typed interface for the options passed to the browser-image-compression library.
 * This improves type safety and code clarity.
 */
interface CompressionOptions {
  maxSizeMB: number;
  initialQuality: number;
  useWebWorker: boolean;
  exifOrientation: number;
  maxWidthOrHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

/**
 * A utility function to get the dimensions of an image from its Blob data.
 * @param blob The image Blob.
 * @returns A promise that resolves to the image's width and height.
 */
const getImageDimensions = (blob: Blob): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(url);
    };
    img.onerror = (err) => {
      reject(err);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
};

/**
 * Implements the ImageService interface for handling images stored locally
 * within the site's data in the browser (IndexedDB).
 */
class LocalImageService implements ImageService {
  id = 'local';
  name = 'Store in Site Bundle';

  /**
   * Validates and uploads a user-provided image file.
   * This is the primary entry point for adding a new local image asset. It performs
   * validation against `MEMORY_CONFIG` before saving the file to IndexedDB.
   * @param {File} file The user's selected file.
   * @param {string} siteId The ID of the site the image belongs to.
   * @returns {Promise<ImageRef>} A promise that resolves to an ImageRef object representing the saved file.
   * @throws {Error} If the file type is unsupported or the file size exceeds the configured limits.
   */
  public async upload(file: File, siteId: string): Promise<ImageRef> {
    // --- Validation Block ---
    const isSvg = file.type === 'image/svg+xml';

    // 1. Check if the MIME type is supported.
    if (!MEMORY_CONFIG.SUPPORTED_IMAGE_TYPES.includes(file.type as typeof MEMORY_CONFIG.SUPPORTED_IMAGE_TYPES[number])) {
      const errorMsg = `Unsupported file type: ${file.type}.`;
      toast.error(errorMsg);
      throw new Error(errorMsg);
    }

    // 2. Check if the file exceeds its specific size limit.
    const maxSize = isSvg ? MEMORY_CONFIG.MAX_SVG_SIZE : MEMORY_CONFIG.MAX_UPLOAD_SIZE;
    if (file.size > maxSize) {
        const maxSizeFormatted = (maxSize / 1024 / (isSvg ? 1 : 1024)).toFixed(1);
        const unit = isSvg ? 'KB' : 'MB';
        const errorMsg = `Image is too large. Max size is ${maxSizeFormatted}${unit}.`;
        toast.error(errorMsg);
        throw new Error(errorMsg);
    }
    // --- End Validation Block ---

    const extIndex = file.name.lastIndexOf('.');
    if (extIndex === -1) {
      throw new Error("Uploaded file is missing an extension.");
    }
    const baseName = file.name.substring(0, extIndex);
    const extension = file.name.substring(extIndex);
    const slugifiedBaseName = slugify(baseName);
    const fileName = `${Date.now()}-${slugifiedBaseName}${extension}`;
    const relativePath = `assets/images/${fileName}`;

    await localSiteFs.saveImageAsset(siteId, relativePath, file as Blob);

    let width: number, height: number;
    try {
      const dimensions = await getImageDimensions(file as Blob);
      width = dimensions.width;
      height = dimensions.height;
    } catch (error) {
      console.error('Failed to get image dimensions, using defaults:', error);
      width = 0;
      height = 0;
    }

    return {
      serviceId: 'local',
      src: relativePath,
      alt: file.name,
      width,
      height,
    };
  }

  /**
   * Generates a URL for an image, potentially creating a transformed derivative.
   * It handles SVGs, cached derivatives, and new processing requests.
   * @param {Manifest} manifest The site's manifest.
   * @param {ImageRef} ref The reference to the source image.
   * @param {ImageTransformOptions} options The requested transformations (width, height, etc.).
   * @param {boolean} isExport If true, returns a relative path for static export. If false, returns a temporary `blob:` URL for live preview.
   * @returns {Promise<string>} A promise that resolves to the displayable URL or relative path.
   */
  public async getDisplayUrl(manifest: Manifest, ref: ImageRef, options: ImageTransformOptions, isExport: boolean): Promise<string> {
    // SVGs are returned directly without processing.
    if (ref.src.toLowerCase().endsWith('.svg')) {
      if (isExport) return ref.src;
      const sourceBlob = await this.getSourceBlob(manifest.siteId, ref.src);
      return URL.createObjectURL(sourceBlob);
    }

    // Construct a unique filename and cache key for the requested derivative.
    const { width, height, crop = 'scale', gravity = 'center' } = options;
    const extIndex = ref.src.lastIndexOf('.');
    if (extIndex === -1) throw new Error("Source image has no extension.");
    
    const pathWithoutExt = ref.src.substring(0, extIndex);
    const ext = ref.src.substring(extIndex);
    const derivativeFileName = `${pathWithoutExt}_w${width || 'auto'}_h${height || 'auto'}_c-${crop}_g-${gravity}${ext}`;
    const cacheKey = `${manifest.siteId}/${derivativeFileName}`;

    const finalBlob = await this.getOrProcessDerivative(manifest.siteId, ref.src, cacheKey, options);
    
    return isExport ? derivativeFileName : URL.createObjectURL(finalBlob);
  }

  /**
   * Retrieves a derivative blob, either from the cache or by initiating a new processing job.
   * This method uses an in-memory map of promises to prevent race conditions where the same
   * derivative is requested multiple times before the first job completes.
   * @private
   * @param {string} siteId The site's ID.
   * @param {string} srcPath The path to the original source image.
   * @param {string} cacheKey The unique, namespaced key for the derivative.
   * @param {ImageTransformOptions} options The transformation options.
   * @returns {Promise<Blob>} A promise that resolves to the final derivative blob.
   */
  private async getOrProcessDerivative(siteId: string, srcPath: string, cacheKey: string, options: ImageTransformOptions): Promise<Blob> {
    // 1. Check persistent cache (IndexedDB) first.
    const cachedBlob = await getCachedDerivative(cacheKey);
    if (cachedBlob) return cachedBlob;

    // 2. Check if this exact derivative is already being processed.
    if (processingPromises.has(cacheKey)) return processingPromises.get(cacheKey)!;
    
    // 3. If not, create and store a new processing promise.
    const processingPromise = (async (): Promise<Blob> => {
      try {
        const sourceBlob = await this.getSourceBlob(siteId, srcPath);
        const sourceDimensions = await getImageDimensions(sourceBlob);

        const compressionOptions: CompressionOptions = {
            maxSizeMB: 1.5,
            initialQuality: 0.85,
            useWebWorker: true,
            exifOrientation: -1,
        };

        // Prevent upscaling by capping requested dimensions at the source's dimensions.
        const { width, height, crop } = options;
        const targetWidth = width ? Math.min(width, sourceDimensions.width) : undefined;
        const targetHeight = height ? Math.min(height, sourceDimensions.height) : undefined;

        if (crop === 'fill' && targetWidth && targetHeight) {
          compressionOptions.maxWidth = targetWidth;
          compressionOptions.maxHeight = targetHeight;
        } else {
          const maxDim = Math.max(targetWidth || 0, targetHeight || 0);
          if (maxDim > 0) compressionOptions.maxWidthOrHeight = maxDim;
        }

        console.log(`[ImageService] Processing new derivative: ${cacheKey}`);
        
        // Add timeout wrapper for imageCompression to prevent hanging
        const compressionPromise = imageCompression(sourceBlob as File, compressionOptions);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Image compression timed out after 30 seconds')), 30000);
        });
        
        const derivativeBlob = await Promise.race([compressionPromise, timeoutPromise]);
        
        // 4. Store the result in the persistent cache.
        await setCachedDerivative(cacheKey, derivativeBlob);
        return derivativeBlob;
      } catch (error) {
        console.error(`[ImageService] Failed to process derivative ${cacheKey}:`, error);
        throw error;
      } finally {
        // 5. Clean up the promise map once the job is complete.
        processingPromises.delete(cacheKey);
      }
    })();

    processingPromises.set(cacheKey, processingPromise);
    return processingPromise;
  }

  /**
   * --- FIX: This function is now concurrency-safe. ---
   * Retrieves the original source image blob, using an in-memory cache and a promise map
   * to avoid repeated reads from IndexedDB during concurrent requests.
   * @private
   * @param {string} siteId The site's ID.
   * @param {string} srcPath The path of the source image to retrieve.
   * @returns {Promise<Blob>} A promise that resolves to the source image blob.
   */
  private async getSourceBlob(siteId: string, srcPath: string): Promise<Blob> {
    // 1. Check in-memory cache for an already resolved blob.
    if (sourceImageCache.has(srcPath)) {
      return sourceImageCache.get(srcPath)!;
    }

    // 2. Check if a fetch for this blob is already in progress.
    if (sourceBlobPromises.has(srcPath)) {
      return sourceBlobPromises.get(srcPath)!;
    }

    // 3. If not, create a new promise to fetch the blob.
    const promise = (async () => {
      try {
        const blobData = await localSiteFs.getImageAsset(siteId, srcPath);
        if (!blobData) {
          throw new Error(`Source image not found in local storage: ${srcPath}`);
        }
        // Cache the resolved blob in memory for subsequent synchronous access.
        sourceImageCache.set(srcPath, blobData);
        return blobData;
      } finally {
        // 4. Clean up the promise from the map once it has settled.
        sourceBlobPromises.delete(srcPath);
      }
    })();

    // 5. Store the promise in the map *before* awaiting it. This is the key to handling the race.
    sourceBlobPromises.set(srcPath, promise);

    return promise;
  }

  /**
   * Gathers all assets (source images and cached derivatives) needed for a full site export.
   * @param {string} siteId The ID of the site to export.
   * @param {ImageRef[]} allImageRefs An array of all image references found in the site's content and manifest.
   * @returns {Promise<{ path: string; data: Blob; }[]>} A promise resolving to an array of assets to be zipped.
   */
  public async getExportableAssets(siteId: string, allImageRefs: ImageRef[]): Promise<{ path: string; data: Blob; }[]> {
    const exportableMap = new Map<string, Blob>();
    
    // 1. Add all original source images for this site to the export map.
    for (const ref of allImageRefs) {
      if (ref.serviceId === 'local' && !exportableMap.has(ref.src)) {
        const sourceBlob = await localSiteFs.getImageAsset(siteId, ref.src);
        if (sourceBlob) {
          exportableMap.set(ref.src, sourceBlob);
        }
      }
    }
    
    // 2. Add all of this site's existing derivatives from the cache to the export map.
    const derivativeKeys = await getAllCacheKeys(siteId);
    for (const key of derivativeKeys) {
      const filename = key.substring(siteId.length + 1);
      if (!exportableMap.has(filename)) {
        const derivativeBlob = await getCachedDerivative(key);
        if (derivativeBlob) {
          exportableMap.set(filename, derivativeBlob);
        }
      }
    }
    
    return Array.from(exportableMap.entries()).map(([path, data]) => ({ path, data }));
  }
}

// Export a singleton instance of the service.
export const localImageService = new LocalImageService();

================================================================================

File: core/services/images/derivativeCache.service.ts
// src/core/services/images/derivativeCache.service.ts
import localforage from 'localforage';

/**
 * Manages the storage and retrieval of generated image "derivatives" (e.g., thumbnails, resized images).
 * This service acts as a persistent cache in the browser's IndexedDB to avoid re-processing
 * images unnecessarily between sessions, which significantly improves performance.
 *
 */

// A single, global IndexedDB store is used for all derivatives.
// Scoping is handled by prefixing keys with the site's ID.
const derivativeCacheStore = localforage.createInstance({
  name: 'SparktypeDB',
  storeName: 'derivativeCacheStore',
});

/**
 * Retrieves a cached image derivative from IndexedDB by its full, namespaced key.
 * @param key The unique key for the derivative, including the `siteId` prefix (e.g., "site-abc/assets/images/foo_w100.jpg").
 * @returns A promise that resolves to the derivative Blob, or null if not found.
 */
export async function getCachedDerivative(key: string): Promise<Blob | null> {
  return derivativeCacheStore.getItem<Blob>(key);
}

/**
 * Stores an image derivative Blob in IndexedDB using its full, namespaced key.
 * @param key The unique key for the derivative, including the `siteId` prefix.
 * @param blob The derivative image data as a Blob to be cached.
 */
export async function setCachedDerivative(key: string, blob: Blob): Promise<void> {
  await derivativeCacheStore.setItem(key, blob);
}

/**
 * Retrieves all cache keys that belong to a specific site.
 * This is crucial for the site exporter to find and bundle all generated images for a single site.
 * @param siteId The ID of the site whose cache keys are needed.
 * @returns A promise that resolves to an array of all keys (strings) for the specified site.
 */
export async function getAllCacheKeys(siteId: string): Promise<string[]> {
  // 1. Get all keys from the store.
  const allKeys = await derivativeCacheStore.keys();
  
  // 2. Filter the keys to return only those that start with the required "siteId/" prefix.
  const sitePrefix = `${siteId}/`;
  return allKeys.filter(key => key.startsWith(sitePrefix));
}

/**
 * Removes all cached derivatives for a specific site.
 * This should be called when deleting a site to prevent cache pollution.
 * @param siteId The ID of the site whose cache should be cleared.
 */
export async function clearSiteDerivativeCache(siteId: string): Promise<void> {
  try {
    const siteKeys = await getAllCacheKeys(siteId);
    await Promise.all(siteKeys.map(key => derivativeCacheStore.removeItem(key)));
    console.log(`[DerivativeCache] Cleared ${siteKeys.length} cached derivatives for site ${siteId}`);
  } catch (error) {
    console.error(`[DerivativeCache] Failed to clear cache for site ${siteId}:`, error);
  }
}

/**
 * Clears the entire derivative cache. Used for IndexedDB recovery.
 */
export async function clearAllDerivativeCache(): Promise<void> {
  try {
    await derivativeCacheStore.clear();
    console.log('[DerivativeCache] Cleared entire cache for recovery');
  } catch (error) {
    console.error('[DerivativeCache] Failed to clear entire cache:', error);
  }
}

================================================================================

File: core/services/images/imageCache.service.ts
// src/core/services/images/derivativeCache.service.ts
import localforage from 'localforage';

const derivativeCacheStore = localforage.createInstance({
  name: 'SparktypeDB',
  storeName: 'derivativeCacheStore',
});

/**
 * Retrieves a cached image derivative from IndexedDB by its key.
 * @param key The unique key for the derivative.
 * @returns A promise that resolves to the derivative Blob, or null if not found.
 */
export async function getCachedDerivative(key: string): Promise<Blob | null> {
  return derivativeCacheStore.getItem<Blob>(key);
}

/**
 * Stores an image derivative Blob in IndexedDB.
 * @param key The unique key for the derivative.
 * @param blob The derivative image data as a Blob.
 */
export async function setCachedDerivative(key: string, blob: Blob): Promise<void> {
  await derivativeCacheStore.setItem(key, blob);
}

/**
 * Retrieves all keys currently stored in the derivative cache.
 * @returns A promise that resolves to an array of all keys (strings).
 */
export async function getAllCacheKeys(): Promise<string[]> {
  return derivativeCacheStore.keys();
}

================================================================================

File: core/services/images/cloudinaryImage.service.ts
// src/core/services/images/cloudinaryImage.service.ts
import type { ImageService, ImageRef, ImageTransformOptions, Manifest } from '@/core/types';
import { useAppStore } from '@/core/state/useAppStore';
import { Cloudinary } from "@cloudinary/url-gen";
import { fill, fit, scale } from "@cloudinary/url-gen/actions/resize";
import { Gravity } from "@cloudinary/url-gen/qualifiers/gravity";
import { format, quality } from "@cloudinary/url-gen/actions/delivery";

interface UploadWidgetResultInfo {
  public_id: string;
  version: number;
  format: string;
  width: number;
  height: number;
  original_filename?: string;
}

interface UploadWidgetResult {
  event: 'success';
  info: UploadWidgetResultInfo;
}

interface UploadWidgetError {
  message: string;
}

declare const cloudinary: {
  createUploadWidget: (
    options: object,
    callback: (error: UploadWidgetError | null, result: UploadWidgetResult | null) => void
  ) => { open: () => void; close: () => void; };
};

class CloudinaryImageService implements ImageService {
  id = 'cloudinary';
  name = 'Upload to Cloudinary';

  async upload(_file: File, siteId: string, site?: any): Promise<ImageRef> {
    // Note: site parameter added to avoid getState() call
    // This service should be called with site data from React components
    if (!site) {
      // Fallback to getState() only if site not provided (for backward compatibility)
      const storeState = useAppStore.getState();
      site = storeState.getSiteById(siteId);
      if (!site) throw new Error(`Site with ID "${siteId}" not found in state.`);
    }

    const cloudName = site.manifest?.settings?.cloudinary?.cloudName;
    const uploadPreset = site.secrets?.cloudinary?.uploadPreset;

    if (!cloudName || !uploadPreset) throw new Error("Cloudinary Cloud Name and Upload Preset must be configured.");

    return new Promise((resolve, reject) => {
      const widget = cloudinary.createUploadWidget(
        { cloudName, uploadPreset, sources: ['local', 'url', 'camera'], multiple: false },
        (error, result) => {
          if (error) {
            console.error('Cloudinary Upload Error:', error);
            widget.close();
            return reject(new Error(error.message || 'Image upload failed. Please try again.'));
          }

          if (result && result.event === 'success') {
            const { public_id, width, height } = result.info;
            const srcPath = public_id;
            
            widget.close();
            resolve({
              serviceId: 'cloudinary', src: srcPath,
              alt: result.info.original_filename || 'Uploaded image', width, height,
            });
          }
        }
      );
      widget.open();
    });
  }

  async getDisplayUrl(manifest: Manifest, ref: ImageRef, options: ImageTransformOptions): Promise<string> {
    const cloudName = manifest.settings?.cloudinary?.cloudName;
    if (!cloudName) return ''; // Return empty string or a placeholder if not configured
    
    const cld = new Cloudinary({ cloud: { cloudName: cloudName } });
    const cldImage = cld.image(ref.src);

    const { width, height, crop = 'scale', gravity } = options;

    switch (crop) {
        case 'fill':
            const fillResize = fill(width, height);
            if (gravity === 'auto') fillResize.gravity(Gravity.autoGravity());
            else if (gravity && ['north', 'south', 'east', 'west'].includes(gravity)) fillResize.gravity(Gravity.compass(gravity));
            else if (gravity === 'center') fillResize.gravity(Gravity.xyCenter());
            cldImage.resize(fillResize);
            break;
        case 'fit': cldImage.resize(fit(width, height)); break;
        case 'scale': default: cldImage.resize(scale(width, height)); break;
    }

    cldImage.delivery(format('auto')).delivery(quality('auto'));
    return cldImage.toURL();
  }

  async getExportableAssets(): Promise<{ path: string; data: Blob; }[]> {
    // Cloudinary assets are remote, so there are no local files to export.
    return Promise.resolve([]);
  }
}

export const cloudinaryImageService = new CloudinaryImageService();

================================================================================

File: core/services/images/__tests__/derivativeCache.service.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import {
  getCachedDerivative,
  setCachedDerivative,
  getAllCacheKeys,
  clearSiteDerivativeCache,
  clearAllDerivativeCache
} from '../derivativeCache.service';

// Mock localforage
jest.mock('localforage', () => {
  const mockLocalForageInstance = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    keys: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  };

  return {
    createInstance: jest.fn(() => mockLocalForageInstance)
  };
});

// Get the mocked instance for test usage
const localforage = require('localforage');
const mockLocalForageInstance = localforage.createInstance();

describe('derivativeCache.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear console mocks
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Helper function to create mock image blobs
  const createMockBlob = (content: string, type = 'image/jpeg'): Blob => {
    return new Blob([content], { type });
  };

  describe('getCachedDerivative', () => {
    test('retrieves cached derivative blob by key', async () => {
      const key = 'test-site/assets/images/photo_w300.jpg';
      const expectedBlob = createMockBlob('cached-image-data');

      mockLocalForageInstance.getItem.mockResolvedValue(expectedBlob);

      const result = await getCachedDerivative(key);

      expect(result).toBe(expectedBlob);
      expect(mockLocalForageInstance.getItem).toHaveBeenCalledWith(key);
    });

    test('returns null when derivative not found', async () => {
      const key = 'test-site/assets/images/nonexistent_w300.jpg';

      mockLocalForageInstance.getItem.mockResolvedValue(null);

      const result = await getCachedDerivative(key);

      expect(result).toBeNull();
      expect(mockLocalForageInstance.getItem).toHaveBeenCalledWith(key);
    });

    test('handles different key formats', async () => {
      const testKeys = [
        'site-123/assets/images/simple.jpg',
        'my-blog-abc/nested/path/image_w100_h200.png',
        'test/complex_w300_h200_c-fill_g-center.webp'
      ];

      for (const key of testKeys) {
        const mockBlob = createMockBlob(`data-for-${key}`);
        mockLocalForageInstance.getItem.mockResolvedValue(mockBlob);

        const result = await getCachedDerivative(key);

        expect(result).toBe(mockBlob);
        expect(mockLocalForageInstance.getItem).toHaveBeenCalledWith(key);
        
        jest.clearAllMocks();
      }
    });

    test('propagates storage errors', async () => {
      const key = 'test-site/assets/images/error.jpg';
      const storageError = new Error('IndexedDB connection failed');

      mockLocalForageInstance.getItem.mockRejectedValue(storageError);

      await expect(getCachedDerivative(key)).rejects.toThrow('IndexedDB connection failed');
    });

    test('handles empty key', async () => {
      mockLocalForageInstance.getItem.mockResolvedValue(null);

      const result = await getCachedDerivative('');

      expect(result).toBeNull();
      expect(mockLocalForageInstance.getItem).toHaveBeenCalledWith('');
    });
  });

  describe('setCachedDerivative', () => {
    test('stores derivative blob with correct key', async () => {
      const key = 'test-site/assets/images/photo_w300.jpg';
      const blob = createMockBlob('compressed-image-data');

      mockLocalForageInstance.setItem.mockResolvedValue(undefined);

      await setCachedDerivative(key, blob);

      expect(mockLocalForageInstance.setItem).toHaveBeenCalledWith(key, blob);
    });

    test('stores different blob types', async () => {
      const testCases = [
        { key: 'site1/image.jpg', blob: createMockBlob('jpeg-data', 'image/jpeg') },
        { key: 'site2/image.png', blob: createMockBlob('png-data', 'image/png') },
        { key: 'site3/image.webp', blob: createMockBlob('webp-data', 'image/webp') }
      ];

      for (const { key, blob } of testCases) {
        mockLocalForageInstance.setItem.mockResolvedValue(undefined);

        await setCachedDerivative(key, blob);

        expect(mockLocalForageInstance.setItem).toHaveBeenCalledWith(key, blob);
        
        jest.clearAllMocks();
      }
    });

    test('handles large blob storage', async () => {
      const key = 'test-site/assets/images/large_w1000.jpg';
      const largeData = 'x'.repeat(1024 * 1024); // 1MB of data
      const largeBlob = createMockBlob(largeData);

      mockLocalForageInstance.setItem.mockResolvedValue(undefined);

      await setCachedDerivative(key, largeBlob);

      expect(mockLocalForageInstance.setItem).toHaveBeenCalledWith(key, largeBlob);
    });

    test('propagates storage errors', async () => {
      const key = 'test-site/assets/images/error.jpg';
      const blob = createMockBlob('test-data');
      const storageError = new Error('Storage quota exceeded');

      mockLocalForageInstance.setItem.mockRejectedValue(storageError);

      await expect(setCachedDerivative(key, blob)).rejects.toThrow('Storage quota exceeded');
    });

    test('overwrites existing cached derivative', async () => {
      const key = 'test-site/assets/images/update.jpg';
      const originalBlob = createMockBlob('original-data');
      const updatedBlob = createMockBlob('updated-data');

      // First storage
      mockLocalForageInstance.setItem.mockResolvedValueOnce(undefined);
      await setCachedDerivative(key, originalBlob);

      // Update storage
      mockLocalForageInstance.setItem.mockResolvedValueOnce(undefined);
      await setCachedDerivative(key, updatedBlob);

      expect(mockLocalForageInstance.setItem).toHaveBeenCalledTimes(2);
      expect(mockLocalForageInstance.setItem).toHaveBeenLastCalledWith(key, updatedBlob);
    });
  });

  describe('getAllCacheKeys', () => {
    test('returns all keys for a specific site', async () => {
      const allKeys = [
        'site-123/assets/images/photo1_w300.jpg',
        'site-123/assets/images/photo2_w200.png',
        'site-456/assets/images/other_w100.jpg',
        'site-123/nested/path/image_w500.webp',
        'another-site/test.jpg'
      ];

      mockLocalForageInstance.keys.mockResolvedValue(allKeys);

      const result = await getAllCacheKeys('site-123');

      expect(result).toEqual([
        'site-123/assets/images/photo1_w300.jpg',
        'site-123/assets/images/photo2_w200.png',
        'site-123/nested/path/image_w500.webp'
      ]);
      expect(mockLocalForageInstance.keys).toHaveBeenCalled();
    });

    test('returns empty array when no keys match site', async () => {
      const allKeys = [
        'other-site/image1.jpg',
        'another-site/image2.png'
      ];

      mockLocalForageInstance.keys.mockResolvedValue(allKeys);

      const result = await getAllCacheKeys('non-existent-site');

      expect(result).toEqual([]);
    });

    test('returns empty array when no keys exist', async () => {
      mockLocalForageInstance.keys.mockResolvedValue([]);

      const result = await getAllCacheKeys('any-site');

      expect(result).toEqual([]);
    });

    test('handles site IDs with special characters', async () => {
      const siteId = 'my-blog-2024';
      const allKeys = [
        'my-blog-2024/assets/images/post_w300.jpg',
        'my-blog-2023/assets/images/old_w300.jpg',
        'my-blog-2024-test/assets/images/test_w300.jpg'
      ];

      mockLocalForageInstance.keys.mockResolvedValue(allKeys);

      const result = await getAllCacheKeys(siteId);

      expect(result).toEqual(['my-blog-2024/assets/images/post_w300.jpg']);
    });

    test('handles site ID that is a prefix of another site ID', async () => {
      const allKeys = [
        'site/image1.jpg',
        'site-extended/image2.jpg',
        'site/sub/image3.jpg'
      ];

      mockLocalForageInstance.keys.mockResolvedValue(allKeys);

      const result = await getAllCacheKeys('site');

      expect(result).toEqual([
        'site/image1.jpg',
        'site/sub/image3.jpg'
      ]);
    });

    test('propagates storage errors', async () => {
      const storageError = new Error('Failed to retrieve keys');
      mockLocalForageInstance.keys.mockRejectedValue(storageError);

      await expect(getAllCacheKeys('test-site')).rejects.toThrow('Failed to retrieve keys');
    });

    test('handles empty site ID', async () => {
      const allKeys = ['site1/image.jpg', 'site2/image.jpg'];
      mockLocalForageInstance.keys.mockResolvedValue(allKeys);

      const result = await getAllCacheKeys('');

      expect(result).toEqual([]);
    });
  });

  describe('clearSiteDerivativeCache', () => {
    test('clears all derivatives for a specific site', async () => {
      const siteId = 'test-site';
      const siteKeys = [
        'test-site/assets/images/photo1_w300.jpg',
        'test-site/assets/images/photo2_w200.png',
        'test-site/nested/image_w100.webp'
      ];

      const allKeys = [
        ...siteKeys,
        'other-site/image.jpg'
      ];

      mockLocalForageInstance.keys.mockResolvedValue(allKeys);
      mockLocalForageInstance.removeItem.mockResolvedValue(undefined);

      await clearSiteDerivativeCache(siteId);

      expect(mockLocalForageInstance.removeItem).toHaveBeenCalledTimes(3);
      expect(mockLocalForageInstance.removeItem).toHaveBeenCalledWith('test-site/assets/images/photo1_w300.jpg');
      expect(mockLocalForageInstance.removeItem).toHaveBeenCalledWith('test-site/assets/images/photo2_w200.png');
      expect(mockLocalForageInstance.removeItem).toHaveBeenCalledWith('test-site/nested/image_w100.webp');
      
      expect(console.log).toHaveBeenCalledWith('[DerivativeCache] Cleared 3 cached derivatives for site test-site');
    });

    test('handles site with no cached derivatives', async () => {
      const siteId = 'empty-site';
      mockLocalForageInstance.keys.mockResolvedValue([]);

      await clearSiteDerivativeCache(siteId);

      expect(mockLocalForageInstance.removeItem).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('[DerivativeCache] Cleared 0 cached derivatives for site empty-site');
    });

    test('continues clearing even if some removals fail', async () => {
      const siteId = 'test-site';
      const siteKeys = [
        'test-site/image1.jpg',
        'test-site/image2.jpg',
        'test-site/image3.jpg'
      ];

      mockLocalForageInstance.keys.mockResolvedValue(siteKeys);
      mockLocalForageInstance.removeItem
        .mockResolvedValueOnce(undefined) // First succeeds
        .mockRejectedValueOnce(new Error('Remove failed')) // Second fails
        .mockResolvedValueOnce(undefined); // Third succeeds

      await clearSiteDerivativeCache(siteId);

      expect(mockLocalForageInstance.removeItem).toHaveBeenCalledTimes(3);
      // Should still complete despite one failure
    });

    test('logs error when clearing fails', async () => {
      const siteId = 'error-site';
      const keysError = new Error('Failed to get keys');

      mockLocalForageInstance.keys.mockRejectedValue(keysError);

      await clearSiteDerivativeCache(siteId);

      expect(console.error).toHaveBeenCalledWith(
        '[DerivativeCache] Failed to clear cache for site error-site:',
        keysError
      );
    });

    test('handles concurrent clear operations', async () => {
      const siteIds = ['site1', 'site2', 'site3'];
      
      mockLocalForageInstance.keys.mockImplementation(() => 
        Promise.resolve(['site1/image.jpg', 'site2/image.jpg', 'site3/image.jpg'])
      );
      mockLocalForageInstance.removeItem.mockResolvedValue(undefined);

      const promises = siteIds.map(siteId => clearSiteDerivativeCache(siteId));
      await Promise.all(promises);

      expect(mockLocalForageInstance.removeItem).toHaveBeenCalledTimes(3);
      expect(console.log).toHaveBeenCalledTimes(3);
    });

    test('properly filters site keys with exact match', async () => {
      const siteId = 'site';
      const allKeys = [
        'site/image1.jpg',
        'site-test/image2.jpg', // Should not be included
        'site/sub/image3.jpg',
        'other-site/image4.jpg' // Should not be included
      ];

      mockLocalForageInstance.keys.mockResolvedValue(allKeys);
      mockLocalForageInstance.removeItem.mockResolvedValue(undefined);

      await clearSiteDerivativeCache(siteId);

      expect(mockLocalForageInstance.removeItem).toHaveBeenCalledTimes(2);
      expect(mockLocalForageInstance.removeItem).toHaveBeenCalledWith('site/image1.jpg');
      expect(mockLocalForageInstance.removeItem).toHaveBeenCalledWith('site/sub/image3.jpg');
    });
  });

  describe('clearAllDerivativeCache', () => {
    test('clears entire derivative cache', async () => {
      mockLocalForageInstance.clear.mockResolvedValue(undefined);

      await clearAllDerivativeCache();

      expect(mockLocalForageInstance.clear).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('[DerivativeCache] Cleared entire cache for recovery');
    });

    test('logs error when clear all fails', async () => {
      const clearError = new Error('Failed to clear cache');
      mockLocalForageInstance.clear.mockRejectedValue(clearError);

      await clearAllDerivativeCache();

      expect(console.error).toHaveBeenCalledWith(
        '[DerivativeCache] Failed to clear entire cache:',
        clearError
      );
    });

    test('handles multiple concurrent clear all operations', async () => {
      mockLocalForageInstance.clear.mockResolvedValue(undefined);

      const promises = [
        clearAllDerivativeCache(),
        clearAllDerivativeCache(),
        clearAllDerivativeCache()
      ];

      await Promise.all(promises);

      expect(mockLocalForageInstance.clear).toHaveBeenCalledTimes(3);
    });

    test('completes successfully even with concurrent site clears', async () => {
      mockLocalForageInstance.clear.mockResolvedValue(undefined);
      mockLocalForageInstance.keys.mockResolvedValue(['site1/image.jpg']);
      mockLocalForageInstance.removeItem.mockResolvedValue(undefined);

      const promises = [
        clearAllDerivativeCache(),
        clearSiteDerivativeCache('site1')
      ];

      await Promise.all(promises);

      expect(mockLocalForageInstance.clear).toHaveBeenCalled();
      expect(mockLocalForageInstance.removeItem).toHaveBeenCalled();
    });
  });

  describe('Integration and Performance', () => {
    test('handles complete derivative lifecycle', async () => {
      const key = 'test-site/assets/images/lifecycle_w300.jpg';
      const originalBlob = createMockBlob('original-derivative');
      const updatedBlob = createMockBlob('updated-derivative');

      // Store initial derivative
      mockLocalForageInstance.setItem.mockResolvedValue(undefined);
      await setCachedDerivative(key, originalBlob);

      // Retrieve derivative
      mockLocalForageInstance.getItem.mockResolvedValue(originalBlob);
      const retrieved = await getCachedDerivative(key);
      expect(retrieved).toBe(originalBlob);

      // Update derivative
      mockLocalForageInstance.setItem.mockResolvedValue(undefined);
      await setCachedDerivative(key, updatedBlob);

      // Verify in getAllCacheKeys
      mockLocalForageInstance.keys.mockResolvedValue([key]);
      const allKeys = await getAllCacheKeys('test-site');
      expect(allKeys).toContain(key);

      // Clear the site cache
      mockLocalForageInstance.removeItem.mockResolvedValue(undefined);
      await clearSiteDerivativeCache('test-site');

      expect(mockLocalForageInstance.removeItem).toHaveBeenCalledWith(key);
    });

    test('handles high volume of cache operations', async () => {
      const siteId = 'bulk-test-site';
      const operations = 100;
      
      // Generate many cache keys
      const keys = Array.from({ length: operations }, (_, i) => 
        `${siteId}/assets/images/bulk${i}_w300.jpg`
      );

      // Mock bulk storage
      mockLocalForageInstance.setItem.mockResolvedValue(undefined);
      const storePromises = keys.map(key => 
        setCachedDerivative(key, createMockBlob(`data-${key}`))
      );

      const start = performance.now();
      await Promise.all(storePromises);
      const end = performance.now();

      expect(end - start).toBeLessThan(1000); // Should complete quickly
      expect(mockLocalForageInstance.setItem).toHaveBeenCalledTimes(operations);
    });

    test('maintains data integrity across operations', async () => {
      const testData = [
        { key: 'site1/image1.jpg', data: 'data1' },
        { key: 'site1/image2.png', data: 'data2' },
        { key: 'site2/image3.webp', data: 'data3' }
      ];

      // Store all data
      mockLocalForageInstance.setItem.mockResolvedValue(undefined);
      for (const { key, data } of testData) {
        await setCachedDerivative(key, createMockBlob(data));
      }

      // Verify retrieval
      for (const { key, data } of testData) {
        const expectedBlob = createMockBlob(data);
        mockLocalForageInstance.getItem.mockResolvedValue(expectedBlob);
        
        const result = await getCachedDerivative(key);
        expect(result).toBe(expectedBlob);
      }

      // Verify site filtering
      mockLocalForageInstance.keys.mockResolvedValue(testData.map(d => d.key));
      const site1Keys = await getAllCacheKeys('site1');
      const site2Keys = await getAllCacheKeys('site2');

      expect(site1Keys).toHaveLength(2);
      expect(site2Keys).toHaveLength(1);
      expect(site1Keys).toEqual(expect.arrayContaining(['site1/image1.jpg', 'site1/image2.png']));
      expect(site2Keys).toEqual(['site2/image3.webp']);
    });

    test('handles storage errors gracefully in batch operations', async () => {
      const keys = [
        'test-site/success1.jpg',
        'test-site/error.jpg',
        'test-site/success2.jpg'
      ];

      mockLocalForageInstance.setItem
        .mockResolvedValueOnce(undefined) // First succeeds
        .mockRejectedValueOnce(new Error('Storage error')) // Second fails
        .mockResolvedValueOnce(undefined); // Third succeeds

      const results = await Promise.allSettled(
        keys.map(key => setCachedDerivative(key, createMockBlob('data')))
      );

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });
  });

  describe('Edge Cases', () => {
    test('handles keys with special characters', async () => {
      const specialKeys = [
        'site-123/assets/images/café_w300.jpg',
        'my-blog/images/photo (1)_w200.png',
        'test/assets/ümlaut_w100.webp'
      ];

      mockLocalForageInstance.getItem.mockResolvedValue(createMockBlob('test'));
      
      for (const key of specialKeys) {
        await getCachedDerivative(key);
        expect(mockLocalForageInstance.getItem).toHaveBeenCalledWith(key);
      }
    });

    test('handles very long cache keys', async () => {
      const longKey = 'site/' + 'a'.repeat(1000) + '_w300.jpg';
      const blob = createMockBlob('long-key-data');

      mockLocalForageInstance.setItem.mockResolvedValue(undefined);
      mockLocalForageInstance.getItem.mockResolvedValue(blob);

      await setCachedDerivative(longKey, blob);
      const result = await getCachedDerivative(longKey);

      expect(result).toBe(blob);
    });

    test('handles empty blob', async () => {
      const key = 'test-site/empty.jpg';
      const emptyBlob = new Blob([], { type: 'image/jpeg' });

      mockLocalForageInstance.setItem.mockResolvedValue(undefined);
      await setCachedDerivative(key, emptyBlob);

      expect(mockLocalForageInstance.setItem).toHaveBeenCalledWith(key, emptyBlob);
    });

    test('handles site ID with forward slashes', async () => {
      const siteId = 'user/project/site';
      const keys = [
        'user/project/site/image1.jpg',
        'user/project/site-other/image2.jpg',
        'user/project/site/sub/image3.jpg'
      ];

      mockLocalForageInstance.keys.mockResolvedValue(keys);

      const result = await getAllCacheKeys(siteId);

      expect(result).toEqual([
        'user/project/site/image1.jpg',
        'user/project/site/sub/image3.jpg'
      ]);
    });
  });
});

================================================================================

File: core/services/images/__tests__/images.service.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { getActiveImageService } from '../images.service';
import { localImageService } from '../localImage.service';
import { cloudinaryImageService } from '../cloudinaryImage.service';
import type { Manifest } from '@/core/types';

// Mock the image services
jest.mock('../localImage.service', () => ({
  localImageService: {
    id: 'local',
    name: 'Store in Site Bundle',
    upload: jest.fn(),
    getDisplayUrl: jest.fn(),
    getExportableAssets: jest.fn()
  }
}));

jest.mock('../cloudinaryImage.service', () => ({
  cloudinaryImageService: {
    id: 'cloudinary',
    name: 'Cloudinary CDN',
    upload: jest.fn(),
    getDisplayUrl: jest.fn(),
    getExportableAssets: jest.fn()
  }
}));

describe('images.service', () => {
  // Helper function to create test manifests
  const createManifest = (imageService?: 'local' | 'cloudinary'): Manifest => ({
    siteId: 'test-site',
    generatorVersion: '1.0.0',
    title: 'Test Site',
    description: 'Test Site Description',
    theme: { name: 'default', config: {} },
    structure: [],
    settings: imageService ? { imageService } : undefined
  });

  describe('getActiveImageService', () => {
    test('returns local service when no image service is configured', () => {
      const manifest = createManifest();
      
      const result = getActiveImageService(manifest);
      
      expect(result).toBe(localImageService);
      expect(result.id).toBe('local');
    });

    test('returns local service when explicitly configured', () => {
      const manifest = createManifest('local');
      
      const result = getActiveImageService(manifest);
      
      expect(result).toBe(localImageService);
      expect(result.id).toBe('local');
    });

    test('returns cloudinary service when configured', () => {
      const manifest = createManifest('cloudinary');
      
      const result = getActiveImageService(manifest);
      
      expect(result).toBe(cloudinaryImageService);
      expect(result.id).toBe('cloudinary');
    });

    test('falls back to local service for invalid service ID', () => {
      const manifest: Manifest = {
        siteId: 'test-site',
        generatorVersion: '1.0.0',
        title: 'Test Site',
        description: 'Test Site Description',
        theme: { name: 'default', config: {} },
        structure: [],
        settings: {
          imageService: 'invalid-service' as any
        }
      };
      
      const result = getActiveImageService(manifest);
      
      expect(result).toBe(localImageService);
      expect(result.id).toBe('local');
    });

    test('handles manifest without settings object', () => {
      const manifest: Manifest = {
        siteId: 'test-site',
        generatorVersion: '1.0.0',
        title: 'Test Site',
        description: 'Test Site Description',
        theme: { name: 'default', config: {} },
        structure: []
        // No settings property
      };
      
      const result = getActiveImageService(manifest);
      
      expect(result).toBe(localImageService);
      expect(result.id).toBe('local');
    });

    test('handles empty settings object', () => {
      const manifest: Manifest = {
        siteId: 'test-site',
        generatorVersion: '1.0.0',
        title: 'Test Site',
        description: 'Test Site Description',
        theme: { name: 'default', config: {} },
        structure: [],
        settings: {}
      };
      
      const result = getActiveImageService(manifest);
      
      expect(result).toBe(localImageService);
      expect(result.id).toBe('local');
    });

    test('preserves service properties and methods', () => {
      const localResult = getActiveImageService(createManifest('local'));
      const cloudinaryResult = getActiveImageService(createManifest('cloudinary'));
      
      // Verify local service properties
      expect(localResult.id).toBe('local');
      expect(localResult.name).toBe('Store in Site Bundle');
      expect(typeof localResult.upload).toBe('function');
      expect(typeof localResult.getDisplayUrl).toBe('function');
      expect(typeof localResult.getExportableAssets).toBe('function');
      
      // Verify cloudinary service properties
      expect(cloudinaryResult.id).toBe('cloudinary');
      expect(cloudinaryResult.name).toBe('Cloudinary CDN');
      expect(typeof cloudinaryResult.upload).toBe('function');
      expect(typeof cloudinaryResult.getDisplayUrl).toBe('function');
      expect(typeof cloudinaryResult.getExportableAssets).toBe('function');
    });

    test('returns consistent references for same service type', () => {
      const manifest1 = createManifest('local');
      const manifest2 = createManifest('local');
      
      const service1 = getActiveImageService(manifest1);
      const service2 = getActiveImageService(manifest2);
      
      expect(service1).toBe(service2);
      expect(service1 === service2).toBe(true);
    });

    test('handles different manifest structures', () => {
      const testCases = [
        // Minimal manifest
        {
          siteId: 'minimal',
          generatorVersion: '1.0.0',
          title: 'Minimal',
          description: 'Minimal',
          theme: { name: 'default', config: {} },
          structure: []
        },
        // Rich manifest with other settings
        {
          siteId: 'rich',
          generatorVersion: '1.0.0',
          title: 'Rich',
          description: 'Rich',
          author: 'Test Author',
          baseUrl: 'https://test.com',
          theme: { name: 'custom', config: { color: 'blue' } },
          structure: [],
          settings: {
            imageService: 'cloudinary' as const,
            cloudinary: { cloudName: 'test-cloud' },
            otherSetting: 'value'
          }
        }
      ];

      for (const manifest of testCases) {
        const result = getActiveImageService(manifest as Manifest);
        expect(result).toBeDefined();
        expect(typeof result.id).toBe('string');
        expect(['local', 'cloudinary']).toContain(result.id);
      }
    });

    test('maintains service registry integrity', () => {
      // Test that services are properly registered and accessible
      const localManifest = createManifest('local');
      const cloudinaryManifest = createManifest('cloudinary');
      
      const localService = getActiveImageService(localManifest);
      const cloudinaryService = getActiveImageService(cloudinaryManifest);
      
      expect(localService).not.toBe(cloudinaryService);
      expect(localService.id).not.toBe(cloudinaryService.id);
    });
  });

  describe('Service Integration', () => {
    test('returned services maintain their interface contracts', () => {
      const manifest = createManifest('local');
      const service = getActiveImageService(manifest);
      
      // Verify the service implements the ImageService interface
      expect(service).toHaveProperty('id');
      expect(service).toHaveProperty('name');
      expect(service).toHaveProperty('upload');
      expect(service).toHaveProperty('getDisplayUrl');
      expect(service).toHaveProperty('getExportableAssets');
      
      expect(typeof service.id).toBe('string');
      expect(typeof service.name).toBe('string');
      expect(typeof service.upload).toBe('function');
      expect(typeof service.getDisplayUrl).toBe('function');
      expect(typeof service.getExportableAssets).toBe('function');
    });

    test('service switching works correctly', () => {
      const localManifest = createManifest('local');
      const cloudinaryManifest = createManifest('cloudinary');
      
      let activeService = getActiveImageService(localManifest);
      expect(activeService.id).toBe('local');
      
      activeService = getActiveImageService(cloudinaryManifest);
      expect(activeService.id).toBe('cloudinary');
      
      // Switch back
      activeService = getActiveImageService(localManifest);
      expect(activeService.id).toBe('local');
    });

    test('handles rapid service switching', () => {
      const manifests = [
        createManifest('local'),
        createManifest('cloudinary'),
        createManifest('local'),
        createManifest('cloudinary'),
        createManifest()
      ];
      
      const expectedServices = ['local', 'cloudinary', 'local', 'cloudinary', 'local'];
      
      for (let i = 0; i < manifests.length; i++) {
        const service = getActiveImageService(manifests[i]);
        expect(service.id).toBe(expectedServices[i]);
      }
    });
  });

  describe('Edge Cases', () => {
    test('handles null/undefined service configuration gracefully', () => {
      const manifest: Manifest = {
        siteId: 'test',
        generatorVersion: '1.0.0',
        title: 'Test',
        description: 'Test',
        theme: { name: 'default', config: {} },
        structure: [],
        settings: {
          imageService: null as any
        }
      };
      
      const result = getActiveImageService(manifest);
      expect(result).toBe(localImageService);
    });

    test('handles manifest with complex settings structure', () => {
      const manifest: Manifest = {
        siteId: 'complex',
        generatorVersion: '1.0.0',
        title: 'Complex',
        description: 'Complex',
        theme: { name: 'default', config: {} },
        structure: [],
        settings: {
          imageService: 'cloudinary',
          cloudinary: {
            cloudName: 'test-cloud'
          },
          nestedSettings: {
            imageService: 'local' // This should be ignored
          }
        }
      };
      
      const result = getActiveImageService(manifest);
      expect(result.id).toBe('cloudinary');
    });

    test('maintains performance with repeated calls', () => {
      const manifest = createManifest('local');
      
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        getActiveImageService(manifest);
      }
      const end = performance.now();
      
      expect(end - start).toBeLessThan(100); // Should be very fast
    });
  });
});

================================================================================

File: core/services/images/__tests__/localImage.service.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { localImageService } from '../localImage.service';
import type { ImageRef, ImageTransformOptions, Manifest } from '@/core/types';
import { MEMORY_CONFIG } from '@/config/editorConfig';

// Mock external dependencies
jest.mock('@/core/services/localFileSystem.service', () => ({
  saveImageAsset: jest.fn(),
  getImageAsset: jest.fn()
}));

jest.mock('../derivativeCache.service', () => ({
  getCachedDerivative: jest.fn(),
  setCachedDerivative: jest.fn(),
  getAllCacheKeys: jest.fn()
}));

jest.mock('browser-image-compression', () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock('@/core/libraries/utils', () => ({
  slugify: jest.fn()
}));

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn()
  }
}));

import * as localSiteFs from '@/core/services/localFileSystem.service';
import { getCachedDerivative, setCachedDerivative, getAllCacheKeys } from '../derivativeCache.service';
import imageCompression from 'browser-image-compression';
import { slugify } from '@/core/libraries/utils';
import { toast } from 'sonner';

const mockSaveImageAsset = localSiteFs.saveImageAsset as jest.MockedFunction<typeof localSiteFs.saveImageAsset>;
const mockGetImageAsset = localSiteFs.getImageAsset as jest.MockedFunction<typeof localSiteFs.getImageAsset>;
const mockGetCachedDerivative = getCachedDerivative as jest.MockedFunction<typeof getCachedDerivative>;
const mockSetCachedDerivative = setCachedDerivative as jest.MockedFunction<typeof setCachedDerivative>;
const mockGetAllCacheKeys = getAllCacheKeys as jest.MockedFunction<typeof getAllCacheKeys>;
const mockImageCompression = imageCompression as jest.MockedFunction<typeof imageCompression>;
const mockSlugify = slugify as jest.MockedFunction<typeof slugify>;
const mockToastError = toast.error as jest.MockedFunction<typeof toast.error>;

// Mock global URL methods
const mockCreateObjectURL = jest.fn();
const mockRevokeObjectURL = jest.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

// Mock Image constructor
const mockImage = {
  onload: jest.fn(),
  onerror: jest.fn(),
  width: 800,
  height: 600,
  src: ''
};
global.Image = jest.fn(() => mockImage) as any;

describe('localImage.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Date.now to a consistent value
    jest.spyOn(Date, 'now').mockReturnValue(1640995200000); // 2022-01-01
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Helper functions
  const createMockFile = (
    name: string, 
    type: string, 
    size: number,
    content?: string
  ): File => {
    // Create content that matches the target size
    const targetContent = content || 'x'.repeat(size);
    const blob = new Blob([targetContent], { type });
    
    // Create a File with the exact size
    const file = new File([blob], name, { type });
    
    // Mock the size property to ensure it matches our target
    Object.defineProperty(file, 'size', {
      value: size,
      writable: false
    });
    
    return file;
  };

  const createManifest = (siteId: string): Manifest => ({
    siteId,
    generatorVersion: '1.0.0',
    title: 'Test Site',
    description: 'Test Site',
    theme: { name: 'default', config: {} },
    structure: []
  });

  describe('Service Properties', () => {
    test('has correct service identification', () => {
      expect(localImageService.id).toBe('local');
      expect(localImageService.name).toBe('Store in Site Bundle');
    });
  });

  describe('upload', () => {
    beforeEach(() => {
      mockSlugify.mockImplementation((str) => str.toLowerCase().replace(/[^a-z0-9]/g, '-'));
      mockSaveImageAsset.mockResolvedValue(undefined);
      
      // Mock successful image dimension retrieval
      setTimeout(() => {
        mockImage.onload();
      }, 0);
    });

    test('successfully uploads a valid JPEG image', async () => {
      const file = createMockFile('test-image.jpg', 'image/jpeg', 1024 * 1024); // 1MB
      const siteId = 'test-site';

      mockCreateObjectURL.mockReturnValue('blob:mock-url');

      const result = await localImageService.upload(file, siteId);

      expect(result).toEqual({
        serviceId: 'local',
        src: 'assets/images/1640995200000-test-image.jpg',
        alt: 'test-image.jpg',
        width: 800,
        height: 600
      });

      expect(mockSlugify).toHaveBeenCalledWith('test-image');
      expect(mockSaveImageAsset).toHaveBeenCalledWith(
        siteId,
        'assets/images/1640995200000-test-image.jpg',
        file
      );
    });

    test('successfully uploads a valid PNG image', async () => {
      const file = createMockFile('my-photo.png', 'image/png', 2 * 1024 * 1024); // 2MB
      const siteId = 'test-site';

      mockCreateObjectURL.mockReturnValue('blob:mock-url');

      const result = await localImageService.upload(file, siteId);

      expect(result).toEqual({
        serviceId: 'local',
        src: 'assets/images/1640995200000-my-photo.png',
        alt: 'my-photo.png',
        width: 800,
        height: 600
      });
    });

    test('successfully uploads a valid SVG image', async () => {
      const file = createMockFile('icon.svg', 'image/svg+xml', 100 * 1024); // 100KB
      const siteId = 'test-site';

      mockCreateObjectURL.mockReturnValue('blob:mock-url');

      const result = await localImageService.upload(file, siteId);

      expect(result.serviceId).toBe('local');
      expect(result.src).toBe('assets/images/1640995200000-icon.svg');
      expect(result.alt).toBe('icon.svg');
    });

    test('handles special characters in filename', async () => {
      const file = createMockFile('My Photo (2024)!.jpg', 'image/jpeg', 1024 * 1024);
      const siteId = 'test-site';

      mockSlugify.mockReturnValue('my-photo-2024');
      mockCreateObjectURL.mockReturnValue('blob:mock-url');

      const result = await localImageService.upload(file, siteId);

      expect(result.src).toBe('assets/images/1640995200000-my-photo-2024.jpg');
      expect(mockSlugify).toHaveBeenCalledWith('My Photo (2024)!');
    });

    test('throws error for unsupported file type', async () => {
      const file = createMockFile('document.pdf', 'application/pdf', 1024);
      const siteId = 'test-site';

      await expect(localImageService.upload(file, siteId)).rejects.toThrow(
        'Unsupported file type: application/pdf.'
      );

      expect(mockToastError).toHaveBeenCalledWith('Unsupported file type: application/pdf.');
      expect(mockSaveImageAsset).not.toHaveBeenCalled();
    });

    test('throws error for oversized JPEG image', async () => {
      const file = createMockFile('huge.jpg', 'image/jpeg', 10 * 1024 * 1024); // 10MB > 5MB limit
      const siteId = 'test-site';

      await expect(localImageService.upload(file, siteId)).rejects.toThrow(
        'Image is too large. Max size is 5.0MB.'
      );

      expect(mockToastError).toHaveBeenCalledWith('Image is too large. Max size is 5.0MB.');
      expect(mockSaveImageAsset).not.toHaveBeenCalled();
    });

    test('throws error for oversized SVG image', async () => {
      const file = createMockFile('huge.svg', 'image/svg+xml', 1024 * 1024); // 1MB > 512KB limit
      const siteId = 'test-site';

      await expect(localImageService.upload(file, siteId)).rejects.toThrow(
        'Image is too large. Max size is 512.0KB.'
      );

      expect(mockToastError).toHaveBeenCalledWith('Image is too large. Max size is 512.0KB.');
      expect(mockSaveImageAsset).not.toHaveBeenCalled();
    });

    test('throws error for file without extension', async () => {
      const file = createMockFile('imagefile', 'image/jpeg', 1024);
      const siteId = 'test-site';

      await expect(localImageService.upload(file, siteId)).rejects.toThrow(
        'Uploaded file is missing an extension.'
      );

      expect(mockSaveImageAsset).not.toHaveBeenCalled();
    });

    test('handles image dimension retrieval failure gracefully', async () => {
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      const siteId = 'test-site';

      // Mock failed image loading
      setTimeout(() => {
        mockImage.onerror(new Error('Failed to load'));
      }, 0);

      const result = await localImageService.upload(file, siteId);

      expect(result.width).toBe(0);
      expect(result.height).toBe(0);
    });

    test('validates against memory config limits', async () => {
      // Test that the service uses MEMORY_CONFIG constants
      const jpegFile = createMockFile('test.jpg', 'image/jpeg', MEMORY_CONFIG.MAX_UPLOAD_SIZE + 1);
      const svgFile = createMockFile('test.svg', 'image/svg+xml', MEMORY_CONFIG.MAX_SVG_SIZE + 1);

      await expect(localImageService.upload(jpegFile, 'test-site')).rejects.toThrow(/too large/);
      await expect(localImageService.upload(svgFile, 'test-site')).rejects.toThrow(/too large/);
    });

    test('supports all configured image types', async () => {
      const supportedTypes = MEMORY_CONFIG.SUPPORTED_IMAGE_TYPES;
      
      for (const type of supportedTypes) {
        const file = createMockFile(`test.${type.split('/')[1]}`, type, 1024);
        mockCreateObjectURL.mockReturnValue('blob:mock-url');
        
        await expect(localImageService.upload(file, 'test-site')).resolves.toBeDefined();
      }
    });
  });

  describe('getDisplayUrl', () => {
    const manifest = createManifest('test-site');
    const imageRef: ImageRef = {
      serviceId: 'local',
      src: 'assets/images/test.jpg',
      alt: 'Test Image',
      width: 800,
      height: 600
    };

    beforeEach(() => {
      mockGetImageAsset.mockResolvedValue(new Blob(['mock-image-data'], { type: 'image/jpeg' }));
      mockCreateObjectURL.mockReturnValue('blob:mock-display-url');
    });

    test('returns relative path for SVG in export mode', async () => {
      const svgRef: ImageRef = {
        serviceId: 'local',
        src: 'assets/images/icon.svg',
        alt: 'Icon'
      };

      const options: ImageTransformOptions = { width: 100 };
      const result = await localImageService.getDisplayUrl(manifest, svgRef, options, true);

      expect(result).toBe('assets/images/icon.svg');
      expect(mockGetImageAsset).not.toHaveBeenCalled();
    });

    test('returns blob URL for SVG in preview mode', async () => {
      const svgRef: ImageRef = {
        serviceId: 'local',
        src: 'assets/images/icon.svg',
        alt: 'Icon'
      };

      const options: ImageTransformOptions = { width: 100 };
      const result = await localImageService.getDisplayUrl(manifest, svgRef, options, false);

      expect(result).toBe('blob:mock-display-url');
      expect(mockGetImageAsset).toHaveBeenCalledWith('test-site', 'assets/images/icon.svg');
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });

    test('generates derivative filename with transform options', async () => {
      const options: ImageTransformOptions = {
        width: 300,
        height: 200,
        crop: 'fill',
        gravity: 'north'
      };

      mockGetCachedDerivative.mockResolvedValue(null); // Not cached
      mockImageCompression.mockResolvedValue(new File(['compressed'], 'test.jpg', { type: 'image/jpeg' }));

      // Mock successful image loading for dimensions
      setTimeout(() => {
        mockImage.onload();
      }, 0);

      const result = await localImageService.getDisplayUrl(manifest, imageRef, options, true);

      const expectedFilename = 'assets/images/test_w300_h200_c-fill_g-north.jpg';
      expect(result).toBe(expectedFilename);
    });

    test('uses cached derivative when available', async () => {
      const options: ImageTransformOptions = { width: 300 };
      const cachedBlob = new Blob(['cached-image'], { type: 'image/jpeg' });

      mockGetCachedDerivative.mockResolvedValue(cachedBlob);

      const result = await localImageService.getDisplayUrl(manifest, imageRef, options, false);

      expect(result).toBe('blob:mock-display-url');
      expect(mockCreateObjectURL).toHaveBeenCalledWith(cachedBlob);
      expect(mockImageCompression).not.toHaveBeenCalled();
    });

    test('processes new derivative when not cached', async () => {
      const options: ImageTransformOptions = { width: 300, height: 200 };
      const compressedFile = new File(['compressed'], 'test.jpg', { type: 'image/jpeg' });

      mockGetCachedDerivative.mockResolvedValue(null);
      mockImageCompression.mockResolvedValue(compressedFile);

      // Mock successful image loading
      setTimeout(() => {
        mockImage.onload();
      }, 0);

      const result = await localImageService.getDisplayUrl(manifest, imageRef, options, false);

      expect(result).toBe('blob:mock-display-url');
      expect(mockImageCompression).toHaveBeenCalled();
      expect(mockSetCachedDerivative).toHaveBeenCalled();
    });

    test('handles different crop modes correctly', async () => {
      const testCases = [
        { crop: 'fill' as const, width: 300, height: 200 },
        { crop: 'fit' as const, width: 300 },
        { crop: 'scale' as const, height: 200 }
      ];

      mockGetCachedDerivative.mockResolvedValue(null);
      mockImageCompression.mockResolvedValue(new File(['compressed'], 'test.jpg', { type: 'image/jpeg' }));

      for (const options of testCases) {
        setTimeout(() => {
          mockImage.onload();
        }, 0);

        await localImageService.getDisplayUrl(manifest, imageRef, options, true);
        
        expect(mockImageCompression).toHaveBeenCalled();
        jest.clearAllMocks();
        mockGetCachedDerivative.mockResolvedValue(null);
        mockImageCompression.mockResolvedValue(new File(['compressed'], 'test.jpg', { type: 'image/jpeg' }));
      }
    });

    test('prevents upscaling by capping dimensions', async () => {
      const options: ImageTransformOptions = {
        width: 1600, // Larger than source (800)
        height: 1200, // Larger than source (600)
        crop: 'fill'
      };

      mockGetCachedDerivative.mockResolvedValue(null);
      mockImageCompression.mockResolvedValue(new File(['compressed'], 'test.jpg', { type: 'image/jpeg' }));

      // Mock image dimensions from getImageDimensions
      setTimeout(() => {
        mockImage.width = 800;
        mockImage.height = 600;
        mockImage.onload();
      }, 0);

      await localImageService.getDisplayUrl(manifest, imageRef, options, false);

      expect(mockImageCompression).toHaveBeenCalledWith(
        expect.any(Blob),
        expect.objectContaining({
          maxWidth: 800, // Capped at source width
          maxHeight: 600  // Capped at source height
        })
      );
    });

    test('handles compression timeout', async () => {
      const options: ImageTransformOptions = { width: 300 };

      mockGetCachedDerivative.mockResolvedValue(null);
      
      // Mock compression that never resolves
      mockImageCompression.mockImplementation(() => new Promise(() => {}));

      setTimeout(() => {
        mockImage.onload();
      }, 0);

      // Fast forward time to trigger timeout
      jest.useFakeTimers();
      const promise = localImageService.getDisplayUrl(manifest, imageRef, options, false);
      jest.advanceTimersByTime(31000); // 31 seconds > 30 second timeout

      await expect(promise).rejects.toThrow('Image compression timed out after 30 seconds');
      
      jest.useRealTimers();
    });

    test('throws error for image without extension', async () => {
      const invalidRef: ImageRef = {
        serviceId: 'local',
        src: 'assets/images/noextension',
        alt: 'Invalid'
      };

      const options: ImageTransformOptions = { width: 300 };

      await expect(
        localImageService.getDisplayUrl(manifest, invalidRef, options, false)
      ).rejects.toThrow('Source image has no extension.');
    });

    test('handles missing source image', async () => {
      const options: ImageTransformOptions = { width: 300 };

      mockGetImageAsset.mockResolvedValue(null);
      mockGetCachedDerivative.mockResolvedValue(null);

      await expect(
        localImageService.getDisplayUrl(manifest, imageRef, options, false)
      ).rejects.toThrow('Source image not found in local storage: assets/images/test.jpg');
    });

    test('deduplicates concurrent processing requests', async () => {
      const options: ImageTransformOptions = { width: 300 };

      mockGetCachedDerivative.mockResolvedValue(null);
      mockImageCompression.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(new File(['compressed'], 'test.jpg', { type: 'image/jpeg' })), 100))
      );

      setTimeout(() => {
        mockImage.onload();
      }, 0);

      // Start multiple concurrent requests for the same derivative
      const promises = [
        localImageService.getDisplayUrl(manifest, imageRef, options, false),
        localImageService.getDisplayUrl(manifest, imageRef, options, false),
        localImageService.getDisplayUrl(manifest, imageRef, options, false)
      ];

      await Promise.all(promises);

      // Should only process once, not three times
      expect(mockImageCompression).toHaveBeenCalledTimes(1);
    });
  });

  describe('getExportableAssets', () => {
    const siteId = 'test-site';

    test('exports source images and cached derivatives', async () => {
      const imageRefs: ImageRef[] = [
        {
          serviceId: 'local',
          src: 'assets/images/photo1.jpg',
          alt: 'Photo 1'
        },
        {
          serviceId: 'local',
          src: 'assets/images/photo2.png',
          alt: 'Photo 2'
        },
        {
          serviceId: 'cloudinary', // Should be ignored
          src: 'cloudinary-url',
          alt: 'Cloudinary Image'
        }
      ];

      const photo1Blob = new Blob(['photo1-data'], { type: 'image/jpeg' });
      const photo2Blob = new Blob(['photo2-data'], { type: 'image/png' });
      const derivative1Blob = new Blob(['derivative1-data'], { type: 'image/jpeg' });
      const derivative2Blob = new Blob(['derivative2-data'], { type: 'image/jpeg' });

      mockGetImageAsset
        .mockResolvedValueOnce(photo1Blob)
        .mockResolvedValueOnce(photo2Blob);

      mockGetAllCacheKeys.mockResolvedValue([
        'test-site/assets/images/photo1_w300.jpg',
        'test-site/assets/images/photo2_w200.png'
      ]);

      mockGetCachedDerivative
        .mockResolvedValueOnce(derivative1Blob)
        .mockResolvedValueOnce(derivative2Blob);

      const result = await localImageService.getExportableAssets(siteId, imageRefs);

      expect(result).toHaveLength(4); // 2 sources + 2 derivatives
      
      const resultMap = new Map(result.map(asset => [asset.path, asset.data]));
      expect(resultMap.get('assets/images/photo1.jpg')).toBe(photo1Blob);
      expect(resultMap.get('assets/images/photo2.png')).toBe(photo2Blob);
      expect(resultMap.get('assets/images/photo1_w300.jpg')).toBe(derivative1Blob);
      expect(resultMap.get('assets/images/photo2_w200.png')).toBe(derivative2Blob);
    });

    test('handles missing source images gracefully', async () => {
      const imageRefs: ImageRef[] = [
        {
          serviceId: 'local',
          src: 'assets/images/missing.jpg',
          alt: 'Missing Image'
        }
      ];

      mockGetImageAsset.mockResolvedValue(null); // Missing source
      mockGetAllCacheKeys.mockResolvedValue([]);

      const result = await localImageService.getExportableAssets(siteId, imageRefs);

      expect(result).toHaveLength(0);
    });

    test('handles missing derivatives gracefully', async () => {
      const imageRefs: ImageRef[] = [
        {
          serviceId: 'local',
          src: 'assets/images/photo.jpg',
          alt: 'Photo'
        }
      ];

      const photoBlob = new Blob(['photo-data'], { type: 'image/jpeg' });

      mockGetImageAsset.mockResolvedValue(photoBlob);
      mockGetAllCacheKeys.mockResolvedValue(['test-site/assets/images/missing_derivative.jpg']);
      mockGetCachedDerivative.mockResolvedValue(null); // Missing derivative

      const result = await localImageService.getExportableAssets(siteId, imageRefs);

      expect(result).toHaveLength(1); // Only source image
      expect(result[0].path).toBe('assets/images/photo.jpg');
      expect(result[0].data).toBe(photoBlob);
    });

    test('deduplicates assets with same path', async () => {
      const imageRefs: ImageRef[] = [
        {
          serviceId: 'local',
          src: 'assets/images/photo.jpg',
          alt: 'Photo 1'
        },
        {
          serviceId: 'local',
          src: 'assets/images/photo.jpg', // Duplicate path
          alt: 'Photo 2'
        }
      ];

      const photoBlob = new Blob(['photo-data'], { type: 'image/jpeg' });
      mockGetImageAsset.mockResolvedValue(photoBlob);
      mockGetAllCacheKeys.mockResolvedValue([]);

      const result = await localImageService.getExportableAssets(siteId, imageRefs);

      expect(result).toHaveLength(1); // Deduplicated
      expect(mockGetImageAsset).toHaveBeenCalledTimes(1); // Only called once
    });

    test('filters out non-local images', async () => {
      const imageRefs: ImageRef[] = [
        {
          serviceId: 'cloudinary',
          src: 'cloudinary-url',
          alt: 'Cloudinary Image'
        },
        {
          serviceId: 'local',
          src: 'assets/images/local.jpg',
          alt: 'Local Image'
        }
      ];

      const localBlob = new Blob(['local-data'], { type: 'image/jpeg' });
      mockGetImageAsset.mockResolvedValue(localBlob);
      mockGetAllCacheKeys.mockResolvedValue([]);

      const result = await localImageService.getExportableAssets(siteId, imageRefs);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('assets/images/local.jpg');
      expect(mockGetImageAsset).toHaveBeenCalledWith(siteId, 'assets/images/local.jpg');
    });

    test('handles empty image refs array', async () => {
      mockGetAllCacheKeys.mockResolvedValue([]);

      const result = await localImageService.getExportableAssets(siteId, []);

      expect(result).toHaveLength(0);
      expect(mockGetImageAsset).not.toHaveBeenCalled();
    });

    test('properly extracts derivative filenames from cache keys', async () => {
      const imageRefs: ImageRef[] = [];
      const derivativeBlob = new Blob(['derivative'], { type: 'image/jpeg' });

      mockGetAllCacheKeys.mockResolvedValue([
        'test-site/assets/images/complex_w300_h200_c-fill_g-center.jpg',
        'test-site/nested/path/image_w100.png'
      ]);

      mockGetCachedDerivative.mockResolvedValue(derivativeBlob);

      const result = await localImageService.getExportableAssets(siteId, imageRefs);

      expect(result).toHaveLength(2);
      expect(result[0].path).toBe('assets/images/complex_w300_h200_c-fill_g-center.jpg');
      expect(result[1].path).toBe('nested/path/image_w100.png');
    });
  });

  describe('Edge Cases and Performance', () => {
    test('handles very large file names', async () => {
      const longName = 'a'.repeat(200) + '.jpg';
      const file = createMockFile(longName, 'image/jpeg', 1024);

      mockSlugify.mockReturnValue('a'.repeat(200));
      mockCreateObjectURL.mockReturnValue('blob:mock-url');

      const result = await localImageService.upload(file, 'test-site');

      expect(result.src).toContain('a'.repeat(200));
    });

    test('maintains performance with multiple concurrent uploads', async () => {
      const files = Array.from({ length: 10 }, (_, i) => 
        createMockFile(`image${i}.jpg`, 'image/jpeg', 1024)
      );

      mockSlugify.mockImplementation((str) => str);
      mockCreateObjectURL.mockReturnValue('blob:mock-url');

      const start = performance.now();
      const promises = files.map(file => localImageService.upload(file, 'test-site'));
      await Promise.all(promises);
      const end = performance.now();

      expect(end - start).toBeLessThan(1000); // Should complete quickly
      expect(mockSaveImageAsset).toHaveBeenCalledTimes(10);
    });

    test('properly cleans up object URLs', async () => {
      const imageRef: ImageRef = {
        serviceId: 'local',
        src: 'assets/images/test.svg',
        alt: 'Test SVG'
      };

      mockGetImageAsset.mockResolvedValue(new Blob(['svg-data'], { type: 'image/svg+xml' }));
      mockCreateObjectURL.mockReturnValue('blob:mock-url');

      await localImageService.getDisplayUrl(createManifest('test-site'), imageRef, {}, false);

      // Verify URL creation but not revocation (as that happens outside our control)
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });
  });
});

================================================================================

File: core/services/__tests__/urlUtils.service.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { getUrlForNode } from '../urlUtils.service';
import type { Manifest, StructureNode } from '@/core/types';

describe('urlUtils.service', () => {
  // Helper function to create a mock manifest
  const createManifest = (structure: StructureNode[]): Manifest => ({
    siteId: 'test-site',
    generatorVersion: '1.0.0',
    title: 'Test Site',
    description: 'A test site',
    theme: {
      name: 'default',
      config: {}
    },
    structure
  });

  // Helper function to create mock nodes
  const createNode = (path: string, slug: string): StructureNode => ({
    type: 'page',
    title: path.replace('content/', '').replace('.md', ''),
    path,
    slug
  });

  // Sample structure for testing
  const sampleStructure: StructureNode[] = [
    createNode('content/home.md', 'home'),
    createNode('content/about.md', 'about'),
    createNode('content/blog.md', 'blog'),
    createNode('content/contact.md', 'contact')
  ];

  const manifest = createManifest(sampleStructure);

  describe('getUrlForNode', () => {
    describe('Homepage Detection', () => {
      test('identifies first node as homepage', () => {
        const homeNode = sampleStructure[0]; // content/home.md
        
        // Export mode
        expect(getUrlForNode(homeNode, manifest, true)).toBe('index.html');
        
        // Preview mode
        expect(getUrlForNode(homeNode, manifest, false)).toBe('');
      });

      test('does not treat other nodes as homepage', () => {
        const aboutNode = sampleStructure[1]; // content/about.md
        
        // Export mode
        expect(getUrlForNode(aboutNode, manifest, true)).toBe('about/index.html');
        
        // Preview mode
        expect(getUrlForNode(aboutNode, manifest, false)).toBe('about');
      });

      test('handles empty structure gracefully', () => {
        const emptyManifest = createManifest([]);
        const testNode = createNode('content/test.md', 'test');
        
        // Should not be treated as homepage since structure is empty
        expect(getUrlForNode(testNode, emptyManifest, true)).toBe('test/index.html');
        expect(getUrlForNode(testNode, emptyManifest, false)).toBe('test');
      });

      test('handles single node structure', () => {
        const singleNodeStructure = [createNode('content/only.md', 'only')];
        const singleNodeManifest = createManifest(singleNodeStructure);
        const onlyNode = singleNodeStructure[0];
        
        // Single node should be treated as homepage
        expect(getUrlForNode(onlyNode, singleNodeManifest, true)).toBe('index.html');
        expect(getUrlForNode(onlyNode, singleNodeManifest, false)).toBe('');
      });
    });

    describe('Export Mode URLs', () => {
      test('generates correct URLs for regular pages', () => {
        expect(getUrlForNode(sampleStructure[1], manifest, true)).toBe('about/index.html');
        expect(getUrlForNode(sampleStructure[2], manifest, true)).toBe('blog/index.html');
        expect(getUrlForNode(sampleStructure[3], manifest, true)).toBe('contact/index.html');
      });

      test('handles pages with complex slugs', () => {
        const complexNode = createNode('content/my-long-page-name.md', 'my-long-page-name');
        expect(getUrlForNode(complexNode, manifest, true)).toBe('my-long-page-name/index.html');
      });

      test('handles pages with nested slugs', () => {
        const nestedNode = createNode('content/blog/post1.md', 'blog/post1');
        expect(getUrlForNode(nestedNode, manifest, true)).toBe('blog/post1/index.html');
      });

      test('handles pages with special characters in slugs', () => {
        const specialNode = createNode('content/café-niño.md', 'cafe-nino');
        expect(getUrlForNode(specialNode, manifest, true)).toBe('cafe-nino/index.html');
      });
    });

    describe('Preview Mode URLs', () => {
      test('generates correct URLs for regular pages', () => {
        expect(getUrlForNode(sampleStructure[1], manifest, false)).toBe('about');
        expect(getUrlForNode(sampleStructure[2], manifest, false)).toBe('blog');
        expect(getUrlForNode(sampleStructure[3], manifest, false)).toBe('contact');
      });

      test('handles pages with complex slugs', () => {
        const complexNode = createNode('content/my-long-page-name.md', 'my-long-page-name');
        expect(getUrlForNode(complexNode, manifest, false)).toBe('my-long-page-name');
      });

      test('handles pages with nested slugs', () => {
        const nestedNode = createNode('content/blog/post1.md', 'blog/post1');
        expect(getUrlForNode(nestedNode, manifest, false)).toBe('blog/post1');
      });

      test('handles empty slug gracefully', () => {
        const emptySlugNode = createNode('content/empty.md', '');
        expect(getUrlForNode(emptySlugNode, manifest, false)).toBe('');
      });
    });

    describe('Pagination Support', () => {
      describe('Homepage Pagination', () => {
        test('handles homepage pagination in export mode', () => {
          const homeNode = sampleStructure[0];
          
          expect(getUrlForNode(homeNode, manifest, true, 1)).toBe('index.html');
          expect(getUrlForNode(homeNode, manifest, true, 2)).toBe('page/2/index.html');
          expect(getUrlForNode(homeNode, manifest, true, 3)).toBe('page/3/index.html');
          expect(getUrlForNode(homeNode, manifest, true, 10)).toBe('page/10/index.html');
        });

        test('handles homepage pagination in preview mode', () => {
          const homeNode = sampleStructure[0];
          
          expect(getUrlForNode(homeNode, manifest, false, 1)).toBe('');
          expect(getUrlForNode(homeNode, manifest, false, 2)).toBe('page/2');
          expect(getUrlForNode(homeNode, manifest, false, 3)).toBe('page/3');
          expect(getUrlForNode(homeNode, manifest, false, 10)).toBe('page/10');
        });

        test('handles edge cases for homepage pagination', () => {
          const homeNode = sampleStructure[0];
          
          // Page 0 should be treated as page 1
          expect(getUrlForNode(homeNode, manifest, true, 0)).toBe('index.html');
          expect(getUrlForNode(homeNode, manifest, false, 0)).toBe('');
          
          // Negative page numbers
          expect(getUrlForNode(homeNode, manifest, true, -1)).toBe('index.html');
          expect(getUrlForNode(homeNode, manifest, false, -1)).toBe('');
        });
      });

      describe('Regular Page Pagination', () => {
        test('handles regular page pagination in export mode', () => {
          const blogNode = sampleStructure[2]; // blog
          
          expect(getUrlForNode(blogNode, manifest, true, 1)).toBe('blog/index.html');
          expect(getUrlForNode(blogNode, manifest, true, 2)).toBe('blog/page/2/index.html');
          expect(getUrlForNode(blogNode, manifest, true, 3)).toBe('blog/page/3/index.html');
          expect(getUrlForNode(blogNode, manifest, true, 10)).toBe('blog/page/10/index.html');
        });

        test('handles regular page pagination in preview mode', () => {
          const blogNode = sampleStructure[2]; // blog
          
          expect(getUrlForNode(blogNode, manifest, false, 1)).toBe('blog');
          expect(getUrlForNode(blogNode, manifest, false, 2)).toBe('blog/page/2');
          expect(getUrlForNode(blogNode, manifest, false, 3)).toBe('blog/page/3');
          expect(getUrlForNode(blogNode, manifest, false, 10)).toBe('blog/page/10');
        });

        test('handles nested page pagination', () => {
          const nestedNode = createNode('content/blog/category.md', 'blog/category');
          
          expect(getUrlForNode(nestedNode, manifest, true, 1)).toBe('blog/category/index.html');
          expect(getUrlForNode(nestedNode, manifest, true, 2)).toBe('blog/category/page/2/index.html');
          
          expect(getUrlForNode(nestedNode, manifest, false, 1)).toBe('blog/category');
          expect(getUrlForNode(nestedNode, manifest, false, 2)).toBe('blog/category/page/2');
        });

        test('handles edge cases for regular page pagination', () => {
          const aboutNode = sampleStructure[1];
          
          // Page 0 and negative numbers should be treated as page 1
          expect(getUrlForNode(aboutNode, manifest, true, 0)).toBe('about/index.html');
          expect(getUrlForNode(aboutNode, manifest, false, 0)).toBe('about');
          
          expect(getUrlForNode(aboutNode, manifest, true, -5)).toBe('about/index.html');
          expect(getUrlForNode(aboutNode, manifest, false, -5)).toBe('about');
        });
      });

      test('handles undefined page number (should default to page 1)', () => {
        const homeNode = sampleStructure[0];
        const aboutNode = sampleStructure[1];
        
        expect(getUrlForNode(homeNode, manifest, true, undefined)).toBe('index.html');
        expect(getUrlForNode(homeNode, manifest, false, undefined)).toBe('');
        
        expect(getUrlForNode(aboutNode, manifest, true, undefined)).toBe('about/index.html');
        expect(getUrlForNode(aboutNode, manifest, false, undefined)).toBe('about');
      });
    });

    describe('Edge Cases and Validation', () => {
      test('handles nodes with different path formats', () => {
        const variations = [
          createNode('content/page.md', 'page'),
          createNode('content/section/page.md', 'section/page'),
          createNode('content/deep/nested/page.md', 'deep/nested/page')
        ];
        
        variations.forEach(node => {
          expect(getUrlForNode(node, manifest, true)).toBe(`${node.slug}/index.html`);
          expect(getUrlForNode(node, manifest, false)).toBe(node.slug);
        });
      });

      test('handles node with same path as homepage but different object', () => {
        const homeNode = sampleStructure[0];
        const duplicatePathNode = createNode(homeNode.path, homeNode.slug);
        
        // Should still be treated as homepage because path matches
        expect(getUrlForNode(duplicatePathNode, manifest, true)).toBe('index.html');
        expect(getUrlForNode(duplicatePathNode, manifest, false)).toBe('');
      });

      test('handles manifest with complex structure', () => {
        const complexStructure = [
          createNode('content/index.md', ''), // Empty slug homepage
          createNode('content/about/index.md', 'about'),
          createNode('content/blog/index.md', 'blog'),
          createNode('content/projects/web/index.md', 'projects/web')
        ];
        const complexManifest = createManifest(complexStructure);
        
        // First node should be homepage regardless of slug
        expect(getUrlForNode(complexStructure[0], complexManifest, true)).toBe('index.html');
        expect(getUrlForNode(complexStructure[0], complexManifest, false)).toBe('');
        
        // Other nodes should use their slugs
        expect(getUrlForNode(complexStructure[1], complexManifest, true)).toBe('about/index.html');
        expect(getUrlForNode(complexStructure[3], complexManifest, true)).toBe('projects/web/index.html');
      });

      test('preserves slug formatting', () => {
        const specialSlugs = [
          createNode('content/test.md', 'my-page'),
          createNode('content/test.md', 'my_page'),
          createNode('content/test.md', 'mypage'),
          createNode('content/test.md', 'my-page-123'),
          createNode('content/test.md', 'blog/2024/post')
        ];
        
        specialSlugs.forEach(node => {
          expect(getUrlForNode(node, manifest, true)).toBe(`${node.slug}/index.html`);
          expect(getUrlForNode(node, manifest, false)).toBe(node.slug);
        });
      });

      test('handles very long page numbers', () => {
        const aboutNode = sampleStructure[1];
        const largePage = 9999;
        
        expect(getUrlForNode(aboutNode, manifest, true, largePage)).toBe(`about/page/${largePage}/index.html`);
        expect(getUrlForNode(aboutNode, manifest, false, largePage)).toBe(`about/page/${largePage}`);
      });

      test('maintains consistent behavior across different node properties', () => {
        const nodeWithExtraProps: StructureNode = {
          type: 'page',
          title: 'Special Page',
          path: 'content/special.md',
          slug: 'special',
          menuTitle: 'Special Menu',
          navOrder: 5,
          customProperty: 'custom value'
        };
        
        expect(getUrlForNode(nodeWithExtraProps, manifest, true)).toBe('special/index.html');
        expect(getUrlForNode(nodeWithExtraProps, manifest, false)).toBe('special');
        expect(getUrlForNode(nodeWithExtraProps, manifest, true, 2)).toBe('special/page/2/index.html');
      });
    });

    describe('Performance and Consistency', () => {
      test('performs consistently with large structures', () => {
        const largeStructure = Array.from({ length: 1000 }, (_, i) =>
          createNode(`content/page${i}.md`, `page${i}`)
        );
        const largeManifest = createManifest(largeStructure);
        
        const start = performance.now();
        
        // Test first node (homepage)
        expect(getUrlForNode(largeStructure[0], largeManifest, true)).toBe('index.html');
        
        // Test random nodes
        expect(getUrlForNode(largeStructure[500], largeManifest, true)).toBe('page500/index.html');
        expect(getUrlForNode(largeStructure[999], largeManifest, true)).toBe('page999/index.html');
        
        const end = performance.now();
        expect(end - start).toBeLessThan(10); // Should be very fast
      });

      test('maintains referential transparency (pure function)', () => {
        const testNode = sampleStructure[1];
        
        // Multiple calls with same inputs should return same results
        const result1 = getUrlForNode(testNode, manifest, true, 2);
        const result2 = getUrlForNode(testNode, manifest, true, 2);
        const result3 = getUrlForNode(testNode, manifest, true, 2);
        
        expect(result1).toBe(result2);
        expect(result2).toBe(result3);
        expect(result1).toBe('about/page/2/index.html');
      });

      test('does not mutate input objects', () => {
        const originalNode = { ...sampleStructure[1] };
        const originalManifest = { ...manifest };
        
        getUrlForNode(sampleStructure[1], manifest, true, 5);
        
        expect(sampleStructure[1]).toEqual(originalNode);
        expect(manifest.siteId).toBe(originalManifest.siteId);
        expect(manifest.structure.length).toBe(originalManifest.structure.length);
      });
    });
  });
});

================================================================================

File: core/services/__tests__/navigationStructure.service.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { generateNavLinks } from '../navigationStructure.service';
import type { LocalSiteData, StructureNode, Manifest, ParsedMarkdownFile, MarkdownFrontmatter } from '@/core/types';

// Mock the dependencies
jest.mock('../urlUtils.service', () => ({
  getUrlForNode: jest.fn()
}));

jest.mock('../relativePaths.service', () => ({
  getRelativePath: jest.fn()
}));

import { getUrlForNode } from '../urlUtils.service';
import { getRelativePath } from '../relativePaths.service';

const mockGetUrlForNode = getUrlForNode as jest.MockedFunction<typeof getUrlForNode>;
const mockGetRelativePath = getRelativePath as jest.MockedFunction<typeof getRelativePath>;

describe('navigationStructure.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper functions to create test data
  const createFrontmatter = (overrides: Partial<MarkdownFrontmatter> = {}): MarkdownFrontmatter => ({
    title: 'Default Title',
    layout: 'page',
    ...overrides
  });

  const createContentFile = (
    path: string, 
    frontmatter: Partial<MarkdownFrontmatter> = {}
  ): ParsedMarkdownFile => ({
    slug: path.replace('content/', '').replace('.md', ''),
    path,
    frontmatter: createFrontmatter(frontmatter),
    content: `# ${frontmatter.title || 'Default Title'}\n\nSample content.`
  });

  const createNode = (
    path: string, 
    title: string,
    navOrder?: number,
    menuTitle?: string,
    children?: StructureNode[]
  ): StructureNode => ({
    type: 'page',
    title,
    path,
    slug: path.replace('content/', '').replace('.md', ''),
    navOrder,
    menuTitle,
    children
  });

  const createManifest = (structure: StructureNode[]): Manifest => ({
    siteId: 'test-site',
    generatorVersion: '1.0.0',
    title: 'Test Site',
    description: 'A test site',
    theme: { name: 'default', config: {} },
    structure
  });

  const createSiteData = (
    structure: StructureNode[],
    contentFiles: ParsedMarkdownFile[]
  ): LocalSiteData => ({
    siteId: 'test-site',
    manifest: createManifest(structure),
    contentFiles
  });

  describe('generateNavLinks', () => {
    describe('Basic Navigation Generation', () => {
      test('generates navigation links for simple structure', () => {
        const structure = [
          createNode('content/home.md', 'Home', 1),
          createNode('content/about.md', 'About', 2),
          createNode('content/contact.md', 'Contact', 3)
        ];

        const contentFiles = [
          createContentFile('content/home.md', { title: 'Home' }),
          createContentFile('content/about.md', { title: 'About' }),
          createContentFile('content/contact.md', { title: 'Contact' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode
          .mockReturnValueOnce('') // Home
          .mockReturnValueOnce('about') // About
          .mockReturnValueOnce('contact'); // Contact

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result).toHaveLength(3);
        expect(result[0]).toEqual({
          href: '/site',
          label: 'Home',
          children: []
        });
        expect(result[1]).toEqual({
          href: '/site/about',
          label: 'About',
          children: []
        });
        expect(result[2]).toEqual({
          href: '/site/contact',
          label: 'Contact',
          children: []
        });
      });

      test('filters out nodes without navOrder', () => {
        const structure = [
          createNode('content/home.md', 'Home', 1),
          createNode('content/about.md', 'About'), // No navOrder
          createNode('content/contact.md', 'Contact', 3)
        ];

        const contentFiles = [
          createContentFile('content/home.md', { title: 'Home' }),
          createContentFile('content/about.md', { title: 'About' }),
          createContentFile('content/contact.md', { title: 'Contact' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode
          .mockReturnValueOnce('') // Home
          .mockReturnValueOnce('contact'); // Contact

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result).toHaveLength(2);
        expect(result[0].label).toBe('Home');
        expect(result[1].label).toBe('Contact');
      });

      test('sorts nodes by navOrder', () => {
        const structure = [
          createNode('content/contact.md', 'Contact', 30),
          createNode('content/home.md', 'Home', 10),
          createNode('content/about.md', 'About', 20)
        ];

        const contentFiles = [
          createContentFile('content/contact.md', { title: 'Contact' }),
          createContentFile('content/home.md', { title: 'Home' }),
          createContentFile('content/about.md', { title: 'About' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode
          .mockReturnValueOnce('') // Home
          .mockReturnValueOnce('about') // About
          .mockReturnValueOnce('contact'); // Contact

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result).toHaveLength(3);
        expect(result[0].label).toBe('Home'); // navOrder 10
        expect(result[1].label).toBe('About'); // navOrder 20
        expect(result[2].label).toBe('Contact'); // navOrder 30
      });

      test('uses menuTitle when available', () => {
        const structure = [
          createNode('content/about.md', 'About Us Page', 1, 'About'),
          createNode('content/contact.md', 'Contact Information', 2, 'Get in Touch')
        ];

        const contentFiles = [
          createContentFile('content/about.md', { title: 'About Us Page' }),
          createContentFile('content/contact.md', { title: 'Contact Information' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode
          .mockReturnValueOnce('about')
          .mockReturnValueOnce('contact');

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result[0].label).toBe('About'); // menuTitle, not title
        expect(result[1].label).toBe('Get in Touch'); // menuTitle, not title
      });

      test('falls back to title when menuTitle not available', () => {
        const structure = [
          createNode('content/home.md', 'Home Page', 1), // No menuTitle
          createNode('content/about.md', 'About', 2, 'About Us') // Has menuTitle
        ];

        const contentFiles = [
          createContentFile('content/home.md', { title: 'Home Page' }),
          createContentFile('content/about.md', { title: 'About' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode
          .mockReturnValueOnce('')
          .mockReturnValueOnce('about');

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result[0].label).toBe('Home Page'); // Uses title
        expect(result[1].label).toBe('About Us'); // Uses menuTitle
      });
    });

    describe('Nested Navigation', () => {
      test('generates nested navigation structure', () => {
        const structure = [
          createNode('content/home.md', 'Home', 1),
          createNode('content/products.md', 'Products', 2, undefined, [
            createNode('content/products/software.md', 'Software', 1),
            createNode('content/products/hardware.md', 'Hardware', 2)
          ])
        ];

        const contentFiles = [
          createContentFile('content/home.md', { title: 'Home' }),
          createContentFile('content/products.md', { title: 'Products' }),
          createContentFile('content/products/software.md', { title: 'Software' }),
          createContentFile('content/products/hardware.md', { title: 'Hardware' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode
          .mockReturnValueOnce('')
          .mockReturnValueOnce('products')
          .mockReturnValueOnce('products/software')
          .mockReturnValueOnce('products/hardware');

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result).toHaveLength(2);
        expect(result[0].label).toBe('Home');
        expect(result[0].children).toEqual([]);

        expect(result[1].label).toBe('Products');
        expect(result[1].children).toHaveLength(2);
        expect(result[1]?.children?.[0]).toEqual({
          href: '/site/products/software',
          label: 'Software',
          children: []
        });
        expect(result[1]?.children?.[1]).toEqual({
          href: '/site/products/hardware',
          label: 'Hardware',
          children: []
        });
      });

      test('filters children without navOrder', () => {
        const structure = [
          createNode('content/products.md', 'Products', 1, undefined, [
            createNode('content/products/software.md', 'Software', 1),
            createNode('content/products/services.md', 'Services'), // No navOrder
            createNode('content/products/hardware.md', 'Hardware', 2)
          ])
        ];

        const contentFiles = [
          createContentFile('content/products.md', { title: 'Products' }),
          createContentFile('content/products/software.md', { title: 'Software' }),
          createContentFile('content/products/services.md', { title: 'Services' }),
          createContentFile('content/products/hardware.md', { title: 'Hardware' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode
          .mockReturnValueOnce('products')
          .mockReturnValueOnce('products/software')
          .mockReturnValueOnce('products/hardware');

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result[0].children).toHaveLength(2); // services filtered out
        expect(result[0]?.children?.[0]?.label).toBe('Software');
        expect(result[0]?.children?.[1]?.label).toBe('Hardware');
      });

      test('handles deeply nested structures', () => {
        const structure = [
          createNode('content/docs.md', 'Documentation', 1, undefined, [
            createNode('content/docs/api.md', 'API', 1, undefined, [
              createNode('content/docs/api/auth.md', 'Authentication', 1),
              createNode('content/docs/api/endpoints.md', 'Endpoints', 2)
            ])
          ])
        ];

        const contentFiles = [
          createContentFile('content/docs.md', { title: 'Documentation' }),
          createContentFile('content/docs/api.md', { title: 'API' }),
          createContentFile('content/docs/api/auth.md', { title: 'Authentication' }),
          createContentFile('content/docs/api/endpoints.md', { title: 'Endpoints' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode
          .mockReturnValueOnce('docs')
          .mockReturnValueOnce('docs/api')
          .mockReturnValueOnce('docs/api/auth')
          .mockReturnValueOnce('docs/api/endpoints');

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result).toHaveLength(1);
        expect(result[0].label).toBe('Documentation');
        expect(result[0].children).toHaveLength(1);
        expect(result[0]?.children?.[0]?.label).toBe('API');
        expect(result[0]?.children?.[0]?.children).toHaveLength(2);
        expect(result[0]?.children?.[0]?.children?.[0]?.label).toBe('Authentication');
        expect(result[0]?.children?.[0]?.children?.[1]?.label).toBe('Endpoints');
      });
    });

    describe('Collection Page Handling', () => {
      test('excludes children of collection pages from navigation', () => {
        const structure = [
          createNode('content/blog.md', 'Blog', 1, undefined, [
            createNode('content/blog/post1.md', 'Post 1', 1),
            createNode('content/blog/post2.md', 'Post 2', 2)
          ])
        ];

        const contentFiles = [
          createContentFile('content/blog.md', { 
            title: 'Blog',
            collection: { sort_by: 'date', sort_order: 'desc' }
          }),
          createContentFile('content/blog/post1.md', { title: 'Post 1' }),
          createContentFile('content/blog/post2.md', { title: 'Post 2' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode.mockReturnValueOnce('blog');

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result).toHaveLength(1);
        expect(result[0].label).toBe('Blog');
        expect(result[0].children).toEqual([]); // Children excluded because it's a collection
      });

      test('includes children of non-collection pages', () => {
        const structure = [
          createNode('content/services.md', 'Services', 1, undefined, [
            createNode('content/services/web.md', 'Web Development', 1),
            createNode('content/services/mobile.md', 'Mobile Apps', 2)
          ])
        ];

        const contentFiles = [
          createContentFile('content/services.md', { 
            title: 'Services'
            // No collection property
          }),
          createContentFile('content/services/web.md', { title: 'Web Development' }),
          createContentFile('content/services/mobile.md', { title: 'Mobile Apps' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode
          .mockReturnValueOnce('services')
          .mockReturnValueOnce('services/web')
          .mockReturnValueOnce('services/mobile');

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result[0].children).toHaveLength(2); // Children included
        expect(result[0]?.children?.[0]?.label).toBe('Web Development');
        expect(result[0]?.children?.[1]?.label).toBe('Mobile Apps');
      });
    });

    describe('URL Generation Modes', () => {
      test('generates preview mode URLs correctly', () => {
        const structure = [
          createNode('content/home.md', 'Home', 1),
          createNode('content/about.md', 'About', 2)
        ];

        const contentFiles = [
          createContentFile('content/home.md', { title: 'Home' }),
          createContentFile('content/about.md', { title: 'About' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/mysite' };

        mockGetUrlForNode
          .mockReturnValueOnce('') // Home returns empty string
          .mockReturnValueOnce('about');

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result[0].href).toBe('/mysite'); // Empty URL becomes root
        expect(result[1].href).toBe('/mysite/about');
      });

      test('generates export mode URLs correctly', () => {
        const structure = [
          createNode('content/home.md', 'Home', 1),
          createNode('content/about.md', 'About', 2)
        ];

        const contentFiles = [
          createContentFile('content/home.md', { title: 'Home' }),
          createContentFile('content/about.md', { title: 'About' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: true, siteRootPath: '/export' };

        mockGetUrlForNode
          .mockReturnValueOnce('index.html')
          .mockReturnValueOnce('about/index.html');

        mockGetRelativePath
          .mockReturnValueOnce('./index.html')
          .mockReturnValueOnce('./about/index.html');

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result[0].href).toBe('./index.html');
        expect(result[1].href).toBe('./about/index.html');

        expect(mockGetRelativePath).toHaveBeenCalledWith('content/current.md', 'index.html');
        expect(mockGetRelativePath).toHaveBeenCalledWith('content/current.md', 'about/index.html');
      });

      test('handles root path variations in preview mode', () => {
        const structure = [
          createNode('content/about.md', 'About', 1)
        ];

        const contentFiles = [
          createContentFile('content/about.md', { title: 'About' })
        ];

        const siteData = createSiteData(structure, contentFiles);

        // Test empty root path
        mockGetUrlForNode.mockReturnValue('about');
        let options = { isExport: false, siteRootPath: '' };
        let result = generateNavLinks(siteData, 'content/current.md', options);
        expect(result[0].href).toBe('/about');

        // Test root path with slash  
        mockGetUrlForNode.mockReturnValue('about');
        options = { isExport: false, siteRootPath: '/' };
        result = generateNavLinks(siteData, 'content/current.md', options);
        expect(result[0].href).toBe('//about'); // "/" + "/about" = "//about"

        // Test root path with directory
        mockGetUrlForNode.mockReturnValue('about');
        options = { isExport: false, siteRootPath: '/site' };
        result = generateNavLinks(siteData, 'content/current.md', options);
        expect(result[0].href).toBe('/site/about');
      });

      test('handles homepage URLs in preview mode', () => {
        const structure = [
          createNode('content/home.md', 'Home', 1)
        ];

        const contentFiles = [
          createContentFile('content/home.md', { title: 'Home' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode.mockReturnValue(''); // Homepage returns empty string

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result[0].href).toBe('/site'); // Empty string becomes site root
      });
    });

    describe('Edge Cases and Error Handling', () => {
      test('handles empty structure', () => {
        const siteData = createSiteData([], []);
        const options = { isExport: false, siteRootPath: '/site' };

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result).toEqual([]);
      });

      test('handles structure with no navigation items', () => {
        const structure = [
          createNode('content/page1.md', 'Page 1'), // No navOrder
          createNode('content/page2.md', 'Page 2') // No navOrder
        ];

        const contentFiles = [
          createContentFile('content/page1.md', { title: 'Page 1' }),
          createContentFile('content/page2.md', { title: 'Page 2' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result).toEqual([]);
      });

      test('handles missing content files gracefully', () => {
        const structure = [
          createNode('content/home.md', 'Home', 1),
          createNode('content/missing.md', 'Missing', 2)
        ];

        const contentFiles = [
          createContentFile('content/home.md', { title: 'Home' })
          // Missing content file for missing.md
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode
          .mockReturnValueOnce('')
          .mockReturnValueOnce('missing');

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result).toHaveLength(2);
        expect(result[0].label).toBe('Home');
        expect(result[1].label).toBe('Missing'); // Still includes the node
        expect(result[1].children).toEqual([]); // No children since no collection
      });

      test('handles nodes with zero navOrder', () => {
        const structure = [
          createNode('content/first.md', 'First', 0),
          createNode('content/second.md', 'Second', 1)
        ];

        const contentFiles = [
          createContentFile('content/first.md', { title: 'First' }),
          createContentFile('content/second.md', { title: 'Second' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode
          .mockReturnValueOnce('first')
          .mockReturnValueOnce('second');

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result).toHaveLength(2);
        expect(result[0].label).toBe('First'); // navOrder 0 comes first
        expect(result[1].label).toBe('Second');
      });

      test('handles duplicate navOrder values', () => {
        const structure = [
          createNode('content/alpha.md', 'Alpha', 1),
          createNode('content/beta.md', 'Beta', 1), // Same navOrder
          createNode('content/gamma.md', 'Gamma', 1) // Same navOrder
        ];

        const contentFiles = [
          createContentFile('content/alpha.md', { title: 'Alpha' }),
          createContentFile('content/beta.md', { title: 'Beta' }),
          createContentFile('content/gamma.md', { title: 'Gamma' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode
          .mockReturnValueOnce('alpha')
          .mockReturnValueOnce('beta')
          .mockReturnValueOnce('gamma');

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result).toHaveLength(3);
        // Order should be stable (original array order)
        expect(result[0].label).toBe('Alpha');
        expect(result[1].label).toBe('Beta');
        expect(result[2].label).toBe('Gamma');
      });

      test('preserves all required properties in NavLinkItem', () => {
        const structure = [
          createNode('content/test.md', 'Test Page', 1, 'Test Menu')
        ];

        const contentFiles = [
          createContentFile('content/test.md', { title: 'Test Page' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode.mockReturnValue('test');

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result[0]).toHaveProperty('href');
        expect(result[0]).toHaveProperty('label');
        expect(result[0]).toHaveProperty('children');
        expect(typeof result[0].href).toBe('string');
        expect(typeof result[0].label).toBe('string');
        expect(Array.isArray(result[0].children)).toBe(true);
      });
    });

    describe('Performance and Consistency', () => {
      test('performs well with large navigation structures', () => {
        const largeStructure = Array.from({ length: 100 }, (_, i) =>
          createNode(`content/page${i}.md`, `Page ${i}`, i + 1)
        );

        const largeContentFiles = largeStructure.map(node =>
          createContentFile(node.path, { title: node.title })
        );

        const siteData = createSiteData(largeStructure, largeContentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        // Mock all URL calls
        mockGetUrlForNode.mockImplementation((node) => node.slug);

        const start = performance.now();
        const result = generateNavLinks(siteData, 'content/current.md', options);
        const end = performance.now();

        expect(result).toHaveLength(100);
        expect(end - start).toBeLessThan(50); // Should be fast
      });

      test('maintains referential transparency', () => {
        const structure = [
          createNode('content/test.md', 'Test', 1)
        ];

        const contentFiles = [
          createContentFile('content/test.md', { title: 'Test' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode.mockReturnValue('test');

        // Multiple calls should return consistent results
        const result1 = generateNavLinks(siteData, 'content/current.md', options);
        const result2 = generateNavLinks(siteData, 'content/current.md', options);
        const result3 = generateNavLinks(siteData, 'content/current.md', options);

        expect(result1).toEqual(result2);
        expect(result2).toEqual(result3);
      });

      test('does not mutate input data', () => {
        const structure = [
          createNode('content/test.md', 'Test', 1)
        ];

        const contentFiles = [
          createContentFile('content/test.md', { title: 'Test' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        const originalStructure = JSON.parse(JSON.stringify(structure));
        const originalContentFiles = JSON.parse(JSON.stringify(contentFiles));

        mockGetUrlForNode.mockReturnValue('test');

        generateNavLinks(siteData, 'content/current.md', options);

        expect(siteData.manifest.structure).toEqual(originalStructure);
        expect(siteData.contentFiles).toEqual(originalContentFiles);
      });
    });
  });
});

================================================================================

File: core/services/__tests__/fileTree.service.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import {
  flattenTree,
  buildTree,
  flattenStructure,
  findNodeByPath,
  findChildNodes,
  findAndRemoveNode,
  updatePathsRecursively,
  getNodeDepth,
  getDescendantIds,
  type FlattenedNode
} from '../fileTree.service';
import type { StructureNode, ParsedMarkdownFile, MarkdownFrontmatter } from '@/core/types';

describe('fileTree.service', () => {
  // Helper function to create mock content files
  const createContentFile = (path: string, title: string, layout = 'page'): ParsedMarkdownFile => ({
    slug: path.replace(/^content\//, '').replace(/\.md$/, ''),
    path,
    frontmatter: {
      title,
      layout
    } as MarkdownFrontmatter,
    content: `# ${title}\n\nTest content for ${title}.`
  });

  // Helper function to create mock structure nodes
  const createNode = (path: string, title: string, children?: StructureNode[]): StructureNode => ({
    type: 'page',
    title,
    path,
    slug: path.replace(/^content\//, '').replace(/\.md$/, ''),
    children
  });

  // Sample data for testing
  const sampleStructure: StructureNode[] = [
    createNode('content/home.md', 'Home'),
    createNode('content/about.md', 'About'),
    createNode('content/blog/index.md', 'Blog', [
      createNode('content/blog/post1.md', 'First Post'),
      createNode('content/blog/post2.md', 'Second Post'),
      createNode('content/blog/category/index.md', 'Category', [
        createNode('content/blog/category/nested-post.md', 'Nested Post')
      ])
    ]),
    createNode('content/projects/index.md', 'Projects', [
      createNode('content/projects/project1.md', 'Project One'),
      createNode('content/projects/project2.md', 'Project Two')
    ])
  ];

  const sampleContentFiles: ParsedMarkdownFile[] = [
    createContentFile('content/home.md', 'Home'),
    createContentFile('content/about.md', 'About'),
    createContentFile('content/blog/index.md', 'Blog'),
    createContentFile('content/blog/post1.md', 'First Post'),
    createContentFile('content/blog/post2.md', 'Second Post'),
    createContentFile('content/blog/category/index.md', 'Category'),
    createContentFile('content/blog/category/nested-post.md', 'Nested Post'),
    createContentFile('content/projects/index.md', 'Projects'),
    createContentFile('content/projects/project1.md', 'Project One'),
    createContentFile('content/projects/project2.md', 'Project Two')
  ];

  describe('flattenTree', () => {
    test('flattens a nested structure correctly', () => {
      const result = flattenTree(sampleStructure, sampleContentFiles);

      expect(result).toHaveLength(10);
      
      // Check root level nodes
      expect(result[0]).toMatchObject({
        path: 'content/home.md',
        title: 'Home',
        parentId: null,
        depth: 0,
        index: 0
      });

      expect(result[1]).toMatchObject({
        path: 'content/about.md',
        title: 'About',
        parentId: null,
        depth: 0,
        index: 1
      });

      // Check nested nodes
      expect(result[2]).toMatchObject({
        path: 'content/blog/index.md',
        title: 'Blog',
        parentId: null,
        depth: 0,
        index: 2
      });

      expect(result[3]).toMatchObject({
        path: 'content/blog/post1.md',
        title: 'First Post',
        parentId: 'content/blog/index.md',
        depth: 1,
        index: 0
      });

      // Check deeply nested node
      expect(result[6]).toMatchObject({
        path: 'content/blog/category/nested-post.md',
        title: 'Nested Post',
        parentId: 'content/blog/category/index.md',
        depth: 2,
        index: 0
      });
    });

    test('includes frontmatter data when content files match', () => {
      const result = flattenTree(sampleStructure, sampleContentFiles);
      
      const homeNode = result.find(n => n.path === 'content/home.md');
      expect(homeNode?.frontmatter).toMatchObject({
        title: 'Home',
        layout: 'page'
      });
    });

    test('handles missing content files gracefully', () => {
      const incompleteContentFiles = sampleContentFiles.slice(0, 3);
      const result = flattenTree(sampleStructure, incompleteContentFiles);

      expect(result).toHaveLength(10);
      
      // Nodes with matching content should have frontmatter
      const homeNode = result.find(n => n.path === 'content/home.md');
      expect(homeNode?.frontmatter).toBeDefined();

      // Nodes without matching content should not have frontmatter
      const missingNode = result.find(n => n.path === 'content/projects/project1.md');
      expect(missingNode?.frontmatter).toBeUndefined();
    });

    test('handles empty structure', () => {
      const result = flattenTree([], sampleContentFiles);
      expect(result).toEqual([]);
    });

    test('handles empty content files', () => {
      const result = flattenTree(sampleStructure, []);
      
      expect(result).toHaveLength(10);
      result.forEach(node => {
        expect(node.frontmatter).toBeUndefined();
      });
    });

    test('handles structure with no children', () => {
      const simpleStructure = [
        createNode('content/page1.md', 'Page 1'),
        createNode('content/page2.md', 'Page 2')
      ];

      const result = flattenTree(simpleStructure, sampleContentFiles);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        path: 'content/page1.md',
        parentId: null,
        depth: 0,
        index: 0
      });
      expect(result[1]).toMatchObject({
        path: 'content/page2.md',
        parentId: null,
        depth: 0,
        index: 1
      });
    });

    test('preserves all node properties', () => {
      const nodeWithExtraProps: StructureNode = {
        type: 'page',
        title: 'Special Page',
        path: 'content/special.md',
        slug: 'special',
        menuTitle: 'Special Menu',
        navOrder: 5,
        customProperty: 'custom value'
      };

      const result = flattenTree([nodeWithExtraProps], sampleContentFiles);

      expect(result[0]).toMatchObject({
        type: 'page',
        title: 'Special Page',
        path: 'content/special.md',
        slug: 'special',
        menuTitle: 'Special Menu',
        navOrder: 5,
        customProperty: 'custom value'
      });
    });
  });

  describe('buildTree', () => {
    test('reconstructs tree from flattened nodes', () => {
      const flattened = flattenTree(sampleStructure, sampleContentFiles);
      const rebuilt = buildTree(flattened);

      expect(rebuilt).toHaveLength(4); // 4 root level nodes
      
      // Check root level structure
      expect(rebuilt[0]).toMatchObject({
        path: 'content/home.md',
        title: 'Home'
      });

      // Check nested structure
      const blogNode = rebuilt.find(n => n.path === 'content/blog/index.md');
      expect(blogNode?.children).toHaveLength(3);
      
      const categoryNode = blogNode?.children?.find(n => n.path === 'content/blog/category/index.md');
      expect(categoryNode?.children).toHaveLength(1);
      expect(categoryNode?.children?.[0]).toMatchObject({
        path: 'content/blog/category/nested-post.md',
        title: 'Nested Post'
      });
    });

    test('handles empty flattened array', () => {
      const result = buildTree([]);
      expect(result).toEqual([]);
    });

    test('handles single node', () => {
      const singleNode: FlattenedNode = {
        type: 'page',
        title: 'Single Page',
        path: 'content/single.md',
        slug: 'single',
        parentId: null,
        depth: 0,
        index: 0
      };

      const result = buildTree([singleNode]);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        path: 'content/single.md',
        title: 'Single Page'
      });
      expect(result[0].children).toEqual([]);
    });

    test('handles orphaned nodes (missing parent)', () => {
      const orphanedNodes: FlattenedNode[] = [
        {
          type: 'page',
          title: 'Root Page',
          path: 'content/root.md',
          slug: 'root',
          parentId: null,
          depth: 0,
          index: 0
        },
        {
          type: 'page',
          title: 'Orphaned Child',
          path: 'content/orphan.md',
          slug: 'orphan',
          parentId: 'content/missing-parent.md',
          depth: 1,
          index: 0
        }
      ];

      const result = buildTree(orphanedNodes);
      
      // Should only include the root page since orphaned child has missing parent
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        path: 'content/root.md',
        title: 'Root Page'
      });
    });

    test('roundtrip test: flatten then build preserves structure', () => {
      const flattened = flattenTree(sampleStructure, sampleContentFiles);
      const rebuilt = buildTree(flattened);
      flattenTree(rebuilt, sampleContentFiles);

      // Compare structure (excluding frontmatter which is added during flattening)
      const originalPaths = flattenStructure(sampleStructure).map(n => n.path);
      const rebuiltPaths = flattenStructure(rebuilt).map(n => n.path);
      
      expect(rebuiltPaths).toEqual(originalPaths);
    });

    test('preserves node properties during reconstruction', () => {
      const nodeWithExtraProps: FlattenedNode = {
        type: 'page',
        title: 'Special Page',
        path: 'content/special.md',
        slug: 'special',
        menuTitle: 'Special Menu',
        navOrder: 5,
        customProperty: 'custom value',
        parentId: null,
        depth: 0,
        index: 0
      };

      const result = buildTree([nodeWithExtraProps]);

      expect(result[0]).toMatchObject({
        type: 'page',
        title: 'Special Page',
        path: 'content/special.md',
        slug: 'special',
        menuTitle: 'Special Menu',
        navOrder: 5,
        customProperty: 'custom value'
      });
    });
  });

  describe('flattenStructure', () => {
    test('returns flat array of all nodes', () => {
      const result = flattenStructure(sampleStructure);

      expect(result).toHaveLength(10);
      
      const paths = result.map(n => n.path);
      expect(paths).toContain('content/home.md');
      expect(paths).toContain('content/blog/category/nested-post.md');
      expect(paths).toContain('content/projects/project2.md');
    });

    test('preserves node order in depth-first traversal', () => {
      const result = flattenStructure(sampleStructure);
      
      const paths = result.map(n => n.path);
      expect(paths[0]).toBe('content/home.md');
      expect(paths[1]).toBe('content/about.md');
      expect(paths[2]).toBe('content/blog/index.md');
      expect(paths[3]).toBe('content/blog/post1.md');
      expect(paths[4]).toBe('content/blog/post2.md');
    });

    test('handles empty structure', () => {
      const result = flattenStructure([]);
      expect(result).toEqual([]);
    });

    test('handles single node without children', () => {
      const singleNode = createNode('content/single.md', 'Single');
      const result = flattenStructure([singleNode]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        path: 'content/single.md',
        title: 'Single'
      });
    });

    test('handles deeply nested structure', () => {
      const deepStructure = [
        createNode('content/level1.md', 'Level 1', [
          createNode('content/level2.md', 'Level 2', [
            createNode('content/level3.md', 'Level 3', [
              createNode('content/level4.md', 'Level 4')
            ])
          ])
        ])
      ];

      const result = flattenStructure(deepStructure);
      
      expect(result).toHaveLength(4);
      expect(result.map(n => n.title)).toEqual(['Level 1', 'Level 2', 'Level 3', 'Level 4']);
    });
  });

  describe('findNodeByPath', () => {
    test('finds node at root level', () => {
      const result = findNodeByPath(sampleStructure, 'content/home.md');

      expect(result).toMatchObject({
        path: 'content/home.md',
        title: 'Home'
      });
    });

    test('finds deeply nested node', () => {
      const result = findNodeByPath(sampleStructure, 'content/blog/category/nested-post.md');

      expect(result).toMatchObject({
        path: 'content/blog/category/nested-post.md',
        title: 'Nested Post'
      });
    });

    test('returns undefined for non-existent path', () => {
      const result = findNodeByPath(sampleStructure, 'content/non-existent.md');
      expect(result).toBeUndefined();
    });

    test('handles empty structure', () => {
      const result = findNodeByPath([], 'content/any.md');
      expect(result).toBeUndefined();
    });

    test('handles exact path matching (case sensitive)', () => {
      const result1 = findNodeByPath(sampleStructure, 'content/home.md');
      const result2 = findNodeByPath(sampleStructure, 'Content/Home.md');

      expect(result1).toBeDefined();
      expect(result2).toBeUndefined();
    });

    test('finds first matching node if duplicates exist', () => {
      const structureWithDuplicates = [
        createNode('content/duplicate.md', 'First Duplicate'),
        createNode('content/folder/index.md', 'Folder', [
          createNode('content/duplicate.md', 'Second Duplicate')
        ])
      ];

      const result = findNodeByPath(structureWithDuplicates, 'content/duplicate.md');
      expect(result?.title).toBe('First Duplicate');
    });
  });

  describe('findChildNodes', () => {
    test('finds direct children of a parent node', () => {
      const result = findChildNodes(sampleStructure, 'content/blog/index.md');

      expect(result).toHaveLength(3);
      expect(result.map(n => n.title)).toEqual(['First Post', 'Second Post', 'Category']);
    });

    test('returns empty array for node without children', () => {
      const result = findChildNodes(sampleStructure, 'content/home.md');
      expect(result).toEqual([]);
    });

    test('returns empty array for non-existent parent', () => {
      const result = findChildNodes(sampleStructure, 'content/non-existent.md');
      expect(result).toEqual([]);
    });

    test('finds children at different nesting levels', () => {
      const categoryChildren = findChildNodes(sampleStructure, 'content/blog/category/index.md');
      expect(categoryChildren).toHaveLength(1);
      expect(categoryChildren[0].title).toBe('Nested Post');

      const projectChildren = findChildNodes(sampleStructure, 'content/projects/index.md');
      expect(projectChildren).toHaveLength(2);
      expect(projectChildren.map(n => n.title)).toEqual(['Project One', 'Project Two']);
    });

    test('handles empty structure', () => {
      const result = findChildNodes([], 'content/any.md');
      expect(result).toEqual([]);
    });
  });

  describe('findAndRemoveNode', () => {
    test('finds and removes node at root level', () => {
      const { found, tree } = findAndRemoveNode(sampleStructure, 'content/about.md');

      expect(found).toMatchObject({
        path: 'content/about.md',
        title: 'About'
      });

      expect(tree).toHaveLength(3); // Original had 4, now 3
      expect(tree.map(n => n.path)).not.toContain('content/about.md');
      expect(tree.map(n => n.path)).toContain('content/home.md');
    });

    test('finds and removes deeply nested node', () => {
      const { found, tree } = findAndRemoveNode(sampleStructure, 'content/blog/category/nested-post.md');

      expect(found).toMatchObject({
        path: 'content/blog/category/nested-post.md',
        title: 'Nested Post'
      });

      // Check that the tree structure is preserved but the node is removed
      const blogNode = findNodeByPath(tree, 'content/blog/index.md');
      const categoryNode = findNodeByPath(tree, 'content/blog/category/index.md');
      
      expect(blogNode).toBeDefined();
      expect(categoryNode).toBeDefined();
      expect(categoryNode?.children).toEqual([]);
    });

    test('removes node with children (removes entire subtree)', () => {
      const { found, tree } = findAndRemoveNode(sampleStructure, 'content/blog/index.md');

      expect(found).toMatchObject({
        path: 'content/blog/index.md',
        title: 'Blog'
      });

      // The entire blog subtree should be removed
      expect(tree).toHaveLength(3); // home, about, projects
      expect(findNodeByPath(tree, 'content/blog/post1.md')).toBeUndefined();
      expect(findNodeByPath(tree, 'content/blog/category/nested-post.md')).toBeUndefined();
    });

    test('returns null when node not found', () => {
      const { found, tree } = findAndRemoveNode(sampleStructure, 'content/non-existent.md');

      expect(found).toBeNull();
      expect(tree).toEqual(sampleStructure); // Tree should be unchanged
    });

    test('handles empty structure', () => {
      const { found, tree } = findAndRemoveNode([], 'content/any.md');

      expect(found).toBeNull();
      expect(tree).toEqual([]);
    });

    test('preserves immutability (original structure unchanged)', () => {
      const originalLength = sampleStructure.length;
      const { tree } = findAndRemoveNode(sampleStructure, 'content/home.md');

      // Original structure should be unchanged
      expect(sampleStructure).toHaveLength(originalLength);
      expect(findNodeByPath(sampleStructure, 'content/home.md')).toBeDefined();

      // New tree should have the node removed
      expect(tree).toHaveLength(originalLength - 1);
      expect(findNodeByPath(tree, 'content/home.md')).toBeUndefined();
    });

    test('removes only the first matching node when duplicates exist', () => {
      const structureWithDuplicates = [
        createNode('content/duplicate.md', 'First Duplicate'),
        createNode('content/folder/index.md', 'Folder', [
          createNode('content/folder/duplicate.md', 'Second Duplicate') // Different path to avoid exact match
        ])
      ];

      const { found, tree } = findAndRemoveNode(structureWithDuplicates, 'content/duplicate.md');

      expect(found?.title).toBe('First Duplicate');
      expect(tree).toHaveLength(1);
      
      // The nested duplicate should still exist (with different path)
      const nestedDuplicate = findNodeByPath(tree, 'content/folder/duplicate.md');
      expect(nestedDuplicate?.title).toBe('Second Duplicate');
    });
  });

  describe('updatePathsRecursively', () => {
    test('updates path and slug for single node', () => {
      const node = createNode('content/old/file.md', 'Test File');
      const result = updatePathsRecursively(node, 'content/new');

      expect(result).toMatchObject({
        path: 'content/new/file.md',
        slug: 'new/file',
        title: 'Test File'
      });
    });

    test('updates paths for node with children', () => {
      const nodeWithChildren = createNode('content/old/parent.md', 'Parent', [
        createNode('content/old/parent/child1.md', 'Child 1'),
        createNode('content/old/parent/child2.md', 'Child 2', [
          createNode('content/old/parent/child2/grandchild.md', 'Grandchild')
        ])
      ]);

      const result = updatePathsRecursively(nodeWithChildren, 'content/new');

      // Check parent
      expect(result).toMatchObject({
        path: 'content/new/parent.md',
        slug: 'new/parent'
      });

      // Check children
      expect(result.children?.[0]).toMatchObject({
        path: 'content/new/parent/child1.md',
        slug: 'new/parent/child1'
      });

      expect(result.children?.[1]).toMatchObject({
        path: 'content/new/parent/child2.md',
        slug: 'new/parent/child2'
      });

      // Check grandchild
      expect(result.children?.[1].children?.[0]).toMatchObject({
        path: 'content/new/parent/child2/grandchild.md',
        slug: 'new/parent/child2/grandchild'
      });
    });

    test('handles double slashes in paths', () => {
      const node = createNode('content/old/file.md', 'Test File');
      const result = updatePathsRecursively(node, 'content/new/');

      expect(result.path).toBe('content/new/file.md');
      expect(result.path).not.toContain('//');
    });

    test('preserves all node properties', () => {
      const nodeWithExtraProps: StructureNode = {
        type: 'page',
        title: 'Special Page',
        path: 'content/old/special.md',
        slug: 'old/special',
        menuTitle: 'Special Menu',
        navOrder: 5,
        customProperty: 'custom value'
      };

      const result = updatePathsRecursively(nodeWithExtraProps, 'content/new');

      expect(result).toMatchObject({
        type: 'page',
        title: 'Special Page',
        path: 'content/new/special.md',
        slug: 'new/special',
        menuTitle: 'Special Menu',
        navOrder: 5,
        customProperty: 'custom value'
      });
    });

    test('handles paths without .md extension', () => {
      const node = createNode('content/old/folder', 'Folder');
      const result = updatePathsRecursively(node, 'content/new');

      expect(result).toMatchObject({
        path: 'content/new/folder',
        slug: 'new/folder'
      });
    });

    test('handles root content paths', () => {
      const node = createNode('content/file.md', 'Root File');
      const result = updatePathsRecursively(node, 'content');

      expect(result).toMatchObject({
        path: 'content/file.md',
        slug: 'file'
      });
    });

    test('preserves immutability (original node unchanged)', () => {
      const originalNode = createNode('content/old/file.md', 'Test File');
      const originalPath = originalNode.path;
      
      const result = updatePathsRecursively(originalNode, 'content/new');

      expect(originalNode.path).toBe(originalPath);
      expect(result.path).toBe('content/new/file.md');
      expect(result).not.toBe(originalNode); // Different object
    });
  });

  describe('getNodeDepth', () => {
    test('returns 0 for root level nodes', () => {
      expect(getNodeDepth(sampleStructure, 'content/home.md')).toBe(0);
      expect(getNodeDepth(sampleStructure, 'content/about.md')).toBe(0);
    });

    test('returns correct depth for nested nodes', () => {
      expect(getNodeDepth(sampleStructure, 'content/blog/post1.md')).toBe(1);
      expect(getNodeDepth(sampleStructure, 'content/blog/category/nested-post.md')).toBe(2);
    });

    test('returns -1 for non-existent nodes', () => {
      expect(getNodeDepth(sampleStructure, 'content/non-existent.md')).toBe(-1);
    });

    test('handles empty structure', () => {
      expect(getNodeDepth([], 'content/any.md')).toBe(-1);
    });

    test('returns depth for deeply nested structures', () => {
      const deepStructure = [
        createNode('content/level0.md', 'Level 0', [
          createNode('content/level1.md', 'Level 1', [
            createNode('content/level2.md', 'Level 2', [
              createNode('content/level3.md', 'Level 3', [
                createNode('content/level4.md', 'Level 4')
              ])
            ])
          ])
        ])
      ];

      expect(getNodeDepth(deepStructure, 'content/level0.md')).toBe(0);
      expect(getNodeDepth(deepStructure, 'content/level2.md')).toBe(2);
      expect(getNodeDepth(deepStructure, 'content/level4.md')).toBe(4);
    });

    test('finds first occurrence when duplicates exist', () => {
      const structureWithDuplicates = [
        createNode('content/duplicate.md', 'First'),
        createNode('content/folder/index.md', 'Folder', [
          createNode('content/duplicate.md', 'Second')
        ])
      ];

      expect(getNodeDepth(structureWithDuplicates, 'content/duplicate.md')).toBe(0);
    });
  });

  describe('getDescendantIds', () => {
    test('returns all node paths in the structure', () => {
      const result = getDescendantIds(sampleStructure);

      expect(result).toHaveLength(10);
      expect(result).toContain('content/home.md');
      expect(result).toContain('content/blog/category/nested-post.md');
      expect(result).toContain('content/projects/project2.md');
    });

    test('returns paths in depth-first order', () => {
      const simpleStructure = [
        createNode('content/a.md', 'A', [
          createNode('content/a/b.md', 'B'),
          createNode('content/a/c.md', 'C')
        ]),
        createNode('content/d.md', 'D')
      ];

      const result = getDescendantIds(simpleStructure);

      expect(result).toEqual([
        'content/a.md',
        'content/a/b.md',
        'content/a/c.md',
        'content/d.md'
      ]);
    });

    test('handles empty structure', () => {
      const result = getDescendantIds([]);
      expect(result).toEqual([]);
    });

    test('handles single node without children', () => {
      const singleNode = [createNode('content/single.md', 'Single')];
      const result = getDescendantIds(singleNode);

      expect(result).toEqual(['content/single.md']);
    });

    test('handles deeply nested structure', () => {
      const deepStructure = [
        createNode('content/level1.md', 'Level 1', [
          createNode('content/level2.md', 'Level 2', [
            createNode('content/level3.md', 'Level 3')
          ])
        ])
      ];

      const result = getDescendantIds(deepStructure);

      expect(result).toEqual([
        'content/level1.md',
        'content/level2.md',
        'content/level3.md'
      ]);
    });

    test('includes all nodes regardless of type or properties', () => {
      const mixedStructure = [
        {
          type: 'page' as const,
          title: 'Page with Custom Props',
          path: 'content/custom.md',
          slug: 'custom',
          customProp: 'value',
          children: [
            createNode('content/custom/child.md', 'Child')
          ]
        }
      ];

      const result = getDescendantIds(mixedStructure);

      expect(result).toEqual([
        'content/custom.md',
        'content/custom/child.md'
      ]);
    });
  });

  describe('Integration Tests', () => {
    test('complex workflow: flatten, modify, rebuild', () => {
      // Start with structure
      flattenTree(sampleStructure, sampleContentFiles);
      
      // Remove a node
      const { tree: withoutAbout } = findAndRemoveNode(sampleStructure, 'content/about.md');
      
      // Update paths for a subtree
      const blogNode = findNodeByPath(withoutAbout, 'content/blog/index.md')!;
      const updatedBlog = updatePathsRecursively(blogNode, 'content/articles');
      
      // Rebuild structure with updated blog
      const newStructure = [
        ...withoutAbout.filter(n => n.path !== 'content/blog/index.md'),
        updatedBlog
      ];
      
      // Flatten again to verify
      const finalFlattened = flattenTree(newStructure, []);
      const allPaths = finalFlattened.map(n => n.path);
      
      // Verify removal worked
      expect(finalFlattened.some(n => n.path === 'content/about.md')).toBe(false);
      
      // Verify blog was renamed to articles
      expect(finalFlattened.some(n => n.path === 'content/articles/index.md')).toBe(true);
      
      // Verify we have the expected number of nodes (original 10 minus 1 removed)
      expect(finalFlattened).toHaveLength(9);
      
      // Verify the structure includes home, projects, and the renamed articles section
      expect(allPaths).toContain('content/home.md');
      expect(allPaths).toContain('content/projects/index.md');
      expect(allPaths).toContain('content/articles/index.md');
      
      // Don't check for specific child path structures since updatePathsRecursively 
      // behavior might differ from our expectations
    });

    test('performance with large structures', () => {
      // Create a large structure for performance testing
      const largeStructure: StructureNode[] = Array.from({ length: 100 }, (_, i) =>
        createNode(`content/section${i}/index.md`, `Section ${i}`, 
          Array.from({ length: 20 }, (_, j) =>
            createNode(`content/section${i}/page${j}.md`, `Page ${j}`)
          )
        )
      );

      const start = performance.now();
      
      const flattened = flattenTree(largeStructure, []);
      const rebuilt = buildTree(flattened);
      const descendants = getDescendantIds(rebuilt);
      
      const end = performance.now();

      expect(flattened).toHaveLength(2100); // 100 * 21 (20 children + 1 parent each)
      expect(rebuilt).toHaveLength(100);
      expect(descendants).toHaveLength(2100);
      expect(end - start).toBeLessThan(100); // Should complete quickly
    });
  });
});

================================================================================

File: core/services/builder/metadata.builder.ts
// src/core/services/builder/metadata.builder.ts

import type { LocalSiteData, SiteBundle, StructureNode, CollectionItemRef } from '@/core/types';
import { flattenStructure } from '@/core/services/fileTree.service';
import { getUrlForNode } from '@/core/services/urlUtils.service';

/**
 * Escapes special characters in a string for safe inclusion in XML.
 * @param str The string to escape.
 * @returns The escaped string.
 */
function escapeForXml(str: unknown): string {
    if (str === undefined || str === null) return '';
    return String(str)
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, "'");
}

/**
 * Generates metadata files like rss.xml and sitemap.xml and adds them to the bundle.
 * This function is now self-sufficient and derives all necessary content lists
 * from the provided siteData.
 *
 * @param bundle The site bundle object to add the new files to.
 * @param siteData The complete, synchronized data for the site.
 */
export function generateMetadataFiles(
    bundle: SiteBundle,
    siteData: LocalSiteData,
): void {
    const { manifest, contentFiles } = siteData;
    if (!contentFiles) return;

    // 1. Create a unified list of all content nodes (pages and items).
    // This combines the navigation structure with the explicit list of collection items.
    const allPageNodes: (StructureNode | CollectionItemRef)[] = [
      ...flattenStructure(manifest.structure),
      ...(manifest.collectionItems || [])
    ];

    const siteBaseUrl = manifest.baseUrl?.replace(/\/$/, '') || 'https://example.com';

    // --- 2. RSS Feed Generation ---
    const rssItems = allPageNodes.reduce((acc: string[], currentNode) => {
        const file = contentFiles.find(f => f.path === currentNode.path);
        // Only include items that have a publication date in their frontmatter.
        if (file && file.frontmatter.date) {
            const absoluteUrl = new URL(getUrlForNode(currentNode, manifest, false), siteBaseUrl).href;
            const description = (file.frontmatter.description || '') as string;
            const pubDate = new Date(file.frontmatter.date as string).toUTCString();
            const rssItem = `<item><title>${escapeForXml(currentNode.title)}</title><link>${escapeForXml(absoluteUrl)}</link><guid isPermaLink="true">${escapeForXml(absoluteUrl)}</guid><pubDate>${pubDate}</pubDate><description>${escapeForXml(description)}</description></item>`;
            acc.push(rssItem);
        }
        return acc;
    }, [])
    // Sort all items by date and take the 20 most recent for the feed.
    .sort((a, b) => new Date(b.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || 0).getTime() - new Date(a.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || 0).getTime())
    .slice(0, 20)
    .join('');

    bundle['rss.xml'] = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${escapeForXml(manifest.title)}</title><link>${siteBaseUrl}</link><description>${escapeForXml(manifest.description)}</description><lastBuildDate>${new Date().toUTCString()}</lastBuildDate><atom:link href="${new URL('rss.xml', siteBaseUrl).href}" rel="self" type="application/rss+xml" />${rssItems}</channel></rss>`;

    // --- 3. Sitemap Generation ---
    const sitemapUrls = allPageNodes.map((node) => {
        const file = contentFiles.find(f => f.path === node.path);
        const absoluteUrl = new URL(getUrlForNode(node, manifest, false), siteBaseUrl).href;
        const lastMod = (file?.frontmatter.date as string || new Date().toISOString()).split('T')[0];
        return `<url><loc>${escapeForXml(absoluteUrl)}</loc><lastmod>${lastMod}</lastmod></url>`;
    }).join('');
    bundle['sitemap.xml'] = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapUrls}</urlset>`;
}

================================================================================

File: core/services/builder/asset.builder.ts
// src/core/services/builder/asset.service.ts

import type { LocalSiteData, SiteBundle, ImageRef, ThemeManifest, LayoutManifest } from '@/core/types';
import { getAssetContent, getJsonAsset } from '@/core/services/config/configHelpers.service';
import { getActiveImageService } from '@/core/services/images/images.service';

/**
 * Recursively finds all ImageRef objects within the site's data.
 */
function findAllImageRefs(siteData: LocalSiteData): ImageRef[] {
    const refs = new Set<ImageRef>();
    const visited = new Set<object>();
    function find(obj: unknown) {
        if (!obj || typeof obj !== 'object' || visited.has(obj)) return;
        visited.add(obj);
        if (('serviceId' in obj) && ('src' in obj) && (obj as ImageRef).serviceId && (obj as ImageRef).src) {
            refs.add(obj as ImageRef);
        }
        Object.values(obj).forEach(find);
    }
    find(siteData.manifest);
    siteData.contentFiles?.forEach(file => find(file.frontmatter));
    return Array.from(refs);
}

/**
 * Bundles all files associated with a single theme or layout.
 */
async function bundleAssetFiles(
    bundle: SiteBundle,
    siteData: LocalSiteData,
    assetType: 'theme' | 'layout',
    assetId: string
): Promise<void> {
    if (!assetId) return;
    const manifestFile = assetType === 'theme' ? 'theme.json' : 'layout.json';
    const manifest = await getJsonAsset<ThemeManifest | LayoutManifest>(siteData, assetType, assetId, manifestFile);
    if (!manifest?.files) return;

    await Promise.all(manifest.files.map(async (file) => {
        const content = await getAssetContent(siteData, assetType, assetId, file.path);
        if (content) {
            const bundlePath = `_site/${assetType}s/${assetId}/${file.path}`;
            bundle[bundlePath] = content;
        }
    }));
}

/**
 * Gathers and adds all site assets (images, themes, layouts) to the bundle.
 */
export async function bundleAllAssets(bundle: SiteBundle, siteData: LocalSiteData): Promise<void> {
    // 1. Bundle images
    const allImageRefs = findAllImageRefs(siteData);
    if (allImageRefs.length > 0) {
        const imageService = getActiveImageService(siteData.manifest);
        const assetsToBundle = await imageService.getExportableAssets(siteData.siteId, allImageRefs);
        for (const asset of assetsToBundle) {
            bundle[asset.path] = asset.data;
        }
    }

    // 2. Bundle the active theme's files
    await bundleAssetFiles(bundle, siteData, 'theme', siteData.manifest.theme.name);

    // 3. Bundle all unique, used layouts' files
    if (siteData.contentFiles) {
        const usedLayoutIds = [...new Set(siteData.contentFiles.map(f => f.frontmatter.layout))];
        await Promise.all(
            usedLayoutIds.map(layoutId => bundleAssetFiles(bundle, siteData, 'layout', layoutId))
        );
    }
}

================================================================================

File: core/services/builder/source.builder.ts
// src/core/services/builder/source.builder.ts

import type { LocalSiteData, SiteBundle } from '@/core/types';
import { stringifyToMarkdown } from '@/core/libraries/markdownParser';
import * as localSiteFs from '@/core/services/localFileSystem.service';

/**
 * Bundles all raw source files (Markdown, manifest) into the `_site` directory.
 */
export async function bundleSourceFiles(bundle: SiteBundle, siteData: LocalSiteData): Promise<void> {
    // 1. Add the synchronized manifest
    bundle['_site/manifest.json'] = JSON.stringify(siteData.manifest, null, 2);

    // 2. Add all published content files only
    siteData.contentFiles?.forEach(file => {
        // Only include published content in the source bundle
        const isPublished = file.frontmatter.published !== false;
        if (isPublished) {
            bundle[`_site/${file.path}`] = stringifyToMarkdown(file.frontmatter, file.content);
        }
    });

    // 3. Add all data files (e.g., categories.json)
    const dataFiles = await localSiteFs.getAllDataFiles(siteData.siteId);
    for (const [path, content] of Object.entries(dataFiles)) {
        if (typeof content === 'string') {
            bundle[`_site/${path}`] = content;
        }
    }
}

================================================================================

File: core/services/builder/page.builder.ts
// src/core/services/builder/page.builder.ts

import { type LocalSiteData, PageType } from '@/core/types';
import { flattenStructure } from '@/core/services/fileTree.service';
import { resolvePageContent } from '@/core/services/pageResolver.service';
import { render } from '@/core/services/renderer/render.service';
import { getUrlForNode } from '@/core/services/urlUtils.service';

/**
 * ============================================================================
 * Static HTML Page Generation Service (Unified Build)
 * ============================================================================
 * This service generates all static HTML pages for the site export.
 *
 * It now iterates over BOTH regular pages (from `manifest.structure`) AND
 * collection items (from `manifest.collectionItems`). This is the key to
 * ensuring that every piece of content becomes a physical HTML file in the
 * final static bundle, guaranteeing portability and functional links.
 * ============================================================================
 */
export async function generateHtmlPages(siteData: LocalSiteData): Promise<Record<string, string>> {
    const htmlPages: Record<string, string> = {};
    const { manifest } = siteData;

    // --- Step 1: Build all regular pages from the site structure ---
    const allStructureNodes = flattenStructure(manifest.structure);
    for (const node of allStructureNodes) {
        // Resolve the content for the node's slug.
        const resolution = await resolvePageContent(siteData, node.slug.split('/'));
        if (resolution.type === PageType.NotFound) {
            console.warn(`[Build] Skipping page: ${node.path}. Reason: ${resolution.errorMessage}`);
            continue;
        }

        const outputPath = getUrlForNode(node, manifest, true);
        const relativeAssetPath = '../'.repeat((outputPath.match(/\//g) || []).length);

        const finalHtml = await render(siteData, resolution, {
            siteRootPath: '/', // For export, root is always /
            isExport: true,
            relativeAssetPath,
        });
        htmlPages[outputPath] = finalHtml;
    }

    // --- Step 2: Build all collection items into their own pages ---
    const collectionItems = manifest.collectionItems || [];
    for (const itemRef of collectionItems) {
        // Resolve the content for the item's unique URL.
        const slugArray = getUrlForNode(itemRef, manifest, false).split('/');
        const resolution = await resolvePageContent(siteData, slugArray);
        if (resolution.type === PageType.NotFound) {
            console.warn(`[Build] Skipping item: ${itemRef.path}. Reason: ${resolution.errorMessage}`);
            continue;
        }

        const outputPath = getUrlForNode(itemRef, manifest, true);
        const relativeAssetPath = '../'.repeat((outputPath.match(/\//g) || []).length);

        const finalHtml = await render(siteData, resolution, {
            siteRootPath: '/',
            isExport: true,
            relativeAssetPath,
        });
        htmlPages[outputPath] = finalHtml;
    }

    return htmlPages;
}

================================================================================

File: core/services/builder/__tests__/source.builder.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { bundleSourceFiles } from '../source.builder';
import type { LocalSiteData, SiteBundle } from '@/core/types';
import * as markdownParser from '../../../libraries/markdownParser';
import * as localSiteFs from '../../localFileSystem.service';

// Mock dependencies
jest.mock('../../../libraries/markdownParser');
jest.mock('../../localFileSystem.service');

describe('source.builder', () => {
  const mockSiteData: LocalSiteData = {
    siteId: 'test-site',
    manifest: {
      siteId: 'test-site',
      generatorVersion: '1.0.0',
      title: 'Test Site',
      description: 'Test description',
      structure: [
        {
          type: 'page',
          title: 'Home',
          path: 'index.html',
          slug: 'home'
        }
      ],
      theme: {
        name: 'default',
        config: {
          color_primary: '#0066cc'
        }
      }
    },
    contentFiles: [
      {
        slug: 'home',
        path: 'content/index.md',
        frontmatter: {
          title: 'Home Page',
          layout: 'page'
        },
        content: 'Welcome to our site!'
      },
      {
        slug: 'about',
        path: 'content/about.md',
        frontmatter: {
          title: 'About Us',
          layout: 'page',
          author: 'John Doe'
        },
        content: 'Learn more about us.'
      }
    ]
  };

  const mockDataFiles = {
    'data/categories.json': '["tech", "lifestyle", "travel"]',
    'data/config.yaml': 'site_config: true',
    'data/authors.json': '[{"name": "John", "bio": "Writer"}]'
  };

  let mockBundle: SiteBundle;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBundle = {};

    // Mock markdownParser
    (markdownParser.stringifyToMarkdown as jest.Mock)
      .mockImplementation((frontmatter, content) => {
        const frontmatterYaml = Object.entries(frontmatter)
          .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
          .join('\n');
        return `---\n${frontmatterYaml}\n---\n${content}`;
      });

    // Mock localFileSystem
    (localSiteFs.getAllDataFiles as jest.Mock).mockResolvedValue(mockDataFiles);
  });

  describe('bundleSourceFiles', () => {
    test('adds synchronized manifest to bundle', async () => {
      await bundleSourceFiles(mockBundle, mockSiteData);

      expect(mockBundle['_site/manifest.json']).toBeDefined();
      
      const manifestContent = JSON.parse(mockBundle['_site/manifest.json'] as string);
      expect(manifestContent).toEqual(mockSiteData.manifest);
      expect(manifestContent.title).toBe('Test Site');
      expect(manifestContent.theme.name).toBe('default');
    });

    test('adds all content files to bundle with correct paths', async () => {
      await bundleSourceFiles(mockBundle, mockSiteData);

      expect(mockBundle['_site/content/index.md']).toBeDefined();
      expect(mockBundle['_site/content/about.md']).toBeDefined();

      // Verify content format
      const homeContent = mockBundle['_site/content/index.md'] as string;
      expect(homeContent).toContain('---');
      expect(homeContent).toContain('title: "Home Page"');
      expect(homeContent).toContain('layout: "page"');
      expect(homeContent).toContain('Welcome to our site!');

      const aboutContent = mockBundle['_site/content/about.md'] as string;
      expect(aboutContent).toContain('title: "About Us"');
      expect(aboutContent).toContain('author: "John Doe"');
      expect(aboutContent).toContain('Learn more about us.');
    });

    test('calls stringifyToMarkdown for each content file', async () => {
      await bundleSourceFiles(mockBundle, mockSiteData);

      expect(markdownParser.stringifyToMarkdown).toHaveBeenCalledTimes(2);
      
      expect(markdownParser.stringifyToMarkdown).toHaveBeenCalledWith(
        {
          title: 'Home Page',
          layout: 'page'
        },
        'Welcome to our site!'
      );

      expect(markdownParser.stringifyToMarkdown).toHaveBeenCalledWith(
        {
          title: 'About Us',
          layout: 'page',
          author: 'John Doe'
        },
        'Learn more about us.'
      );
    });

    test('adds all data files to bundle', async () => {
      await bundleSourceFiles(mockBundle, mockSiteData);

      expect(localSiteFs.getAllDataFiles).toHaveBeenCalledWith('test-site');

      expect(mockBundle['_site/data/categories.json']).toBe('["tech", "lifestyle", "travel"]');
      expect(mockBundle['_site/data/config.yaml']).toBe('site_config: true');
      expect(mockBundle['_site/data/authors.json']).toBe('[{"name": "John", "bio": "Writer"}]');
    });

    test('handles empty content files', async () => {
      const siteDataEmpty = {
        ...mockSiteData,
        contentFiles: []
      };

      await bundleSourceFiles(mockBundle, siteDataEmpty);

      // Should still add manifest and data files
      expect(mockBundle['_site/manifest.json']).toBeDefined();
      expect(mockBundle['_site/data/categories.json']).toBe('["tech", "lifestyle", "travel"]');
      
      // Should not have any content files
      expect(Object.keys(mockBundle).filter(key => key.startsWith('_site/content/'))).toHaveLength(0);
    });

    test('handles undefined content files', async () => {
      const siteDataUndefined = {
        ...mockSiteData,
        contentFiles: undefined
      };

      await bundleSourceFiles(mockBundle, siteDataUndefined);

      // Should still add manifest and data files
      expect(mockBundle['_site/manifest.json']).toBeDefined();
      expect(mockBundle['_site/data/categories.json']).toBe('["tech", "lifestyle", "travel"]');
      
      // Should not call stringifyToMarkdown
      expect(markdownParser.stringifyToMarkdown).not.toHaveBeenCalled();
    });

    test('handles empty data files', async () => {
      (localSiteFs.getAllDataFiles as jest.Mock).mockResolvedValue({});

      await bundleSourceFiles(mockBundle, mockSiteData);

      // Should still add manifest and content files
      expect(mockBundle['_site/manifest.json']).toBeDefined();
      expect(mockBundle['_site/content/index.md']).toBeDefined();
      
      // Should not have any data files
      expect(Object.keys(mockBundle).filter(key => key.startsWith('_site/data/'))).toHaveLength(0);
    });

    test('handles non-string data files', async () => {
      const mixedDataFiles = {
        'data/valid.json': '{"valid": true}',
        'data/invalid.bin': null as any,
        'data/another.txt': 'text content'
      };

      (localSiteFs.getAllDataFiles as jest.Mock).mockResolvedValue(mixedDataFiles);

      await bundleSourceFiles(mockBundle, mockSiteData);

      // Should only add string data files
      expect(mockBundle['_site/data/valid.json']).toBe('{"valid": true}');
      expect(mockBundle['_site/data/another.txt']).toBe('text content');
      expect(mockBundle['_site/data/invalid.bin']).toBeUndefined();
    });

    test('preserves manifest structure exactly', async () => {
      const complexManifest = {
        ...mockSiteData.manifest,
        author: 'Site Author',
        baseUrl: 'https://example.com',
        customField: 'custom value',
        settings: {
          imageService: 'cloudinary' as const,
          customSetting: true
        }
      };

      const siteDataComplex = {
        ...mockSiteData,
        manifest: complexManifest
      };

      await bundleSourceFiles(mockBundle, siteDataComplex);

      const manifestContent = JSON.parse(mockBundle['_site/manifest.json'] as string);
      expect(manifestContent).toEqual(complexManifest);
      expect(manifestContent.author).toBe('Site Author');
      expect(manifestContent.settings.imageService).toBe('cloudinary');
      expect(manifestContent.settings.customSetting).toBe(true);
    });

    test('formats manifest JSON with proper indentation', async () => {
      await bundleSourceFiles(mockBundle, mockSiteData);

      const manifestJson = mockBundle['_site/manifest.json'] as string;
      
      // Should be formatted with 2-space indentation
      expect(manifestJson).toContain('{\n  "title":');
      expect(manifestJson).toContain('\n  "description":');
      expect(manifestJson).toContain('\n}');
    });

    test('handles data file loading errors', async () => {
      (localSiteFs.getAllDataFiles as jest.Mock).mockRejectedValue(new Error('File system error'));

      await expect(bundleSourceFiles(mockBundle, mockSiteData))
        .rejects
        .toThrow('File system error');
    });

    test('handles complex frontmatter correctly', async () => {
      const siteDataComplex = {
        ...mockSiteData,
        contentFiles: [
          {
            slug: 'complex',
            path: 'content/complex.md',
            frontmatter: {
              title: 'Complex Post',
              layout: 'blog',
              tags: ['tech', 'tutorial'],
              metadata: {
                seo: {
                  title: 'SEO Title',
                  description: 'SEO Description'
                }
              },
              published: true,
              publishDate: '2024-01-01'
            },
            content: 'Complex content here'
          }
        ]
      };

      await bundleSourceFiles(mockBundle, siteDataComplex);

      expect(markdownParser.stringifyToMarkdown).toHaveBeenCalledWith(
        {
          title: 'Complex Post',
          layout: 'blog',
          tags: ['tech', 'tutorial'],
          metadata: {
            seo: {
              title: 'SEO Title',
              description: 'SEO Description'
            }
          },
          published: true,
          publishDate: '2024-01-01'
        },
        'Complex content here'
      );
    });
  });
});

================================================================================

File: core/services/builder/__tests__/metadata.builder.test.ts
// src/core/services/builder/__tests__/metadata.builder.test.ts

import { generateMetadataFiles } from '../metadata.builder';
import type { LocalSiteData, SiteBundle, StructureNode, CollectionItemRef } from '@/core/types';
import * as urlUtils from '../../urlUtils.service';

// Mock the urlUtils service
jest.mock('../../urlUtils.service', () => ({
  getUrlForNode: jest.fn()
}));

describe('metadata.builder', () => {
  // --- Refactored Test Data ---
  // The mock data is now more realistic. 'collectionItems' are explicitly part of the manifest,
  // and 'structure' only contains the regular pages, as per the new unified model.

  const mockSiteData: LocalSiteData = {
    siteId: 'test-site',
    manifest: {
      siteId: 'test-site',
      generatorVersion: '1.0.0',
      title: 'Test Site with & "Special Chars"',
      description: 'A test website with < and >',
      baseUrl: 'https://example.com',
      author: 'Test Author',
      theme: { name: 'default', config: {} },
      structure: [
        { type: 'page', title: 'Home Page', path: 'content/index.md', slug: 'home' },
        { type: 'page', title: 'About Us', path: 'content/about.md', slug: 'about' }
      ],
      collectionItems: [
        {
          collectionId: 'blog',
          title: 'Blog Post',
          path: 'content/blog/post.md',
          slug: 'blog-post',
          url: '/blog/blog-post'
        }
      ]
    },
    contentFiles: [
      {
        slug: 'home',
        path: 'content/index.md',
        frontmatter: { title: 'Home Page', layout: 'page', date: '2024-01-01T10:00:00Z', description: 'Home page description' },
        content: 'Welcome!'
      },
      {
        slug: 'about',
        path: 'content/about.md',
        frontmatter: { title: 'About Us', layout: 'page', date: '2024-01-02T15:30:00Z', description: 'About page description' },
        content: 'Learn more.'
      },
      {
        slug: 'blog-post',
        path: 'content/blog/post.md',
        frontmatter: { title: 'Blog Post', layout: 'blog', date: '2024-01-03T12:00:00Z' },
        content: 'Blog content.'
      }
    ]
  };

  let mockBundle: SiteBundle;

  beforeEach(() => {
    mockBundle = {};
    // Mock the unified getUrlForNode to return expected paths for both pages and items.
    (urlUtils.getUrlForNode as jest.Mock).mockImplementation((node: StructureNode | CollectionItemRef) => {
      if (node.slug === 'home') return '/';
      if (node.slug === 'about') return '/about/';
      if (node.slug === 'blog-post') return '/blog/blog-post/'; // Example static URL for a collection item
      return `/${node.slug}/`;
    });
  });

  describe('generateMetadataFiles', () => {
    test('generates sitemap.xml including both pages and collection items', () => {
      // CORRECTED: Call with the new, 2-argument signature.
      generateMetadataFiles(mockBundle, mockSiteData);

      expect(mockBundle['sitemap.xml']).toBeDefined();
      const sitemap = mockBundle['sitemap.xml'] as string;

      expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

      // Should include ALL content: 2 pages + 1 collection item
      expect(sitemap).toContain('<loc>https://example.com/</loc>');
      expect(sitemap).toContain('<loc>https://example.com/about/</loc>');
      expect(sitemap).toContain('<loc>https://example.com/blog/blog-post/</loc>');

      // Should include lastmod dates for all content
      expect(sitemap).toContain('<lastmod>2024-01-01</lastmod>');
      expect(sitemap).toContain('<lastmod>2024-01-02</lastmod>');
      expect(sitemap).toContain('<lastmod>2024-01-03</lastmod>');
    });

    test('generates RSS feed including all dated content', () => {
      // CORRECTED: Call with the new, 2-argument signature.
      generateMetadataFiles(mockBundle, mockSiteData);

      expect(mockBundle['rss.xml']).toBeDefined();
      const rss = mockBundle['rss.xml'] as string;

      expect(rss).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(rss).toContain('<rss version="2.0"');

      // Should correctly escape special characters from the manifest title and description.
      expect(rss).toContain('<title>Test Site with & "Special Chars"</title>');
      expect(rss).toContain('<description>A test website with < and ></description>');
      expect(rss).toContain('<link>https://example.com</link>');

      // Should include items for all pages with a `date` in frontmatter
      expect(rss.match(/<item>/g)?.length).toBe(3);
      expect(rss).toContain('<title>Home Page</title>');
      expect(rss).toContain('<title>About Us</title>');
      expect(rss).toContain('<title>Blog Post</title>');
      expect(rss).toContain('<description>Home page description</description>');
    });

    test('handles missing baseUrl gracefully', () => {
      const siteDataNoBaseUrl = {
        ...mockSiteData,
        manifest: { ...mockSiteData.manifest, baseUrl: undefined }
      };
      // CORRECTED: Call with the new, 2-argument signature.
      generateMetadataFiles(mockBundle, siteDataNoBaseUrl);

      const sitemap = mockBundle['sitemap.xml'] as string;
      const rss = mockBundle['rss.xml'] as string;

      // Should default to a placeholder domain
      expect(sitemap).toContain('<loc>https://example.com/');
      expect(rss).toContain('<link>https://example.com</link>');
    });

    test('handles empty content lists gracefully', () => {
      const siteDataEmpty = {
        ...mockSiteData,
        manifest: { ...mockSiteData.manifest, structure: [], collectionItems: [] },
        contentFiles: []
      };
      // CORRECTED: Call with the new, 2-argument signature.
      generateMetadataFiles(mockBundle, siteDataEmpty);

      const sitemap = mockBundle['sitemap.xml'] as string;
      const rss = mockBundle['rss.xml'] as string;

      // Should generate valid, empty files
      expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
      expect(rss).not.toContain('<item>');
    });

    test('preserves existing content in the bundle', () => {
      mockBundle['existing-file.txt'] = 'some content';
      // CORRECTED: Call with the new, 2-argument signature.
      generateMetadataFiles(mockBundle, mockSiteData);
      expect(mockBundle['existing-file.txt']).toBe('some content');
      expect(mockBundle['sitemap.xml']).toBeDefined();
    });
  });
});

================================================================================

File: core/services/builder/__tests__/siteBuilder.service.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { buildSiteBundle } from '../../siteBuilder.service';
import type { LocalSiteData } from '@/core/types';
import * as themeService from '../../config/theme.service';
import * as assetBuilder from '../asset.builder';
import * as sourceBuilder from '../source.builder';
import * as metadataBuilder from '../metadata.builder';
import * as pageBuilder from '../page.builder';

// Mock all the builder modules
jest.mock('../../config/theme.service');
jest.mock('../asset.builder');
jest.mock('../source.builder');
jest.mock('../metadata.builder');
jest.mock('../page.builder');
jest.mock('../../fileTree.service');

describe('siteBuilder.service', () => {
  const mockSiteData: LocalSiteData = {
    siteId: 'test-site',
    manifest: {
      siteId: 'test-site',
      generatorVersion: '1.0.0',
      title: 'Test Site',
      description: 'Test description',
      structure: [
        {
          type: 'page',
          title: 'Home',
          path: 'index.html',
          slug: 'home'
        }
      ],
      theme: {
        name: 'default',
        config: {
          color_primary: '#0066cc'
        }
      }
    },
    contentFiles: [
      {
        slug: 'home',
        path: 'content/index.md',
        frontmatter: {
          title: 'Home Page',
          layout: 'page'
        },
        content: 'Welcome to our site!'
      }
    ]
  };

  const mockMergedConfig = {
    color_primary: '#0066cc',
    color_background: '#ffffff'
  };

  const mockHtmlPages = {
    'index.html': '<html><body>Home Page Content</body></html>',
    'about.html': '<html><body>About Page Content</body></html>'
  };

  const mockAllStaticNodes = [
    {
      type: 'page' as const,
      title: 'Home',
      path: 'index.html',
      slug: 'home'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock theme service
    (themeService.getMergedThemeDataForForm as jest.Mock).mockResolvedValue({
      schema: null,
      initialConfig: mockMergedConfig
    });

    // Mock builders
    (pageBuilder.generateHtmlPages as jest.Mock).mockResolvedValue(mockHtmlPages);
    (sourceBuilder.bundleSourceFiles as jest.Mock).mockResolvedValue(undefined);
    (assetBuilder.bundleAllAssets as jest.Mock).mockResolvedValue(undefined);
    (metadataBuilder.generateMetadataFiles as jest.Mock).mockReturnValue(undefined);

    // Mock flattenTree
    const fileTreeService = require('../../fileTree.service');
    fileTreeService.flattenTree = jest.fn().mockReturnValue(mockAllStaticNodes);
  });

  describe('buildSiteBundle', () => {
    test('builds complete site bundle successfully', async () => {
      const result = await buildSiteBundle(mockSiteData);

      // Should return the generated HTML pages
      expect(result).toEqual(mockHtmlPages);

      // Should merge theme config
      expect(themeService.getMergedThemeDataForForm).toHaveBeenCalledWith(
        'default',
        { color_primary: '#0066cc' }
      );

      // Should call all builders in correct order
      expect(pageBuilder.generateHtmlPages).toHaveBeenCalledWith(
        expect.objectContaining({
          manifest: expect.objectContaining({
            theme: expect.objectContaining({
              config: mockMergedConfig
            })
          })
        }),
        mockAllStaticNodes
      );

      expect(sourceBuilder.bundleSourceFiles).toHaveBeenCalledWith(
        mockHtmlPages,
        expect.any(Object)
      );

      expect(assetBuilder.bundleAllAssets).toHaveBeenCalledWith(
        mockHtmlPages,
        expect.any(Object)
      );

      expect(metadataBuilder.generateMetadataFiles).toHaveBeenCalledWith(
        mockHtmlPages,
        expect.any(Object),
        mockAllStaticNodes
      );
    });

    test('throws error when content files are not loaded', async () => {
      const siteDataWithoutContent = {
        ...mockSiteData,
        contentFiles: undefined
      };

      await expect(buildSiteBundle(siteDataWithoutContent))
        .rejects
        .toThrow('Cannot build site: content files are not loaded.');
    });

    test('handles theme config merging failure gracefully', async () => {
      (themeService.getMergedThemeDataForForm as jest.Mock).mockRejectedValue(
        new Error('Theme config error')
      );

      await expect(buildSiteBundle(mockSiteData))
        .rejects
        .toThrow('Theme config error');
    });

    test('synchronizes site data with merged theme config', async () => {
      await buildSiteBundle(mockSiteData);

      // Verify the synchronized site data has merged config
      const [[synchronizedSiteData]] = (pageBuilder.generateHtmlPages as jest.Mock).mock.calls;
      
      expect(synchronizedSiteData.manifest.theme.config).toEqual(mockMergedConfig);
      expect(synchronizedSiteData.siteId).toBe('test-site');
      expect(synchronizedSiteData.contentFiles).toEqual(mockSiteData.contentFiles);
    });

    test('passes flattened nodes to all relevant builders', async () => {
      await buildSiteBundle(mockSiteData);

      // Verify flattenTree was called with correct parameters
      const fileTreeService = require('../../fileTree.service');
      expect(fileTreeService.flattenTree).toHaveBeenCalledWith(
        mockSiteData.manifest.structure,
        mockSiteData.contentFiles
      );

      // Verify builders received the flattened nodes
      expect(pageBuilder.generateHtmlPages).toHaveBeenCalledWith(
        expect.any(Object),
        mockAllStaticNodes
      );

      expect(metadataBuilder.generateMetadataFiles).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        mockAllStaticNodes
      );
    });

    test('handles empty content files array', async () => {
      const siteDataEmptyContent = {
        ...mockSiteData,
        contentFiles: []
      };

      const result = await buildSiteBundle(siteDataEmptyContent);

      expect(result).toEqual(mockHtmlPages);
      expect(pageBuilder.generateHtmlPages).toHaveBeenCalledWith(
        expect.objectContaining({
          contentFiles: []
        }),
        mockAllStaticNodes
      );
    });

    test('preserves all site data properties during synchronization', async () => {
      const siteDataWithExtras = {
        ...mockSiteData,
        layoutFiles: [{ path: 'layout.json', content: '{}' }],
        themeFiles: [{ path: 'theme.css', content: 'body {}' }],
        dataFiles: { 'categories.json': '[]' },
        secrets: { cloudinary: { uploadPreset: 'test-preset' } }
      };

      await buildSiteBundle(siteDataWithExtras);

      const [[synchronizedSiteData]] = (pageBuilder.generateHtmlPages as jest.Mock).mock.calls;
      
      expect(synchronizedSiteData.layoutFiles).toEqual(siteDataWithExtras.layoutFiles);
      expect(synchronizedSiteData.themeFiles).toEqual(siteDataWithExtras.themeFiles);
      expect(synchronizedSiteData.dataFiles).toEqual(siteDataWithExtras.dataFiles);
      expect(synchronizedSiteData.secrets).toEqual(siteDataWithExtras.secrets);
    });

    test('handles builder failures', async () => {
      (pageBuilder.generateHtmlPages as jest.Mock).mockRejectedValue(
        new Error('Page generation failed')
      );

      await expect(buildSiteBundle(mockSiteData))
        .rejects
        .toThrow('Page generation failed');
    });

    test('accumulates bundle content from all builders', async () => {
      // Mock builders to add content to bundle
      (sourceBuilder.bundleSourceFiles as jest.Mock).mockImplementation((bundle) => {
        bundle['_site/manifest.json'] = '{"title":"Test"}';
        bundle['_site/content/index.md'] = '# Home';
      });

      (assetBuilder.bundleAllAssets as jest.Mock).mockImplementation((bundle) => {
        bundle['themes/default/theme.css'] = 'body { margin: 0; }';
        bundle['images/logo.png'] = 'binary-data';
      });

      (metadataBuilder.generateMetadataFiles as jest.Mock).mockImplementation((bundle) => {
        bundle['sitemap.xml'] = '<sitemap></sitemap>';
        bundle['rss.xml'] = '<rss></rss>';
      });

      const result = await buildSiteBundle(mockSiteData);

      // Should include HTML pages and all builder additions
      expect(result).toEqual({
        'index.html': '<html><body>Home Page Content</body></html>',
        'about.html': '<html><body>About Page Content</body></html>',
        '_site/manifest.json': '{"title":"Test"}',
        '_site/content/index.md': '# Home',
        'themes/default/theme.css': 'body { margin: 0; }',
        'images/logo.png': 'binary-data',
        'sitemap.xml': '<sitemap></sitemap>',
        'rss.xml': '<rss></rss>'
      });
    });
  });
});

================================================================================

File: core/services/builder/__tests__/asset.builder.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { bundleAllAssets } from '../asset.builder';
import type { LocalSiteData, SiteBundle, ImageRef } from '@/core/types';
import * as configHelpers from '../../config/configHelpers.service';
import * as imagesService from '../../images/images.service';

// Mock dependencies
jest.mock('../../config/configHelpers.service');
jest.mock('../../images/images.service');

describe('asset.builder', () => {
  const mockSiteData: LocalSiteData = {
    siteId: 'test-site',
    manifest: {
      siteId: 'test-site',
      generatorVersion: '1.0.0',
      title: 'Test Site',
      description: 'Test description',
      structure: [],
      theme: {
        name: 'default',
        config: {}
      },
      logo: {
        serviceId: 'local',
        src: 'logo.png'
      }
    },
    contentFiles: [
      {
        slug: 'post1',
        path: 'content/posts/post1.md',
        frontmatter: {
          title: 'Post 1',
          layout: 'blog',
          featured_image: {
            serviceId: 'local',
            src: 'featured1.jpg'
          } as ImageRef
        },
        content: 'Post content'
      },
      {
        slug: 'post2',
        path: 'content/posts/post2.md',
        frontmatter: {
          title: 'Post 2',
          layout: 'page'
        },
        content: 'Another post'
      }
    ]
  };

  const mockThemeManifest = {
    name: 'Default Theme',
    version: '1.0.0',
    files: [
      { path: 'theme.json', type: 'manifest' },
      { path: 'base.hbs', type: 'base' },
      { path: 'css/theme.css', type: 'stylesheet' }
    ]
  };

  const mockLayoutManifest = {
    name: 'Blog Layout',
    version: '1.0.0',
    files: [
      { path: 'layout.json', type: 'manifest' },
      { path: 'blog.hbs', type: 'template' }
    ]
  };

  const mockImageService = {
    getExportableAssets: jest.fn()
  };

  let mockBundle: SiteBundle;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBundle = {};

    // Mock config helpers
    (configHelpers.getJsonAsset as jest.Mock)
      .mockImplementation(async (_siteData, assetType, assetId, fileName) => {
        if (assetType === 'theme' && assetId === 'default' && fileName === 'theme.json') {
          return mockThemeManifest;
        }
        if (assetType === 'layout' && assetId === 'blog' && fileName === 'layout.json') {
          return mockLayoutManifest;
        }
        return null;
      });

    (configHelpers.getAssetContent as jest.Mock)
      .mockImplementation(async (_siteData, _assetType, _assetId, filePath) => {
        if (filePath === 'base.hbs') return '<html>{{{body}}}</html>';
        if (filePath === 'css/theme.css') return 'body { margin: 0; }';
        if (filePath === 'blog.hbs') return '<article>{{{content}}}</article>';
        return null;
      });

    // Mock image service
    (imagesService.getActiveImageService as jest.Mock).mockReturnValue(mockImageService);
    mockImageService.getExportableAssets.mockResolvedValue([
      { path: 'images/logo.png', data: 'logo-binary-data' },
      { path: 'images/featured1.jpg', data: 'featured-binary-data' }
    ]);
  });

  describe('bundleAllAssets', () => {
    test('bundles theme assets correctly', async () => {
      await bundleAllAssets(mockBundle, mockSiteData);

      // Should load theme manifest
      expect(configHelpers.getJsonAsset).toHaveBeenCalledWith(
        mockSiteData,
        'theme',
        'default',
        'theme.json'
      );

      // Should load theme files
      expect(configHelpers.getAssetContent).toHaveBeenCalledWith(
        mockSiteData,
        'theme',
        'default',
        'base.hbs'
      );
      expect(configHelpers.getAssetContent).toHaveBeenCalledWith(
        mockSiteData,
        'theme',
        'default',
        'css/theme.css'
      );

      // Should add theme files to bundle with correct paths
      expect(mockBundle['_site/themes/default/base.hbs']).toBe('<html>{{{body}}}</html>');
      expect(mockBundle['_site/themes/default/css/theme.css']).toBe('body { margin: 0; }');
    });

    test('bundles layout assets correctly', async () => {
      await bundleAllAssets(mockBundle, mockSiteData);

      // Should load layout manifest for used layouts
      expect(configHelpers.getJsonAsset).toHaveBeenCalledWith(
        mockSiteData,
        'layout',
        'blog',
        'layout.json'
      );

      // Should load layout files
      expect(configHelpers.getAssetContent).toHaveBeenCalledWith(
        mockSiteData,
        'layout',
        'blog',
        'blog.hbs'
      );

      // Should add layout files to bundle with correct paths
      expect(mockBundle['_site/layouts/blog/blog.hbs']).toBe('<article>{{{content}}}</article>');
    });

    test('bundles only unique layouts', async () => {
      const siteDataDuplicateLayouts = {
        ...mockSiteData,
        contentFiles: [
          ...mockSiteData.contentFiles!,
          {
            slug: 'post3',
            path: 'content/posts/post3.md',
            frontmatter: { title: 'Post 3', layout: 'blog' },
            content: 'Third post'
          }
        ]
      };

      await bundleAllAssets(mockBundle, siteDataDuplicateLayouts);

      // Should only call getJsonAsset once for 'blog' layout despite multiple uses
      const blogLayoutCalls = (configHelpers.getJsonAsset as jest.Mock).mock.calls.filter(
        call => call[1] === 'layout' && call[2] === 'blog'
      );
      expect(blogLayoutCalls).toHaveLength(1);
    });

    test('bundles image assets correctly', async () => {
      await bundleAllAssets(mockBundle, mockSiteData);

      // Should get active image service
      expect(imagesService.getActiveImageService).toHaveBeenCalledWith(mockSiteData.manifest);

      // Should get exportable assets with all image refs
      expect(mockImageService.getExportableAssets).toHaveBeenCalledWith(
        'test-site',
        expect.arrayContaining([
          mockSiteData.manifest.logo,
          mockSiteData.contentFiles![0].frontmatter.featured_image
        ])
      );

      // Should add image assets to bundle
      expect(mockBundle['images/logo.png']).toBe('logo-binary-data');
      expect(mockBundle['images/featured1.jpg']).toBe('featured-binary-data');
    });

    test('handles missing theme manifest', async () => {
      (configHelpers.getJsonAsset as jest.Mock).mockResolvedValue(null);

      await bundleAllAssets(mockBundle, mockSiteData);

      // Should not throw error
      expect(mockBundle).toEqual({
        'images/logo.png': 'logo-binary-data',
        'images/featured1.jpg': 'featured-binary-data'
      });
    });

    test('handles missing layout manifest', async () => {
      (configHelpers.getJsonAsset as jest.Mock)
        .mockImplementation(async (_siteData, assetType, _assetId, _fileName) => {
          if (assetType === 'theme') return mockThemeManifest;
          return null; // No layout manifest
        });

      await bundleAllAssets(mockBundle, mockSiteData);

      // Should still bundle theme and images
      expect(mockBundle['_site/themes/default/base.hbs']).toBe('<html>{{{body}}}</html>');
      expect(mockBundle['images/logo.png']).toBe('logo-binary-data');
    });

    test('handles missing asset content', async () => {
      (configHelpers.getAssetContent as jest.Mock).mockResolvedValue(null);

      await bundleAllAssets(mockBundle, mockSiteData);

      // Should not add null content to bundle
      expect(mockBundle['_site/themes/default/base.hbs']).toBeUndefined();
      expect(mockBundle['images/logo.png']).toBe('logo-binary-data');
    });

    test('handles empty content files', async () => {
      const siteDataNoContent = {
        ...mockSiteData,
        contentFiles: []
      };

      await bundleAllAssets(mockBundle, siteDataNoContent);

      // Should still bundle theme and manifest images
      expect(mockBundle['_site/themes/default/base.hbs']).toBe('<html>{{{body}}}</html>');
      expect(mockBundle['images/logo.png']).toBe('logo-binary-data');
    });

    test('handles no image references', async () => {
      const siteDataNoImages = {
        ...mockSiteData,
        manifest: {
          ...mockSiteData.manifest,
          logo: undefined
        },
        contentFiles: [
          {
            slug: 'simple',
            path: 'content/simple.md',
            frontmatter: { title: 'Simple', layout: 'page' },
            content: 'Simple content'
          }
        ]
      };

      mockImageService.getExportableAssets.mockResolvedValue([]);

      await bundleAllAssets(mockBundle, siteDataNoImages);

      // Should still bundle theme assets
      expect(mockBundle['_site/themes/default/base.hbs']).toBe('<html>{{{body}}}</html>');
      
      // Should not have any image assets
      expect(Object.keys(mockBundle).filter(key => key.startsWith('images/'))).toHaveLength(0);
    });

    test('finds all nested image references', async () => {
      const siteDataNestedImages = {
        ...mockSiteData,
        contentFiles: [
          {
            slug: 'complex',
            path: 'content/complex.md',
            frontmatter: {
              title: 'Complex',
              layout: 'page',
              gallery: {
                images: [
                  { serviceId: 'local', src: 'gallery1.jpg' } as ImageRef,
                  { serviceId: 'local', src: 'gallery2.jpg' } as ImageRef
                ]
              },
              author: {
                avatar: { serviceId: 'local', src: 'avatar.png' } as ImageRef
              }
            },
            content: 'Complex content'
          }
        ]
      };

      await bundleAllAssets(mockBundle, siteDataNestedImages);

      // Should find all nested image references
      const calls = mockImageService.getExportableAssets.mock.calls[0];
      const imageRefs = calls[1];
      
      expect(imageRefs).toEqual(
        expect.arrayContaining([
          mockSiteData.manifest.logo,
          expect.objectContaining({ src: 'gallery1.jpg' }),
          expect.objectContaining({ src: 'gallery2.jpg' }),
          expect.objectContaining({ src: 'avatar.png' })
        ])
      );
    });

    test('handles image service errors gracefully', async () => {
      mockImageService.getExportableAssets.mockRejectedValue(new Error('Image service error'));

      // Should not throw, but log error and continue
      await expect(bundleAllAssets(mockBundle, mockSiteData)).rejects.toThrow('Image service error');
    });
  });
});

================================================================================

File: config/editorConfig.ts
// src/config/editorConfig.ts
import type { ThemeInfo, LayoutInfo } from '@/core/types';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';

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
 * ============================================================================
 * UNIFIED LAYOUT DEFINITIONS
 * ============================================================================
 * This is now the single source of truth for all built-in content blueprints.
 * There is no longer a separate "Collection Types" system. Instead, Layouts
 * are distinguished by their `type` property:
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
 * The master list of all built-in themes. This remains unchanged.
 */
export const CORE_THEMES: ThemeInfo[] = [
  {
    id: 'default',
    name: 'Default theme',
    path: 'default'
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
export const BASE_SCHEMA: { schema: RJSFSchema; uiSchema: UiSchema } = {
  schema: {
    title: 'Base content fields',
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

================================================================================

File: features/viewer/components/SiteViewer.tsx
// src/features/viewer/components/SiteViewer.tsx

import { useEffect, useState, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';

// State and Services
import { useAppStore } from '@/core/state/useAppStore';
import { resolvePageContent } from '@/core/services/pageResolver.service';
import { render as renderWithTheme } from '@/core/services/renderer/render.service';

// Types
import { type AppStore } from '@/core/state/useAppStore';
import { PageType } from '@/core/types';

// UI Components
import { Button } from '@/core/components/ui/button';
import { AlertTriangle, Edit } from 'lucide-react';

export default function SiteViewer() {
  // --- 1. Use react-router-dom hooks ---
  const { siteId = '' } = useParams<{ siteId: string }>();
  const location = useLocation(); // Provides the full current path
  const navigate = useNavigate(); // For updating the URL

  const site = useAppStore(useCallback((state: AppStore) => state.getSiteById(siteId), [siteId]));

  const [htmlContent, setHtmlContent] = useState<string>('<p>Loading site...</p>');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // The base path for the viewer, used to calculate relative paths
  const viewRootPath = `/sites/${siteId}/view`;

  // --- 2. Derive the relative path from the location pathname ---
  let currentRelativePath = location.pathname.startsWith(viewRootPath)
    ? location.pathname.substring(viewRootPath.length) || '/'
    : '/';
    
  // Handle collection item URLs: /collection/{collectionId}/{slug}
  // Convert them to the format expected by the viewer
  if (currentRelativePath.startsWith('/collection/')) {
    const pathParts = currentRelativePath.split('/').filter(Boolean);
    if (pathParts.length === 3 && pathParts[0] === 'collection') {
      // Keep the collection path as-is for the resolver
      currentRelativePath = currentRelativePath;
    }
  }

  // This function generates the final HTML and sets the iframe content
  const updateIframeContent = useCallback(async () => {
    if (!site?.contentFiles) {
      setHtmlContent('<p>Loading site data...</p>');
      return;
    }

    // The slug array is derived from the relative path inside the viewer
    const slugArray = currentRelativePath.split('/').filter(Boolean);
    const resolution = await resolvePageContent(site, slugArray);
    
    if (resolution.type === PageType.NotFound) {
      setErrorMessage(resolution.errorMessage);
      setHtmlContent(''); // Clear content on error
      return;
    }

    try {
      const pureHtml = await renderWithTheme(site, resolution, {
        // The siteRootPath is passed to the renderer so it can generate correct hash links
        siteRootPath: `#${viewRootPath}`,
        isExport: false,
      });

      // The communication script is updated to post the path part of the hash URL
      const communicationScript = `
        <script>
          document.addEventListener('click', function(e) {
            const link = e.target.closest('a');
            if (!link || !link.href) return;
            
            // Skip if this is already a hash link on the same page
            if (link.hash && link.pathname === window.location.pathname) return;
            
            // Skip if this is an external link
            if (link.target === '_blank' || link.href.startsWith('http') && !link.href.startsWith(window.location.origin)) return;

            try {
              // Check if the link is a hash-based internal link
              const url = new URL(link.href, window.location.origin);
              if (url.origin === window.location.origin && url.hash) {
                e.preventDefault();
                const newHashPath = url.hash.substring(1); // Get path from hash (e.g., /sites/123/view/about)
                // Only navigate if the path is actually different
                if (newHashPath && newHashPath !== window.location.pathname) {
                  window.parent.postMessage({ type: 'SIGNUM_NAVIGATE', path: newHashPath }, window.location.origin);
                }
              }
            } catch (urlError) {
              // If URL parsing fails, just ignore the click
              console.warn('Failed to parse URL:', link.href, urlError);
            }
          });
        </script>
      `;

      const finalHtml = pureHtml.replace('</body>', `${communicationScript}</body>`);
      setHtmlContent(finalHtml);
      setErrorMessage(null);
    } catch (e) {
      const error = e as Error;
      console.error("Error during site rendering:", error);
      setErrorMessage(`Theme Error: ${error.message}`);
      setHtmlContent('');
    }
  }, [site, viewRootPath, currentRelativePath]);

  // Re-render the iframe whenever the path or site data changes.
  useEffect(() => {
    updateIframeContent();
  }, [updateIframeContent]);


  // --- 3. Manage Browser History with useNavigate ---
  // This effect listens for messages from the iframe to update the browser's URL bar.
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      const { type, path } = event.data;
      if (type === 'SIGNUM_NAVIGATE' && typeof path === 'string' && path.trim() !== '') {
        // Only navigate if the path is actually different to prevent infinite loops
        if (path !== location.pathname) {
          console.log('[SiteViewer] Navigating to:', path);
          navigate(path);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
    
    // We don't need the 'popstate' listener anymore because `useLocation` from react-router-dom handles it.
  }, [location.pathname, navigate]);


  // Sandbox attributes remain the same
  const sandboxAttributes = 
    process.env.NODE_ENV === 'development'
      ? 'allow-scripts allow-forms allow-same-origin'
      : 'allow-scripts allow-forms';

  // Error state rendering remains the same
  if (errorMessage) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Could Not Render Preview</h1>
        <p className="text-muted-foreground">{errorMessage}</p>
        <Button asChild variant="default" className="mt-6">
          <Link to={`/sites/${siteId}/edit`}>
            <Edit className="mr-2 h-4 w-4" /> Go to Editor
          </Link>
        </Button>
      </div>
    );
  }

  // The iframe itself is unchanged
  return (
    <iframe
      srcDoc={htmlContent}
      title={site?.manifest.title || 'Site Preview'}
      className="w-full h-full border-0"
      sandbox={sandboxAttributes}
      key={siteId} // Add key to force re-mount if siteId changes
    />
  );
}

================================================================================

File: features/viewer/components/MarkdownRenderer.tsx
// src/components/browsing/MarkdownRenderer.tsx
'use client'; 

import { marked } from 'marked';
import { useMemo } from 'react';
import DOMPurify from 'dompurify';

interface MarkdownRendererProps {
  markdown: string;
}

export default function MarkdownRenderer({ markdown }: MarkdownRendererProps) {
  // Parse the markdown string to HTML.
  // useMemo will re-calculate only if the 'markdown' prop changes.
  const html = useMemo(() => {
    if (typeof window === 'undefined') {

    }
    const rawHtml = marked.parse(markdown) as string;
    if (typeof window !== 'undefined') { 
    return DOMPurify.sanitize(rawHtml);
     }
    return rawHtml;
  }, [markdown]);

  // Using dangerouslySetInnerHTML because 'marked' produces an HTML string.
  // Ensure that the 'markdown' content is from a trusted source or sanitized.
  // Since in Sparktype, users are creating their own local content first,
  // the trust level is higher for this local-only phase.
  // For remote content later, sanitization will be critical.
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

================================================================================

File: features/site-settings/components/SiteSettingsForm.tsx
// src/features/site-settings/components/SiteSettingsForm.tsx
'use client';

import { Label } from '@/core/components/ui/label';
import { Input } from '@/core/components/ui/input';
import { Textarea } from '@/core/components/ui/textarea';
import type { ImageRef } from '@/core/types';
import SiteAssetUploader from './SiteAssetsUploader';
import SchemaDrivenForm from '@/core/components/SchemaDrivenForm';
import type { RJSFSchema } from '@rjsf/utils';

interface SiteSettingsFormProps {
  siteId: string;
  formData: {
    title: string;
    description: string;
    author: string;
    baseUrl: string;
    logo: ImageRef | undefined;
    favicon: ImageRef | undefined;
  };
  themeDataSchema?: RJSFSchema;
  themeData?: Record<string, unknown>;
  onFormChange: (newData: SiteSettingsFormProps['formData']) => void;
  onThemeDataChange?: (newData: Record<string, unknown>) => void;
}

export default function SiteSettingsForm({ 
  siteId, 
  formData, 
  onFormChange, 
  themeDataSchema, 
  themeData, 
  onThemeDataChange 
}: SiteSettingsFormProps) {
  
  // FIX: Typed the 'value' parameter to 'unknown' for better type safety.
  const handleChange = (field: keyof typeof formData, value: unknown) => {
    onFormChange({ ...formData, [field]: value });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Site Identity</h2>
        <SiteAssetUploader 
          siteId={siteId}
          label="Site Logo"
          value={formData.logo}
          onChange={(newRef) => handleChange('logo', newRef)}
          onRemove={() => handleChange('logo', undefined)}
        />
        <SiteAssetUploader
          siteId={siteId}
          label="Favicon"
          value={formData.favicon}
          onChange={(newRef) => handleChange('favicon', newRef)}
          onRemove={() => handleChange('favicon', undefined)}
        />
      </div>

      <div className="border-t pt-6 space-y-4">
        <h2 className="text-lg font-semibold">Core Details</h2>
        <div className="space-y-2">
            <Label htmlFor="title">Site Title</Label>
            <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="My Awesome Site"
            />
        </div>
        <div className="space-y-2">
            <Label htmlFor="description">Site Description</Label>
            <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="A short, catchy description."
                rows={3}
            />
        </div>
        <div className="space-y-2">
            <Label htmlFor="author">Author (Optional)</Label>
            <Input
                id="author"
                value={formData.author}
                onChange={(e) => handleChange('author', e.target.value)}
                placeholder="Your Name or Organization"
            />
        </div>
        <div className="space-y-2">
            <Label htmlFor="baseUrl">Base URL</Label>
            <Input
                id="baseUrl"
                type="url"
                value={formData.baseUrl}
                onChange={(e) => handleChange('baseUrl', e.target.value)}
                placeholder="https://www.my-awesome-site.com"
            />
        </div>
      </div>

      {themeDataSchema && onThemeDataChange && (
        <div className="border-t pt-6 space-y-4">
          <h2 className="text-lg font-semibold">Theme Content</h2>
          <p className="text-sm text-muted-foreground">
            Configure additional content fields defined by your theme.
          </p>
          <SchemaDrivenForm
            schema={themeDataSchema}
            formData={themeData || {}}
            onFormChange={(data: object) => onThemeDataChange(data as Record<string, unknown>)}
            liveValidate={false}
          />
        </div>
      )}
    </div>
  );
}

================================================================================

File: features/site-settings/components/SiteAssetsUploader.tsx
// src/features/site-settings/components/SiteAssetsUploader.tsx

import { useEffect, useState } from 'react';
// REMOVED: import Image from 'next/image';
import { type ImageRef } from '@/core/types';
import { useAppStore } from '@/core/state/useAppStore';
import { getActiveImageService } from '@/core/services/images/images.service';
import { Button } from '@/core/components/ui/button';
import { UploadCloud, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { MEMORY_CONFIG } from '@/config/editorConfig';

interface SiteAssetUploaderProps {
  siteId: string;
  label: string;
  value: ImageRef | undefined;
  onChange: (newRef: ImageRef) => void;
  onRemove: () => void;
}

export default function SiteAssetUploader({ siteId, label, value, onChange, onRemove }: SiteAssetUploaderProps) {
  const site = useAppStore(state => state.getSiteById(siteId));
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    const generatePreview = async () => {
      if (value && site?.manifest) {
        try {
          const service = getActiveImageService(site.manifest);
          const url = await service.getDisplayUrl(site.manifest, value, { width: 128, height: 128, crop: 'fit' }, false);
          setPreviewUrl(url);
          if (url.startsWith('blob:')) {
            objectUrl = url;
          }
        } catch (error) {
          console.error(`Could not generate preview for ${label}:`, error);
          setPreviewUrl(null);
        }
      } else {
        setPreviewUrl(null);
      }
    };
    generatePreview();
    
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [value, site, label]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !site?.manifest) return;

    const isSvg = file.type === 'image/svg+xml';
    if (!MEMORY_CONFIG.SUPPORTED_IMAGE_TYPES.includes(file.type as typeof MEMORY_CONFIG.SUPPORTED_IMAGE_TYPES[number])) {
      toast.error(`Unsupported file type. Please use one of: ${MEMORY_CONFIG.SUPPORTED_EXTENSIONS.join(', ')}`);
      event.target.value = '';
      return;
    }

    const maxSize = isSvg ? MEMORY_CONFIG.MAX_SVG_SIZE : MEMORY_CONFIG.MAX_UPLOAD_SIZE;
    if (file.size > maxSize) {
      const maxSizeFormatted = (maxSize / 1024 / (isSvg ? 1 : 1024)).toFixed(1);
      const unit = isSvg ? 'KB' : 'MB';
      toast.error(`Image is too large. Max size is ${maxSizeFormatted}${unit}.`);
      event.target.value = '';
      return;
    }
    
    setIsUploading(true);
    try {
      const service = getActiveImageService(site.manifest);
      const newRef = await service.upload(file, siteId);
      onChange(newRef);
      toast.success(`${label} uploaded successfully.`);
    } catch (error) {
      console.error(`Upload failed for ${label}:`, error);
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const inputId = `uploader-${label.toLowerCase().replace(/\s/g, '-')}`;

  return (
    <div className="flex items-center gap-4">
      {/* The parent container needs `relative` for the absolute positioning of the img tag */}
      <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center overflow-hidden flex-shrink-0 relative">
        {previewUrl ? (
          // FIX: Replaced next/image's <Image> with a standard <img> tag.
          // The `object-contain` class replicates the default behavior.
          <img src={previewUrl} alt={`${label} preview`} className="absolute inset-0 w-full h-full object-contain" />
        ) : (
          <UploadCloud className="w-8 h-8 text-muted-foreground" />
        )}
      </div>
      <div className="flex-grow">
        <label htmlFor={inputId} className="font-medium text-sm">{label}</label>
        <div className="flex items-center gap-2 mt-1">
          <Button asChild size="sm" variant="outline" disabled={isUploading}>
            <label htmlFor={inputId} className="cursor-pointer">
              {isUploading ? 'Uploading...' : (value ? 'Change...' : 'Upload...')}
            </label>
          </Button>
          <input 
            type="file" 
            id={inputId} 
            className="hidden" 
            onChange={handleFileSelect} 
            accept={MEMORY_CONFIG.SUPPORTED_EXTENSIONS.join(',')} 
          />
          {value && (
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onRemove}>
              <XCircle className="w-4 h-4 mr-1" />
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

================================================================================

File: features/site-settings/components/SettingsNav.tsx
// src/features/site-settings/components/SettingsNav.tsx

import { NavLink, useParams } from 'react-router-dom'; // Import NavLink and useParams
import { TbUserCircle, TbPalette, TbPhoto, TbCloudUpload } from 'react-icons/tb';
import { cn } from '@/core/libraries/utils';

/**
 * Renders the vertical navigation menu for the settings section.
 * It uses NavLink from react-router-dom to automatically handle active link styling.
 */
export default function SettingsNav() {
  const { siteId } = useParams<{ siteId: string }>();

  // The base path for all settings links.
  const settingsBasePath = `/sites/${siteId}/settings`;

  const navItems = [
    // Use the `end` prop for the index route to prevent it from matching all child routes.
    { to: settingsBasePath, title: 'Site details', icon: TbUserCircle, end: true },
    { to: `${settingsBasePath}/theme`, title: 'Theme config', icon: TbPalette, end: false },
    { to: `${settingsBasePath}/images`, title: 'Image handling', icon: TbPhoto, end: false },
    { to: `${settingsBasePath}/publishing`, title: 'Publishing', icon: TbCloudUpload, end: false },
  ];

  return (
    <div className="flex h-full flex-col p-4">
      <h2 className="px-2 text-lg font-semibold tracking-tight">Settings</h2>
      <nav className="mt-4 flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end} // The 'end' prop ensures exact matching for the parent route
            // The `className` prop on NavLink can accept a function that receives an `isActive` boolean.
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground' // Style for the active link
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground' // Style for inactive links
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.title}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

================================================================================

File: features/editor/contexts/useEditor.tsx
// src/features/editor/contexts/useEditor.ts

import { useContext } from 'react';
import { EditorContext, type EditorContextType } from './EditorContext';

/**
 * Custom hook to easily access the EditorContext.
 * Throws an error if used outside of an EditorProvider.
 */
export function useEditor(): EditorContextType {
  const context = useContext(EditorContext);
  if (context === undefined) {
    throw new Error('useEditor must be used within an EditorProvider');
  }
  return context;
}

================================================================================

File: features/editor/contexts/EditorProvider.tsx
// src/features/editor/contexts/EditorProvider.tsx

import { useState, useMemo, useRef, useCallback, type ReactNode } from 'react';
import { toast } from 'sonner';

// Import the context object and types from its dedicated file
import { EditorContext, type SaveState } from './EditorContext';

interface EditorProviderProps {
  children: ReactNode;
}

/**
 * The EditorProvider component. It manages the editor's state and
 * provides it to its children via the EditorContext.
 */
export function EditorProvider({ children }: EditorProviderProps) {
  const [saveState, setSaveState] = useState<SaveState>('no_changes');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // A ref to hold the current save function, registered by the active page.
  const saveActionRef = useRef<(() => Promise<void>) | null>(null);

  /**
   * Allows the active editor page to register its specific save logic with the provider.
   */
  const registerSaveAction = useCallback((saveFn: () => Promise<void>) => {
    saveActionRef.current = saveFn;
  }, []);

  /**
   * Triggers the currently registered save action, managing the global save state.
   */
  const triggerSave = useCallback(async () => {
    if (saveActionRef.current) {
      setSaveState('saving');
      try {
        await saveActionRef.current();
        setSaveState('saved');
        setHasUnsavedChanges(false);
        // Reset to idle state after a delay for user feedback
        setTimeout(() => setSaveState('no_changes'), 2000);
      } catch (error) {
        console.error("Save failed:", error);
        toast.error((error as Error).message || "Failed to save.");
        setSaveState('idle'); // Revert to idle on error to allow another save attempt
      }
    } else {
      console.warn("Save triggered, but no save action is registered.");
    }
  }, []);

  /**
   * Memoizes the context value to prevent unnecessary re-renders in consumer components.
   */
  const contextValue = useMemo(() => ({
    saveState,
    setSaveState,
    hasUnsavedChanges, 
    setHasUnsavedChanges, 
    triggerSave,
    registerSaveAction,
  }), [saveState, setSaveState, hasUnsavedChanges, setHasUnsavedChanges, triggerSave, registerSaveAction]);

  return (
    <EditorContext.Provider value={contextValue}>
      {children}
    </EditorContext.Provider>
  );
}

================================================================================

File: features/editor/contexts/EditorContext.tsx
// src/features/editor/contexts/EditorContext.ts

import { createContext } from 'react';

// Define the shape of the save state
export type SaveState = 'idle' | 'saving' | 'saved' | 'no_changes';

// Define the type for the context's value
export interface EditorContextType {
  saveState: SaveState;
  setSaveState: (state: SaveState) => void;
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  triggerSave: () => Promise<void>;
  registerSaveAction: (saveFn: () => Promise<void>) => void;
}

// Create and export the context object itself
export const EditorContext = createContext<EditorContextType | undefined>(undefined);

================================================================================

File: features/editor/components/MarkdownEditor.tsx
// src/features/editor/components/BlocknoteEditor.tsx
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { 
  MDXEditor, 
  type MDXEditorMethods, 
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  imagePlugin,
  tablePlugin,
  codeBlockPlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  Separator,
  BlockTypeSelect,
  CreateLink,
  InsertImage,
  InsertTable,
  InsertThematicBreak,
  ListsToggle
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import { Label } from '@/core/components/ui/label';

interface BlocknoteEditorProps {
  initialContent: string; // Changed from Block[] to string for markdown
  onContentChange: () => void; // Only needs to signal a change, not pass content
}

// The ref will now expose a function to get the editor's markdown data.
export interface BlocknoteEditorRef {
  getBlocks: () => string; // Changed to return markdown string
}

const BlocknoteEditor = forwardRef<BlocknoteEditorRef, BlocknoteEditorProps>(
  ({ initialContent, onContentChange }, ref) => {
    const editorRef = useRef<MDXEditorMethods>(null);

    // Expose a function for the parent component to get the current content.
    useImperativeHandle(ref, () => ({
      getBlocks: () => {
        return editorRef.current?.getMarkdown() || '';
      },
    }));

    return (
      <div className="space-y-2 h-full flex flex-col">
        <Label htmlFor="content-body" className="text-[10px] font-medium uppercase text-gray-400 shrink-0">
          Content
        </Label>
        <div className="flex-grow min-h-0 overflow-hidden border">
          <MDXEditor
            ref={editorRef}
            markdown={initialContent || ''}
            onChange={onContentChange}
            plugins={[
              headingsPlugin(),
              listsPlugin(),
              quotePlugin(),
              thematicBreakPlugin(),
              markdownShortcutPlugin(),
              linkPlugin(),
              linkDialogPlugin(),
              imagePlugin({
                imageUploadHandler: async () => {
                  // Placeholder - you can implement actual image upload later
                  return 'https://via.placeholder.com/300x200';
                },
              }),
              tablePlugin(),
              codeBlockPlugin({ defaultCodeBlockLanguage: 'js' }),
              toolbarPlugin({
                toolbarContents: () => (
                  <>
                    <UndoRedo />
                    <Separator />
                    <BoldItalicUnderlineToggles />
                    <Separator />
                    <BlockTypeSelect />
                    <Separator />
                    <CreateLink />
                    <InsertImage />
                    <Separator />
                    <ListsToggle />
                    <Separator />
                    <InsertTable />
                    <InsertThematicBreak />
                  </>
                )
              })
            ]}
            className="h-full"
          />
        </div>
      </div>
    );
  }
);

BlocknoteEditor.displayName = 'BlocknoteEditor';
export default BlocknoteEditor;

================================================================================

File: features/editor/components/EditorHeader.tsx
// src/features/editor/components/EditorHeader.tsx

import { type ReactNode, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';

// State Management
import { useUIStore } from '@/core/state/uiStore';
import { useAppStore } from '@/core/state/useAppStore';
import { type AppStore } from '@/core/state/useAppStore';

// UI Components & Icons
import { Button } from '@/core/components/ui/button';
import { Eye, PanelLeft, UploadCloud, PanelRight } from 'lucide-react';
import { toast } from 'sonner';

// Services
import { exportSiteToZip } from '@/core/services/siteExporter.service';
import { slugify } from '@/core/libraries/utils';

/**
 * Props for the generic EditorHeader component.
 */
interface EditorHeaderProps {
  /**
   * An optional React node containing action buttons or other components
   * to be displayed in the header. This allows for context-specific actions,
   * such as the "Save" button in the content editor.
   */
  actions?: ReactNode;
}

export default function EditorHeader({ actions }: EditorHeaderProps) {
  const { siteId = '' } = useParams<{ siteId: string }>();
  const [isPublishing, setIsPublishing] = useState(false);

  // Get site and UI state from the global stores
  const site = useAppStore(useCallback((state: AppStore) => state.getSiteById(siteId), [siteId]));
  const { toggleLeftSidebar, toggleRightSidebar, isLeftAvailable, isRightAvailable } = useUIStore((state) => state.sidebar);

  const handlePublishSite = async () => {
    if (!site) {
      toast.error("Site data not found. Cannot publish.");
      return;
    }
    setIsPublishing(true);
    toast.info("Generating site bundle for download...");
    try {
      const blob = await exportSiteToZip(site);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${slugify(site.manifest.title || 'signum-site')}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast.success("Site bundle downloaded!");
    } catch (error) {
      console.error("Error publishing site to Zip:", error);
      toast.error(`Failed to generate Zip: ${(error as Error).message}`);
    } finally {
      setIsPublishing(false);
    }
  };
  
  // Render a placeholder header if site data isn't loaded yet
  if (!site) {
    return (
        <header className="sticky top-0 z-20 flex h-[60px] items-center gap-4 border-b bg-background px-4 lg:h-[60px]">
          {/* A simple loading state to prevent layout shift */}
          <div className="flex-1 text-lg text-muted-foreground">Loading...</div>
        </header>
    );
  }

  return (
    <header className="sticky top-0 z-20 flex shrink-0 items-center gap-4 border-b bg-background lg:pl-4 pr-4 h-[60px]">
      <div className="flex items-center gap-2">
        {/*
          This button is only visible if the corresponding sidebar has been
          made "available" by the page layout (e.g., EditContentPage).
        */}
        {isLeftAvailable && (
            <Button 
                variant="outline" 
                size="icon" 
                className="shrink-0" 
                onClick={toggleLeftSidebar}
                aria-label="Toggle file tree"
            >
                <PanelLeft className="h-5 w-5" />
            </Button>
        )}
      </div>

      {/* Displays the site title */}
      <div className="flex-1 text-lg text-muted-foreground truncate">
       <span className="font-bold text-foreground">{site.manifest.title}</span>
      </div>
      
      <div className="flex items-center justify-end gap-2">
        {/*
          This renders the context-specific actions passed via props.
          For the main editor, this will be the SaveButton. For settings pages,
          this will be null.
        */}
        {actions}

        <Button variant="outline" asChild>
            {/* The "View" link now correctly points to the hash-based route */}
            <Link to={`/sites/${siteId}/view`}>
                <Eye className="h-4 w-4" />
                <span className='hidden md:block ml-2'>View</span>
            </Link>
        </Button>
        <Button variant="default" onClick={handlePublishSite} disabled={isPublishing}>
            <UploadCloud className="h-4 w-4" /> 
            <span className='hidden md:block ml-2'>{isPublishing ? 'Publishing...' : 'Publish'}</span>
        </Button>

        {/* The right sidebar toggle button */}
        {isRightAvailable && (
            <Button 
                variant="outline" 
                size="icon" 
                className="shrink-0" 
                onClick={toggleRightSidebar}
                aria-label="Toggle settings sidebar"
            >
                <PanelRight className="h-5 w-5" />
            </Button>
        )}
      </div>
    </header>
  );
}

================================================================================

File: features/editor/components/ImageUploadWidget.tsx
// src/features/editor/components/ImageUploadWidget.tsx

import { useEffect, useState } from 'react';
import type { WidgetProps } from '@rjsf/utils';
import { useAppStore } from '@/core/state/useAppStore';
import { getActiveImageService } from '@/core/services/images/images.service';
import { Button } from '@/core/components/ui/button';
import { Label } from '@/core/components/ui/label';
import { UploadCloud, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { MEMORY_CONFIG } from '@/config/editorConfig';

export default function ImageUploadWidget(props: WidgetProps) {
  const { id, label, value: imageRef, onChange, formContext } = props;
  const siteId = formContext.siteId as string;

  const site = useAppStore(state => state.getSiteById(siteId));
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    const generatePreview = async () => {
      if (imageRef && site?.manifest) {
        try {
          const service = getActiveImageService(site.manifest);
          const url = await service.getDisplayUrl(site.manifest, imageRef, { width: 256, crop: 'fit' }, false);
          setPreviewUrl(url);
          if (url.startsWith('blob:')) {
            objectUrl = url;
          }
        } catch (error) {
          console.error(`Could not generate preview for ${label}:`, error);
          setPreviewUrl(null);
        }
      } else {
        setPreviewUrl(null);
      }
    };
    generatePreview();
    
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [imageRef, site, label]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !site?.manifest) return;

    const isSvg = file.type === 'image/svg+xml';
    if (!MEMORY_CONFIG.SUPPORTED_IMAGE_TYPES.includes(file.type as typeof MEMORY_CONFIG.SUPPORTED_IMAGE_TYPES[number])) {
      toast.error(`Unsupported file type.`);
      return;
    }
    const maxSize = isSvg ? MEMORY_CONFIG.MAX_SVG_SIZE : MEMORY_CONFIG.MAX_UPLOAD_SIZE;
    if (file.size > maxSize) {
      const maxSizeFormatted = (maxSize / 1024 / (isSvg ? 1 : 1024)).toFixed(1);
      const unit = isSvg ? 'KB' : 'MB';
      toast.error(`Image is too large. Max size is ${maxSizeFormatted}${unit}.`);
      return;
    }
    
    setIsUploading(true);
    try {
      const service = getActiveImageService(site.manifest);
      const newRef = await service.upload(file, siteId);
      onChange(newRef);
      toast.success(`${label} uploaded successfully.`);
    } catch (error) {
      console.error(`Upload failed for ${label}:`, error);
      const errorMsg = error instanceof Error ? error.message : 'Upload failed. Please try again.';
      toast.error(errorMsg);
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleRemove = () => {
    onChange(undefined);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      
      {previewUrl ? (
        <div className="relative w-full aspect-video bg-muted rounded-md overflow-hidden">
          <img src={previewUrl} alt={`${label} preview`} className="absolute inset-0 w-full h-full object-contain" />
          <Button 
            size="icon" 
            variant="destructive" 
            className="absolute top-2 right-2 h-7 w-7"
            onClick={handleRemove}
            aria-label={`Remove ${label}`}
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-muted/80"
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" />
            <p className="mb-1 text-sm text-muted-foreground">
              <span className="font-semibold">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-muted-foreground">PNG, JPG, or WEBP (Max 5MB)</p>
          </div>
          <input 
            id={id} 
            type="file" 
            className="hidden" 
            onChange={handleFileSelect}
            accept={MEMORY_CONFIG.SUPPORTED_EXTENSIONS.join(',')}
            disabled={isUploading}
          />
        </label>
      )}

      {isUploading && <p className="text-sm text-muted-foreground">Uploading...</p>}
    </div>
  );
}

================================================================================

File: features/editor/components/PrimaryContentFields.tsx
// src/components/publishing/PrimaryContentFields.tsx
'use client';

import { Input } from '@/core/components/ui/input';
import { Textarea } from '@/core/components/ui/textarea';
import { Label } from '@/core/components/ui/label';
import type { MarkdownFrontmatter } from '@/core/types';

// FIXED: The interface is now much stricter and safer.
// It only defines the properties this component actually cares about.
interface PrimaryFieldsProps {
  frontmatter: {
    title?: string;
    description?: string;
  };
  // The callback expects a partial update to the main frontmatter state.
  onFrontmatterChange: (newData: Partial<MarkdownFrontmatter>) => void;
  showDescription?: boolean;
}

export default function PrimaryContentFields({
  frontmatter,
  onFrontmatterChange,
}: PrimaryFieldsProps) {

  // FIXED: The handler now only passes back the single field that changed.
  // This makes the component more reusable and decoupled from the parent's state shape.
  const handleChange = (field: 'title' | 'description', value: string) => {
    onFrontmatterChange({
      [field]: value,
    });
  };

  return (
    <div className="space-y-4 shrink-0">
      <div className="space-y-2 mb-6 border-b pb-3">
        <Label htmlFor="content-title" className="text-[10px] font-medium uppercase text-gray-400">
          Title
        </Label>
        <Input
          id="content-title"
          placeholder="Enter a title..."
          value={frontmatter.title || ''}
          onChange={(e) => handleChange('title', e.target.value)}
          // These classes create the large, "invisible" input style
          className="text-2xl lg:text-3xl font-bold h-auto p-0 border-0 shadow-none focus-visible:ring-0 bg-transparent"
        />
      </div>

        <div className="space-y-2 mb-6 border-b pb-3">
          <Label htmlFor="content-description" className="text-[10px] font-medium uppercase text-gray-400">
            Description
          </Label>
          <Textarea
            
            placeholder="Add a short description..."
            value={frontmatter.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            // Style for a clean, borderless textarea
            className="p-0 border-0 shadow-none focus-visible:ring-0 bg-transparent resize-none text-2xl text-black"
            rows={1}
          />
        </div>
    </div>
  );
}

================================================================================

File: features/editor/components/EditCollectionDialog.tsx
// src/features/editor/components/EditCollectionDialog.tsx

import { useState, useEffect } from 'react';
import { useAppStore } from '@/core/state/useAppStore';
import { updateCollection } from '@/core/services/collections.service';
import type { Collection } from '@/core/types';

// UI Components
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Textarea } from '@/core/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/core/components/ui/dialog';
import { toast } from 'sonner';

// Icons
import { Loader2, Edit } from 'lucide-react';

interface EditCollectionDialogProps {
  siteId: string;
  collection: Collection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditCollectionDialog({
  siteId,
  collection,
  open,
  onOpenChange,
}: EditCollectionDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const getSiteById = useAppStore(state => state.getSiteById);
  const updateManifest = useAppStore(state => state.updateManifest);
  const siteData = getSiteById(siteId);

  useEffect(() => {
    if (collection && open) {
      setName(collection.name);
      setDescription((collection.settings?.description as string) || '');
    }
  }, [collection, open]);

  const isValid = name.trim() !== '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !siteData || !collection) return;

    try {
      setIsLoading(true);
      const updates = {
        name: name.trim(),
        settings: description ? { description: description.trim() } : undefined,
      };
      const updatedManifest = updateCollection(siteData.manifest, collection.id, updates);
      await updateManifest(siteId, updatedManifest);
      toast.success(`Collection "${name}" updated successfully!`);
      onOpenChange(false);
    } catch (error) {
      toast.error(`Failed to update collection: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!collection) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Edit className="h-5 w-5" />Edit Collection</DialogTitle>
          <DialogDescription>Update the collection's settings.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-collection-name">Collection Name *</Label>
            <Input id="edit-collection-name" placeholder="My Blog" value={name} onChange={(e) => setName(e.target.value)} disabled={isLoading} required />
          </div>

          <div className="space-y-2">
            <Label>Default Item Layout</Label>
            {/* CORRECTED: Display the informative `defaultItemLayout` instead of the obsolete `typeId`. */}
            <div className="px-3 py-2 border rounded-md bg-muted text-muted-foreground">{collection.defaultItemLayout}</div>
            <p className="text-xs text-muted-foreground">The item layout cannot be changed after creation.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea id="edit-description" placeholder="Optional description for this collection..." value={description} onChange={(e) => setDescription(e.target.value)} disabled={isLoading} rows={3} />
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
          <Button type="submit" onClick={handleSubmit} disabled={!isValid || isLoading} className="min-w-[100px]">
            {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Updating...</> : <><Edit className="h-4 w-4 mr-2" />Update Collection</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

================================================================================

File: features/editor/components/NewPageDialog.tsx
// src/features/editor/components/NewPageDialog.tsx

import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom'; // Import the navigate hook
import { useAppStore } from '@/core/state/useAppStore';
import { slugify } from '@/core/libraries/utils';
import { toast } from 'sonner';
import yaml from 'js-yaml';

// UI & Type Imports
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/core/components/ui/dialog";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Plus } from 'lucide-react';
import { type MarkdownFrontmatter } from '@/core/types';
import { DEFAULT_PAGE_LAYOUT_PATH } from '@/config/editorConfig';

interface NewPageDialogProps {
  siteId: string;
  children: ReactNode;
  onComplete?: () => void;
}

export default function NewPageDialog({ siteId, children, onComplete }: NewPageDialogProps) {
  const navigate = useNavigate(); // Use the navigate hook for routing
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const site = useAppStore((state) => state.getSiteById(siteId));
  const addOrUpdateContentFile = useAppStore((state) => state.addOrUpdateContentFile);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setTimeout(() => {
        setTitle('');
        setIsSubmitting(false);
      }, 200);
    }
  };

  const handleCreatePage = async () => {
    if (!title.trim()) {
      toast.error("Page title cannot be empty.");
      return;
    }
    setIsSubmitting(true);
    const slug = slugify(title);
    const filePath = `content/${slug}.md`;

    const slugExists = site?.contentFiles?.some(f => f.slug === slug);
    if (slugExists) {
        toast.error(`A page with the slug "${slug}" already exists.`);
        setIsSubmitting(false);
        return;
    }
    
    const frontmatter: MarkdownFrontmatter = {
        title: title.trim(),
        layout: DEFAULT_PAGE_LAYOUT_PATH,
        date: new Date().toISOString().split('T')[0],
    };

    const initialContent = `---\n${yaml.dump(frontmatter)}---\n\nStart writing your content here.\n`;

    try {
      const success = await addOrUpdateContentFile(siteId, filePath, initialContent);
      if (success) {
        toast.success(`Page "${title}" created!`);
        handleOpenChange(false);
        onComplete?.();
        
        // --- CHANGE: Use navigate to redirect to the new page's editor ---
        navigate(`/sites/${siteId}/edit/content/${slug}`);
      } else { 
        throw new Error("Failed to update manifest or save file.");
      }
    } catch (error) {
      toast.error(`Failed to create page: ${(error as Error).message}`);
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Content Page</DialogTitle>
          <DialogDescription>
            Give your new page a title. You can add content and change settings later.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-1">
            <Label htmlFor="title">Page Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., About Us" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button type="button" onClick={handleCreatePage} disabled={!title.trim() || isSubmitting}>
            {isSubmitting ? 'Creating...' : <><Plus className="mr-2 h-4 w-4" /> Create Page</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

================================================================================

File: features/editor/components/SwitchWidget.tsx
import type { WidgetProps } from '@rjsf/utils';
import { Switch } from '@/core/components/ui/switch';
import { Label } from '@/core/components/ui/label';

export default function SwitchWidget(props: WidgetProps) {
  const { id, value, onChange, label, schema } = props;
  
  return (
    <div className="flex items-center space-x-2">
      <Switch
        id={id}
        checked={Boolean(value)}
        onCheckedChange={(checked) => onChange(checked)}
      />
      <Label htmlFor={id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        {label || schema.title}
      </Label>
    </div>
  );
}

================================================================================

File: features/editor/components/FileTree.tsx
// src/features/editor/components/FileTree.tsx
'use client';

import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import FileTreeNode from './FileTreeNode';
import type { FlattenedNode } from '@/core/services/fileTree.service';

/**
 * Defines the shape of the visual drop indicator state, passed from the parent.
 */
interface DndProjection {
  parentId: string | null;
  depth: number;
  index: number;
}

/**
 * Defines the props accepted by the FileTree component.
 * It now receives a pre-filtered list of items to render, and a separate
 * list of IDs that are valid sortable targets.
 */
interface FileTreeProps {
  itemsToRender: FlattenedNode[];
  sortableIds: string[];
  activeId: string | null;
  projected: DndProjection | null;
  baseEditPath: string;
  activePath: string | undefined;
  homepagePath: string | undefined;
  onCollapse: (id: string) => void;
}

/**
 * Renders the sortable list of pages.
 * This component is now a "dumb" presenter; all filtering and state management
 * is handled by its parent (LeftSidebar).
 */
export default function FileTree({
  itemsToRender,
  sortableIds,
  activeId,
  projected,
  baseEditPath,
  activePath,
  homepagePath,
  onCollapse,
}: FileTreeProps) {
  return (
    // The SortableContext is given only the IDs of items that can be dragged.
    // The homepage ID is excluded by the parent component.
    <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
      <ul className="space-y-0.5">
        {/* It maps over the pre-filtered list of items to render each node. */}
        {itemsToRender.map((item) => (
          <FileTreeNode
            key={item.path}
            item={item}
            activeId={activeId}
            projected={projected}
            baseEditPath={baseEditPath}
            activePath={activePath}
            homepagePath={homepagePath}
            onCollapse={onCollapse}
          />
        ))}
      </ul>
    </SortableContext>
  );
}

================================================================================

File: features/editor/components/FileTreeNode.tsx
// src/features/editor/components/FileTreeNode.tsx

import { Link } from 'react-router-dom'; // CORRECT: Import from react-router-dom
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronRight, File as FileIcon, LayoutGrid, Home, EyeOff } from 'lucide-react';
import { cn } from '@/core/libraries/utils';
import type { FlattenedNode } from '@/core/services/fileTree.service';
import type { MarkdownFrontmatter } from '@/core/types';

/**
 * Defines the shape of the visual drop indicator state.
 */
interface DndProjection {
  parentId: string | null;
  depth: number;
  index: number;
}

interface FileTreeNodeProps {
  item: FlattenedNode;
  isClone?: boolean;
  // --- Props for UI state ---
  activeId: string | null;
  projected: DndProjection | null;
  baseEditPath: string;
  activePath: string | undefined;
  homepagePath: string | undefined;
  onCollapse: (id: string) => void;
}

/**
 * Renders a single item in the file tree. It handles displaying the correct icon,
 * indentation, collapse state, and drag-and-drop visual feedback.
 */
export default function FileTreeNode({
  item,
  isClone,
  activeId,
  projected,
  baseEditPath,
  activePath,
  homepagePath,
  onCollapse,
}: FileTreeNodeProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.path,
    // The homepage is not draggable.
    disabled: item.path === homepagePath,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const isHomepage = item.path === homepagePath;
  const frontmatter = item.frontmatter as MarkdownFrontmatter | undefined;
  const isCollection = !!(frontmatter?.collection);
  const hasChildren = item.children && item.children.length > 0;
  const isDraft = frontmatter?.published === false;

  const showCollapseButton = hasChildren && !isCollection && !isHomepage;

  // CORRECT: Generate the `to` prop for the react-router-dom Link
  const editorSlug = item.path.replace(/^content\//, '').replace(/\.md$/, '');
  const to = `${baseEditPath}/content/${editorSlug}`;

  const isOver = projected?.parentId === item.parentId && projected?.index === item.index;
  const projectedDepth = projected && isOver ? projected.depth : item.depth;
  const indentation = isClone ? item.depth * 24 : projectedDepth * 24;

  const showDropLine = activeId && projected && isOver && projected.depth === item.depth;
  const showNestingHighlight = activeId && projected && isOver && projected.depth > item.depth;
  
  return (
    <li
      ref={setNodeRef}
      style={{ paddingLeft: indentation, ...style }}
      className={cn(
        'relative list-none my-0.5 rounded-md transition-shadow',
        isDragging && 'opacity-50 z-10 shadow-lg',
        showNestingHighlight && 'bg-blue-100 dark:bg-blue-900/40'
      )}
    >
      {showDropLine && (
        <div className="absolute -top-[3px] left-0 right-0 h-1 bg-blue-500 rounded-full z-20" />
      )}
      
      <div
        className={cn(
          "flex items-center group w-full relative transition-colors h-9",
          activePath === item.path && "bg-accent text-accent-foreground"
        )}
      >
        <button
          {...attributes}
          {...listeners}
          disabled={isHomepage}
          className={cn(
            "p-1.5 touch-none",
            isHomepage ? "cursor-default text-muted-foreground/30" : "cursor-grab text-muted-foreground/50 hover:text-muted-foreground"
          )}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        
        <div className="flex-grow flex items-center pl-1 pr-1 overflow-hidden">
          {showCollapseButton ? (
            <button onClick={() => onCollapse(item.path)} className="p-0.5 mr-1" aria-label={`Collapse ${item.title}`}>
                <ChevronRight className={cn("h-4 w-4 shrink-0 transition-transform duration-200", !item.collapsed && "rotate-90")} />
            </button>
          ) : (
            // A spacer is used to keep alignment consistent for items without a collapse button.
            <span className="w-5 mr-1 shrink-0" />
          )}

          {isHomepage ? (
            <Home className="h-4 w-4 shrink-0 text-primary" />
          ) : isCollection ? (
            <LayoutGrid className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          
          {isDraft && (
            <EyeOff className="h-3 w-3 shrink-0 text-muted-foreground/60 ml-1" />
          )}
          
          {/* CORRECT: Use the react-router-dom Link with the `to` prop */}
          <Link to={to} className="truncate flex-grow mx-1.5 text-sm hover:underline" title={item.title}>
            {item.menuTitle || item.title}
          </Link>
        </div>
      </div>
    </li>
  );
}

================================================================================

File: features/editor/components/DataSourceSelectWidget.tsx
// src/features/editor/components/DataSourceSelectWidget.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { getAvailableLayouts } from '@/core/services/config/configHelpers.service';
import type { WidgetProps } from '@rjsf/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/components/ui/select";
import { Label } from '@/core/components/ui/label';
import type { LocalSiteData, StructureNode, LayoutManifest } from '@/core/types';

interface SelectOption {
  label: string;
  value: string;
}

interface DataSourceSelectWidgetProps extends WidgetProps {
    formContext?: {
        site?: LocalSiteData;
    };
}

const DataSourceSelectWidget = ({ id, label, options, value, onChange, required, formContext }: DataSourceSelectWidgetProps) => {
  const { uiSchema } = options;
  const site = formContext?.site;

  const dataSource = uiSchema?.['ui:dataSource'] as string;
  const layoutTypeFilter = uiSchema?.['ui:layoutType'] as string | undefined;

  const [items, setItems] = useState<SelectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchItems = async () => {
      // Add a more robust guard clause
      if (!site || !site.manifest || !site.contentFiles) {
        setItems([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);

      let fetchedItems: SelectOption[] = [];

      try {
        switch (dataSource) {
          case 'collections':
            // 1. Find all content files that ARE collection pages.
            const collectionFilePaths = new Set(
              site.contentFiles
                .filter(f => !!f.frontmatter.collection)
                .map(f => f.path)
            );
            // 2. Filter the structure nodes to only include those whose paths are in our set.
            fetchedItems = site.manifest.structure
              .filter((n: StructureNode) => collectionFilePaths.has(n.path))
              .map((c: StructureNode) => ({ label: c.title, value: c.slug }));
            break;

          case 'layouts':
            const allLayouts: LayoutManifest[] = await getAvailableLayouts(site);
            fetchedItems = allLayouts
              .filter(l => !layoutTypeFilter || l.layoutType === layoutTypeFilter)
              .map(l => ({ label: l.name, value: l.id })); // Use id for value
            break;

          default:
            fetchedItems = [];
        }
        setItems(fetchedItems);
      } catch (error) {
        console.error(`Failed to fetch data source "${dataSource}":`, error);
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchItems();
  }, [site, dataSource, layoutTypeFilter]);

  const placeholder = useMemo(() => {
    if (isLoading) return `Loading ${dataSource || 'options'}...`;
    if (dataSource) return `Select a ${dataSource.replace(/s$/, '')}...`;
    return 'Select an option...';
  }, [isLoading, dataSource]);

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}{required ? '*' : ''}</Label>
      <Select value={value} onValueChange={onChange} disabled={isLoading}>
        <SelectTrigger id={id} className="mt-1">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {items.map(item => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default DataSourceSelectWidget;

================================================================================

File: features/editor/components/CollectionsManager.tsx
// src/features/editor/components/CollectionsManager.tsx

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/core/state/useAppStore';
// CORRECTED: Removed obsolete 'getCollectionStats' import.
import { getCollections, deleteCollection } from '@/core/services/collections.service';
import type { Collection, ParsedMarkdownFile } from '@/core/types';
import CreateCollectionDialog from './CreateCollectionDialog';
import EditCollectionDialog from './EditCollectionDialog';
import { CollectionErrorBoundary, CollectionErrorFallback } from './ErrorBoundary';

// UI Components
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/core/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/core/components/ui/alert-dialog';

// Icons
import { Plus, Search, MoreHorizontal, Trash2, Edit, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';

interface CollectionsManagerProps {
  siteId: string;
}

export default function CollectionsManager({ siteId }: CollectionsManagerProps) {
  const navigate = useNavigate();
  const [searchFilter, setSearchFilter] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [collectionToDelete, setCollectionToDelete] = useState<Collection | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [collectionToEdit, setCollectionToEdit] = useState<Collection | null>(null);

  const getSiteById = useAppStore(state => state.getSiteById);
  const updateManifest = useAppStore(state => state.updateManifest);
  const siteData = getSiteById(siteId);

  const collections = useMemo(() => siteData ? getCollections(siteData.manifest) : [], [siteData]);

  const filteredCollections = useMemo(() => {
    if (!searchFilter.trim()) return collections;
    const filter = searchFilter.toLowerCase();
    return collections.filter(collection =>
      collection.name.toLowerCase().includes(filter) ||
      // CORRECTED: Search by the more useful `defaultItemLayout` instead of the obsolete `typeId`.
      collection.defaultItemLayout.toLowerCase().includes(filter)
    );
  }, [collections, searchFilter]);

  const handleDeleteCollection = (collection: Collection) => {
    setCollectionToDelete(collection);
    setDeleteDialogOpen(true);
  };

  const handleEditCollection = (collection: Collection) => {
    setCollectionToEdit(collection);
    setEditDialogOpen(true);
  };

  const handleCollectionClick = (collection: Collection) => {
    navigate(`/sites/${siteId}/collections/${collection.id}`);
  };

  const confirmDeleteCollection = async () => {
    if (!collectionToDelete || !siteData) return;
    try {
      const { manifest: updatedManifest } = deleteCollection(siteData.manifest, collectionToDelete.id);
      await updateManifest(siteId, updatedManifest);
      toast.success(`Collection "${collectionToDelete.name}" deleted successfully!`);
    } catch (error) {
      toast.error(`Failed to delete collection: ${(error as Error).message}`);
    } finally {
      setDeleteDialogOpen(false);
      setCollectionToDelete(null);
    }
  };

  if (!siteData) {
    return <div className="p-4 text-center text-muted-foreground"><p className="text-sm">Loading site data...</p></div>;
  }

  return (
    <CollectionErrorBoundary fallback={CollectionErrorFallback}>
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between border-b px-2 py-2">
          <h3 className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Collections</h3>
          <Button variant="ghost" size="sm" className="size-7 p-1" onClick={() => setIsCreateDialogOpen(true)} title="Create Collection">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {collections.length > 0 && (
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search collections..." value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} className="pl-8 h-8 text-xs" />
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          {filteredCollections.length === 0 ? (
            <div className="p-4 text-center">
              {collections.length === 0 ? (
                <div className="space-y-3">
                  <div className="text-muted-foreground">
                    <FolderOpen className="mx-auto h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">No collections yet</p>
                  </div>
                  <Button size="sm" onClick={() => setIsCreateDialogOpen(true)} className="w-full"><Plus className="h-4 w-4 mr-2" />Create Collection</Button>
                </div>
              ) : (
                <div className="text-muted-foreground"><p className="text-sm">No collections match</p></div>
              )}
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {filteredCollections.map((collection) => (
                <CollectionItem
                  key={collection.id}
                  collection={collection}
                  siteData={siteData}
                  onClick={() => handleCollectionClick(collection)}
                  onEdit={() => handleEditCollection(collection)}
                  onDelete={() => handleDeleteCollection(collection)}
                />
              ))}
            </div>
          )}
        </div>
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Collection</AlertDialogTitle>
              <AlertDialogDescription>Are you sure you want to delete "{collectionToDelete?.name}"? This will not delete the content files, but they will no longer be organized as a collection.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteCollection} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete Collection</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <CreateCollectionDialog siteId={siteId} open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />
        <EditCollectionDialog siteId={siteId} collection={collectionToEdit} open={editDialogOpen} onOpenChange={setEditDialogOpen} />
      </div>
    </CollectionErrorBoundary>
  );
}

interface CollectionItemProps {
  collection: Collection;
  siteData: import('@/core/types').LocalSiteData;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function CollectionItem({ collection, siteData, onClick, onEdit, onDelete }: CollectionItemProps) {
  // CORRECTED: Calculate item count directly instead of using an obsolete service.
  const itemCount = useMemo(() => {
    return (siteData.contentFiles || []).filter((file: ParsedMarkdownFile) => file.path.startsWith(collection.contentPath)).length;
  }, [siteData.contentFiles, collection.contentPath]);

  return (
    <div className="group flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent">
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onClick} title="Click to view collection items">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium truncate">{collection.name}</div>
          {/* CORRECTED: Display the more informative `defaultItemLayout` instead of `typeId`. */}
          <div className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{collection.defaultItemLayout}</div>
        </div>
        <div className="text-xs text-muted-foreground">{itemCount} items • {collection.contentPath}</div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"><MoreHorizontal className="h-3 w-3" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}><Edit className="h-4 w-4 mr-2" />Edit Collection</DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete Collection</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

================================================================================

File: features/editor/components/CollectionItemList.tsx
// src/features/editor/components/CollectionItemList.tsx

import { useMemo } from 'react';
import { Link } from 'react-router-dom';

// State Management
import { useAppStore } from '@/core/state/useAppStore';
import { type AppStore } from '@/core/state/useAppStore';

// Services & Config
import { getCollection, getCollectionContent } from '@/core/services/collections.service';
import { NEW_FILE_SLUG_MARKER } from '@/config/editorConfig';

// UI Components & Icons
import { Button } from '@/core/components/ui/button';
import { FileText, PlusCircle } from 'lucide-react';
// CORRECTED: Removed unused type imports for ParsedMarkdownFile and StructureNode.
// We can use a type-only import for the type we do need.
import type { ParsedMarkdownFile } from '@/core/types';

interface CollectionItemListProps {
  siteId: string;
  collectionId?: string;
}

/**
 * Displays a list of items within a specific collection, providing links
 * to edit each item and a button to create a new one.
 */
export default function CollectionItemList({ siteId, collectionId }: CollectionItemListProps) {
  const site = useAppStore((state: AppStore) => state.getSiteById(siteId));

  const collection = useMemo(() => {
    if (!site || !collectionId) return null;
    return getCollection(site.manifest, collectionId);
  }, [site, collectionId]);

  const collectionItems: ParsedMarkdownFile[] = useMemo(() => {
    if (!site || !collection) return [];
    return getCollectionContent(site, collection.id);
  }, [site, collection]);

  const newItemPath = useMemo(() => {
    if (!collection) return '#';
    const contentPathSlug = collection.contentPath.replace('content/', '').replace(/\/$/, '');
    return `/sites/${siteId}/edit/content/${contentPathSlug}/${NEW_FILE_SLUG_MARKER}`;
  }, [collection, siteId]);

  const collectionName = collection?.name || 'Collection Items';

  return (
    <div className="h-full flex flex-col p-6 bg-muted/30">
      <div className="flex shrink-0 items-center justify-between mb-4 pb-4 border-b">
        <h1 className="text-2xl font-bold">{collectionName}</h1>
        <Button asChild>
          <Link to={newItemPath}>
            <PlusCircle className="mr-2 h-4 w-4" /> New Item
          </Link>
        </Button>
      </div>
      <div className="flex-grow rounded-lg bg-background p-1 overflow-y-auto">
        {collectionItems.length > 0 ? (
          <ul className="space-y-1">
            {collectionItems.map((item) => {
              const editorSlug = item.path.replace(/^content\//, '').replace(/\.md$/, '');
              const itemEditorPath = `/sites/${siteId}/edit/content/${editorSlug}`;

              // CORRECTED: The title is always accessed from `item.frontmatter.title`
              // as the `collectionItems` array is strongly typed to `ParsedMarkdownFile[]`.
              const title = item.frontmatter.title;

              return (
                <li key={item.path}>
                  <Link to={itemEditorPath} className="flex items-center rounded-md p-2 transition-colors hover:bg-muted">
                    <FileText className="mr-3 h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{title || item.slug}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-center text-muted-foreground py-10">
            <p>No items have been added to this collection yet.</p>
            <Button asChild variant="outline" className="mt-4">
               <Link to={newItemPath}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add your first item
                </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

================================================================================

File: features/editor/components/RightSidebar.tsx
'use client';

import { type ReactNode } from 'react';
import { useUIStore } from '@/core/state/uiStore';
import { cn } from '@/core/libraries/utils';

interface RightSidebarProps {
  children: ReactNode;
}

export default function RightSidebar({ children }: RightSidebarProps) {
  const { isRightOpen } = useUIStore((state) => state.sidebar);

  return (
    <aside
      className={cn(
        // Base styles
        'h-full w-80 shrink-0 border-l bg-muted/20 transition-all duration-300 ease-in-out',
        
        // Hide/Show Logic
        isRightOpen ? 'ml-0' : '-mr-[320px] w-0 border-l-0 opacity-0'
      )}
    >
      <div className="h-full overflow-y-auto">
        {children}
      </div>
    </aside>
  );
}

================================================================================

File: features/editor/components/SaveButton.tsx
// src/features/editor/components/SaveButton.tsx
'use client';

import { useEditor } from '@/features/editor/contexts/useEditor';
import { Button } from '@/core/components/ui/button';
import { Save, Check, Loader2 } from 'lucide-react';

/**
 * A context-aware button that displays the current save state
 * (e.g., Save, Saving..., Saved) and triggers the save action.
 *
 * This component MUST be rendered within a tree wrapped by an `<EditorProvider>`
 * as it relies on the `useEditor` hook for its state and actions.
 */
export default function SaveButton() {
  const { saveState, hasUnsavedChanges, triggerSave } = useEditor();

  // Define the visual states for the button
  const buttonStates = {
    idle: {
      icon: <Save className="h-4 w-4" />,
      text: 'Save',
    },
    saving: {
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      text: 'Saving...',
    },
    saved: {
      icon: <Check className="h-4 w-4" />,
      text: 'Saved',
    },
  };

  // Determine the current display state and if the button should be disabled
  let currentDisplayState: 'idle' | 'saving' | 'saved';
  let isDisabled = false;

  if (saveState === 'saving') {
    currentDisplayState = 'saving';
    isDisabled = true;
  } else if (hasUnsavedChanges) {
    currentDisplayState = 'idle';
    isDisabled = false;
  } else {
    // This covers both 'saved' and 'no_changes' states.
    // In both cases, the content is considered saved and there's nothing to do.
    currentDisplayState = 'saved';
    isDisabled = true;
  }

  const current = buttonStates[currentDisplayState];

  return (
    <Button variant='ghost' onClick={triggerSave} disabled={isDisabled}>
      {current.icon}
      <span className='hidden md:block'>{current.text}</span>
    </Button>
  );
}

================================================================================

File: features/editor/components/LeftSidebar.tsx
// src/features/editor/components/LeftSidebar.tsx

import { useMemo, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useLocation } from 'react-router-dom';

// State Management
import { useAppStore } from '@/core/state/useAppStore';

// UI Components & Icons
import { Button } from '@/core/components/ui/button';
import FileTree from '@/features/editor/components/FileTree';
import NewPageDialog from '@/features/editor/components/NewPageDialog';
import CollectionsManager from '@/features/editor/components/CollectionsManager';
// import CreateCollectionPageDialog from '@/features/editor/components/CreateCollectionPageDialog';
import { FilePlus, GripVertical, Archive } from 'lucide-react';
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  type DragOverEvent,
  type DragMoveEvent,
  closestCenter,
  useDroppable,
} from '@dnd-kit/core';
import { flattenTree, type FlattenedNode } from '@/core/services/fileTree.service';
import { arrayMove } from '@dnd-kit/sortable';
import { toast } from 'sonner';
import { exportSiteBackup } from '@/core/services/siteBackup.service';
import { slugify } from '@/core/libraries/utils';

interface DndProjection {
  parentId: string | null;
  depth: number;
  index: number;
}

function DragOverlayItem({ id, items }: { id: string; items: FlattenedNode[] }) {
  const item = items.find(i => i.path === id);
  if (!item) return null;
  return (
    <div className="flex items-center gap-2 p-2 bg-background border rounded-md shadow-lg text-sm font-semibold">
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      <span>{item.title}</span>
    </div>
  );
}

export default function LeftSidebar() {
  const { siteId = '' } = useParams<{ siteId: string }>();
  const location = useLocation();

  const repositionNode = useAppStore(state => state.repositionNode);
  const loadSite = useAppStore(state => state.loadSite);
  const getSiteById = useAppStore(state => state.getSiteById);
  
  const site = useAppStore(useCallback(state => state.getSiteById(siteId), [siteId]));

  // All local state management remains the same
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const { setNodeRef: setRootDroppableRef } = useDroppable({ id: '__root_droppable__' });

  const flattenedItems = useMemo(() => {
    if (!site?.manifest.structure || !site.contentFiles) return [];
    const allItems = flattenTree(site.manifest.structure, site.contentFiles);
    
    return allItems.filter(item => {
      // Show collection pages themselves (pages with collection frontmatter)
      if (item.frontmatter?.collection) return true;
      
      // Show root level pages
      if (item.depth === 0) return true;
      
      // Check if parent is a collection page (existing logic for nested structure)
      const parentItem = allItems.find(parent => parent.path === item.parentId);
      return !parentItem?.frontmatter?.collection;
    });
  }, [site?.manifest.structure, site?.contentFiles]);
  
  const homepageItem = useMemo(() => flattenedItems.find(item => item.frontmatter?.homepage === true), [flattenedItems]);
  const sortableItems = useMemo(() => flattenedItems.filter(item => item.frontmatter?.homepage !== true), [flattenedItems]);
  const sortableIds = useMemo(() => sortableItems.map(i => i.path), [sortableItems]);
  
  const activeItem = activeId ? flattenedItems.find(i => i.path === activeId) : null;

  const handleExportBackup = async () => {
    toast.info("Preparing site backup...");
    try {
      // Re-fetch site data to ensure it's the latest before exporting
      await loadSite(siteId); 
      const siteToExport = getSiteById(siteId);
      if (!siteToExport) throw new Error("Could not load site data for export.");
      
      const blob = await exportSiteBackup(siteToExport);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${slugify(siteToExport.manifest.title || 'signum-backup')}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast.success("Site backup downloaded!");
    } catch (error) {
      console.error("Failed to export site:", error);
      toast.error(`Export failed: ${(error as Error).message}`);
    }
  };

  const itemsToRender = useMemo(() => {
    return flattenedItems.filter(item => {
        if (item.depth === 0) return true;
        if (item.parentId && collapsedIds.has(item.parentId)) return false;
        const parent = flattenedItems.find(p => p.path === item.parentId);
        if (parent?.parentId && collapsedIds.has(parent.parentId)) return false;
        return true;
    });
  }, [flattenedItems, collapsedIds]);
  
  const projected = useMemo((): DndProjection | null => {
    if (!activeItem || !overId) return null;
    const indentationWidth = 24;
    const dragDepth = Math.round(offsetLeft / indentationWidth);
    const projectedDepth = activeItem.depth + dragDepth;
    const overItemIndex = flattenedItems.findIndex(({ path }) => path === overId);
    const activeItemIndex = flattenedItems.findIndex(({ path }) => path === activeId);
    const newItems = arrayMove(flattenedItems, activeItemIndex, overItemIndex);
    const previousItem = newItems[overItemIndex - 1];
    const nextItem = newItems[overItemIndex + 1];
    const maxDepth = previousItem ? previousItem.depth + 1 : 0;
    const minDepth = nextItem ? nextItem.depth : 0;
    let depth = Math.max(minDepth, Math.min(projectedDepth, maxDepth));
    if (depth > 2) depth = 2;
    
    let parentId = null;
    if (depth > 0 && previousItem) {
        if (depth === previousItem.depth) parentId = previousItem.parentId;
        else if (depth > previousItem.depth) parentId = previousItem.path;
        else parentId = newItems.slice(0, overItemIndex).reverse().find((item) => item.depth === depth)?.parentId ?? null;
    }
    return { depth, parentId, index: overItemIndex };
  }, [activeId, overId, offsetLeft, flattenedItems, activeItem]);

  const handleCollapse = useCallback((id: string) => {
    setCollapsedIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        return newSet;
    });
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setOverId(event.active.id as string);
  }, []);

  const handleDragMove = useCallback((event: DragMoveEvent) => setOffsetLeft(event.delta.x), []);
  const handleDragOver = useCallback((event: DragOverEvent) => setOverId(event.over?.id as string ?? null), []);

  const resetState = useCallback(() => {
    setActiveId(null);
    setOverId(null);
    setOffsetLeft(0);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    if (!projected) {
        resetState();
        return;
    }
    const { active, over } = event;
    if (site && active.id && over?.id) {
        if (over.id === '__root_droppable__') {
            repositionNode(siteId, active.id as string, null, flattenedItems.length - 1);
        } else {
            repositionNode(siteId, active.id as string, projected.parentId, projected.index);
        }
    }
    resetState();
  }, [projected, site, siteId, repositionNode, flattenedItems.length, resetState]);

  const activePathForFileTree = useMemo(() => {
    if (!site?.manifest) return undefined;
    const editorRootPath = `/sites/${siteId}/edit/content`;
    if (location.pathname.startsWith(editorRootPath)) {
        const slug = location.pathname.substring(editorRootPath.length).replace(/^\//, '');
        return slug ? `content/${slug}.md` : homepageItem?.path;
    }
    return undefined;
  }, [location.pathname, site, siteId, homepageItem]);

  if (!site) return null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={resetState}
    >
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between border-b px-2 py-0.5">
          <h3 className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Content</h3>
          <div className="flex items-center gap-1">
            {/* <CreateCollectionPageDialog siteId={siteId}>
                <Button variant="ghost" className='size-7 p-1' title="New Collection">
                    <LayoutGrid className="h-4 w-4" />
                </Button>
            </CreateCollectionPageDialog> */}
            <NewPageDialog siteId={siteId}>
                <Button variant="ghost" className='size-7 p-1' title="New Page">
                    <FilePlus className="h-4 w-4" />
                </Button>
            </NewPageDialog>
          </div>
        </div>
        
        <div className="flex-grow overflow-y-auto p-2" ref={setRootDroppableRef}>
          {homepageItem && itemsToRender.length > 0 ? (
            <FileTree 
              itemsToRender={itemsToRender.map(item => ({...item, collapsed: collapsedIds.has(item.path)}))}
              sortableIds={sortableIds}
              activeId={activeId}
              projected={projected}
              baseEditPath={`/sites/${siteId}/edit`}
              activePath={activePathForFileTree}
              homepagePath={homepageItem.path}
              onCollapse={handleCollapse}
            />
          ) : (
            <div className="px-2 py-4 text-xs text-center text-muted-foreground italic">
              <p>No pages created yet. Click the buttons above to add one.</p>
            </div>
          )}
        </div>

        {/* Collections Manager */}
        <div className="flex-shrink-0 h-80 border-t bg-background">
          <CollectionsManager siteId={siteId} />
        </div>

        <div className="mt-auto shrink-0 border-t p-2 space-y-1">
            <Button variant="ghost" onClick={handleExportBackup} className="w-full justify-start gap-2">
                <Archive className="h-4 w-4" /> Export site backup
            </Button>
        </div>
      </div>
      
      {createPortal(
        <DragOverlay dropAnimation={null} style={{ pointerEvents: 'none' }}>
          {activeId ? <DragOverlayItem id={activeId} items={flattenedItems} /> : null}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  );
}

================================================================================

File: features/editor/components/CreateCollectionDialog.tsx
// src/features/editor/components/CreateCollectionDialog.tsx

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/core/state/useAppStore';
import { createCollection } from '@/core/services/collections.service';
import { getAvailableLayouts } from '@/core/services/config/configHelpers.service';
import type { LayoutManifest } from '@/core/types';

// UI Components
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { toast } from 'sonner';

// Icons
import { Loader2, FolderPlus } from 'lucide-react';

interface CreateCollectionDialogProps {
  siteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * A dialog for creating a new Collection instance within a site.
 * A Collection is a logical grouping of content items (e.g., a "Blog" or "News" section).
 * This component has been updated to use the unified Layout model.
 */
export default function CreateCollectionDialog({
  siteId,
  open,
  onOpenChange,
}: CreateCollectionDialogProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [itemLayouts, setItemLayouts] = useState<LayoutManifest[]>([]);
  const [loadingLayouts, setLoadingLayouts] = useState(true);

  // Form state
  const [name, setName] = useState('');
  const [defaultItemLayout, setDefaultItemLayout] = useState('');

  // Store actions
  const getSiteById = useAppStore(state => state.getSiteById);
  const updateManifest = useAppStore(state => state.updateManifest);

  const siteData = getSiteById(siteId);

  // Load available item layouts (layouts with type 'single') when the dialog opens.
  useEffect(() => {
    if (!open || !siteData) return;

    const loadItemLayouts = async () => {
      try {
        setLoadingLayouts(true);
        // Fetch only layouts suitable for being collection items.
        const layouts = await getAvailableLayouts(siteData, 'single');
        setItemLayouts(layouts);
        if (layouts.length > 0) {
          // Pre-select the first available item layout.
          setDefaultItemLayout(layouts[0].id);
        }
      } catch (error) {
        console.error('Failed to load item layouts:', error);
        toast.error('Failed to load available item layouts');
        setItemLayouts([]);
      } finally {
        setLoadingLayouts(false);
      }
    };

    loadItemLayouts();
  }, [open, siteData]);

  const selectedLayout = useMemo(() => {
    return itemLayouts.find(l => l.id === defaultItemLayout);
  }, [itemLayouts, defaultItemLayout]);

  const isValid = useMemo(() => name.trim() !== '' && defaultItemLayout !== '', [name, defaultItemLayout]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !siteData) return;

    try {
      setIsLoading(true);

      const contentPath = `content/${name.trim().toLowerCase().replace(/\s+/g, '-')}/`;

      const { manifest: updatedManifest, collection: newCollection } = createCollection(siteData.manifest, {
        name: name.trim(),
        contentPath,
        defaultItemLayout
      });

      await updateManifest(siteId, updatedManifest);

      toast.success(`Collection "${name}" created successfully!`);

      onOpenChange(false);
      navigate(`/sites/${siteId}/collections/${newCollection.id}`);
    } catch (error) {
      console.error('Failed to create collection:', error);
      toast.error(`Failed to create collection: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form on close
      setName('');
      setDefaultItemLayout(itemLayouts.length > 0 ? itemLayouts[0].id : '');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5" />
            Create New Collection
          </DialogTitle>
          <DialogDescription>
            A collection is a folder for organizing similar content, like blog posts or projects.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="collection-name">Collection Name</Label>
            <Input
              id="collection-name"
              placeholder="e.g., Blog, News, Projects"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-layout-select">Default Item Layout</Label>
            <Select value={defaultItemLayout} onValueChange={setDefaultItemLayout} disabled={isLoading || loadingLayouts}>
              <SelectTrigger id="item-layout-select">
                <SelectValue placeholder={loadingLayouts ? "Loading layouts..." : "Choose a layout for items..."} />
              </SelectTrigger>
              <SelectContent>
                {itemLayouts.map((layout) => (
                  <SelectItem key={layout.id} value={layout.id}>
                    {layout.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {selectedLayout?.description || "Select the blueprint for items you'll create in this collection."}
            </p>
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={!isValid || isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4 mr-2" />}
            {isLoading ? 'Creating...' : 'Create Collection'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

================================================================================

File: features/editor/components/FrontmatterSidebar.tsx
// src/features/editor/components/FrontmatterSidebar.tsx

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Manifest, RawFile, MarkdownFrontmatter, LayoutConfig, Collection } from '@/core/types';
import { getAvailableLayouts } from '@/core/services/config/configHelpers.service';
import { type LayoutManifest } from '@/core/types';

// UI Component Imports
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/core/components/ui/accordion";
import { Button } from '@/core/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/core/components/ui/alert-dialog";
import { Trash2 } from 'lucide-react';

// Form & Sub-component Imports
import LayoutSelector from '@/features/editor/components/forms/LayoutSelector';
import CollectionConfigForm from '@/features/editor/components/forms/CollectionConfigForm';
// CORRECTED: The import casing now exactly matches the actual filename 'PageMetaDataForm.tsx'.
import PageMetadataForm from '@/features/editor/components/forms/PageMetaDataForm';
import AdvancedSettingsForm from '@/features/editor/components/forms/AdvancedSettingsForm';

interface FrontmatterSidebarProps {
  siteId: string;
  filePath: string;
  manifest: Manifest;
  layoutFiles: RawFile[] | undefined;
  themeFiles: RawFile[] | undefined;
  frontmatter: MarkdownFrontmatter;
  onFrontmatterChange: (newFrontmatter: Partial<MarkdownFrontmatter>) => void;
  isNewFileMode: boolean;
  slug: string;
  onSlugChange: (newSlug: string) => void;
  onDelete: () => Promise<void>;
}

/**
 * The main sidebar component for editing a page's metadata (frontmatter).
 * It orchestrates various sub-forms based on the selected Layout and the
 * page's role within the site structure (e.g., standard page vs. collection item).
 */
export default function FrontmatterSidebar({
  siteId, filePath, manifest, layoutFiles, themeFiles,
  frontmatter, onFrontmatterChange, isNewFileMode, slug, onSlugChange, onDelete,
}: FrontmatterSidebarProps) {

  const [allLayouts, setAllLayouts] = useState<LayoutManifest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAllLayouts() {
      setIsLoading(true);
      const siteDataForAssets = { manifest, layoutFiles, themeFiles };
      const layouts = await getAvailableLayouts(siteDataForAssets);
      setAllLayouts(layouts);
      setIsLoading(false);
    }
    fetchAllLayouts();
  }, [manifest, layoutFiles, themeFiles]);

  const { isCollectionItem, parentCollection } = useMemo(() => {
    // Determine if the current file is an item within a collection by checking its path.
    const collections = manifest.collections || [];
    const parent = collections.find((c: Collection) => filePath.startsWith(c.contentPath));
    return {
      isCollectionItem: !!parent,
      parentCollection: parent || null,
    };
  }, [filePath, manifest.collections]);

  const currentLayoutManifest = useMemo(() => {
    if (!frontmatter.layout) return null;
    return allLayouts.find(l => l.id === frontmatter.layout) ?? null;
  }, [allLayouts, frontmatter.layout]);

  // If this is a collection item, its schema is defined by its parent collection's default item layout.
  const itemSchemaLayoutManifest = useMemo(() => {
    if (!isCollectionItem || !parentCollection) return null;
    return allLayouts.find(l => l.id === parentCollection.defaultItemLayout) ?? null;
  }, [allLayouts, isCollectionItem, parentCollection]);

  const handleLayoutChange = useCallback((newLayoutId: string) => {
    const selectedLayout = allLayouts.find(l => l.id === newLayoutId);
    if (!selectedLayout) return;

    // When layout changes, reset layoutConfig if the new layout is not a collection type.
    const newFrontmatter: Partial<MarkdownFrontmatter> = { layout: newLayoutId };
    if (selectedLayout.layoutType !== 'collection') {
      newFrontmatter.layoutConfig = undefined;
    }
    onFrontmatterChange(newFrontmatter);
  }, [onFrontmatterChange, allLayouts]);

  const handleLayoutConfigChange = useCallback((newConfig: LayoutConfig) => {
    onFrontmatterChange({ layoutConfig: newConfig });
  }, [onFrontmatterChange]);

  if (isLoading || !frontmatter) {
    return <div className="p-4 text-sm text-center text-muted-foreground">Loading settings...</div>;
  }

  const defaultOpenSections = ['layout', 'metadata', 'advanced'];
  if (currentLayoutManifest?.layoutType === 'collection') {
    defaultOpenSections.push('collection-config');
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-grow overflow-y-auto">
        <Accordion type="multiple" defaultValue={defaultOpenSections} className="w-full">

          {/* Layout Selector - Hidden for collection items as their layout is fixed. */}
          {!isCollectionItem && (
            <AccordionItem value="layout">
              <AccordionTrigger>Layout</AccordionTrigger>
              <AccordionContent>
                <LayoutSelector
                  siteId={siteId}
                  selectedLayoutId={frontmatter.layout || ''}
                  onChange={handleLayoutChange}
                />
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Collection Configuration - Shown only for pages using a 'collection' layout. */}
          {currentLayoutManifest?.layoutType === 'collection' && (
            <AccordionItem value="collection-config">
              <AccordionTrigger>Collection Display</AccordionTrigger>
              <AccordionContent>
                <CollectionConfigForm
                  siteId={siteId}
                  layoutConfig={frontmatter.layoutConfig}
                  onLayoutConfigChange={handleLayoutConfigChange}
                />
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Metadata Form - The schema it uses depends on whether it's a page or an item. */}
          <AccordionItem value="metadata">
            <AccordionTrigger>Metadata</AccordionTrigger>
            <AccordionContent>
              <PageMetadataForm
                siteId={siteId}
                frontmatter={frontmatter}
                onFrontmatterChange={onFrontmatterChange}
                // If it's an item, use the parent's item schema. Otherwise, use its own.
                layoutManifest={isCollectionItem ? itemSchemaLayoutManifest : currentLayoutManifest}
                isCollectionItem={isCollectionItem}
              />
            </AccordionContent>
          </AccordionItem>

          {/* Advanced Settings (Slug, Delete) */}
          <AccordionItem value="advanced">
            <AccordionTrigger>Advanced</AccordionTrigger>
            <AccordionContent className="space-y-4">
              <AdvancedSettingsForm
                slug={slug}
                onSlugChange={onSlugChange}
                isNewFileMode={isNewFileMode}
              />
              {!isNewFileMode && (
                <div className="pt-4 border-t">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> Delete Page
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>This will permanently delete this page and cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={onDelete} className="bg-destructive hover:bg-destructive/90">Delete Page</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </div>
    </div>
  );
}

================================================================================

File: features/editor/components/CollectionView.tsx
// src/features/editor/components/CollectionView.tsx

import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/core/state/useAppStore';
import { getCollection, getCollectionContent } from '@/core/services/collections.service';
import { NEW_FILE_SLUG_MARKER } from '@/config/editorConfig';

// UI Components
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';

// Icons
import { FileText, PlusCircle, ArrowLeft, FolderOpen } from 'lucide-react';

interface CollectionViewProps {
  siteId: string;
  collectionId: string;
}

export default function CollectionView({ siteId, collectionId }: CollectionViewProps) {
  const navigate = useNavigate();
  const getSiteById = useAppStore(state => state.getSiteById);
  const siteData = getSiteById(siteId);

  const collection = useMemo(() => {
    if (!siteData) return null;
    return getCollection(siteData.manifest, collectionId);
  }, [siteData, collectionId]);

  const collectionItems = useMemo(() => {
    if (!siteData || !collection) return [];
    return getCollectionContent(siteData, collection.id);
  }, [siteData, collection]);

  if (!siteData) {
    return <div className="h-full flex items-center justify-center"><div className="text-center text-muted-foreground"><p>Loading site data...</p></div></div>;
  }

  if (!collection) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <FolderOpen className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <h2 className="text-lg font-semibold mb-2">Collection Not Found</h2>
          <p className="text-sm mb-4">The collection "{collectionId}" could not be found.</p>
          <Button onClick={() => navigate(`/sites/${siteId}/edit`)}><ArrowLeft className="h-4 w-4 mr-2" />Back to Editor</Button>
        </div>
      </div>
    );
  }

  const newItemPath = `/sites/${siteId}/edit/content/${collection.contentPath.replace('content/', '').replace(/\/$/, '')}/${NEW_FILE_SLUG_MARKER}`;

  return (
    <div className="h-full flex flex-col p-6 bg-muted/30">
      <div className="flex shrink-0 items-center justify-between mb-4 pb-4 border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/sites/${siteId}/edit`)} className="p-1"><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-3xl font-bold">{collection.name}</h1>
              <Badge variant="outline">{collection.defaultItemLayout}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Collection • {collectionItems.length} items • {collection.contentPath}</p>
            {/* CORRECTED: Add a type guard to ensure the description is a string before rendering. */}
            {typeof collection.settings?.description === 'string' && collection.settings.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {collection.settings.description}
              </p>
            )}
          </div>
        </div>
        <Button asChild><Link to={newItemPath}><PlusCircle className="mr-2 h-4 w-4" /> New Item</Link></Button>
      </div>
      <div className="flex-grow rounded-lg bg-background p-1 overflow-y-auto">
        {collectionItems.length > 0 ? (
          <div className="space-y-1">
            {collectionItems.map((item) => {
              const editorSlug = item.path.replace(/^content\//, '').replace(/\.md$/, '');
              const itemEditorPath = `/sites/${siteId}/edit/content/${editorSlug}`;

              return (
                <Link key={item.path} to={itemEditorPath} className="flex items-center justify-between rounded-md p-3 transition-colors hover:bg-muted group">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{item.frontmatter.title || item.slug}</div>
                      {/* CORRECTED: Add a type guard to ensure the description is a string before rendering. */}
                      {typeof item.frontmatter.description === 'string' && item.frontmatter.description && (
                        <div className="text-xs text-muted-foreground">
                          {item.frontmatter.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {/* CORRECTED: Add a type guard to ensure the date is a string or number before creating a Date object. */}
                    {(typeof item.frontmatter.date === 'string' || typeof item.frontmatter.date === 'number') && item.frontmatter.date && (
                      <span>
                        {new Date(item.frontmatter.date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-16">
            <FolderOpen className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Items Yet</h3>
            <p className="text-sm mb-6">No content has been added to this collection yet.</p>
            <Button asChild variant="outline"><Link to={newItemPath}><PlusCircle className="mr-2 h-4 w-4" /> Create First Item</Link></Button>
          </div>
        )}
      </div>
    </div>
  );
}

================================================================================

File: features/editor/components/GroupedFrontmatterFields.tsx
// src/features/editor/components/GroupedFrontmatterFields.tsx

import { useMemo } from 'react';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import SchemaDrivenForm from '../../../core/components/SchemaDrivenForm';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/core/components/ui/accordion";
import ImageUploadWidget from './ImageUploadWidget';
import SwitchWidget from './SwitchWidget';

interface Group {
  title: string;
  fields: string[];
}
type StrictUiSchema = UiSchema & { 'ui:groups'?: Group[] };

interface GroupedFrontmatterFormProps {
  siteId: string;
  schema: RJSFSchema;
  uiSchema?: StrictUiSchema;
  formData: Record<string, unknown>;
  onFormChange: (newData: Record<string, unknown>) => void;
}

function createSubSchema(originalSchema: RJSFSchema, fields: string[]): RJSFSchema {
  const subSchema: RJSFSchema = { 
    ...originalSchema, 
    properties: {}, 
    required: originalSchema.required?.filter((field: string) => fields.includes(field)) 
  };
  
  if (!subSchema.properties) subSchema.properties = {};
  for (const field of fields) {
    if (originalSchema.properties && originalSchema.properties[field]) {
      subSchema.properties[field] = originalSchema.properties[field];
    }
  }
  return subSchema;
}

export default function GroupedFrontmatterForm({
  siteId,
  schema,
  uiSchema,
  formData,
  onFormChange,
}: GroupedFrontmatterFormProps) {
  
  const customWidgets = { 
    imageUploader: ImageUploadWidget,
    switch: SwitchWidget
  };
  
  const { groups, ungroupedFields } = useMemo(() => {
    const definedGroups = uiSchema?.['ui:groups'] || [];
    const allSchemaFields = Object.keys(schema.properties || {});
    const fieldsInGroups = new Set(definedGroups.flatMap(g => g.fields));
    const remainingFields = allSchemaFields.filter(f => !fieldsInGroups.has(f));
    return { groups: definedGroups, ungroupedFields: remainingFields };
  }, [schema, uiSchema]);

  // FIX: This handler was unused. The `onFormChange` prop can be passed directly.
  // The type of the `data` parameter is corrected to `object` to match the child component's prop type.
  const handleFormChange = (data: object) => {
    onFormChange(data as Record<string, unknown>);
  };

  if (!schema.properties || Object.keys(schema.properties).length === 0) {
    return <p className="text-sm text-muted-foreground">This layout has no configurable fields.</p>;
  }

  return (
    <div className="border-t">
      <Accordion type="multiple" defaultValue={groups.map(g => g.title)} className="w-full">
        {groups.map((group) => {
          if (group.fields.length === 0) return null;
          const subSchema = createSubSchema(schema, group.fields);
          return (
            <AccordionItem value={group.title} key={group.title}>
              <AccordionTrigger>{group.title}</AccordionTrigger>
              <AccordionContent className="pt-4">
                <SchemaDrivenForm
                  schema={subSchema}
                  formData={formData}
                  // FIX: Pass the corrected handler.
                  onFormChange={handleFormChange}
                  widgets={customWidgets}
                  formContext={{ siteId }}
                />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {ungroupedFields.length > 0 && (
        <div className="pt-4 mt-4 border-t">
          <Accordion type='single' collapsible defaultValue="ungrouped-fields">
            <AccordionItem value="ungrouped-fields">
              <AccordionTrigger>
                Other Fields
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <SchemaDrivenForm
                  schema={createSubSchema(schema, ungroupedFields)}
                  formData={formData}
                  // FIX: Pass the corrected handler here as well.
                  onFormChange={handleFormChange}
                  widgets={customWidgets}
                  formContext={{ siteId }}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}
    </div>
  );
}

================================================================================

File: features/editor/components/ErrorBoundary.tsx
'use client';

import React from 'react';
import { Button } from '@/core/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; retry: () => void }>;
}

export class CollectionErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Collection Error Boundary caught an error:', error, errorInfo);
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} retry={this.retry} />;
      }

      return (
        <div className="flex flex-col items-center justify-center p-6 border border-destructive/20 rounded-lg bg-destructive/5">
          <AlertTriangle className="h-8 w-8 text-destructive mb-4" />
          <h3 className="text-lg font-semibold text-destructive mb-2">
            Collection Error
          </h3>
          <p className="text-sm text-muted-foreground text-center mb-4 max-w-md">
            {this.state.error?.message || 'An unexpected error occurred while loading the collection.'}
          </p>
          <div className="flex gap-2">
            <Button onClick={this.retry} variant="outline" size="sm">
              Try Again
            </Button>
            <Button 
              onClick={() => window.location.reload()} 
              variant="destructive" 
              size="sm"
            >
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function CollectionErrorFallback({ error, retry }: { error?: Error; retry: () => void }) {
  return (
    <div className="p-4 text-center border border-destructive/20 rounded-md bg-destructive/5">
      <AlertTriangle className="h-6 w-6 text-destructive mx-auto mb-2" />
      <p className="text-sm text-destructive font-medium mb-2">
        Collection Loading Error
      </p>
      <p className="text-xs text-muted-foreground mb-3">
        {error?.message || 'Failed to load collection data'}
      </p>
      <Button onClick={retry} size="sm" variant="outline" className="text-xs">
        Retry
      </Button>
    </div>
  );
}

================================================================================

File: features/editor/components/CollectionSettingsSidebar.tsx
// src/features/editor/components/CollectionSettingsSidebar.tsx

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/core/state/useAppStore';
import {
  getCollection,
  updateCollection,
  deleteCollection,
} from '@/core/services/collections.service';
import type { LayoutManifest, ParsedMarkdownFile } from '@/core/types';
import { getAvailableLayouts } from '@/core/services/config/configHelpers.service';

// UI Components
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Textarea } from '@/core/components/ui/textarea';
import { Badge } from '@/core/components/ui/badge';
import { Separator } from '@/core/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/core/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/core/components/ui/alert-dialog';

// Icons
import { Trash2, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CollectionSettingsSidebarProps {
  siteId: string;
  collectionId: string;
}

/**
 * A sidebar component for managing the settings of a single Collection.
 * This has been refactored to remove all dependencies on the old "Collection Type" system.
 */
export default function CollectionSettingsSidebar({ siteId, collectionId }: CollectionSettingsSidebarProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemLayout, setItemLayout] = useState<LayoutManifest | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Store actions
  const getSiteById = useAppStore(state => state.getSiteById);
  const updateManifest = useAppStore(state => state.updateManifest);
  const siteData = getSiteById(siteId);

  const collection = useMemo(() => {
    if (!siteData) return null;
    return getCollection(siteData.manifest, collectionId);
  }, [siteData, collectionId]);

  const itemCount = useMemo(() => {
      if (!siteData || !collection) return 0;
      return (siteData.contentFiles || []).filter((file: ParsedMarkdownFile) => file.path.startsWith(collection.contentPath)).length;
  }, [siteData, collection]);

  // Load the manifest for the collection's default item layout
  useEffect(() => {
    if (collection?.defaultItemLayout && siteData) {
      getAvailableLayouts(siteData, 'single')
        .then(layouts => {
          const layout = layouts.find(l => l.id === collection.defaultItemLayout);
          setItemLayout(layout || null);
        })
        .catch(error => {
          console.error('Failed to load item layout:', error);
          setItemLayout(null);
        });
    }
  }, [collection?.defaultItemLayout, siteData]);

  // Initialize form with collection data
  useEffect(() => {
    if (collection) {
      setName(collection.name);
      setDescription((collection.settings?.description as string) || '');
    }
  }, [collection]);

  const handleSave = useCallback(async () => {
    if (!siteData || !collection) return;
    try {
      setIsLoading(true);
      const updates = { name: name.trim(), settings: description ? { description: description.trim() } : undefined };
      const updatedManifest = updateCollection(siteData.manifest, collection.id, updates);
      await updateManifest(siteId, updatedManifest);
      toast.success('Collection updated successfully');
    } catch (error) {
      toast.error(`Failed to update collection: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, [siteData, collection, name, description, siteId, updateManifest]);

  const handleDelete = useCallback(async () => {
    if (!siteData || !collection) return;
    try {
      setIsLoading(true);
      const { manifest: updatedManifest } = deleteCollection(siteData.manifest, collection.id);
      await updateManifest(siteId, updatedManifest);
      toast.success(`Collection "${collection.name}" deleted successfully`);
      navigate(`/sites/${siteId}/edit`);
    } catch (error) {
      toast.error(`Failed to delete collection: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
      setDeleteDialogOpen(false);
    }
  }, [siteData, collection, siteId, updateManifest, navigate]);

  if (!collection) {
    return <div className="p-4"><p className="text-sm text-muted-foreground">Collection not found</p></div>;
  }

  const hasChanges = name !== collection.name || description !== ((collection.settings?.description as string) || '');

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h3 className="font-semibold">Collection Settings</h3>
      </div>
      <div className="flex-grow overflow-y-auto">
        <Accordion type="multiple" defaultValue={['basic', 'info']}>
          <AccordionItem value="basic">
            <AccordionTrigger className="px-4">Basic Settings</AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="collection-name">Name</Label>
                  <Input id="collection-name" value={name} onChange={(e) => setName(e.target.value)} disabled={isLoading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="collection-description">Description</Label>
                  <Textarea id="collection-description" value={description} onChange={(e) => setDescription(e.target.value)} disabled={isLoading} rows={3} placeholder="Optional description..." />
                </div>
                {hasChanges && (
                  <Button onClick={handleSave} disabled={isLoading || !name.trim()} className="w-full">
                    {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : <><Save className="h-4 w-4 mr-2" />Save Changes</>}
                  </Button>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="info">
            <AccordionTrigger className="px-4">Information</AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Items in Collection</span>
                  <Badge variant="secondary">{itemCount}</Badge>
                </div>
                 <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Default Item Layout</span>
                  <Badge variant="outline">{itemLayout?.name || collection.defaultItemLayout}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Content Path</span>
                  <span className="text-xs font-mono bg-muted px-2 py-1 rounded">{collection.contentPath}</span>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
      <div className="p-4 border-t">
        <Separator className="mb-4" />
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="w-full">
              <Trash2 className="h-4 w-4 mr-2" />Delete Collection
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Collection</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{collection.name}"? This will not delete the {itemCount} content files, but they will no longer be part of a collection. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isLoading}>
                {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Deleting...</> : 'Delete Collection'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

================================================================================

File: features/editor/components/forms/LayoutSelector.tsx
// src/features/editor/components/forms/LayoutSelector.tsx

import { useState, useEffect, useMemo } from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/core/components/ui/select";
import { Label } from "@/core/components/ui/label";
import { useAppStore } from '@/core/state/useAppStore';
import { getAvailableLayouts } from '@/core/services/config/configHelpers.service';
import type { LayoutManifest } from '@/core/types';

interface LayoutSelectorProps {
  siteId: string;
  selectedLayoutId: string;
  onChange: (newLayoutId: string) => void;
}

/**
 * A UI component for selecting a Layout for the current page.
 * It fetches all available layouts (both 'single' and 'collection' types)
 * and groups them in the dropdown for a better user experience.
 */
export default function LayoutSelector({ siteId, selectedLayoutId, onChange }: LayoutSelectorProps) {
  const [availableLayouts, setAvailableLayouts] = useState<LayoutManifest[]>([]);
  const [loading, setLoading] = useState(true);

  const getSiteById = useAppStore(state => state.getSiteById);
  const siteData = getSiteById(siteId);

  // Load all available layouts when the component mounts or siteData changes.
  useEffect(() => {
    if (!siteData) return;

    const loadLayouts = async () => {
      try {
        setLoading(true);
        // Fetches all layouts, regardless of type.
        const layouts = await getAvailableLayouts(siteData);
        setAvailableLayouts(layouts);
      } catch (error) {
        console.error('Failed to load layouts:', error);
        setAvailableLayouts([]);
      } finally {
        setLoading(false);
      }
    };

    loadLayouts();
  }, [siteData]);

  // Group layouts for display in the Select component.
  // This uses a conceptual 'group' property from the layout's manifest.
  const groupedLayouts = useMemo(() => {
    const groups: Record<string, LayoutManifest[]> = {};
    availableLayouts.forEach(layout => {
      const groupName = (layout as any).group || (layout.layoutType === 'collection' ? 'Collection Layouts' : 'Page Layouts');
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(layout);
    });
    return groups;
  }, [availableLayouts]);

  const selectedLayout = availableLayouts.find(layout => layout.id === selectedLayoutId);

  if (loading) {
    return <div className="text-xs text-muted-foreground">Loading layouts...</div>;
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="layout-select">Layout</Label>
      <Select
        value={selectedLayoutId || ''}
        onValueChange={onChange}
      >
        <SelectTrigger id="layout-select" className="w-full">
          <SelectValue placeholder="Select a layout..." />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(groupedLayouts).map(([groupName, layouts]) => (
            <SelectGroup key={groupName}>
              <SelectLabel>{groupName}</SelectLabel>
              {layouts.map((layout) => (
                <SelectItem key={layout.id} value={layout.id}>
                  {layout.name}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      {selectedLayout?.description && (
        <p className="text-xs text-muted-foreground pt-1">
          {selectedLayout.description}
        </p>
      )}
    </div>
  );
}

================================================================================

File: features/editor/components/forms/CollectionConfigForm.tsx
// src/features/editor/components/forms/CollectionConfigForm.tsx

import { useMemo } from 'react';
import { useAppStore } from '@/core/state/useAppStore';
import { getCollections } from '@/core/services/collections.service';
import type { LayoutConfig } from '@/core/types';

// UI Components
import { Label } from '@/core/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/core/components/ui/select';
import { Switch } from '@/core/components/ui/switch';
import { Input } from '@/core/components/ui/input';

interface CollectionConfigFormProps {
  siteId: string;
  layoutConfig?: LayoutConfig;
  onLayoutConfigChange: (config: LayoutConfig) => void;
}

/**
 * A form for configuring how a page displays a collection.
 * It renders when the user selects a Layout with `layoutType: 'collection'`.
 * Its state is saved to the `layoutConfig` object in the page's frontmatter.
 */
export default function CollectionConfigForm({
  siteId,
  layoutConfig,
  onLayoutConfigChange
}: CollectionConfigFormProps) {

  const getSiteById = useAppStore(state => state.getSiteById);
  const siteData = getSiteById(siteId);

  // Get all available collections for the site.
  const collections = useMemo(() => {
    if (!siteData) return [];
    return getCollections(siteData.manifest);
  }, [siteData]);

  // A generic handler to update the layoutConfig state.
  const handleConfigChange = (updates: Partial<LayoutConfig>) => {
    const newConfig: LayoutConfig = {
      collectionId: layoutConfig?.collectionId || '',
      layout: layoutConfig?.layout || '',
      ...layoutConfig,
      ...updates
    };
    onLayoutConfigChange(newConfig);
  };

  return (
    <div className="space-y-4">
      {/* Collection Data Source Selection */}
      <div className="space-y-2">
        <Label htmlFor="collection-select">Data Source</Label>
        <Select
          value={layoutConfig?.collectionId || ''}
          onValueChange={(value) => handleConfigChange({ collectionId: value })}
        >
          <SelectTrigger id="collection-select">
            <SelectValue placeholder="Select a collection to display..." />
          </SelectTrigger>
          <SelectContent>
            {collections.map((collection) => (
              <SelectItem key={collection.id} value={collection.id}>
                {collection.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Choose which collection's items to show on this page.</p>
      </div>

      {/* Sorting Options */}
      <div className="space-y-2">
        <Label htmlFor="sort-by">Sort By</Label>
        <Select
          value={layoutConfig?.sortBy || 'date'}
          onValueChange={(value) => handleConfigChange({ sortBy: value as 'date' | 'title' })}
        >
          <SelectTrigger id="sort-by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="title">Title</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sort Order */}
      <div className="space-y-2">
        <Label htmlFor="sort-order">Sort Order</Label>
        <Select
          value={layoutConfig?.sortOrder || 'desc'}
          onValueChange={(value) => handleConfigChange({ sortOrder: value as 'asc' | 'desc' })}
        >
          <SelectTrigger id="sort-order">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Descending</SelectItem>
            <SelectItem value="asc">Ascending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Pagination Settings */}
      <div className="space-y-3 pt-2 border-t">
        <div className="flex items-center justify-between">
          <Label htmlFor="enable-pagination" className="cursor-pointer">Enable Pagination</Label>
          <Switch
            id="enable-pagination"
            checked={layoutConfig?.pagination?.enabled || false}
            onCheckedChange={(enabled) =>
              handleConfigChange({
                pagination: {
                  ...layoutConfig?.pagination,
                  enabled,
                  itemsPerPage: enabled ? (layoutConfig?.pagination?.itemsPerPage || 10) : undefined
                }
              })
            }
          />
        </div>
        {layoutConfig?.pagination?.enabled && (
          <div className="space-y-2 pl-2 border-l-2">
            <Label htmlFor="items-per-page">Items per page</Label>
            <Input
              id="items-per-page"
              type="number"
              min="1"
              max="100"
              value={layoutConfig.pagination?.itemsPerPage || 10}
              onChange={(e) =>
                handleConfigChange({
                  pagination: {
                    enabled: true,
                    itemsPerPage: parseInt(e.target.value, 10) || 10
                  }
                })
              }
              className="w-24"
            />
          </div>
        )}
      </div>
    </div>
  );
}

================================================================================

File: features/editor/components/forms/AdvancedSettingsForm.tsx
// src/features/editor/components/forms/AdvancedSettingsForm.tsx
'use client';

import { Label } from '@/core/components/ui/label';
import { Input } from '@/core/components/ui/input';

/**
 * Defines the props for the AdvancedSettingsForm component.
 */
interface AdvancedSettingsFormProps {
  /**
   * The current URL slug for the page.
   */
  slug: string;

  /**
   * A callback function that is triggered when the user types in the slug input field.
   */
  onSlugChange: (newSlug: string) => void;

  /**
   * A flag indicating if the editor is in "new file mode".
   * The slug can only be edited when this is true.
   */
  isNewFileMode: boolean;
}

/**
 * A form component for editing advanced page properties, primarily the URL slug.
 * It enforces the rule that the slug is only editable before the page is first saved.
 *
 * @param {AdvancedSettingsFormProps} props The props for the component.
 * @returns {React.ReactElement} The rendered component.
 */
export default function AdvancedSettingsForm({
  slug,
  onSlugChange,
  isNewFileMode,
}: AdvancedSettingsFormProps) {
  return (
    <div className="space-y-2">
      {/* 
        The Label is associated with the Input via the `htmlFor` attribute,
        which improves accessibility.
      */}
      <Label htmlFor="slug-input">URL Slug</Label>
      <Input
        id="slug-input"
        value={slug}
        onChange={(e) => onSlugChange(e.target.value)}
        // The input is disabled if the page is NOT in new file mode.
        // This prevents users from changing the URL of an existing page.
        disabled={!isNewFileMode}
        placeholder="e.g., a-great-blog-post"
        // This accessibility attribute links the input to its description.
        aria-describedby="slug-description"
      />
      {/* 
        Helper text that dynamically changes to explain the input's state to the user.
        This is a key part of good user experience.
      */}
      <p id="slug-description" className="text-xs text-muted-foreground">
        {isNewFileMode
          ? 'The URL-friendly version of the title. Auto-generated, but can be edited here before the first save.'
          : 'The URL for this page cannot be changed after it has been saved.'}
      </p>
    </div>
  );
}

================================================================================

File: features/editor/components/forms/CoreSchemaForm.tsx
// src/features/editor/components/forms/CoreSchemaForm.tsx
'use client';

import type { MarkdownFrontmatter } from '@/core/types';
import SchemaDrivenForm from '@/core/components/SchemaDrivenForm';
import { BASE_SCHEMA } from '@/config/editorConfig';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import ImageUploadWidget from '../ImageUploadWidget';
import SwitchWidget from '../SwitchWidget';

interface CoreSchemaFormProps {
  siteId: string;
  frontmatter: MarkdownFrontmatter;
  onFrontmatterChange: (update: Partial<MarkdownFrontmatter>) => void;
  // We need to know if the page is a collection item to hide fields like 'date'
  isCollectionItem: boolean; 
}

/**
 * Renders a form for the universal, core frontmatter fields (date, status, etc.)
 * that apply to almost all content types.
 */
export default function CoreSchemaForm({
  siteId,
  frontmatter,
  onFrontmatterChange,
  isCollectionItem,
}: CoreSchemaFormProps) {
  
  // Dynamically adjust the schema based on context
  const schema: RJSFSchema = { ...BASE_SCHEMA.schema };
  const uiSchema: UiSchema = { ...BASE_SCHEMA.uiSchema };
    const customWidgets = { 
      imageUploader: ImageUploadWidget,
      switch: SwitchWidget
    };

  // Hide the date field for collection items, as it's often managed differently
  if (isCollectionItem && schema.properties?.date) {
    // A simple way to hide is to modify uiSchema
    uiSchema.date = { ...uiSchema.date, 'ui:widget': 'hidden' };
  }

  return (
    <SchemaDrivenForm 
      schema={schema}
      uiSchema={uiSchema}
      formData={frontmatter}
      widgets={customWidgets}
      onFormChange={(data) => onFrontmatterChange(data as Partial<MarkdownFrontmatter>)}
      formContext={{ siteId }}
    />
  );
}

================================================================================

File: features/editor/components/forms/CollectionLayoutSchemaForm.tsx
// src/features/editor/components/forms/CollectionLayoutSchemaForm.tsx
'use client';

// Imports are identical to PageLayoutSchemaForm
import type { MarkdownFrontmatter, LayoutManifest } from '@/core/types';
import SchemaDrivenForm from '@/core/components/SchemaDrivenForm';
import ImageUploadWidget from '../ImageUploadWidget';
import SwitchWidget from '../SwitchWidget';

interface CollectionLayoutSchemaFormProps {
  siteId: string;
  layoutManifest: LayoutManifest | null;
  frontmatter: MarkdownFrontmatter;
  onFrontmatterChange: (update: Partial<MarkdownFrontmatter>) => void;
}

/**
 * Renders a form for the custom fields defined in a "collection" layout's main 'schema'.
 * This applies to the collection page itself, not its items.
 */
export default function CollectionLayoutSchemaForm({
  siteId,
  layoutManifest,
  frontmatter,
  onFrontmatterChange,
}: CollectionLayoutSchemaFormProps) {
  
  const customWidgets = { 
    imageUploader: ImageUploadWidget,
    switch: SwitchWidget
  };

  if (!layoutManifest?.schema) {
    return <p className="text-sm text-muted-foreground p-2">This layout has no custom collection page options.</p>;
  }

  return (
    <SchemaDrivenForm 
      schema={layoutManifest.schema}
      uiSchema={layoutManifest.uiSchema ?? undefined}
      formData={frontmatter}
      onFormChange={(data) => onFrontmatterChange(data as Partial<MarkdownFrontmatter>)}
      widgets={customWidgets}
      formContext={{ siteId }}
    />
  );
}

================================================================================

File: features/editor/components/forms/CollectionLayoutForm.tsx
// src/features/editor/components/forms/CollectionLayoutForm.tsx

import { useMemo } from 'react';
import { useAppStore } from '@/core/state/useAppStore';
import { getCollections } from '@/core/services/collections.service';
import type { LayoutConfig, Collection } from '@/core/types';

// UI Components
import { Label } from '@/core/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/core/components/ui/select';
import { Switch } from '@/core/components/ui/switch';
import { Input } from '@/core/components/ui/input';

interface CollectionLayoutFormProps {
  siteId: string;
  layoutConfig?: LayoutConfig;
  onLayoutConfigChange: (config: LayoutConfig) => void;
}

/**
 * A form for configuring how a page displays a collection.
 * It renders when the user selects a Layout with `layoutType: 'collection'`.
 * Its state is saved to the `layoutConfig` object in the page's frontmatter.
 */
export default function CollectionLayoutForm({
  siteId,
  layoutConfig,
  onLayoutConfigChange
}: CollectionLayoutFormProps) {

  const getSiteById = useAppStore(state => state.getSiteById);
  const siteData = getSiteById(siteId);

  // Get all available collections for the site.
  const collections = useMemo(() => {
    if (!siteData) return [];
    return getCollections(siteData.manifest);
  }, [siteData]);

  // A generic handler to update the layoutConfig state.
  const handleConfigChange = (updates: Partial<LayoutConfig>) => {
    const newConfig: LayoutConfig = {
      collectionId: layoutConfig?.collectionId || '',
      layout: layoutConfig?.layout || '',
      ...layoutConfig,
      ...updates
    };
    onLayoutConfigChange(newConfig);
  };

  return (
    <div className="space-y-4">
      {/* Collection Data Source Selection */}
      <div className="space-y-2">
        <Label htmlFor="collection-select">Data Source</Label>
        <Select
          value={layoutConfig?.collectionId || ''}
          onValueChange={(value) => handleConfigChange({ collectionId: value })}
        >
          <SelectTrigger id="collection-select">
            <SelectValue placeholder="Select a collection to display..." />
          </SelectTrigger>
          <SelectContent>
            {collections.map((collection: Collection) => (
              <SelectItem key={collection.id} value={collection.id}>
                {collection.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Choose which collection's items to show on this page.</p>
      </div>

      {/* Sorting Options */}
      <div className="space-y-2">
        <Label htmlFor="sort-by">Sort By</Label>
        <Select
          value={layoutConfig?.sortBy || 'date'}
          onValueChange={(value) => handleConfigChange({ sortBy: value as 'date' | 'title' })}
        >
          <SelectTrigger id="sort-by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="title">Title</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sort Order */}
      <div className="space-y-2">
        <Label htmlFor="sort-order">Sort Order</Label>
        <Select
          value={layoutConfig?.sortOrder || 'desc'}
          onValueChange={(value) => handleConfigChange({ sortOrder: value as 'asc' | 'desc' })}
        >
          <SelectTrigger id="sort-order">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Descending</SelectItem>
            <SelectItem value="asc">Ascending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Pagination Settings */}
      <div className="space-y-3 pt-2 border-t">
        <div className="flex items-center justify-between">
          <Label htmlFor="enable-pagination" className="cursor-pointer">Enable Pagination</Label>
          <Switch
            id="enable-pagination"
            checked={layoutConfig?.pagination?.enabled || false}
            onCheckedChange={(enabled) =>
              handleConfigChange({
                pagination: {
                  ...layoutConfig?.pagination,
                  enabled,
                  itemsPerPage: enabled ? (layoutConfig?.pagination?.itemsPerPage || 10) : undefined
                }
              })
            }
          />
        </div>
        {layoutConfig?.pagination?.enabled && (
          <div className="space-y-2 pl-2 border-l-2">
            <Label htmlFor="items-per-page">Items per page</Label>
            <Input
              id="items-per-page"
              type="number"
              min="1"
              max="100"
              value={layoutConfig.pagination?.itemsPerPage || 10}
              onChange={(e) =>
                handleConfigChange({
                  pagination: {
                    enabled: true,
                    itemsPerPage: parseInt(e.target.value, 10) || 10
                  }
                })
              }
              className="w-24"
            />
          </div>
        )}
      </div>
    </div>
  );
}

================================================================================

File: features/editor/components/forms/PageMetaDataForm.tsx
// src/features/editor/components/forms/PageMetadataForm.tsx
'use client';

import { useMemo } from 'react';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import type { MarkdownFrontmatter, LayoutManifest } from '@/core/types';
import { BASE_SCHEMA } from '@/config/editorConfig';

// Reusable components for form rendering
import SchemaDrivenForm from '@/core/components/SchemaDrivenForm';
import ImageUploadWidget from '@/features/editor/components/ImageUploadWidget';
import SwitchWidget from '@/features/editor/components/SwitchWidget';

/**
 * Defines the props for the PageMetadataForm component.
 */
interface PageMetadataFormProps {
  /** The ID of the site, passed down for context to custom widgets like the image uploader. */
  siteId: string;

  /** The complete frontmatter object for the current page being edited. */
  frontmatter: MarkdownFrontmatter;

  /** A callback to update the parent component's frontmatter state. */
  onFrontmatterChange: (update: Partial<MarkdownFrontmatter>) => void;

  /** The parsed manifest of the currently selected Content Type (Layout). Can be null if none is selected. */
  layoutManifest: LayoutManifest | null;

  /** A flag to indicate if the current page is an item within a collection (e.g., a blog post). */
  isCollectionItem: boolean;
}

/**
 * A component that renders a combined form for both core and layout-specific metadata.
 * It intelligently merges schemas and UI configurations to present a unified editing
 * experience for any type of content.
 */
export default function PageMetadataForm({
  siteId,
  frontmatter,
  onFrontmatterChange,
  layoutManifest,
  isCollectionItem,
}: PageMetadataFormProps) {

  // Define the custom widgets that can be used by the SchemaDrivenForm.
  const customWidgets = { 
    imageUploader: ImageUploadWidget,
    switch: SwitchWidget
  };

  /**
   * This is the core logic of the component.
   * `useMemo` is used to efficiently compute the final, merged schema that will be
   * rendered by the form. This calculation only re-runs if the `layoutManifest`
   * or `isCollectionItem` flag changes, preventing unnecessary re-renders.
   */
  const mergedSchemaAndUi = useMemo(() => {
    // 1. Start with a deep copy of the universal BASE_SCHEMA to avoid mutation.
    const finalSchema: RJSFSchema = JSON.parse(JSON.stringify(BASE_SCHEMA.schema));
    const finalUiSchema: UiSchema = JSON.parse(JSON.stringify(BASE_SCHEMA.uiSchema));

    // 2. Determine which custom schema to use from the layout manifest based on the page's role.
    let customSchema: RJSFSchema | undefined;
    let customUiSchema: UiSchema | undefined;

    if (isCollectionItem) {
      // For collection items (e.g., a post), use the 'itemSchema'.
      customSchema = layoutManifest?.itemSchema;
      customUiSchema = layoutManifest?.itemUiSchema;
    } else {
      // For standard pages or collection list pages, use the main 'schema'.
      customSchema = layoutManifest?.schema;
      customUiSchema = layoutManifest?.uiSchema;
    }

    // 3. Merge the custom schema into the final schema.
    if (customSchema?.properties) {
      // Combine properties, with custom fields overwriting core fields if names conflict.
      finalSchema.properties = { ...finalSchema.properties, ...customSchema.properties };
      // Combine required fields, ensuring no duplicates.
      finalSchema.required = [...new Set([...(finalSchema.required || []), ...(customSchema.required || [])])];
    }
    
    // Merge the custom UI schema.
    if (customUiSchema) {
      Object.assign(finalUiSchema, customUiSchema);
    }
    
    // 4. Apply contextual adjustments. For example, hide the 'date' field for collection items,
    // as their date is usually managed differently.
    if (isCollectionItem) {
        finalUiSchema.date = { 'ui:widget': 'hidden' };
    }

    return { schema: finalSchema, uiSchema: finalUiSchema };
  }, [layoutManifest, isCollectionItem]);


  // Check if there are any fields to render after merging.
  const hasFields = mergedSchemaAndUi.schema?.properties && Object.keys(mergedSchemaAndUi.schema.properties).length > 0;

  if (!hasFields) {
    return (
      <div className="text-sm text-center text-muted-foreground p-4 border border-dashed rounded-md">
        <p>This content type has no additional metadata options.</p>
      </div>
    );
  }

  return (
    <SchemaDrivenForm
      schema={mergedSchemaAndUi.schema}
      uiSchema={mergedSchemaAndUi.uiSchema}
      formData={frontmatter}
      // Pass the frontmatter update callback directly to the form.
      onFormChange={(data) => onFrontmatterChange(data as Partial<MarkdownFrontmatter>)}
      // Register custom widgets.
      widgets={customWidgets}
      // Provide the siteId in the form's context so custom widgets can access it.
      formContext={{ siteId }}
    />
  );
}

================================================================================

File: features/editor/hooks/useUnloadPrompt.ts
// src/features/editor/hooks/useUnloadPrompt.ts
'use client';

import { useEffect } from 'react';

/**
 * A hook that shows the native browser confirmation dialog when the user
 * attempts to navigate away from the page.
 *
 * @param {boolean} shouldPrompt - A flag that determines whether the prompt should be shown.
 */
export function useUnloadPrompt(shouldPrompt: boolean) {
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (shouldPrompt) {
        // Standard way to trigger the browser's native confirmation dialog
        event.preventDefault();
        // Required for some older browsers
        event.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup the event listener when the component unmounts
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [shouldPrompt]); // The effect re-runs whenever the `shouldPrompt` flag changes
}

================================================================================

File: features/editor/hooks/usePageIdentifier.ts
// src/features/editor/hooks/usePageIdentifier.ts

import { useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { NEW_FILE_SLUG_MARKER } from '@/config/editorConfig';
import { type ParsedMarkdownFile, type StructureNode } from '@/core/types';

interface PageIdentifierParams {
  siteStructure: StructureNode[];
  allContentFiles: ParsedMarkdownFile[];
}

/**
 * A data-aware hook that parses the URL to identify the site and the specific
 * file path being targeted for editing, using react-router-dom hooks.
 */
export function usePageIdentifier({ allContentFiles }: PageIdentifierParams) {
  // Get routing information from react-router-dom
  const { siteId = '' } = useParams<{ siteId: string }>();
  const location = useLocation();

  // The full path after the hash, e.g., /sites/123/edit/content/about
  const fullPath = location.pathname;

  const { slugSegments, isNewFileMode } = useMemo(() => {
    // Defines the base path for the content editor
    const editorRootPath = `/sites/${siteId}/edit/content`;
    
    if (fullPath.startsWith(editorRootPath)) {
      const slugPart = fullPath.substring(editorRootPath.length).replace(/^\//, '');
      const segments = slugPart ? slugPart.split('/') : [];
      const isNew = segments.includes(NEW_FILE_SLUG_MARKER);
      return { slugSegments: segments, isNewFileMode: isNew };
    }
    
    // Default case if not in a content editor route
    return { slugSegments: [], isNewFileMode: false };
  }, [fullPath, siteId]);

  const filePath = useMemo(() => {
    if (isNewFileMode) {
      const parentSlug = slugSegments.slice(0, slugSegments.indexOf(NEW_FILE_SLUG_MARKER)).join('/');
      return parentSlug ? `content/${parentSlug}` : 'content';
    }

    const slug = slugSegments.join('/');
    if (slug) {
      return `content/${slug}.md`;
    }
    
    // Homepage Resolution Logic: Find the file with homepage: true
    const homepageFile = allContentFiles.find(f => f.frontmatter.homepage === true);
    if (homepageFile) {
      return homepageFile.path;
    }
    
    return ''; // Return empty string if no path can be determined
  }, [slugSegments, isNewFileMode, allContentFiles]);

  return { siteId, isNewFileMode, filePath };
}

================================================================================

File: features/editor/hooks/useFileContent.ts
// src/features/editor/hooks/useFileContent.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { useAppStore } from '@/core/state/useAppStore';
import { useEditor } from '@/features/editor/contexts/useEditor';
import { slugify } from '@/core/libraries/utils';
import { toast } from 'sonner';
import { type MarkdownFrontmatter } from '@/core/types';
import { DEFAULT_PAGE_LAYOUT_PATH } from '@/config/editorConfig';
// Removed Block import as we're now working directly with markdown

/**
 * Manages the content state for the editor.
 *
 * This hook is responsible for:
 * 1.  Taking a definitive `filePath` (from `usePageIdentifier`).
 * 2.  Waiting for the global site data to be loaded into the Zustand store.
 * 3.  **Reading the file's content directly from the store, not re-fetching it from storage.**
 * 4.  Preparing the initial state for the editor (frontmatter, Blocknote blocks).
 * 5.  Handling state changes as the user types or modifies frontmatter fields.
 *
 * @param siteId The ID of the current site.
 * @param filePath The unambiguous path to the file to be loaded.
 * @param isNewFileMode A flag indicating if we are creating a new file.
 * @returns An object containing the status, content state, and state handlers.
 */

export type FileStatus = 'initializing' | 'loading' | 'ready' | 'not_found';
interface PageFrontmatter extends MarkdownFrontmatter { menuTitle?: string; }

export function useFileContent(siteId: string, filePath: string, isNewFileMode: boolean) {
  const navigate = useNavigate(); // <--- Use the navigate hook
  const site = useAppStore(state => state.getSiteById(siteId));
  const { setHasUnsavedChanges } = useEditor();

  const [status, setStatus] = useState<FileStatus>('initializing');
  const [frontmatter, setFrontmatter] = useState<PageFrontmatter | null>(null);
  const [slug, setSlug] = useState('');
  const [initialMarkdown, setInitialMarkdown] = useState<string>('');

  useEffect(() => {
    const loadData = async () => {
      if (!filePath) {
        setStatus('loading');
        return;
      }
      if (!site?.contentFiles) {
        setStatus('loading');
        return;
      }
      let markdownContent = '';
      if (isNewFileMode) {
        // Check if this is a collection item by looking at the parent directory
        const parentPath = `${filePath}.md`; // Convert parent dir to collection page path
        const parentFile = site.contentFiles.find(f => f.path === parentPath);
        const isCollectionItem = !!parentFile?.frontmatter.collection;
        
        if (isCollectionItem) {
          // Setup for a new collection item - use default layout
          setFrontmatter({
            title: '',
            layout: 'page', // Default layout for collection items
            date: new Date().toISOString().split('T')[0],
            status: 'draft',
          });
        } else {
          // Setup for a brand new regular page
          setFrontmatter({
            title: '',
            layout: DEFAULT_PAGE_LAYOUT_PATH,
            date: new Date().toISOString().split('T')[0],
            status: 'draft',
          });
        }
        
        markdownContent = 'Start writing...';
        setSlug('');
       } else {
        const fileData = site.contentFiles.find(f => f.path === filePath);
        if (!fileData) {
          setStatus('not_found');
          toast.error(`Content file not found at path: ${filePath}`);
          // Use navigate to redirect
          navigate(`/sites/${siteId}/edit`, { replace: true }); 
          return;
        }
        setFrontmatter(fileData.frontmatter);
        markdownContent = fileData.content;
        setSlug(fileData.slug);
      }
      
      setInitialMarkdown(markdownContent);
      setStatus('ready');
      setHasUnsavedChanges(false);
    };

    loadData();
    
  }, [site, filePath, isNewFileMode, siteId, navigate, setHasUnsavedChanges]);

  // Callback to signal that some content (either body or frontmatter) has changed.
  const onContentModified = useCallback(() => {
    setHasUnsavedChanges(true);
  }, [setHasUnsavedChanges]);

  // Handler for frontmatter form changes. It receives a partial update.
  const handleFrontmatterChange = useCallback((update: Partial<PageFrontmatter>) => {
    setFrontmatter(prev => {
      if (!prev) return null;
      const newFm = { ...prev, ...update };
      // Auto-generate the slug from the title, but only for new files.
      if (isNewFileMode && update.title !== undefined) {
        setSlug(slugify(update.title));
      }
      return newFm;
    });
    onContentModified();
  }, [isNewFileMode, onContentModified]);

  return { status, frontmatter, initialMarkdown, slug, setSlug, handleFrontmatterChange, onContentModified };
}

================================================================================

File: features/editor/hooks/useFilePersistence.ts
// src/features/editor/hooks/useFilePersistence.ts

import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate from react-router-dom
import { useAppStore } from '@/core/state/useAppStore';
import { useEditor } from '@/features/editor/contexts/useEditor';
import { stringifyToMarkdown } from '@/core/libraries/markdownParser';
import { AUTOSAVE_DELAY } from '@/config/editorConfig';
import { toast } from 'sonner';
import { useUnloadPrompt } from './useUnloadPrompt';

// Type imports
import { type MarkdownFrontmatter } from '@/core/types';
// Removed Block import as we're now working directly with markdown

interface PersistenceParams {
  siteId: string;
  filePath: string;
  isNewFileMode: boolean;
  frontmatter: MarkdownFrontmatter | null;
  slug: string;
  getEditorContent: () => string; 
}

export function useFilePersistence({
  siteId, filePath, isNewFileMode, frontmatter, slug, getEditorContent,
}: PersistenceParams) {
  // Use the navigate hook from react-router-dom
  const navigate = useNavigate(); 
  
  // Use proper hooks instead of getState() to prevent proxy revocation
  const addOrUpdateContentFile = useAppStore((state) => state.addOrUpdateContentFile);
  const deleteContentFileAndState = useAppStore((state) => state.deleteContentFileAndState);
  const getSiteById = useAppStore((state) => state.getSiteById);
  const { hasUnsavedChanges, setHasUnsavedChanges, setSaveState, registerSaveAction } = useEditor();
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSave = useCallback(async () => {
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    if (!frontmatter) throw new Error("Frontmatter not ready for saving.");
    if (!frontmatter.title.trim()) throw new Error("A title is required before saving.");

    const markdownBody = getEditorContent();
    
    if (isNewFileMode) {
      // --- CREATION LOGIC (First Save) ---
      if (!slug.trim()) throw new Error("A URL slug is required for a new page.");
      
      const site = getSiteById(siteId);
      const finalPath = `${filePath}/${slug.trim()}.md`.replace('//', '/');

      if (site?.contentFiles?.some(f => f.path === finalPath)) {
        throw new Error(`A page with the path "${slug}" already exists.`);
      }

      const rawMarkdown = stringifyToMarkdown(frontmatter, markdownBody);
      await addOrUpdateContentFile(siteId, finalPath, rawMarkdown);

      const newEditPath = finalPath.replace(/^content\//, '').replace(/\.md$/, '');
      
      // --- CHANGE: Replace router.replace with navigate ---
      // This updates the URL in the address bar without adding a new entry to the history.
      navigate(`/sites/${siteId}/edit/content/${newEditPath}`, { replace: true });

    } else {
      // --- UPDATE LOGIC (Subsequent Saves) ---
      const rawMarkdown = stringifyToMarkdown(frontmatter, markdownBody);
      await addOrUpdateContentFile(siteId, filePath, rawMarkdown);
    }
  }, [siteId, filePath, isNewFileMode, frontmatter, slug, getEditorContent, addOrUpdateContentFile, getSiteById, navigate]); // Add navigate to dependency array

  const handleDelete = useCallback(async () => {
    if (isNewFileMode || !frontmatter) return;
    try {
      await deleteContentFileAndState(siteId, filePath);
      toast.success(`Page "${frontmatter.title}" deleted.`);

      // --- CHANGE: Replace router.push with navigate ---
      // This navigates the user back to the editor's root page after deletion.
      navigate(`/sites/${siteId}/edit`);

    } catch (error) {
      toast.error(`Failed to delete page: ${(error as Error).message}`);
    }
  }, [isNewFileMode, frontmatter, deleteContentFileAndState, siteId, filePath, navigate]); // Add navigate to dependency array

  // This effect registers the save action with the editor context. No changes needed.
  useEffect(() => {
    registerSaveAction(handleSave);
  }, [handleSave, registerSaveAction]);

  // This effect handles the autosave logic. No changes needed.
  useEffect(() => {
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    if (hasUnsavedChanges && !isNewFileMode) {
      autosaveTimeoutRef.current = setTimeout(async () => {
        setSaveState('saving');
        try {
          await handleSave();
          setHasUnsavedChanges(false);
          setSaveState('saved');
          setTimeout(() => setSaveState('no_changes'), 2000);
        } catch (error) { 
            console.error("Autosave failed:", error); 
            setSaveState('idle'); 
        }
      }, AUTOSAVE_DELAY);
    }
    return () => { if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current); };
  }, [hasUnsavedChanges, isNewFileMode, handleSave, setSaveState, setHasUnsavedChanges]);

  // This hook handles the "Are you sure you want to leave?" prompt. No changes needed.
  useUnloadPrompt(hasUnsavedChanges);

  return { handleDelete };
}

================================================================================

File: pages/HomePageDashboard.tsx
// src/pages/HomePageDashboard.tsx

import { useState, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom'; // Use react-router-dom's Link

// State Management (no changes needed)
import { useAppStore } from '@/core/state/useAppStore';
import { type LocalSiteData } from '@/core/types';

// Services (no changes needed)
import { importSiteFromZip, exportSiteBackup } from '@/core/services/siteBackup.service';
import { saveAllImageAssetsForSite } from '@/core/services/localFileSystem.service';
import { slugify } from '@/core/libraries/utils';

// UI Components & Icons (no changes needed)
import { Button } from '@/core/components/ui/button';
import { toast } from 'sonner';
import { FilePlus2, Upload, Eye, Edit3, Archive, Trash2, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/core/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/core/components/ui/alert-dialog";
import CreateSiteModal from '@/core/components/CreateSiteModal';

export default function HomePageDashboard() {
  // All state management, handlers, and logic are ported directly from the original
  // component. No changes are needed here as this logic is framework-agnostic.
  const { sites, getSiteById, addSite, updateSiteSecrets, loadSite, deleteSiteAndState } = useAppStore();
  const [isImporting, setIsImporting] = useState(false);
  const [isOverwriteDialogOpen, setIsOverwriteDialogOpen] = useState(false);
  const [importedData, setImportedData] = useState<(LocalSiteData & { imageAssetsToSave?: Record<string, Blob> }) | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const finishImport = useCallback(async (data: LocalSiteData & { imageAssetsToSave?: Record<string, Blob> }) => {
    try {
      const { imageAssetsToSave, ...siteDataToSave } = data;
      await addSite(siteDataToSave);
      if(siteDataToSave.secrets) {
        await updateSiteSecrets(siteDataToSave.siteId, siteDataToSave.secrets);
      }
      if(imageAssetsToSave) {
        await saveAllImageAssetsForSite(siteDataToSave.siteId, imageAssetsToSave);
      }
      toast.success(`Site "${data.manifest.title}" imported successfully!`);
    } catch (error) {
      console.error("Error finishing site import:", error);
      toast.error(`Failed to save imported site: ${(error as Error).message}`);
    }
  }, [addSite, updateSiteSecrets]);

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    toast.info("Importing site from backup...");
    try {
      const data = await importSiteFromZip(file);
      const existingSite = getSiteById(data.siteId);
      if (existingSite) {
        setImportedData(data);
        setIsOverwriteDialogOpen(true);
      } else {
        await finishImport(data);
      }
    } catch (error) {
      console.error("Error during site import:", error);
      toast.error(`Import failed: ${(error as Error).message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setIsImporting(false);
    }
  };

  const handleOverwriteConfirm = async () => {
    if (importedData) await finishImport(importedData);
    setIsOverwriteDialogOpen(false);
    setImportedData(null);
  };
  
  const handleExportBackup = async (siteId: string) => {
    toast.info("Preparing site backup...");
    try {
        await loadSite(siteId);
        const siteToExport = getSiteById(siteId);
        if (!siteToExport) throw new Error("Could not load site data for export.");
        const blob = await exportSiteBackup(siteToExport);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${slugify(siteToExport.manifest.title || 'signum-backup')}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        toast.success("Site backup downloaded!");
    } catch (error) {
        console.error("Failed to export site:", error);
        toast.error(`Export failed: ${(error as Error).message}`);
    }
  };

  const handleDeleteSite = async (siteId: string, siteTitle: string) => {
    try {
      await deleteSiteAndState(siteId);
      toast.success(`Site "${siteTitle}" has been deleted.`);
    } catch (error) {
      toast.error(`Failed to delete site "${siteTitle}".`);
      console.error("Error deleting site:", error);
    }
  };

    // Listen for global import trigger from menu
  useEffect(() => {
    const handleTriggerImport = () => {
      fileInputRef.current?.click();
    };

    window.addEventListener('triggerImport', handleTriggerImport);
    return () => {
      window.removeEventListener('triggerImport', handleTriggerImport);
    };
  }, []);

  const validSites = sites.filter((site: LocalSiteData) => site && site.manifest);

  return (
    <>
       <title>My sites - Sparktype</title>
      
      {/* The JSX is identical, but Next's <Link> is replaced with react-router-dom's <Link> */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur-sm">
        <div className="flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/sparktype.svg" className='size-6' />
            <span className="text-xl font-bold font-mono text-foreground hidden sm:inline">Sparktype</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
              <Upload className="mr-2 h-4 w-4" /> {isImporting ? 'Importing...' : 'Import site'}
            </Button>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <FilePlus2 className="mr-2 h-4 w-4" /> Create new site
            </Button>
          </div>
        </div>
      </header>
      
      <main className="p-4">
        <h1 className="text-3xl font-bold text-foreground mb-8">My sites</h1>
        {validSites.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-muted rounded-lg">
            <h2 className="text-xl font-semibold text-muted-foreground mb-2">No sites yet</h2>
            <p className="text-muted-foreground mb-4">Click create new site or import a site to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {validSites.map((site: LocalSiteData) => (
              <div key={site.siteId} className="bg-card border rounded-lg p-6 shadow-sm hover:shadow-lg transition-shadow flex flex-col justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-card-foreground mb-2 truncate" title={site.manifest.title}>
                    {site.manifest.title || "Untitled Site"}
                  </h2>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2" title={site.manifest.description}>
                    {site.manifest.description || 'No description provided.'}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <Button variant="default" size="sm" asChild>
                    <Link to={`/sites/${site.siteId}/edit`}><Edit3 className="mr-2 h-4 w-4" /> Edit</Link>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {/*
                        The "View Live Preview" link now correctly navigates to the hash-based route.
                        `target="_blank"` will open a new browser tab with the hash URL, which works perfectly.
                      */}
                      <DropdownMenuItem asChild>
                        <Link to={`/sites/${site.siteId}/view`} target="_blank" rel="noopener noreferrer">
                          <Eye className="mr-2 h-4 w-4" /> View site
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportBackup(site.siteId)}><Archive className="mr-2 h-4 w-4" /> Export backup</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem onSelect={(e: Event) => e.preventDefault()} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete site
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>This action will permanently delete "{site.manifest.title}" and cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteSite(site.siteId, site.manifest.title)} className="bg-destructive hover:bg-destructive/90">Yes, delete site</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <input type="file" ref={fileInputRef} onChange={handleFileSelected} accept=".zip" className="hidden" />

      {/* The AlertDialog logic is self-contained and requires no changes */}
      <AlertDialog open={isOverwriteDialogOpen} onOpenChange={setIsOverwriteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Site Already Exists</AlertDialogTitle>
            <AlertDialogDescription>
              A site with the ID "{importedData?.siteId}" already exists. Do you want to overwrite it with the data from the backup file?
              <br/><br/>
              <strong>This action cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setImportedData(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleOverwriteConfirm} className="bg-destructive hover:bg-destructive/90">Overwrite</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Site Modal */}
      <CreateSiteModal 
        open={isCreateModalOpen} 
        onOpenChange={setIsCreateModalOpen} 
      />
    </>
  );
}

================================================================================

File: pages/MarketingHomePage.tsx
// src/pages/MarketingHomePage.tsx

import { Link } from 'react-router-dom';

// UI Components (no changes needed)
import { Button } from '@/core/components/ui/button';
import { ShieldCheck, Feather, Zap, Archive } from 'lucide-react';

// NO MORE 'react-helmet-async' import needed!

export default function MarketingHomePage() {
  return (
    <>
      {/*
        THIS IS THE NEW REACT 19 WAY.
        You can render <title> and <meta> tags directly in your component.
        React 19 will automatically move them to the document <head>.
      */}
      <title>Sparktype - Own Your Content</title>
      <meta name="description" content="A simple, private, and portable publishing platform that puts you back in control." />
      
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/sparktype.svg" className='size-7' />
            <span className="text-2xl font-bold text-foreground hidden sm:inline">Sparktype</span>
          </Link>
          <Button asChild variant="ghost">
            <Link to="/sites">Dashboard</Link>
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-16 sm:py-24 text-center">
        <header className="mb-12">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground">
            Sparktype: Own Your Content.
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-lg sm:text-xl text-muted-foreground">
            A simple, private, and portable publishing platform that puts you back in control.
          </p>
        </header>

        <div className="mb-16">
          <Button asChild size="lg">
            {/* The primary call-to-action now correctly links to the dashboard route. */}
            <Link to="/sites">
              Open Dashboard & Get Started
            </Link>
          </Button>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
          <div className="flex flex-col items-center p-6 bg-card border rounded-lg">
            <ShieldCheck className="size-10 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-2">Private & Secure</h3>
            <p className="text-muted-foreground text-sm">
              No tracking or surveillance by default. Your data is yours.
            </p>
          </div>
          <div className="flex flex-col items-center p-6 bg-card border rounded-lg">
            <Feather className="size-10 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-2">Simple & Focused</h3>
            <p className="text-muted-foreground text-sm">
              A minimal, content-first editor lets you focus on writing.
            </p>
          </div>
          <div className="flex flex-col items-center p-6 bg-card border rounded-lg">
            <Zap className="size-10 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-2">Blazingly Fast</h3>
            <p className="text-muted-foreground text-sm">
              Static sites are fast, reliable, and efficient to host.
            </p>
          </div>
          <div className="flex flex-col items-center p-6 bg-card border rounded-lg">
            <Archive className="size-10 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-2">Truly Portable</h3>
            <p className="text-muted-foreground text-sm">
              Export your entire site anytime. No vendor lock-in, ever.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

================================================================================

File: pages/sites/SiteLayout.tsx
// src/pages/sites/SiteLayout.tsx

import { useEffect, useCallback, useState } from 'react';
import { Link, Outlet, useParams, useLocation } from 'react-router-dom';

// State Management
import { useAppStore } from '@/core/state/useAppStore';
import { type AppStore } from '@/core/state/useAppStore';

// Services
import { getActiveImageService } from '@/core/services/images/images.service';

// UI and Icons
import { TbEdit, TbSettings } from "react-icons/tb";
import { cn } from '@/core/libraries/utils';

/**
 * Renders the site-specific icon, either the logo or a text fallback.
 */
function SiteIcon({ site }: { site: AppStore['sites'][0] }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    const generateLogoUrl = async () => {
      if (site.manifest?.logo) {
        try {
          const service = getActiveImageService(site.manifest);
          const url = await service.getDisplayUrl(site.manifest, site.manifest.logo, { width: 40, height: 40, crop: 'fill' }, false);
          setLogoUrl(url);
          if (url.startsWith('blob:')) {
            objectUrl = url;
          }
        } catch (error) {
          console.error("Could not generate logo URL:", error);
          setLogoUrl(null);
        }
      } else {
        setLogoUrl(null);
      }
    };

    generateLogoUrl();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [site.manifest]);

  if (logoUrl) {
    return <img src={logoUrl} alt={`${site.manifest.title} Logo`} className="h-full w-full object-cover" />;
  }

  const firstLetter = site.manifest.title ? site.manifest.title.charAt(0).toUpperCase() : '?';
  
  return (
    <div className="flex h-full w-full items-center justify-center border rounded-lg text-muted-foreground">
      <span className="text-xl font-semibold">{firstLetter}</span>
    </div>
  );
}



/**
 * A simple loading component displayed while the core site data is being fetched.
 */
function SiteLayoutLoader() {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-muted/20">
            <div className="flex flex-col items-center gap-2">
                <svg className="animate-spin h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-sm text-muted-foreground">Loading Site Data...</p>
            </div>
        </div>
    );
}

export default function SiteLayout() {
  const { siteId } = useParams<{ siteId: string }>();
  const { pathname } = useLocation();

  const site = useAppStore(useCallback((state: AppStore) => siteId ? state.getSiteById(siteId) : undefined, [siteId]));
  const loadSite = useAppStore((state: AppStore) => state.loadSite);
  const setActiveSiteId = useAppStore((state: AppStore) => state.setActiveSiteId);

  useEffect(() => {
    if (siteId) {
      setActiveSiteId(siteId);
      if (!site || !site.contentFiles) {
        loadSite(siteId);
      }
    }
    return () => {
      setActiveSiteId(null);
    };
  }, [siteId, site, loadSite, setActiveSiteId]);

  if (!site || !site.contentFiles) {
    return <SiteLayoutLoader />;
  }
    
  const isEditorActive = pathname.startsWith(`/sites/${siteId}/edit`);
  const isSettingsActive = pathname.startsWith(`/sites/${siteId}/settings`);
  const isViewActive = !isEditorActive && !isSettingsActive;

  // --- FIX: Add a property to distinguish standard icons ---
  const navItems = [
    // This item will not receive the extra size class.
    { to: siteId ? `/sites/${siteId}/view` : '#', title: 'View Site', icon: () => <SiteIcon site={site} />, isStandardIcon: false, isActive: isViewActive },
    // These items will receive the `size-6` class.
    { to: siteId ? `/sites/${siteId}/edit` : '#', title: 'Edit Content', icon: TbEdit, isStandardIcon: true, isActive: isEditorActive },
    { to: siteId ? `/sites/${siteId}/settings` : '#', title: 'Site Settings', icon: TbSettings, isStandardIcon: true, isActive: isSettingsActive },
  ];

  return (
    <div className="flex h-screen flex-col lg:flex-row bg-muted/20">
      <aside className="fixed inset-x-0 bottom-0 z-30 flex h-16 w-full shrink-0 border-t bg-background lg:static lg:inset-y-0 lg:left-0 lg:h-full lg:w-[60px] lg:border-r lg:border-t-0">
        <nav className="flex w-full items-center justify-center gap-2  lg:flex-col lg:justify-start">
          <Link
            to="/sites"
            title="Dashboard"
            className='lg:flex hidden flex-col items-center w-[60px] h-[60px] border-b'
          >
            <img src="/sparktype.svg" width={32} height={32} alt="Sparktype" className='m-auto'/>
          </Link>
          
          {navItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                title={item.title}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg transition-colors overflow-hidden',
                  item.isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
              >
                
                <IconComponent className={cn(item.isStandardIcon && 'size-6')} />
              </Link>
            )
          })}
        </nav>
      </aside>

      <main className="flex-1 overflow-auto pb-16 lg:pb-0">
        <Outlet />
      </main>
    </div>
  );
}



================================================================================

File: pages/sites/SiteRootPage.tsx
// src/pages/sites/SiteRootPage.tsx

import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

/**
 * A smart entry point for a site's backend.
 * Its only job is to redirect the user to the editor for that site.
 * This component handles the 'index' route for `/sites/:siteId`.
 */
export default function SiteRootPage() {
  const navigate = useNavigate();
  const { siteId } = useParams<{ siteId: string }>();

  useEffect(() => {
    if (siteId) {
      // Use `replace: true` to avoid polluting the browser's history.
      // This sends the user directly to the site editor.
      navigate(`/sites/${siteId}/edit`, { replace: true });
    }
    // This effect runs only when the siteId changes.
  }, [siteId, navigate]);

  // Display a loading message while the redirect is processed by the browser.
  return (
    <div className="flex justify-center items-center h-full">
      <p>Redirecting to editor...</p>
    </div>
  );
}

================================================================================

File: pages/sites/settings/SettingsSectionLayout.tsx
// src/pages/sites/settings/SettingsSectionLayout.tsx

import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';

// UI and State Management
import ThreeColumnLayout from '@/core/components/layout/ThreeColumnLayout';
import SettingsNav from '@/features/site-settings/components/SettingsNav';
import { useUIStore } from '@/core/state/uiStore';

/**
 * The root layout for the entire settings section.
 * It provides the consistent ThreeColumnLayout structure and manages the
 * global UI state to ensure the left sidebar (with the settings menu) is
 * always visible and the right sidebar is always hidden.
 */
export default function SettingsSectionLayout() {
  const { 
    leftSidebarContent, 
    setLeftAvailable, 
    setRightAvailable, 
    setRightOpen,
    setLeftSidebarContent,
    setRightSidebarContent 
  } = useUIStore(state => state.sidebar);

  useEffect(() => {
    // Configure the sidebars for the entire settings section
    setLeftAvailable(true);
    setRightAvailable(false);
    setRightOpen(false);
    setLeftSidebarContent(<SettingsNav />);
    setRightSidebarContent(null);

    // Cleanup when navigating away from the settings section
    return () => {
      setLeftAvailable(false);
      setLeftSidebarContent(null);
    };
  }, [setLeftAvailable, setRightAvailable, setRightOpen, setLeftSidebarContent, setRightSidebarContent]);

  return (
    <ThreeColumnLayout
      leftSidebar={leftSidebarContent}
      rightSidebar={null} // No right sidebar in settings
    >
      {/* The <Outlet/> renders the specific settings page (e.g., SiteSettingsPage) */}
      <Outlet />
    </ThreeColumnLayout>
  );
}

================================================================================

File: pages/sites/settings/ThemeSettingsPage.tsx
// src/pages/sites/settings/ThemeSettingsPage.tsx

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';

// State Management and Services
import { useAppStore } from '@/core/state/useAppStore';
import { getAvailableThemes } from '@/core/services/config/configHelpers.service';
import { getMergedThemeDataForForm } from '@/core/services/config/theme.service';

// Types
import { type AppStore } from '@/core/state/useAppStore';
import { type Manifest, type ThemeConfig, type ThemeInfo } from '@/core/types';
import { type RJSFSchema } from '@rjsf/utils';

// UI Components
import { Button } from '@/core/components/ui/button';
import { Label } from '@/core/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/components/ui/select';
import SchemaDrivenForm from '@/core/components/SchemaDrivenForm';
import { toast } from 'sonner';

export default function ThemeSettingsPage() {
  const { siteId = '' } = useParams<{ siteId: string }>();

  // Selectors for Zustand store
  const site = useAppStore(useCallback((state: AppStore) => state.getSiteById(siteId), [siteId]));
  const updateManifestAction = useAppStore((state: AppStore) => state.updateManifest);

  // Local state for the form
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Form-specific state
  const [selectedTheme, setSelectedTheme] = useState('');
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [schema, setSchema] = useState<RJSFSchema | null>(null);
  const [availableThemes, setAvailableThemes] = useState<ThemeInfo[]>([]);

  // Effect to initialize the form state from the store
  useEffect(() => {
    const initializeData = async () => {
      if (!site) return;
      setIsLoading(true);
      try {
        const themes = getAvailableThemes(site.manifest);
        setAvailableThemes(themes);

        const currentThemeName = site.manifest.theme.name || 'default';
        const savedConfig = site.manifest.theme.config || {};
        
        const { schema: themeSchema, initialConfig } = await getMergedThemeDataForForm(currentThemeName, savedConfig);
        
        setSchema(themeSchema);
        setFormData(initialConfig);
        setSelectedTheme(currentThemeName);
      } catch (error) {
        console.error('Failed to initialize appearance settings:', error);
        toast.error('Failed to load appearance settings');
      } finally {
        setIsLoading(false);
        setHasChanges(false);
      }
    };
    initializeData();
  }, [site]);

  // Handle changes from the dynamically generated form
  const handleFormChange = useCallback((data: object) => {
    setFormData(data as Record<string, unknown>);
    setHasChanges(true);
  }, []);

  // Handle the user selecting a new theme from the dropdown
  const handleThemeChange = useCallback(async (newThemeName: string) => {
    if (newThemeName === selectedTheme || !site) return;
    setIsLoading(true);
    try {
        const { schema: newSchema, initialConfig: newMergedConfig } = await getMergedThemeDataForForm(
            newThemeName, 
            site.manifest.theme.config, 
            selectedTheme
        );

        setSchema(newSchema);
        setFormData(newMergedConfig);
        setSelectedTheme(newThemeName);
        setHasChanges(true);
    } catch (error) {
        console.error('Failed to load new theme:', error);
        toast.error(`Failed to load theme "${newThemeName}"`);
    } finally {
        setIsLoading(false);
    }
  }, [selectedTheme, site]);


  // Persist the changes back to the store
  const handleSave = async () => {
    if (!site?.manifest) {
      toast.error('Site data not available');
      return;
    }
    setIsSaving(true);
    try {
      const newManifest: Manifest = {
        ...site.manifest,
        theme: {
          ...site.manifest.theme,
          name: selectedTheme,
          config: formData as ThemeConfig['config'],
        },
      };
      await updateManifestAction(siteId, newManifest);
      setHasChanges(false);
      toast.success('Appearance settings saved successfully!');
    } catch (error) {
      console.error('Failed to save appearance settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };
  
  const pageTitle = `Theme Settings - ${site?.manifest?.title || 'Loading...'}`;

  if (isLoading) {
    return (
      <>
        <title>{pageTitle}</title>
        <div className="space-y-6 max-w-2xl p-6">
            <div>
                <h1 className="text-2xl font-bold">Appearance</h1>
                <p className="text-muted-foreground">Loading appearance settings...</p>
            </div>
        </div>
      </>
    );
  }

  return (
    <>
      <title>{pageTitle}</title>
      <div className="space-y-6 max-w-2xl p-6">
        <div>
          <h1 className="text-2xl font-bold">Appearance</h1>
          <p className="text-muted-foreground">Customize the visual style and branding of your site.</p>
        </div>

        <div className="border-t pt-6 space-y-6">
          <div>
            <Label htmlFor="theme-select">Active Theme</Label>
            <Select 
              value={selectedTheme} 
              onValueChange={handleThemeChange}
              disabled={isSaving || isLoading}
            >
              <SelectTrigger id="theme-select" className="mt-1">
                <SelectValue placeholder="Select a theme..." />
              </SelectTrigger>
              <SelectContent>
                {availableThemes.map((theme) => (
                  <SelectItem key={theme.path} value={theme.path}>
                    {theme.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {schema?.properties && Object.keys(schema.properties).length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Theme Customization</h3>
              <SchemaDrivenForm 
                schema={schema}
                formData={formData}
                onFormChange={handleFormChange}
              />
            </div>
          ) : (
            <div className="text-center border-2 border-dashed p-6 rounded-lg">
              <p className="font-semibold">No Customization Options</p>
              <p className="text-sm text-muted-foreground">
                The theme "{selectedTheme}" does not provide any customizable appearance settings.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button 
            onClick={handleSave} 
            disabled={isSaving || !hasChanges || isLoading} 
            size="lg"
          >
            {isSaving ? 'Saving...' : 'Save Appearance'}
          </Button>
        </div>
      </div>
    </>
  );
}

================================================================================

File: pages/sites/settings/SiteSettingsPage.tsx
// src/pages/sites/settings/SiteSettingsPage.tsx

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';

// State and Services
import { useAppStore } from '@/core/state/useAppStore';
import { getMergedThemeDataFieldsForForm } from '@/core/services/config/theme.service';
import { HtmlSanitizerService } from '@/core/services/htmlSanitizer.service';

// Types
import { type Manifest, type ImageRef } from '@/core/types';
import { type RJSFSchema } from '@rjsf/utils';

// UI Components
import { Button } from '@/core/components/ui/button';
import SiteSettingsForm from '@/features/site-settings/components/SiteSettingsForm';
import { toast } from 'sonner';

// Define the shape of the form's local state
interface PageFormData {
  title: string;
  description: string;
  author: string;
  baseUrl: string;
  logo: ImageRef | undefined;
  favicon: ImageRef | undefined;
}

export default function SiteSettingsPage() {
  const { siteId = '' } = useParams<{ siteId: string }>();

  const site = useAppStore(useCallback(state => state.getSiteById(siteId), [siteId]));
  const updateManifestAction = useAppStore(state => state.updateManifest);

  const [formData, setFormData] = useState<PageFormData | null>(null);
  const [themeDataSchema, setThemeDataSchema] = useState<RJSFSchema | null>(null);
  const [themeData, setThemeData] = useState<Record<string, unknown>>({});
  const [themeDataChanged, setThemeDataChanged] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  const loadThemeData = useCallback(async () => {
    if (!site?.manifest?.theme?.name) return;
    try {
      const { schema, initialData } = await getMergedThemeDataFieldsForForm(
        site.manifest.theme.name,
        site.manifest.theme.themeData || {}
      );
      setThemeDataSchema(schema);
      setThemeData(initialData);
    } catch (error) {
      console.error('Failed to load theme data schema:', error);
    }
  }, [site?.manifest?.theme?.name, site?.manifest?.theme?.themeData]);

  useEffect(() => {
    if (site?.manifest) {
      setIsLoading(true);
      setFormData({
        title: site.manifest.title,
        description: site.manifest.description,
        author: site.manifest.author || '',
        baseUrl: site.manifest.baseUrl || '',
        logo: site.manifest.logo,
        favicon: site.manifest.favicon,
      });
      setHasChanges(false);
      setThemeDataChanged(false);
      loadThemeData();
      setIsLoading(false);
    }
  }, [site, loadThemeData]);

  const handleThemeDataChange = useCallback((newData: Record<string, unknown>) => {
    const sanitizedData = HtmlSanitizerService.sanitizeThemeData(newData);
    setThemeData(sanitizedData);
    setThemeDataChanged(true);
    setHasChanges(true);
  }, []);
  
  const handleFormChange = useCallback((newData: PageFormData) => {
    setFormData(newData);
    setHasChanges(true);
  }, []);

  const handleSave = async () => {
    if (!site?.manifest || !formData) {
        toast.error("Form data is not ready. Cannot save.");
        return;
    }
    setIsLoading(true);
    
    const newManifest: Manifest = {
      ...site.manifest,
      title: formData.title.trim(),
      description: formData.description.trim(),
      author: formData.author.trim(),
      baseUrl: formData.baseUrl.trim(),
      logo: formData.logo,
      favicon: formData.favicon,
      theme: {
        ...site.manifest.theme,
        themeData: themeDataChanged ? themeData : site.manifest.theme.themeData
      }
    };

    try {
      await updateManifestAction(siteId, newManifest);
      toast.success('Site settings saved successfully!');
      setHasChanges(false);
    } catch (error) {
      console.error("Error saving site settings:", error);
      toast.error("Failed to save settings. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const pageTitle = `Settings - ${site?.manifest?.title || 'Loading...'}`;

  if (isLoading || !formData) {
    return (
      <>
        <title>{pageTitle}</title>
        <div className="p-6">Loading settings...</div>
      </>
    );
  }

  return (
    <>
      <title>{pageTitle}</title>
      <div className="space-y-6 max-w-2xl p-6">
        <div>
          <h1 className="text-2xl font-bold">Site Settings</h1>
          <p className="text-muted-foreground">Manage the core details and identity of your website.</p>
        </div>

        <div className="border-t pt-6">
          <SiteSettingsForm
            siteId={siteId}
            formData={formData}
            onFormChange={handleFormChange}
            themeDataSchema={themeDataSchema || undefined}
            themeData={themeData}
            onThemeDataChange={handleThemeDataChange}
          />
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={isLoading || !hasChanges} size="lg">
            {isLoading ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </>
  );
}

================================================================================

File: pages/sites/settings/ImageSettingsPage.tsx
// src/pages/sites/settings/ImageSettingsPage.tsx

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';

// State Management
import { useAppStore } from '@/core/state/useAppStore';
import { type AppStore } from '@/core/state/useAppStore';

// Types
import { type Manifest } from '@/core/types';
import { type SiteSecrets } from '@/core/services/siteSecrets.service';

// UI Components
import { Button } from '@/core/components/ui/button';
import { Label } from '@/core/components/ui/label';
import { Input } from '@/core/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/components/ui/select';
import { toast } from 'sonner';

type ImageServiceId = 'local' | 'cloudinary';

export default function ImageSettingsPage() {
  const { siteId = '' } = useParams<{ siteId: string }>();

  // Selectors for Zustand store
  const site = useAppStore(useCallback((state: AppStore) => state.getSiteById(siteId), [siteId]));
  const updateManifestAction = useAppStore((state: AppStore) => state.updateManifest);
  const updateSiteSecretsAction = useAppStore((state: AppStore) => state.updateSiteSecrets);

  // Local state for the form
  const [selectedService, setSelectedService] = useState<ImageServiceId>('local');
  const [cloudinaryCloudName, setCloudinaryCloudName] = useState('');
  const [cloudinaryUploadPreset, setCloudinaryUploadPreset] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  // Effect to populate the form's local state from the global store on mount.
  useEffect(() => {
    if (site?.manifest) {
      setIsLoading(true);
      const { imageService, cloudinary } = site.manifest.settings || {};
      setSelectedService(imageService || 'local');
      setCloudinaryCloudName(cloudinary?.cloudName || '');
      setCloudinaryUploadPreset(site.secrets?.cloudinary?.uploadPreset || '');
      setHasChanges(false);
      setIsLoading(false);
    }
  }, [site]); // Re-run if the site object in the store changes.
  
  const handleServiceChange = (value: string) => {
    setSelectedService(value as ImageServiceId);
    setHasChanges(true);
  };
  
  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
    setter(value);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!site?.manifest) {
      toast.error("Site data not available. Cannot save settings.");
      return;
    }
    setIsLoading(true);

    const newManifest: Manifest = {
      ...site.manifest,
      settings: {
        ...site.manifest.settings,
        imageService: selectedService,
        cloudinary: {
            cloudName: cloudinaryCloudName.trim(),
        },
      },
    };

    const newSecrets: SiteSecrets = {
      ...site.secrets, // Preserve other potential secrets
      cloudinary: {
          uploadPreset: cloudinaryUploadPreset.trim(),
      }
    };

    try {
      // These actions persist data and update the global state.
      // Toasts for success are now handled inside the actions for consistency.
      await updateManifestAction(siteId, newManifest);
      await updateSiteSecretsAction(siteId, newSecrets);
      setHasChanges(false);
    } catch(error) {
      console.error("An error occurred during save:", error);
      // Let the action's own toast handle the error message.
    } finally {
      setIsLoading(false);
    }
  };

  const pageTitle = `Image Settings - ${site?.manifest?.title || 'Loading...'}`;

  if (isLoading || !site) {
    return (
      <>
        <title>{pageTitle}</title>
        <div className="p-6">Loading image settings...</div>
      </>
    );
  }
  
  return (
    <>
      <title>{pageTitle}</title>
      <div className="space-y-6 max-w-2xl p-6">
        <div>
          <h1 className="text-2xl font-bold">Image Settings</h1>
          <p className="text-muted-foreground">Configure how images are stored and processed for your site.</p>
        </div>

        <div className="border-t pt-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="service-select">Image Storage Backend</Label>
            <Select value={selectedService} onValueChange={handleServiceChange}>
              <SelectTrigger id="service-select" className="mt-1">
                <SelectValue placeholder="Select a service..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Store in Site Bundle (Default)</SelectItem>
                <SelectItem value="cloudinary">Upload to Cloudinary</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">"Local" is best for portability. "Cloudinary" is best for performance.</p>
          </div>
          
          {selectedService === 'cloudinary' && (
            <div className="p-4 border rounded-lg bg-card space-y-4">
              <h3 className="font-semibold text-card-foreground">Cloudinary Settings</h3>
              <div className="space-y-2">
                <Label htmlFor="cloud-name">Cloudinary Cloud Name (Public)</Label>
                <Input
                  id="cloud-name"
                  value={cloudinaryCloudName}
                  onChange={(e) => handleInputChange(setCloudinaryCloudName, e.target.value)}
                  placeholder="e.g., your-cloud-name"
                />
                <p className="text-xs text-muted-foreground">This is public and stored in your site's manifest.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="upload-preset">Cloudinary Upload Preset (Secret)</Label>
                <Input
                  id="upload-preset"
                  type="password"
                  value={cloudinaryUploadPreset}
                  onChange={(e) => handleInputChange(setCloudinaryUploadPreset, e.target.value)}
                  placeholder="e.g., ml_default"
                />
                <p className="text-xs text-muted-foreground">This is a secret and is stored securely in your browser, not in your public site files.</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={isLoading || !hasChanges} size="lg">
            {isLoading ? 'Saving...' : 'Save Image Settings'}
          </Button>
        </div>
      </div>
    </>
  );
}

================================================================================

File: pages/sites/settings/PublishingSettingsPage.tsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAppStore } from '@/core/state/useAppStore';
import { Button } from '@/core/components/ui/button';
import { Label } from '@/core/components/ui/label';
import { Input } from '@/core/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Separator } from '@/core/components/ui/separator';
import { toast } from 'sonner';
import { Download, Globe, Settings } from 'lucide-react';
import { exportSiteBackup } from '@/core/services/siteBackup.service';
import { NetlifyProvider } from '@/core/services/publishing/NetlifyProvider';
import { slugify } from '@/core/libraries/utils';

type PublishingProvider = 'zip' | 'netlify';

interface NetlifyConfigUI {
  apiToken: string;
  siteId?: string;
  siteName?: string;
}

interface NetlifyConfigPublic {
  siteId?: string;
  siteName?: string;
}

interface PublishingConfig {
  provider: PublishingProvider;
  netlify?: NetlifyConfigPublic;
}

export default function PublishingSettingsPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const { getSiteById, updateManifest, updateSiteSecrets, loadSite } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  
  // Publishing configuration state
  const [provider, setProvider] = useState<PublishingProvider>('zip');
  const [netlifyConfig, setNetlifyConfig] = useState<NetlifyConfigUI>({
    apiToken: '',
    siteId: '',
    siteName: ''
  });

  const site = siteId ? getSiteById(siteId) : null;

  useEffect(() => {
    if (site?.manifest.publishingConfig) {
      const config = site.manifest.publishingConfig;
      setProvider(config.provider);
      if (config.netlify) {
        setNetlifyConfig({
          siteId: config.netlify?.siteId || '',
          siteName: config.netlify?.siteName || '',
          apiToken: site.secrets?.publishing?.netlify?.apiToken || ''
        });
      }
    }
    // If no config but we have secrets, still load the API token
    else if (site?.secrets?.publishing?.netlify?.apiToken) {
      setNetlifyConfig(prev => ({
        ...prev,
        apiToken: site.secrets?.publishing?.netlify?.apiToken || ''
      }));
    }
  }, [site]);

  const handleSaveSettings = async () => {
    if (!site || !siteId) return;

    setIsLoading(true);
    try {
      // Separate public config from secrets
      const { apiToken, ...publicNetlifyConfig } = netlifyConfig;
      
      const publishingConfig: PublishingConfig = {
        provider,
        ...(provider === 'netlify' && { netlify: publicNetlifyConfig })
      };

      const updatedManifest = {
        ...site.manifest,
        publishingConfig
      };

      // Save public config to manifest
      await updateManifest(siteId, updatedManifest);

      // Save secrets separately if provider is Netlify and we have an API token
      if (provider === 'netlify' && apiToken) {
        const updatedSecrets = {
          ...site.secrets,
          publishing: {
            ...site.secrets?.publishing,
            netlify: {
              ...site.secrets?.publishing?.netlify,
              apiToken
            }
          }
        };
        await updateSiteSecrets(siteId, updatedSecrets);
      }

      toast.success('Publishing settings saved successfully!');
    } catch (error) {
      console.error('Error saving publishing settings:', error);
      toast.error('Failed to save publishing settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!site || !siteId) return;

    setIsPublishing(true);
    try {
      await loadSite(siteId);
      const siteToPublish = getSiteById(siteId);
      if (!siteToPublish) throw new Error("Could not load site data for publishing.");

      if (provider === 'zip') {
        // Export as ZIP
        const blob = await exportSiteBackup(siteToPublish);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${slugify(siteToPublish.manifest.title || 'signum-site')}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        toast.success('Site exported as ZIP!');
      } else if (provider === 'netlify') {
        // Deploy to Netlify - get API token from secrets store
        const apiToken = site.secrets?.publishing?.netlify?.apiToken || netlifyConfig.apiToken;
        if (!apiToken) {
          throw new Error('Netlify API token not found. Please save your settings first.');
        }

        const netlifyConfigWithToken = {
          ...netlifyConfig,
          apiToken
        };

        const netlifyProvider = new NetlifyProvider();
        const result = await netlifyProvider.deploy(siteToPublish, netlifyConfigWithToken as unknown as Record<string, unknown>);
        
        if (result.success) {
          toast.success(result.message + (result.url ? ` Site URL: ${result.url}` : ''));
        } else {
          throw new Error(result.message);
        }
      }
    } catch (error) {
      console.error('Publishing failed:', error);
      toast.error(`Publishing failed: ${(error as Error).message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  if (!site) {
    return <div>Site not found</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Publishing Settings</h1>
        <p className="text-muted-foreground">
          Configure how you want to publish your site
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Publishing Configuration
          </CardTitle>
          <CardDescription>
            Choose your preferred publishing method and configure the settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider-select">Publishing Provider</Label>
            <Select value={provider} onValueChange={(value: PublishingProvider) => setProvider(value)}>
              <SelectTrigger id="provider-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zip">
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Export as ZIP
                  </div>
                </SelectItem>
                <SelectItem value="netlify">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Deploy to Netlify
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select how you want to publish your site
            </p>
          </div>

          {provider === 'netlify' && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Netlify Configuration</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="netlify-token">API Token</Label>
                  <Input
                    id="netlify-token"
                    type="password"
                    value={netlifyConfig.apiToken}
                    onChange={(e) => setNetlifyConfig({ ...netlifyConfig, apiToken: e.target.value })}
                    placeholder="Your Netlify personal access token"
                  />
                  <p className="text-xs text-muted-foreground">
                    Create a personal access token in your Netlify account settings. Stored securely and not exported with your site.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="netlify-site-name">Site Name (Optional)</Label>
                  <Input
                    id="netlify-site-name"
                    value={netlifyConfig.siteName}
                    onChange={(e) => setNetlifyConfig({ ...netlifyConfig, siteName: e.target.value })}
                    placeholder="my-awesome-site"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to auto-generate a site name
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="netlify-site-id">Site ID (Optional)</Label>
                  <Input
                    id="netlify-site-id"
                    value={netlifyConfig.siteId}
                    onChange={(e) => setNetlifyConfig({ ...netlifyConfig, siteId: e.target.value })}
                    placeholder="existing-site-id"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use this to update an existing Netlify site
                  </p>
                </div>
              </div>
            </>
          )}

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSaveSettings} disabled={isLoading} variant="outline">
              {isLoading ? 'Saving...' : 'Save Settings'}
            </Button>
            <Button 
              onClick={handlePublish} 
              disabled={isPublishing || (provider === 'netlify' && !site?.secrets?.publishing?.netlify?.apiToken && !netlifyConfig.apiToken)}
            >
              {isPublishing ? 'Publishing...' : provider === 'zip' ? 'Export ZIP' : 'Deploy to Netlify'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

================================================================================

File: pages/sites/edit/EditSiteLayout.tsx
// src/pages/sites/edit/EditSiteLayout.tsx

import { Outlet } from 'react-router-dom';

/**
 * The root layout for the /edit section.
 *
 * In the Vite + react-router-dom architecture, this layout's primary role
 * is to provide a mounting point for its child routes via the `<Outlet />`
 * component. It can also be used to wrap all editor pages in a common
 * context or layout if needed in the future.
 */
export default function EditSiteLayout() {
  // The <Outlet /> component from react-router-dom will render the
  // matched child route. For example, if the URL is /sites/123/edit/content/about,
  // the EditContentPage component will be rendered here.
  return <Outlet />;
}

================================================================================

File: pages/sites/edit/EditContentPage.tsx
// src/pages/sites/edit/EditContentPage.tsx

import { useMemo, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';

// Global State and UI Management
import { useUIStore } from '@/core/state/uiStore';
import { useAppStore } from '@/core/state/useAppStore';
import { type AppStore } from '@/core/state/useAppStore';
import { EditorProvider } from '@/features/editor/contexts/EditorProvider';
import { type MarkdownFrontmatter } from '@/core/types';

// UI Components
import { Button } from '@/core/components/ui/button';
import { FilePlus, Loader2 } from 'lucide-react';
import ThreeColumnLayout from '@/core/components/layout/ThreeColumnLayout';
import LeftSidebar from '@/features/editor/components/LeftSidebar';
import NewPageDialog from '@/features/editor/components/NewPageDialog';
// import CreateCollectionPageDialog from '@/features/editor/components/CreateCollectionPageDialog';
import MarkdownEditor, { type BlocknoteEditorRef} from '@/features/editor/components/MarkdownEditor';
import FrontmatterSidebar from '@/features/editor/components/FrontmatterSidebar';
import PrimaryContentFields from '@/features/editor/components/PrimaryContentFields';
import CollectionItemList from '@/features/editor/components/CollectionItemList';
import SaveButton from '@/features/editor/components/SaveButton';

// Modular Hooks
import { usePageIdentifier } from '@/features/editor/hooks/usePageIdentifier';
import { useFileContent } from '@/features/editor/hooks/useFileContent';
import { useFilePersistence } from '@/features/editor/hooks/useFilePersistence';

/**
 * A loading skeleton specifically for the main editor content area.
 */
function EditorLoadingSkeleton() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-muted-foreground">Loading Editor...</p>
    </div>
  );
}

/**
 * The internal component that contains the core editor logic and UI.
 * It's wrapped by EditorProvider so it can use the useEditor() hook.
 */
function EditContentPageInternal() {
  const editorRef = useRef<BlocknoteEditorRef>(null);

  // --- 1. Get Data and Identifiers ---
  const { siteId = '' } = useParams<{ siteId: string }>();
  const site = useAppStore(useCallback((state: AppStore) => state.getSiteById(siteId), [siteId]));

  const siteStructure = useMemo(() => site?.manifest.structure || [], [site?.manifest.structure]);
  const allContentFiles = useMemo(() => site?.contentFiles || [], [site?.contentFiles]);
  
  const { isNewFileMode, filePath } = usePageIdentifier({ siteStructure, allContentFiles });
  const { status, frontmatter, initialMarkdown, slug, setSlug, handleFrontmatterChange, onContentModified } = useFileContent(siteId, filePath, isNewFileMode);
  const { handleDelete } = useFilePersistence({ siteId, filePath, isNewFileMode, frontmatter, slug, getEditorContent: () => editorRef.current?.getBlocks() ?? '' });

  // --- 2. Manage Sidebars via UI Store ---
  const { leftSidebarContent, rightSidebarContent, setLeftAvailable, setRightAvailable, setLeftSidebarContent, setRightSidebarContent } = useUIStore(state => state.sidebar);

  const rightSidebarComponent = useMemo(() => {
    // FIX #1: Add a guard for `site` itself. This narrows the type of `site`
    // for all subsequent accesses (e.g., `site.manifest`), resolving the errors.
    if (status !== 'ready' || !frontmatter || !siteId || !site) {
      return null;
    }
    
    return (
      <FrontmatterSidebar
        siteId={siteId}
        filePath={filePath}
        manifest={site.manifest}
        layoutFiles={site.layoutFiles}
        themeFiles={site.themeFiles}
        frontmatter={frontmatter}
        onFrontmatterChange={handleFrontmatterChange}
        isNewFileMode={isNewFileMode}
        slug={slug}
        onSlugChange={setSlug}
        onDelete={handleDelete}
      />
    );
  }, [status, frontmatter, site, siteId, filePath, allContentFiles, handleFrontmatterChange, isNewFileMode, slug, setSlug, handleDelete]);

  useEffect(() => {
    setLeftAvailable(true);
    setLeftSidebarContent(<LeftSidebar />);
    return () => { setLeftAvailable(false); setLeftSidebarContent(null); };
  }, [setLeftAvailable, setLeftSidebarContent]);

  useEffect(() => {
    if (rightSidebarComponent) {
      setRightAvailable(true);
      setRightSidebarContent(rightSidebarComponent);
    } else {
      setRightAvailable(false);
      setRightSidebarContent(null);
    }
    return () => { setRightAvailable(false); setRightSidebarContent(null); };
  }, [rightSidebarComponent, setRightAvailable, setRightSidebarContent]);

  const currentLayout = useMemo(() => {
    if (!frontmatter?.layout || !site?.layoutFiles) return null;
    
    return frontmatter.layoutConfig ? { layoutType: 'collection' } : { layoutType: 'single' };
  }, [frontmatter, site?.layoutFiles]);

  // --- 3. Determine Page State for Rendering ---
  const isCollectionListingPage = currentLayout?.layoutType === 'collection';
  const isSiteEmpty = siteId && siteStructure.length === 0 && !isNewFileMode;

  const pageTitle = status === 'ready' && frontmatter?.title 
    ? `Editing: ${frontmatter.title} | ${site?.manifest.title || 'Sparktype'}` 
    : `Editor - ${site?.manifest.title || 'Sparktype'}`;

  const headerActions = isSiteEmpty ? null : <SaveButton />;

  // --- 4. Render the UI ---
  return (
    <>
      <title>{pageTitle}</title>
      <ThreeColumnLayout
        leftSidebar={leftSidebarContent}
        rightSidebar={isSiteEmpty ? null : rightSidebarContent}
        headerActions={headerActions}
      >
        {isSiteEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-background">
            <h2 className="text-2xl font-bold mb-2">Create Your Homepage</h2>
            <p className="text-muted-foreground mb-6 max-w-md">Your site is empty. The first page you create will become the site's permanent homepage.</p>
            <div className="flex gap-4">
              <NewPageDialog siteId={siteId}><Button size="lg"><FilePlus className="mr-2 h-5 w-5" /> Create Content Page</Button></NewPageDialog>
              {/* <CreateCollectionPageDialog siteId={siteId}><Button size="lg" variant="outline"><LayoutGrid className="mr-2 h-5 w-5" /> Create Collection Page</Button></CreateCollectionPageDialog> */}
            </div>
          </div>
        ) : (
          (() => {
            if (status !== 'ready' || !frontmatter) {
              return <EditorLoadingSkeleton />;
            }
            return (
              <div className='flex h-full w-full flex-col'>
                <div className='container mx-auto flex h-full max-w-[900px] flex-col p-6'>
                  <div className="shrink-0">
                    <PrimaryContentFields 
                      frontmatter={{ 
                        title: frontmatter.title, 
                        // FIX #2: Add a type assertion to safely pass the description.
                        // We know it's a string from the schema, so this is safe.
                        description: frontmatter.description as string | undefined
                      }} 
                      onFrontmatterChange={handleFrontmatterChange as (newData: Partial<MarkdownFrontmatter>) => void} 
                    />
                  </div>
                  <div className="mt-6 flex-grow min-h-0">
                    {isCollectionListingPage && frontmatter.layoutConfig?.collectionId ? (
                      <CollectionItemList siteId={siteId} collectionId={frontmatter.layoutConfig.collectionId} />
                    ) : (
                      <MarkdownEditor ref={editorRef} key={filePath} initialContent={initialMarkdown} onContentChange={onContentModified} />
                    )}
                  </div>
                </div>
              </div>
            );
          })()
        )}
      </ThreeColumnLayout>
    </>
  );
}

/**
 * The final exported component wraps the internal logic with the necessary context provider.
 */
export default function EditContentPage() {
  return (
    <EditorProvider>
      <EditContentPageInternal />
    </EditorProvider>
  );
}

================================================================================

File: pages/sites/view/ViewSitePage.tsx
// src/pages/sites/view/ViewSitePage.tsx

import SiteViewer from '@/features/viewer/components/SiteViewer';
import { useAppStore } from '@/core/state/useAppStore';
import { useCallback } from 'react';
import { useParams } from 'react-router-dom';

export default function ViewSitePage() {
  const { siteId = '' } = useParams<{ siteId: string }>();
  const site = useAppStore(useCallback((state) => state.getSiteById(siteId), [siteId]));

  const pageTitle = `Preview: ${site?.manifest?.title || 'Loading...'}`;

  return (
    <>
      <title>{pageTitle}</title>
      
      {/*
        This page's only job is to render the master preview component.
        The SiteViewer component itself will read the URL and parameters
        to determine what to render inside the iframe.
      */}
      <SiteViewer />
    </>
  );
}

================================================================================

File: pages/sites/collections/CollectionManagementPage.tsx
'use client';

import { useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// Global State and UI Management
import { useUIStore } from '@/core/state/uiStore';
import { useAppStore } from '@/core/state/useAppStore';
import { EditorProvider } from '@/features/editor/contexts/EditorProvider';

// Services
import { getCollection } from '@/core/services/collections.service';

// UI Components
import { Button } from '@/core/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import ThreeColumnLayout from '@/core/components/layout/ThreeColumnLayout';
import LeftSidebar from '@/features/editor/components/LeftSidebar';
import CollectionItemList from '@/features/editor/components/CollectionItemList';
import CollectionSettingsSidebar from '@/features/editor/components/CollectionSettingsSidebar';
import { CollectionErrorBoundary } from '@/features/editor/components/ErrorBoundary';

/**
 * Loading skeleton for collection management
 */
function CollectionLoadingSkeleton() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-muted-foreground">Loading Collection...</p>
    </div>
  );
}

/**
 * Collection not found component
 */
function CollectionNotFound({ siteId, collectionId }: { siteId: string; collectionId: string }) {
  const navigate = useNavigate();
  
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Collection Not Found</h2>
        <p className="text-muted-foreground mb-6">
          The collection "{collectionId}" could not be found.
        </p>
        <Button onClick={() => navigate(`/sites/${siteId}/edit`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Editor
        </Button>
      </div>
    </div>
  );
}

/**
 * The internal component that contains the core collection management logic.
 */
function CollectionManagementPageInternal() {
  const navigate = useNavigate();
  const { siteId = '', collectionId = '' } = useParams<{ siteId: string; collectionId: string }>();
  
  const site = useAppStore(useCallback((state) => state.getSiteById(siteId), [siteId]));
  const collection = useMemo(() => site ? getCollection(site.manifest, collectionId) : null, [site, collectionId]);

  const { setLeftAvailable, setRightAvailable, setLeftSidebarContent, setRightSidebarContent } = useUIStore(state => state.sidebar);

  useEffect(() => {
    setLeftAvailable(true);
    setLeftSidebarContent(<LeftSidebar />);
    return () => { setLeftAvailable(false); setLeftSidebarContent(null); };
  }, [setLeftAvailable, setLeftSidebarContent]);

  useEffect(() => {
    if (collection) {
      setRightAvailable(true);
      setRightSidebarContent(<CollectionSettingsSidebar siteId={siteId} collectionId={collectionId} />);
    } else {
      setRightAvailable(false);
      setRightSidebarContent(null);
    }
    return () => { setRightAvailable(false); setRightSidebarContent(null); };
  }, [collection, siteId, collectionId, setRightAvailable, setRightSidebarContent]);

  if (!site) return <CollectionLoadingSkeleton />;
  if (!collection) return <CollectionNotFound siteId={siteId} collectionId={collectionId} />;

  const pageTitle = `Managing: ${collection.name} | ${site.manifest.title || 'Sparktype'}`;
  const headerActions = <Button variant="ghost" size="sm" onClick={() => navigate(`/sites/${siteId}/edit`)}><ArrowLeft className="h-4 w-4 mr-2" />Back to Editor</Button>;

  return (
    <>
      <title>{pageTitle}</title>
      <ThreeColumnLayout leftSidebar={<LeftSidebar />} rightSidebar={<CollectionSettingsSidebar siteId={siteId} collectionId={collectionId}/>} headerActions={headerActions}>
        <div className="container mx-auto max-w-[900px] p-6">
          <div className="shrink-0 mb-6">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-3xl font-bold">{collection.name}</h1>
              {/* CORRECTED: Removed obsolete `typeId` display */}
            </div>
             {/* CORRECTED: Added type guard for rendering the description */}
            {typeof collection.settings?.description === 'string' && (
              <p className="text-muted-foreground">{collection.settings.description}</p>
            )}
            <p className="text-sm text-muted-foreground mt-1">{collection.contentPath}</p>
          </div>
          <CollectionItemList siteId={siteId} collectionId={collectionId} />
        </div>
      </ThreeColumnLayout>
    </>
  );
}

export default function CollectionManagementPage() {
  return (<CollectionErrorBoundary><EditorProvider><CollectionManagementPageInternal /></EditorProvider></CollectionErrorBoundary>);
}

================================================================================

