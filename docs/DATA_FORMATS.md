# Sparktype data file formats documentation

## Overview

Sparktype uses a structured approach to data organisation, with the main manifest file defining site configuration, collections, themes, and authentication. Content is stored as markdown files with YAML frontmatter, and images are tracked through a registry system that maps images to their usage locations.

---

## 1. Site manifest (manifest.json)

The manifest is the central configuration file for a Sparktype site. It defines the site structure, theme configuration, collections, tags, and system settings.

### Complete manifest structure

```json
{
  "siteId": "unique-site-identifier",
  "generatorVersion": "1.0.0",
  "title": "My Site Title",
  "description": "Site description for SEO and metadata",
  "author": "Author Name",
  "baseUrl": "https://example.com",
  
  "theme": {
    "name": "default",
    "config": {
      "primaryColor": "#000000",
      "accentColor": "#FF0000",
      "customSetting": true
    },
    "themeData": {
      "customKey": "custom value"
    }
  },

  "structure": [
    {
      "type": "page",
      "title": "Home Page",
      "menuTitle": "Home",
      "path": "content/index.md",
      "slug": "home",
      "navOrder": 1,
      "children": []
    }
  ],

  "layouts": [
    {
      "id": "blog-layout",
      "name": "Blog Post",
      "type": "item",
      "path": "layouts/blog/",
      "description": "Layout for blog posts"
    }
  ],

  "themes": [
    {
      "id": "default-theme",
      "name": "Default Theme",
      "path": "themes/default/"
    }
  ],

  "collections": [
    {
      "id": "blog",
      "name": "Blog Posts",
      "contentPath": "content/blog/",
      "defaultItemLayout": "blog-layout",
      "settings": {}
    }
  ],

  "collectionItems": [
    {
      "collectionId": "blog",
      "slug": "my-first-post",
      "path": "content/blog/my-first-post.md",
      "title": "My First Post",
      "url": "/blog/my-first-post/"
    }
  ],

  "tagGroups": [
    {
      "id": "categories",
      "name": "Categories",
      "description": "Content categories",
      "applicableCollections": ["blog"],
      "settings": {}
    }
  ],

  "tags": [
    {
      "id": "tech",
      "name": "Technology",
      "groupId": "categories",
      "description": "Tech-related content",
      "slug": "technology"
    }
  ],

  "logo": {
    "serviceId": "local",
    "src": "assets/originals/logo.png",
    "alt": "Site Logo",
    "width": 200,
    "height": 100
  },

  "favicon": {
    "serviceId": "local",
    "src": "assets/originals/favicon.ico",
    "alt": "Site Favicon"
  },

  "imagePresets": {
    "thumbnail": {
      "width": 300,
      "height": 300,
      "crop": "fill",
      "gravity": "centre",
      "description": "Small thumbnail image"
    },
    "featured": {
      "width": 1200,
      "height": 630,
      "crop": "fill",
      "gravity": "centre",
      "description": "Featured image preset"
    }
  },

  "settings": {
    "imageService": "local",
    "cloudinary": {
      "cloudName": "my-cloud"
    }
  },

  "publishingConfig": {
    "provider": "netlify",
    "netlify": {
      "siteId": "netlify-site-id",
      "siteName": "my-site"
    },
    "github": {
      "owner": "username",
      "repo": "repo-name",
      "branch": "main"
    }
  },

  "auth": {
    "publicKey": "base64-encoded-public-key",
    "credentialId": "webauthn-credential-id",
    "requiresAuth": true,
    "userDisplayName": "User Name",
    "registeredAt": "2024-01-01T00:00:00Z"
  },

  "dataFiles": ["data/media.json"]
}
```

### Field descriptions

#### Top-level metadata
- **siteId** (string, required): Unique identifier for the site
- **generatorVersion** (string, required): Version of Sparktype used to generate the site
- **title** (string, required): Site name
- **description** (string, required): Site description for SEO
- **author** (string, optional): Site author name
- **baseUrl** (string, optional): Base URL for the site (used in RSS/sitemap generation)

#### Theme configuration
- **theme** (ThemeConfig, required): Current theme configuration
  - **name**: Theme identifier
  - **config**: Key-value pairs for theme appearance settings
  - **themeData**: Additional theme-specific data

