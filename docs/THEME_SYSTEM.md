# Sparktype Theme System

## Overview

The Sparktype theme system uses **Handlebars templates** to render markdown content into static HTML sites. The system has two key components:

1. **Themes** - Global site wrappers that provide the overall page structure (header, footer, base HTML shell)
2. **Layouts** - Content-specific templates that format individual pages and collections

This document traces the complete flow from source templates in the `public/` folder through to the final published static site.

---

## Architecture

### 1. Theme Structure (`public/themes/`)

Themes provide the overall page shell and global components. Each theme is a self-contained directory:

```
public/themes/
├── sparksite/
│   ├── theme.json           # Theme manifest and configuration
│   ├── base.hbs             # Main HTML wrapper template
│   ├── variables.css        # CSS variables for theming
│   └── partials/
│       ├── head.hbs         # <head> section template
│       ├── header.hbs       # Site header/navigation
│       └── footer.hbs       # Site footer
└── sparkdocs/
    ├── theme.json
    ├── base.hbs
    ├── variables.css
    └── partials/
        ├── head.hbs
        ├── header.hbs
        ├── sidebar.hbs      # Docs-specific sidebar
        └── footer.hbs
```

#### Theme Manifest (`theme.json`)

Defines theme metadata, files, appearance settings, and optional theme-specific data:

```json
{
  "name": "Sparkdocs",
  "version": "1.0.0",
  "files": [
    { "path": "theme.json", "type": "manifest" },
    { "path": "base.hbs", "type": "base" },
    { "path": "variables.css", "type": "stylesheet" },
    { "path": "partials/head.hbs", "type": "partial", "name": "head" },
    { "path": "partials/header.hbs", "type": "partial", "name": "header" },
    { "path": "partials/footer.hbs", "type": "partial", "name": "footer" }
  ],
  "appearanceSchema": {
    "type": "object",
    "properties": {
      "color_background": { "type": "string", "format": "color", "default": "#ffffff" },
      "color_text": { "type": "string", "format": "color", "default": "#333333" },
      "font_headings": { "type": "string", "enum": ["Inter", "Geist", ...] }
    }
  },
  "themeDataSchema": {
    "type": "object",
    "properties": {
      "header_content": { "type": "string", "format": "textarea" },
      "footer_content": { "type": "string", "format": "textarea" }
    }
  }
}
```

**Key Schemas:**
- `appearanceSchema` - User-configurable appearance settings (colors, fonts, spacing)
- `themeDataSchema` - Custom data fields specific to the theme (footer text, links, etc.)

#### Base Template (`base.hbs`)

The outer HTML shell that wraps all pages:

```handlebars
<!DOCTYPE html>
<html lang="en">
<head>
    {{> head headContext}}
</head>
<body>
    <div class="flex flex-col min-h-screen">
        {{> header}}
        <main class="flex-1">
            {{{body}}}
        </main>
        {{> footer}}
    </div>
</body>
</html>
```

**Key Variables:**
- `{{> partialName}}` - Includes registered Handlebars partials
- `{{{body}}}` - Rendered layout content (triple braces = unescaped HTML)
- `headContext` - Scoped context passed to the head partial

---

### 2. Layout Structure (`public/layouts/`)

Layouts define how specific content types are displayed. Each layout is a directory:

```
public/layouts/
├── page/
│   ├── layout.json          # Layout manifest
│   └── index.hbs            # Main layout template
├── blog-post/
│   ├── layout.json
│   └── index.hbs
├── blog-listing/
│   ├── layout.json
│   ├── index.hbs            # Main collection template
│   └── partials/
│       ├── post-card.hbs    # Card display variant
│       └── post-full.hbs    # Full content variant
├── docs-page/
│   ├── layout.json
│   └── index.hbs
└── hero-page/
    ├── layout.json
    └── index.hbs
```

#### Layout Manifest (`layout.json`)

Defines layout metadata, type, fields, and display variants:

```json
{
  "name": "Blog listing",
  "version": "1.0.0",
  "description": "Displays a paginated list of items from a 'Blog' collection.",
  "layoutType": "collection",
  "files": [
    { "path": "layout.json", "type": "manifest" },
    { "path": "index.hbs", "type": "template" },
    { "path": "partials/post-card.hbs", "type": "partial" },
    { "path": "partials/post-full.hbs", "type": "partial" }
  ],
  "partials": [
    {
      "path": "partials/post-card.hbs",
      "name": "Card View",
      "description": "Compact cards with title, excerpt, and read more links",
      "isDefault": true
    }
  ],
  "schema": {
    "type": "object",
    "properties": {
      "listing_title": { "type": "string", "title": "Custom Page Title" }
    }
  },
  "image_presets": {
    "featured_image": {
      "contexts": {
        "card": "thumbnail",
        "full": "page_display"
      }
    }
  }
}
```

**Layout Types:**
- `single` - Individual content pages (blog posts, standard pages)
- `collection` - Lists of content items (blog listings, portfolio grids)

**Partials:**
- Named template variants for collection items
- Enable different display modes (card view, list view, grid, etc.)
- Registered as `{layoutId}/partials/{filename}` in Handlebars

#### Layout Template (`index.hbs`)

The content template that receives the page context:

```handlebars
<article class="max-w-4xl mx-auto px-4 py-8">
    <h1>{{contentFile.frontmatter.title}}</h1>

    {{#if contentFile.frontmatter.featured_image}}
        <div class="mb-6">
            {{{image fieldname="featured_image" class="w-full" alt=contentFile.frontmatter.title}}}
        </div>
    {{/if}}

    {{{content}}}

    {{#if contentFile.frontmatter.layoutConfig}}
        {{{render_collection contentFile.frontmatter.layoutConfig}}}
    {{/if}}
</article>
```

**Available Context:**
- `contentFile` - Parsed markdown file with frontmatter and content
- `siteData` - Full site manifest and configuration
- `collectionItems` - Items for collection layouts
- `manifest` - Site manifest data

---

## Content Integration

### 1. Content Files with Frontmatter

Content files specify their layout via frontmatter:

```markdown
---
title: My Blog Post
layout: blog-post
date: '2025-01-15'
published: true
featured_image:
  serviceId: local
  src: assets/originals/image.jpg
  alt: Featured image
  width: 1200
  height: 800
---

This is my blog post content written in **Markdown**.
```

**Key Fields:**
- `layout` - Specifies which layout to use (must match a layout directory name)
- `title`, `date`, `published` - Standard metadata
- Image fields (e.g., `featured_image`) - ImageRef objects for image handling

### 2. Site Manifest Configuration

The site's `manifest.json` specifies the active theme:

```json
{
  "siteId": "my-site-abc123",
  "title": "My Site",
  "theme": {
    "name": "docs",
    "config": {
      "color_background": "#f8f9fa",
      "color_text": "#212529",
      "font_headings": "Inter",
      "font_text": "Gentium Book Plus",
      "sidebar_width": "280px"
    }
  },
  "structure": [
    {
      "type": "page",
      "title": "Home",
      "path": "content/home.md",
      "slug": "home"
    }
  ],
  "collections": [
    {
      "name": "Blog",
      "contentPath": "content/blog/",
      "defaultItemLayout": "blog-post",
      "id": "blog"
    }
  ]
}
```

**Theme Configuration Flow:**
1. User selects theme in UI → saves to `manifest.theme.name`
2. User customizes appearance → saves to `manifest.theme.config`
3. Render service merges config with theme defaults from `theme.json`
4. Final config generates CSS variables in `<style>` tag

---

## Rendering Pipeline

### Step 1: Template Preparation (`asset.service.ts`)

**Location:** `src/core/services/renderer/asset.service.ts`

```typescript
export async function prepareRenderEnvironment(siteData: LocalSiteData): Promise<void> {
    registerCoreHelpers(siteData);      // Register Handlebars helpers
    await cacheAllTemplates(siteData);   // Pre-compile and register templates
}
```

**Template Registration:**
1. Clears existing Handlebars partials
2. Loads theme manifest and registers theme partials by name:
   - `head`, `header`, `footer`, `sidebar`
3. Loads all layout manifests and registers layout partials with namespace:
   - `blog-listing/partials/post-card`
   - `blog-listing/partials/post-full`
4. Compiles all templates for reuse during rendering

**Handlebars Helpers Registered:**
- `image` - Renders image tags with service integration
- `markdown` - Converts markdown to HTML
- `render_collection` - Renders collection items
- `formatDate` - Date formatting
- `query` - Filter and query collections
- Many more (see `src/core/services/renderer/helpers/`)

