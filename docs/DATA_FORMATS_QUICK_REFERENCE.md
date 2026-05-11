# Sparktype data formats - Quick Reference

## File Locations & Storage

| Data | Storage | Exported | Location |
|------|---------|----------|----------|
| manifest.json | Persistent | Yes | IndexedDB: siteManifests |
| Content Files | Persistent | Yes | IndexedDB: siteContentFiles |
| Images (originals) | Persistent | Yes | IndexedDB: siteImageAssets |
| Images (derivatives) | Cache | No | IndexedDB: derivativeCache |
| Image Registry | Ephemeral | No | IndexedDB: sparktype-image-registry |
| media.json | Generated | Yes | Generated on export |
| Site Secrets | Persistent | No | IndexedDB: siteSecrets |
| Layout Files | Persistent | Yes | IndexedDB: siteLayoutFiles |
| Theme Files | Persistent | Yes | IndexedDB: siteThemeFiles |

## Core Data Structures

### 1. Site Manifest (manifest.json)
```json
{
  "siteId": "string (required)",
  "title": "string (required)",
  "description": "string (required)",
  "baseUrl": "string (optional)",
  "theme": {
    "name": "string",
    "config": {},
    "themeData": {}
  },
  "structure": [{ "type", "title", "path", "slug", "children" }],
  "collections": [{ "id", "name", "contentPath", "defaultItemLayout" }],
  "collectionItems": [{ "collectionId", "slug", "path", "title", "url" }],
  "tagGroups": [{ "id", "name", "applicableCollections" }],
  "tags": [{ "id", "name", "groupId", "slug" }],
  "imagePresets": { "presetName": { "width", "height", "crop" } },
  "logo": { "serviceId", "src", "alt", "width", "height" },
  "favicon": { "serviceId", "src", "alt" },
  "publishingConfig": {},
  "auth": {},
  "dataFiles": []
}
```

### 2. Content File (content/*.md)
```markdown
---
title: "string (required)"
layout: "string (required)"
date: "ISO 8601 (optional)"
description: "string (optional)"

featured_image:
  serviceId: "local" | "cloudinary"
  src: "string (path or URL)"
  alt: "string (optional)"
  width: number
  height: number

tags:
  groupId: ["tag1", "tag2"]

layoutConfig:
  collectionId: "string"
  layout: "string"
  displayType: "string (optional)"
  sortBy: "string (optional)"
  sortOrder: "asc" | "desc"
  maxItems: number
  itemsPerPage: number
  pagination:
    enabled: boolean
    itemsPerPage: number
---

# Markdown Content

![Inline images](assets/originals/image.jpg)
```

### 3. Media Manifest (media.json - Generated)
```json
{
  "version": 1,
  "imageService": "local" | "cloudinary",
  "images": {
    "assets/originals/image.jpg": {
      "referencedIn": ["content/page.md"],
      "metadata": {
        "sizeBytes": number,
        "width": number (optional),
        "height": number (optional),
        "alt": "string (optional)"
      }
    }
  }
}
```

### 4. Image Registry (Internal - IndexedDB)
```typescript
{
  "siteId": "string",
  "version": 1,
  "lastUpdated": timestamp,
  "images": {
    "assets/originals/image.jpg": {
      "originalPath": "string",
      "derivativePaths": ["array of derivative paths"],
      "referencedIn": ["array of content file paths"],
      "lastAccessed": timestamp,
      "sizeBytes": number,
      "width": number (optional),
      "height": number (optional),
      "alt": "string (optional)",
      "createdAt": timestamp
    }
  }
}
```

### 5. Site Secrets (Never Exported)
```typescript
{
  "cloudinary": {
    "uploadPreset": "string"
  },
  "publishing": {
    "netlify": {
      "apiToken": "string"
    },
    "github": {
      "accessToken": "string"
    }
  }
}
```

## Image References Format

### In Frontmatter (ImageRef)
```yaml
featured_image:
  serviceId: local
  src: assets/originals/1704067200000-image.jpg
  alt: Image description
  width: 1920
  height: 1080
```

### In Markdown (Inline)
```markdown
![alt text](assets/originals/image.jpg)
```

## Field Reference

### Required Manifest Fields
- `siteId` - Unique identifier
- `generatorVersion` - Version created with
- `title` - Site name
- `description` - Site description
- `theme` - Theme configuration
- `structure` - Navigation structure

### Required Content File Fields
- `title` - Article/page title
- `layout` - Layout template ID

### Optional Image Preset Options
- `width` - Target width (px)
- `height` - Target height (px)
- `crop` - 'fill' | 'fit' | 'scale'
- `gravity` - 'center' | 'north' | 'south' | 'east' | 'west'