#### Structure and navigation
- **structure** (StructureNode[], required): Array of static pages defining site hierarchy
  - Each node has: `type`, `title`, `menuTitle`, `path`, `slug`, `navOrder`, `children`
  - Forms the main navigation tree

#### Layouts and themes
- **layouts** (LayoutInfo[], optional): Metadata about custom page and item layouts
- **themes** (ThemeInfo[], optional): Metadata about available themes

#### Collections system
- **collections** (Collection[], optional): Content collection definitions
  - **id**: Unique collection identifier
  - **name**: Display name
  - **contentPath**: Directory where collection items are stored (e.g., "content/blog/")
  - **defaultItemLayout**: Layout ID for rendering items
  - **settings**: Collection-specific configuration

#### Collection items
- **collectionItems** (CollectionItemRef[], optional): Indexed references to all collection items
  - Used for RSS feeds, sitemaps, and quick lookups
  - Updated when items are added/removed

#### Tag system
- **tagGroups** (TagGroup[], optional): Tag group definitions
  - **id**, **name**, **description**, **applicableCollections**, **settings**
- **tags** (Tag[], optional): Individual tag definitions
  - **id**, **name**, **groupId**, **description**, **slug**

#### Image assets
- **logo** (ImageRef, optional): Site logo image reference
- **favicon** (ImageRef, optional): Site favicon reference
- **imagePresets** (Record<string, ImagePreset>, optional): Named transformation presets
  - **width**, **height**, **crop**, **gravity**, **description**

#### Settings and configuration
- **settings** (object, optional): System-level settings
  - **imageService**: "local" or "cloudinary"
  - **cloudinary**: Cloudinary-specific configuration

- **publishingConfig** (object, optional): Publishing and deployment settings
  - **provider**: "zip", "netlify", or "github"
  - Provider-specific configuration

- **auth** (SiteAuthConfig, optional): WebAuthn authentication configuration
  - **publicKey**: Public key for credential verification
  - **credentialId**: Unique credential identifier
  - **requiresAuth**: Whether site requires authentication
  - **userDisplayName**: Display name of registered user
  - **registeredAt**: ISO 8601 timestamp

- **dataFiles** (string[], optional): Array of data file paths (e.g., "data/media.json")

---

## 2. Content files (Markdown with YAML frontmatter)

Content files are stored as markdown with YAML frontmatter. The frontmatter contains metadata and configuration.

### Content file structure

```markdown
---
title: "Article Title"
layout: "post"
date: "2024-01-15T10:00:00Z"
description: "Article description for SEO"
author: "Article Author"

featured_image:
  serviceId: "local"
  src: "assets/originals/featured.jpg"
  alt: "Featured image alt text"
  width: 1200
  height: 630

banner_image:
  serviceId: "cloudinary"
  src: "https://res.cloudinary.com/..."
  alt: "Banner image"

tags:
  categories: ["tech", "tutorial"]
  topics: ["javascript", "react"]

layoutConfig:
  collectionId: "blog"
  layout: "blog-listing"
  displayType: "grid"
  sortBy: "date"
  sortOrder: "desc"
  maxItems: 12
  itemsPerPage: 6
  filterTags: ["featured"]
  pagination:
    enabled: true
    itemsPerPage: 6
  templateVariables:
    customVar: "custom value"
  displayOptions:
    listingStyle: "grid"

custom_field_1: "Custom value"
---

# Article Content

Markdown content goes here...

![Inline image](assets/originals/inline-image.jpg)
```

### Frontmatter fields

#### Standard fields
- **title** (string, required): Page/article title
- **layout** (string, required): Layout template ID to use for rendering
- **date** (string, optional): ISO 8601 publication date
- **description** (string, optional): SEO meta description
- **author** (string, optional): Content author
- **homepage** (boolean, optional): Whether this is the homepage

#### Image fields
- **featured_image** (ImageRef, optional): Main featured image
- **banner_image** (ImageRef, optional): Header/banner image
- **[any other image field]** (ImageRef, optional): Custom image fields defined by layout schema

Each ImageRef contains:
```typescript
{
  serviceId: "local" | "cloudinary",
  src: string,                    // Path or URL
  alt?: string,                   // Alt text
  width?: number,                 // Image width
  height?: number                 // Image height
}
```

#### Tag assignments
- **tags** (Record<string, string[]>, optional): Tags organized by group
  - Key: Tag group ID
  - Value: Array of tag IDs assigned to this content