### Step 2: Content Resolution (`pageResolver.service.ts`)

Resolves URL slugs to content files and layouts:

```typescript
const resolution = await resolvePageContent(siteData, ['blog', 'my-post']);
// Returns:
{
  type: PageType.ContentPage,
  contentFile: { path: 'content/blog/my-post.md', frontmatter: {...}, content: '...' },
  layoutPath: 'blog-post',  // From frontmatter.layout
  pageTitle: 'My Post | Site Title'
}
```

### Step 3: Context Assembly (`context.service.ts`)

**Location:** `src/core/services/renderer/context.service.ts`

Builds two context objects for rendering:

#### Page Context
Passed to the layout template (`index.hbs`):

```typescript
const pageContext = await assemblePageContext(siteData, resolution, options, imageService);
// Contains:
{
  contentFile: { path, frontmatter, content, slug },
  siteData: { manifest, contentFiles, ... },
  collectionItems: [...],  // For collection layouts
  layoutManifest: { name, schema, files, ... },
  options: { isExport, siteRootPath, relativeAssetPath }
}
```

#### Base Context
Passed to the theme's `base.hbs`:

```typescript
const baseContext = await assembleBaseContext(siteData, resolution, options, imageService, pageContext);
// Contains:
{
  manifest: { title, description, theme, ... },
  navLinks: [...],  // Generated navigation tree
  headContext: {
    pageTitle: 'Page Title | Site Title',
    canonicalUrl: 'https://example.com/page',
    styleOverrides: '<style>:root { --color-background: #fff; }</style>',
    faviconUrl: '/assets/favicon.png',
    logoUrl: '/assets/logo.png'
  },
  pageContext: { ... }  // Nested page context
}
```

### Step 4: Markdown Processing (`render.service.ts`)

**Location:** `src/core/services/renderer/render.service.ts`

Processes markdown content with remark/rehype:

```typescript
const processor = remark()
  .use(remarkDirective)           // Support for ::collection_view directives
  .use(customImageHandler)        // Mark Sparktype assets for processing
  .use(remarkRehype)              // Convert to HTML
  .use(rehypeSlug)                // Add IDs to headings for TOC
  .use(rehypeStringify);          // Serialize to HTML string

const processedContent = await processor.process(markdownContent);
```

**Post-processing:**
1. Collection directives (`::collection_view`) → rendered collection HTML
2. Sparktype asset paths → blob URLs (preview) or relative paths (export)
3. External images → passed through unchanged

### Step 5: Template Rendering

**Two-stage rendering process:**

#### Stage 1: Layout Rendering
```typescript
const bodyTemplateSource = await getAssetContent(siteData, 'layout', resolution.layoutPath, 'index.hbs');
const bodyTemplate = Handlebars.compile(bodyTemplateSource);
const bodyHtml = bodyTemplate(pageContext);
```

Produces the main content HTML (article, collection listing, etc.)

#### Stage 2: Theme Rendering
```typescript
const baseTemplateSource = await getAssetContent(siteData, 'theme', siteData.manifest.theme.name, 'base.hbs');
const baseTemplate = Handlebars.compile(baseTemplateSource);
const finalHtml = baseTemplate({ ...baseContext, body: new Handlebars.SafeString(bodyHtml) });
```

Wraps the layout HTML in the full page shell (header, footer, navigation)

**Final Output:**
Complete HTML page ready for browser display or file export.

---

## Build Process

### Overview (`siteBuilder.service.ts`)

**Location:** `src/core/services/siteBuilder.service.ts`

Orchestrates the complete static site build:

```typescript
export async function buildSiteBundle(siteData: LocalSiteData): Promise<SiteBundle> {
    const bundle: SiteBundle = {};

    // 1. Synchronize theme config
    const { initialConfig: finalMergedConfig } = await getMergedThemeDataForForm(
        siteData.manifest.theme.name,
        siteData.manifest.theme.config
    );
    const synchronizedSiteData = { ...siteData, manifest: { ...siteData.manifest, theme: { ...finalMergedConfig } } };

    // 2. Generate all HTML pages
    const htmlPages = await generateHtmlPages(synchronizedSiteData);
    Object.assign(bundle, htmlPages);

    // 3. Bundle source files (content, manifest, data)
    await bundleSourceFiles(bundle, synchronizedSiteData);

    // 4. Bundle assets (images, themes, layouts, CSS)
    await bundleAllAssets(bundle, synchronizedSiteData);

    // 5. Generate metadata (RSS, sitemap)
    generateMetadataFiles(bundle, synchronizedSiteData);

    return bundle;  // In-memory representation of complete site
}
```