### Path Patterns
- Content: `content/page.md` or `content/collection/item.md`
- Images: `assets/originals/timestamp-name.ext`
- Derivatives: `assets/derivatives/name_w300_h300.ext`

## Image Discovery Rules

1. **Frontmatter ImageRef Objects**
   - Any field with `{serviceId, src, alt, ...}` structure
   - Scanned recursively with depth limit

2. **Markdown Inline Images**
   - Pattern: `![.*?](assets/.*?)`
   - Only local images (starting with `assets/`)

3. **Recursive Scanning**
   - Searches all frontmatter fields
   - Stops at depth 10 (prevents infinite loops)
   - Skips circular references

## Collection Discovery

Collections are discovered by:
1. Collection defined in manifest with `contentPath`
2. Content files matching the `contentPath` pattern
3. Example: `contentPath: "content/blog/"` → all files in `content/blog/` belong to this collection

## Tag Assignment

Tags are assigned in frontmatter as:
```yaml
tags:
  categories: ["tag-id-1", "tag-id-2"]
  topics: ["tag-id-3"]
```

Where:
- Key = `TagGroup.id`
- Value = array of `Tag.id` values

## Export/Import Checklist

### What Gets Exported
- [x] manifest.json
- [x] All content files (markdown)
- [x] All layout files
- [x] All theme files
- [x] media.json (image metadata)
- [x] Images (assets/)
- [x] Generated HTML/CSS

### What Does NOT Get Exported
- [ ] Site secrets (API tokens, credentials)
- [ ] Derivative cache (recreated on-demand)
- [ ] User authentication state
- [ ] Browser IndexedDB registry

## Service Migration

Media manifest supports service migration:

```typescript
// Migrate from Cloudinary to Local
const result = await importMediaManifest(manifest, siteId, {
  migrateToService: 'local'
});

// Result includes migration warnings
result.warnings; // ["Migrating from cloudinary to local service"]
```

## Validation

### Media Manifest Validation Returns
```typescript
{
  isValid: boolean,
  errors: string[],
  warnings: string[],
  stats: {
    totalImages: number,
    totalReferences: number,
    estimatedSize: number,
    serviceType: string
  }
}
```

### Image Path Validation Rules
- Must start with `assets/`
- No path traversal (`..` or `//`)
- Maximum length: 500 characters
- Recommended format: `assets/originals/{timestamp}-{slug}.{ext}`

## API Quick Reference

### Image Registry
```typescript
await getImageRegistry(siteId);
await saveImageRegistry(registry);
await addImageToRegistry(siteId, imagePath, metadata);
await updateImageMetadata(siteId, imagePath, updates);
await updateImageReferences(siteId, contentPath, imagePaths);
await getImageUsageStats(siteId);
```

### Media Manifest
```typescript
await generateMediaManifest(siteData, { includeOrphaned: false });
validateMediaManifest(manifestJson);
await importMediaManifest(manifest, siteId, { migrateToService: 'local' });
estimateManifestStorageSize(manifest);
```

### Image References
```typescript
findImagesInContentFile(contentFile);
findImagesInRawContent(frontmatter, content);
findImagesInObject(anyObject);
scanObjectForImageRefs(obj, found, depth);
```

## Key Differences

### manifest.json vs media.json
| Aspect | manifest.json | media.json |
|--------|---------------|-----------|
| Purpose | Configuration | Export/Import |
| Generated | No | Yes |
| Size | Small | Medium |
| Includes Secrets | No | No |
| Update Frequency | Per edit | Per export |
| Derivative Info | No | No |

### ImageRef vs ImageMetadata
| Aspect | ImageRef | ImageMetadata |
|--------|----------|---------------|
| Storage | Frontmatter | Registry |
| Fields | Basic (src, alt) | Complete |
| Derivatives | None | Tracked |
| References | None | Tracked |
| Scope | Single field | Complete image |

## Common Patterns

### Adding an Image
1. Upload via UI → saves to `assets/originals/`
2. Get `ImageRef` with serviceId, src, dimensions
3. Add to frontmatter or markdown
4. Registry auto-updates references

### Exporting a Site
1. Scan content for image references
2. Build image registry from references
3. Generate media.json from registry
4. Include in export bundle
5. (Secrets stay in browser)

### Importing a Site
1. Parse manifest.json
2. Parse media.json
3. Validate media.json structure
4. Rebuild registry from media.json
5. Set up image service
6. Optionally migrate to different service

### Migrating Image Services
1. Export with media.json
2. Import with `migrateToService: 'cloudinary'`
3. Image paths transformed as needed
4. Manifest updated with new service

## Document Structure

For the complete detailed documentation, see `DATA_FORMATS.md` which includes:
- Full JSON examples for all formats
- Detailed field descriptions
- Service descriptions and references
- Complete data flow examples
- Validation requirements
- Path conventions

This quick reference covers the essential information for daily development work.