#### Collection layout configuration
- **layoutConfig** (LayoutConfig, optional): Configuration for displaying collection content
  - Used when a page displays a collection (e.g., "Show latest 10 blog posts")
  - **collectionId**: Which collection to display
  - **layout**: Which layout template to use
  - **displayType**: Which display variant to use (e.g., "grid" vs "list")
  - **sortBy**: Field to sort by
  - **sortOrder**: "asc" or "desc"
  - **maxItems**: Maximum items to display
  - **itemsPerPage**: Items per page (for pagination)
  - **filterTags**: Tag IDs to filter by
  - **pagination.enabled**: Enable pagination
  - **templateVariables**: Custom variables to pass to template
  - **displayOptions**: Display variant selections

#### Custom fields
- Any other fields are preserved and available to templates via frontmatter

### Markdown content body
The content section below the frontmatter:
- Regular markdown syntax
- Inline images: `![alt text](assets/originals/image.jpg)`
- All images are tracked in the registry based on `src` field

---

## 3. Image media manifest (media.json)

The media manifest tracks all images used in a site for export/import operations. It's generated from the image registry.

### Media manifest structure

```json
{
  "version": 1,
  "imageService": "local",
  "images": {
    "assets/originals/photo1.jpg": {
      "referencedIn": [
        "content/blog/post1.md",
        "content/blog/post2.md"
      ],
      "metadata": {
        "sizeBytes": 245760,
        "width": 1920,
        "height": 1080,
        "alt": "Beautiful photo"
      }
    },
    "assets/originals/photo2.jpg": {
      "referencedIn": [
        "content/pages/about.md"
      ],
      "metadata": {
        "sizeBytes": 180000,
        "width": 1600,
        "height": 900,
        "alt": "Another photo"
      }
    },
    "assets/originals/logo.png": {
      "referencedIn": [],
      "metadata": {
        "sizeBytes": 50000,
        "width": 200,
        "height": 100
      }
    }
  }
}
```

### Field descriptions

#### Root level
- **version** (number): Format version (currently 1) for future compatibility
- **imageService** (string): Which service was used ("local" or "cloudinary")
- **images** (Record<string, MediaImageEntry>): Map of image paths to their data

#### MediaImageEntry
- **referencedIn** (string[]): Array of file paths that reference this image
  - Empty array indicates the image is orphaned
  - Used for cleanup and dependency tracking
  
- **metadata** (MediaImageMetadata): Essential image metadata
  - **sizeBytes** (number, required): File size in bytes
  - **width** (number, optional): Image width in pixels
  - **height** (number, optional): Image height in pixels
  - **alt** (string, optional): Alt text for accessibility

### Key characteristics
- **Only includes referenced images**: Orphaned images are excluded by default
- **No derivative tracking**: Derivatives are generated on-demand during rendering
- **Image service agnostic**: Can be used to migrate between local and Cloudinary
- **Safe for export**: Includes only essential data needed for reimport

---

## 4. Image registry (Internal - IndexedDB)

The image registry is stored in the browser's IndexedDB and tracks complete image metadata including derivatives and access patterns.

### Image registry structure

```typescript
interface ImageRegistry {
  siteId: string;
  version: number;
  lastUpdated: number;
  images: Record<string, ImageMetadata>;
}

interface ImageMetadata {
  originalPath: string;                    // Path where image is stored
  derivativePaths: string[];               // Generated transformed versions
  referencedIn: string[];                  // Files that reference this image
  lastAccessed: number;                    // Timestamp for LRU cleanup
  sizeBytes: number;                       // Original file size
  width?: number;                          // Image width in pixels
  height?: number;                         // Image height in pixels
  alt?: string;                            // Alt text
  createdAt: number;                       // When added to registry
}
```

### Registry Features
- **Derivative tracking**: Knows which transformed versions exist
- **Usage tracking**: Can identify unused images for cleanup
- **Access patterns**: Tracks last access for LRU cache management
- **Complete metadata**: Preserves all image information for rendering

---

## 5. Image References

Images can be referenced in two ways:

### A. ImageRef Objects (in Frontmatter)

```typescript
interface ImageRef {
  serviceId: 'local' | 'cloudinary';
  src: string;           // Path or URL
  alt?: string;
  width?: number;
  height?: number;
}
```

Example in frontmatter:
```yaml
featured_image:
  serviceId: local
  src: assets/originals/1704067200000-sunset.jpg
  alt: Beautiful sunset
  width: 1920
  height: 1080
```