### HTML Page Generation (`page.builder.ts`)

**Location:** `src/core/services/builder/page.builder.ts`

Generates static HTML for all content:

```typescript
export async function generateHtmlPages(siteData: LocalSiteData): Promise<Record<string, string>> {
    const htmlPages: Record<string, string> = {};

    // Step 1: Generate pages from site structure
    const allStructureNodes = flattenStructure(manifest.structure);
    for (const node of allStructureNodes) {
        const slugArray = node.slug.split('/');
        const resolution = await resolvePageContent(siteData, slugArray);
        const outputPath = generateExportUrl(node, manifest, undefined, siteData, undefined, true);
        // e.g., 'about-us/index.html', 'blog/index.html'

        const finalHtml = await render(siteData, resolution, {
            siteRootPath: '/',
            isExport: true,
            relativeAssetPath: '../'.repeat((outputPath.match(/\//g) || []).length)
        });

        htmlPages[outputPath] = finalHtml;
    }

    // Step 2: Generate pages for collection items
    const collectionItems = manifest.collectionItems || [];
    for (const itemRef of collectionItems) {
        const outputPath = generateExportUrl(itemRef, manifest, undefined, siteData, undefined, true);
        // e.g., 'blog/my-post/index.html'

        const finalHtml = await render(siteData, resolution, { ... });
        htmlPages[outputPath] = finalHtml;
    }

    return htmlPages;
}
```

**Output Examples:**
- `index.html` - Homepage
- `about/index.html` - About page
- `blog/index.html` - Blog listing page
- `blog/my-first-post/index.html` - Individual blog post
- `blog/another-post/index.html` - Another blog post

### Asset Bundling (`asset.builder.ts`)

**Location:** `src/core/services/builder/asset.builder.ts`

Copies all required assets to the bundle:

```typescript
export async function bundleAllAssets(bundle: SiteBundle, siteData: LocalSiteData): Promise<void> {
    // 1. Bundle main CSS (Tailwind output)
    const response = await fetch('/styles.css');
    bundle['_site/assets/css/styles.css'] = await response.text();

    // 2. Cleanup orphaned images
    await cleanupOrphanedImages(siteData);

    // 3. Bundle referenced images
    const allImageRefs = findAllImageRefs(siteData);
    const imageService = getActiveImageService(siteData.manifest);
    const assetsToBundle = await imageService.getExportableAssets(siteData.siteId, allImageRefs);
    for (const asset of assetsToBundle) {
        bundle[asset.path] = asset.data;
        // e.g., '_site/assets/originals/123-image.jpg'
        // e.g., '_site/assets/derivatives/123-image-800x600.jpg'
    }

    // 4. Bundle theme files
    await bundleAssetFiles(bundle, siteData, 'theme', siteData.manifest.theme.name);
    // Copies: _site/themes/docs/base.hbs, partials/head.hbs, etc.

    // 5. Bundle layout files
    const usedLayoutIds = [...new Set(siteData.contentFiles.map(f => f.frontmatter.layout))];
    for (const layoutId of usedLayoutIds) {
        await bundleAssetFiles(bundle, siteData, 'layout', layoutId);
        // Copies: _site/layouts/blog-post/index.hbs, layout.json, etc.
    }

    // 6. Generate media.json manifest
    await generateMediaDataFile(bundle, siteData);
}
```

**Bundled Assets:**
- `_site/assets/css/styles.css` - Main stylesheet
- `_site/assets/originals/` - Original uploaded images
- `_site/assets/derivatives/` - Generated image derivatives
- `_site/themes/{themeName}/` - Active theme files
- `_site/layouts/{layoutId}/` - Used layout files
- `_site/data/media.json` - Image metadata manifest

---

## Published Site Structure

The final exported site has this structure:

```
site-export/
├── index.html                          # Homepage
├── about/
│   └── index.html                      # About page
├── blog/
│   ├── index.html                      # Blog listing page
│   ├── first-post/
│   │   └── index.html                  # Individual blog post
│   └── second-post/
│       └── index.html
├── assets/
│   ├── css/
│   │   └── styles.css                  # Main stylesheet
│   ├── originals/                      # Original images
│   │   ├── 123-photo.jpg
│   │   └── 456-banner.png
│   └── derivatives/                    # Generated image sizes
│       ├── 123-photo-800x600.jpg
│       └── 456-banner-1200x400.png
├── _site/                              # Source files (for re-import)
│   ├── manifest.json                   # Site configuration
│   ├── content/                        # Markdown source files
│   │   ├── about.md
│   │   ├── blog.md
│   │   └── blog/
│   │       ├── first-post.md
│   │       └── second-post.md
│   ├── data/
│   │   └── media.json                  # Image metadata
│   ├── themes/
│   │   └── docs/
│   │       ├── theme.json
│   │       ├── base.hbs
│   │       ├── variables.css
│   │       └── partials/
│   │           ├── head.hbs
│   │           ├── header.hbs
│   │           └── footer.hbs
│   └── layouts/
│       ├── page/
│       │   ├── layout.json
│       │   └── index.hbs
│       └── blog-post/
│           ├── layout.json
│           └── index.hbs
├── rss.xml                             # RSS feed
└── sitemap.xml                         # Sitemap
```

### File Organization

**HTML Files:**
- Each content item gets its own directory with `index.html`
- Enables clean URLs: `/blog/first-post/` instead of `/blog/first-post.html`
- Homepage is at root: `index.html`

**Asset Paths:**
- Relative paths from each HTML file to assets
- `index.html` → `assets/css/styles.css`
- `blog/post/index.html` → `../../assets/css/styles.css`

**Source Preservation (`_site/`):**
- Complete source files bundled for portability
- Enables site import/export workflow
- Users can download and re-import sites elsewhere

---

## Theme Customization Flow

### User Perspective

1. **Select Theme:**
   - User chooses theme from dropdown (e.g., "Sparkdocs")
   - Saves to `manifest.theme.name = "docs"`

2. **Customize Appearance:**
   - UI presents form based on `theme.json` → `appearanceSchema`
   - User adjusts colors, fonts, spacing
   - Saves to `manifest.theme.config`:
     ```json
     {
       "color_background": "#f8f9fa",
       "color_text": "#212529",
       "font_headings": "Inter"
     }
     ```

3. **Configure Theme Data:**
   - UI presents additional fields from `themeDataSchema`
   - User adds footer content, social links, etc.
   - Saves to `manifest.themeData` (if theme uses it)

### Technical Flow

**Configuration Merge (`theme.service.ts`):**

```typescript
export const getMergedThemeDataForForm = async (
  themeName: string,
  savedConfig: ThemeConfig['config'] = {},
  currentThemeName?: string
): Promise<{ schema: RJSFSchema | null; initialConfig: ThemeConfig['config'] }> => {
  const themeData = await getThemeData(themeName);
  const schema = themeData?.appearanceSchema;
  const defaults = extractDefaultsFromSchema(schema);

  const isThemeChange = currentThemeName && currentThemeName !== themeName;
  const mergedConfig = isThemeChange
    ? fieldByFieldMerge(defaults, savedConfig)  // Preserve compatible settings
    : { ...defaults, ...savedConfig };           // Keep all user settings

  return { schema, initialConfig: mergedConfig };
};
```

**CSS Variable Generation (`asset.service.ts`):**

```typescript
export function generateStyleOverrides(themeConfig: Record<string, string | number | boolean>): string {
  const variables = Object.entries(themeConfig)
    .map(([key, value]) => value ? `  --${key.replace(/_/g, '-')}: ${value};` : null)
    .filter(Boolean)
    .join('\n');

  return `<style id="signum-style-overrides">\n:root {\n${variables}\n}\n</style>`;
}
```

**Rendered Output:**

```html
<style id="signum-style-overrides">
:root {
  --color-background: #f8f9fa;
  --color-text: #212529;
  --color-headings: #000000;
  --font-headings: Inter;
  --sidebar-width: 280px;
}
</style>
```

These CSS variables are then used in theme templates and stylesheets.

---

## Complete Rendering Example

### Input Files