### B. Markdown Inline Images

```markdown
![alt text](assets/originals/image.jpg)
```

The finder scans for patterns: `![.*?](assets/.*?)`

---

## 6. Collections Configuration

Collections are content groupings with their own organisation and layouts.

### Collection Instance Definition

```typescript
interface Collection {
  id: string;                    // Unique identifier (e.g., "blog")
  name: string;                  // Display name
  contentPath: string;           // Directory containing items (e.g., "content/blog/")
  defaultItemLayout: string;     // Default layout ID for items
  settings?: Record<string, unknown>;  // Custom collection settings
}
```

### Collection Item Reference

```typescript
interface CollectionItemRef {
  collectionId: string;          // Which collection it belongs to
  slug: string;                  // URL-friendly identifier
  path: string;                  // File path (e.g., "content/blog/post.md")
  title: string;                 // Item title
  url: string;                   // Rendered URL
}
```

### Collection Content Discovery
Content files are associated with collections via their path:
- Files in `content/blog/` belong to the "blog" collection
- Files in `content/pages/` belong to the "pages" collection
- Determined by the `contentPath` field in collection definition

---

## 7. Tag System

Tags are organized into groups and applied to content.

### Tag Group Definition

```typescript
interface TagGroup {
  id: string;                    // Unique identifier (e.g., "categories")
  name: string;                  // Display name
  description?: string;
  applicableCollections: string[];  // Which collections can use these tags
  settings?: Record<string, unknown>;
}
```

### Tag Definition

```typescript
interface Tag {
  id: string;                    // Unique identifier (e.g., "tech")
  name: string;                  // Display name
  groupId: string;               // Which group this tag belongs to
  description?: string;
  slug?: string;                 // URL-friendly version
}
```

### Tag Assignment in Frontmatter

```yaml
tags:
  categories: ["tech", "tutorial"]  # Group ID -> array of tag IDs
  topics: ["javascript", "react"]
```

---

## 8. Theme Configuration

Theme configuration is stored in the manifest and defines appearance.

### ThemeConfig Structure

```typescript
interface ThemeConfig {
  name: string;                        // Theme ID
  config: Record<string, string | boolean | number>;  // Settings
  themeData?: Record<string, unknown>; // Additional data
}
```

Example:
```json
{
  "name": "default-theme",
  "config": {
    "primaryColor": "#000000",
    "accentColor": "#FF0000",
    "siteLogo": "assets/logo.png",
    "enableDarkMode": true
  },
  "themeData": {
    "customVariable": "value"
  }
}
```

---

## 9. Layout Configuration in Frontmatter

When a page displays collection content, it uses LayoutConfig.

### LayoutConfig Structure

```typescript
interface LayoutConfig {
  collectionId: string;              // Which collection to display
  layout: string;                    // Which layout template
  displayType?: string;              // Display variant (e.g., "grid", "list")
  sortBy?: string;                   // Sort field
  sortOrder?: 'asc' | 'desc';        // Sort direction
  maxItems?: number;                 // Max items to display
  itemsPerPage?: number;             // Pagination size
  filterTags?: string[];             // Tag IDs to filter by
  pagination?: {
    enabled: boolean;
    itemsPerPage?: number;
  };
  templateVariables?: Record<string, unknown>;  // Custom template vars
  displayOptions?: Record<string, string>;      // Display variant choices
}
```

Example in frontmatter:
```yaml
layoutConfig:
  collectionId: blog
  layout: blog-listing
  displayType: grid
  sortBy: date
  sortOrder: desc
  maxItems: 12
  itemsPerPage: 6
  pagination:
    enabled: true
    itemsPerPage: 6
```

---

## 10. WebAuthn Authentication Configuration

Site authentication is configured in the manifest.

### SiteAuthConfig Structure

```typescript
interface SiteAuthConfig {
  publicKey: string;             // Public key for verification (safe to share)
  credentialId: string;          // WebAuthn credential identifier
  requiresAuth: boolean;         // Whether auth is required to view
  userDisplayName?: string;      // Registered user's display name
  registeredAt: string;          // ISO 8601 registration timestamp
}
```