**Content File:** `content/blog/hello-world.md`
```markdown
---
title: Hello World
layout: blog-post
date: '2025-01-15'
author: John Doe
featured_image:
  serviceId: local
  src: assets/originals/123-photo.jpg
  alt: Featured photo
---

Welcome to my **first blog post**!
```

**Manifest:** `manifest.json`
```json
{
  "theme": { "name": "sparksite", "config": { "color_primary": "#0d6efd" } }
}
```

### Processing Steps

1. **Resolution:**
   - URL: `/blog/hello-world`
   - Resolves to: `content/blog/hello-world.md`
   - Layout: `blog-post` (from frontmatter)

2. **Context Assembly:**
   ```javascript
   pageContext = {
     contentFile: {
       frontmatter: { title: 'Hello World', layout: 'blog-post', ... },
       content: 'Welcome to my **first blog post**!',
       slug: 'hello-world'
     }
   }
   ```

3. **Markdown Processing:**
   ```
   'Welcome to my **first blog post**!'
   → '<p>Welcome to my <strong>first blog post</strong>!</p>'
   ```

4. **Layout Rendering** (`layouts/blog-post/index.hbs`):
   ```html
   <article class="max-w-4xl mx-auto">
       <h1>Hello World</h1>
       <div class="mb-6">
           <img src="assets/originals/123-photo.jpg" alt="Featured photo" />
       </div>
       <p>Welcome to my <strong>first blog post</strong>!</p>
   </article>
   ```

5. **Theme Rendering** (`themes/sparksite/base.hbs`):
   ```html
   <!DOCTYPE html>
   <html lang="en">
   <head>
       <title>Hello World | My Site</title>
       <style>:root { --color-primary: #0d6efd; }</style>
   </head>
   <body>
       <header>...</header>
       <main>
           <article class="max-w-4xl mx-auto">
               <h1>Hello World</h1>
               ...
           </article>
       </main>
       <footer>...</footer>
   </body>
   </html>
   ```

### Export Output

**File:** `blog/hello-world/index.html`
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Hello World | My Site</title>
    <link rel="stylesheet" href="../../assets/css/styles.css">
    <style>:root { --color-primary: #0d6efd; }</style>
</head>
<body>
    <header>...</header>
    <main>
        <article class="max-w-4xl mx-auto">
            <h1>Hello World</h1>
            <img src="../../assets/derivatives/123-photo-800x600.jpg" alt="Featured photo" />
            <p>Welcome to my <strong>first blog post</strong>!</p>
        </article>
    </main>
    <footer>...</footer>
</body>
</html>
```

**Note:** Relative paths adjusted for depth (`../../`), image converted to derivative.

---

## Key Service Files

### Rendering Pipeline
- `src/core/services/renderer/render.service.ts` - Main rendering orchestration
- `src/core/services/renderer/asset.service.ts` - Template registration and caching
- `src/core/services/renderer/context.service.ts` - Context assembly for templates
- `src/core/services/renderer/helpers/` - Handlebars helper functions

### Builder Services
- `src/core/services/siteBuilder.service.ts` - Main build orchestration
- `src/core/services/builder/page.builder.ts` - HTML page generation
- `src/core/services/builder/asset.builder.ts` - Asset bundling
- `src/core/services/builder/source.builder.ts` - Source file bundling
- `src/core/services/builder/metadata.builder.ts` - RSS/sitemap generation

### Configuration
- `src/core/services/config/theme.service.ts` - Theme config merging
- `src/core/services/config/configHelpers.service.ts` - Asset loading utilities
- `src/core/services/pageResolver.service.ts` - URL to content resolution

### Utilities
- `src/core/services/urlUtils.service.ts` - URL generation for pages/items
- `src/core/services/relativePaths.service.ts` - Relative path calculation
- `src/core/services/navigationStructure.service.ts` - Navigation tree generation

---

## Summary

The Sparktype theme system provides a flexible, template-based approach to static site generation:

1. **Themes** provide the global page structure and branding
2. **Layouts** define how specific content types are displayed
3. **Content files** specify their layout via frontmatter
4. **Handlebars templates** are compiled and rendered with rich context data
5. **Build process** generates complete static sites with proper relative paths
6. **Exported sites** are fully portable with source files included

The system's modularity allows for easy theme switching, layout customization, and content portability while maintaining a clean separation between content, presentation, and site structure.