### Key Properties
- **publicKey**: Base64-encoded public key that can be shared/stored publicly
- **credentialId**: Unique identifier from WebAuthn credential
- **Private key**: Never stored or transmitted (stays on user's device)
- **Per-site credentials**: Each site has its own isolated credential

---

## 11. Publishing Configuration

Publishing settings define how the site is deployed.

### PublishingConfig Structure

```typescript
interface PublishingConfig {
  provider: 'zip' | 'netlify' | 'github';
  
  netlify?: {
    siteId?: string;     // Netlify site ID
    siteName?: string;   // Netlify site name
  };
  
  github?: {
    owner: string;       // GitHub username
    repo: string;        // Repository name
    branch?: string;     // Branch to publish to
  };
}
```

---

## 12. Image Presets Configuration

Image presets define transformation options available for responsive images.

### ImagePreset Structure

```typescript
interface ImagePreset {
  width?: number;        // Target width in pixels
  height?: number;       // Target height in pixels
  crop?: 'fill' | 'fit' | 'scale';  // Crop strategy
  gravity?: 'centre' | 'north' | 'south' | 'east' | 'west';  // Crop focus
  description?: string;  // Human description
}
```

### ImageFieldPreset Structure

Context-aware preset configuration for specific fields:

```typescript
interface ImageFieldPreset {
  contexts?: Record<string, string>;  // context -> preset name mapping
  default?: string;                   // Fallback preset
}
```

---

## 13. Navigation Structure

The structure defines the site's navigation hierarchy.

### StructureNode Format

```typescript
interface StructureNode {
  type: 'page';
  title: string;         // Display title
  menuTitle?: string;    // Short menu title
  path: string;          // Content file path (e.g., "content/index.md")
  slug: string;          // URL slug
  navOrder?: number;     // Navigation order
  children?: StructureNode[];  // Nested pages
  [key: string]: unknown;  // Custom fields
}
```

Example:
```json
{
  "type": "page",
  "title": "Blog",
  "menuTitle": "Blog",
  "path": "content/blog/index.md",
  "slug": "blog",
  "navOrder": 2,
  "children": [
    {
      "type": "page",
      "title": "Category: Tech",
      "path": "content/blog/tech.md",
      "slug": "blog/tech",
      "navOrder": 1
    }
  ]
}
```

---

## 14. Site Secrets (SiteSecrets)

Sensitive credentials are stored separately from the manifest (never exported).

### SiteSecrets Structure

```typescript
interface SiteSecrets {
  cloudinary?: {
    uploadPreset?: string;
  };
  
  publishing?: {
    netlify?: {
      apiToken?: string;
      proxySettings?: {
        useAppProxy?: boolean;
        customProxyUrl?: string;
      };
    };
    github?: {
      accessToken?: string;
    };
  };
}
```

### Key Features
- **Never exported**: Secrets stay in the browser
- **Not in manifest**: Stored separately in IndexedDB
- **Clean exports**: Exported sites don't contain credentials

---

## Data File Generation and Persistence

### What Gets Generated (media.json)

1. **When**: During site export or backup
2. **What**: Referenced images with their metadata and usage information
3. **How**: 
   - Scans image registry for all images
   - Includes only images with references (by default)
   - Preserves metadata for reimport

```typescript
async function generateMediaManifest(siteData, options = {}): Promise<MediaManifest>
```

### What Gets Computed vs Persisted

**Persisted in Manifest:**
- Site structure and hierarchy
- Collection definitions
- Tag groups and tags
- Theme configuration
- Image presets
- Publishing settings
- WebAuthn credentials

**Computed/Derived:**
- Collection items list (built from content directory scan)
- Image references (found by scanning content)
- Derivatives cache (generated on-demand)
- Navigation paths (derived from structure)

**In Separate Registry (IndexedDB):**
- Image metadata
- Derivative paths
- Reference tracking
- Access timestamps

---

## Import/Export Considerations

### What's exported
- manifest.json (all configuration)
- All content files (markdown)
- All layout files
- media.json (image metadata and usage)
- Rendered HTML/CSS
- Images in assets/

### What's not exported
- Site secrets (API tokens, credentials)
- Browser cache and derivatives
- User authentication state
- Workspace metadata

### Import process
1. Load manifest.json into memory
2. Parse media.json to rebuild image registry
3. Optionally migrate image service (local → Cloudinary)
4. Reconstruct content file index
5. Restore theme and collection configuration

---

## Path conventions

### Content files
- **Location**: `content/` directory
- **Format**: Markdown with YAML frontmatter
- **Naming**: Slug-based (URL-friendly names)
- **Collections**: Organized in subdirectories (e.g., `content/blog/`)

### Assets
- **Original images**: `assets/originals/`
- **Derivative images**: `assets/derivatives/`
- **Naming**: `{timestamp}-{slugified-name}.{ext}`
- **Derivatives**: `{base}_{preset-name}_{options}.{ext}`

### Layouts and themes
- **Layouts**: `layouts/{layout-id}/`
- **Themes**: `themes/{theme-id}/`
- **Partials**: `layouts/{id}/partials/` or `themes/{id}/partials/`

---

## Validation and constraints

### Manifest fields
- **siteId**: Must be unique, non-empty
- **baseUrl**: Must be valid URL with protocol
- **collectionId**: Alphanumeric with hyphens
- **tagId**: Must be unique within manifest
- **Image paths**: Must start with `assets/`, no path traversal (`..`)

### Content files
- **Path**: Must match `content/` prefix pattern
- **Frontmatter**: Must be valid YAML
- **Image refs**: Must have valid ImageRef structure or be valid markdown image syntax

### Collections
- **id**: Unique, non-empty
- **contentPath**: Must be unique, must end with `/`
- **defaultItemLayout**: Layout must exist

---

## Example: Complete data flow

### 1. Creating a Blog Post

**Content file** (`content/blog/my-post.md`):
```markdown
---
title: "My First Post"
layout: "blog-post"
date: "2024-01-15T10:00:00Z"
featured_image:
  serviceId: local
  src: assets/originals/1704067200000-hero.jpg
  alt: Hero image
  width: 1200
  height: 630
tags:
  categories: ["tech"]
---

# My First Post

![inline](assets/originals/1704067200000-inline.jpg)

Content here...
```

**Manifest updates**:
1. If "blog" collection doesn't exist, create it with `contentPath: "content/blog/"`
2. File is added to `collectionItems` array with path, slug, title, url
3. Tags are verified/created in `tags` array

**Image registry updates**:
1. `assets/originals/1704067200000-hero.jpg` → add reference to `content/blog/my-post.md`
2. `assets/originals/1704067200000-inline.jpg` → add reference to `content/blog/my-post.md`

**Media manifest generation** (on export):
```json
{
  "images": {
    "assets/originals/1704067200000-hero.jpg": {
      "referencedIn": ["content/blog/my-post.md"],
      "metadata": {
        "sizeBytes": 245760,
        "width": 1200,
        "height": 630,
        "alt": "Hero image"
      }
    },
    "assets/originals/1704067200000-inline.jpg": {
      "referencedIn": ["content/blog/my-post.md"],
      "metadata": {
        "sizeBytes": 154000,
        "width": 800,
        "height": 600
      }
    }
  }
}
```

### 2. Importing a Site with media.json

1. Parse media.json and validate structure
2. For each image in manifest:
   - Create registry entry with metadata
   - Set up reference tracking
3. Optionally migrate image service (if specified)
4. Save updated registry to IndexedDB

---

## API reference

### Key services

#### Image registry service
```typescript
// Load registry
const registry = await getImageRegistry(siteId);

// Add image
await addImageToRegistry(siteId, imagePath, metadata);

// Update metadata
await updateImageMetadata(siteId, imagePath, updates);

// Track references
await updateImageReferences(siteId, contentFilePath, imagePathList);

// Get usage stats
const stats = await getImageUsageStats(siteId);
```

#### Media manifest service
```typescript
// Generate manifest
const manifest = await generateMediaManifest(siteData, options);

// Validate manifest
const validation = validateMediaManifest(mediaJson);

// Import manifest
const result = await importMediaManifest(manifest, siteId, options);
```

#### Image reference finder
```typescript
// Find all images in content
const images = findImagesInContentFile(contentFile);

// Find images in frontmatter and content
const images = findImagesInRawContent(frontmatter, content);

// Find images in any object
const images = findImagesInObject(data);
```

---

## Summary

Sparktype's data architecture provides:
- **Centralized configuration** via manifest.json
- **Flexible content** with markdown and YAML frontmatter
- **Smart image tracking** with registry and media manifest
- **Organized structure** with collections, tags, and layouts
- **Import/export capability** preserving all essential data
- **Security** with separate secrets storage and WebAuthn support

This documentation covers all data file formats and their relationships within the Sparktype system.
