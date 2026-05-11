# Sparktype image pipeline: Upload, render and export process

## Overview

Sparktype's image pipeline handles the complete lifecycle of images from upload through rendering to static site export. The system uses a **template-driven preset selection** approach with **eager preprocessing** and **3-tier inheritance** for simple, predictable image handling.

## Key principles

1. **Template-driven**: Templates explicitly specify which preset to use
2. **Eager preprocessing**: All available presets are generated for all images before rendering
3. **Simple lookup**: Runtime rendering is synchronous - just looks up pre-generated URLs
4. **3-tier inheritance**: Core presets → Theme overrides → Layout overrides
5. **No magic**: No context detection or dynamic selection - everything is explicit

## Pipeline architecture

```
[Upload] → [Validation] → [Storage] → [Preprocessing] → [Rendering] → [Export]
    ↓           ↓           ↓             ↓              ↓           ↓
  File      Type/Size    IndexedDB    Generate ALL    Template    Bundle
 Select    Validation    Storage      Presets         Lookup      Creation
```

---

## Phase 1: Image upload process

### Entry point: ImageUploadWidget

**Location**: `src/features/editor/components/widgets/ImageUploadWidget.tsx`

**Process flow**:
1. User selects image file via file input
2. File validation against `MEMORY_CONFIG` constraints
3. Upload to selected image service (local or Cloudinary)
4. ImageRef creation with metadata
5. Form data update with ImageRef object

### File validation

**Validation rules** (from `MEMORY_CONFIG` in `src/config/editorConfig.ts`):
```typescript
{
  SUPPORTED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  MAX_UPLOAD_SIZE: 5 * 1024 * 1024, // 5MB for raster images
  MAX_SVG_SIZE: 512 * 1024,          // 512KB for SVG files
  SUPPORTED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
}
```

**Validation process**:
```typescript
// 1. MIME type check
if (!MEMORY_CONFIG.SUPPORTED_IMAGE_TYPES.includes(file.type)) {
  throw new Error(`Unsupported file type: ${file.type}`);
}

// 2. Size limit check
const maxSize = isSvg ? MEMORY_CONFIG.MAX_SVG_SIZE : MEMORY_CONFIG.MAX_UPLOAD_SIZE;
if (file.size > maxSize) {
  const maxSizeFormatted = (maxSize / 1024 / (isSvg ? 1 : 1024)).toFixed(1);
  const unit = isSvg ? 'KB' : 'MB';
  throw new Error(`Image is too large. Max size is ${maxSizeFormatted}${unit}.`);
}
```

### Local image service upload

**Location**: `src/core/services/images/localImage.service.ts`

**Upload process**:
```typescript
async upload(file: File, siteId: string): Promise<ImageRef> {
  // 1. Validation (type, size)
  // 2. Generate unique filename with timestamp
  const fileName = `${Date.now()}-${slugify(baseName)}${extension}`;
  const relativePath = `assets/originals/${fileName}`;

  // 3. Convert to Blob and store in IndexedDB
  const blob = new Blob([file], { type: file.type });
  await localSiteFs.saveImageAsset(siteId, relativePath, blob);

  // 4. Extract image dimensions
  const dimensions = await getImageDimensionsFromBlob(blob);

  // 5. Return ImageRef object
  return {
    serviceId: 'local',
    src: relativePath,
    alt: file.name,
    width: dimensions.width,
    height: dimensions.height
  };
}
```

**Storage structure**:
```
IndexedDB: SparktypeDB
├── siteDataStore/
│   └── {siteId}/
│       └── assets/originals/
│           └── {timestamp}-{slug}.{ext}
└── derivativeCacheStore/
    └── {siteId}/assets/derivatives/
        └── {filename}_w{width}_h{height}_c-{crop}_g-{gravity}.{ext}
```

---

## Phase 2: Image preprocessing (eager generation)

### Preprocessing trigger

**Location**: `src/core/services/images/imagePreprocessor.service.ts`

**Called before template rendering**:
```typescript
// In render.service.ts before compiling templates
await imagePreprocessor.preprocessImages(siteData, isExport, forIframe);
```

### What preprocessing does

**Core logic** (lines 46-99):
```typescript
async preprocessImages(siteData: LocalSiteData, isExport: boolean, forIframe?: boolean): Promise<void> {
  const imageService = getActiveImageService(siteData.manifest);

  // 1. Find all image references in all content
  const allImageRefs = this.extractImageReferences(siteData);

  // 2. For each image reference
  for (const { imageRef, fieldName, layoutPath, contentPath } of allImageRefs) {
    // 3. Get ALL available presets (core + theme + layout)
    const presetsToGenerate = this.getPresetsForField(siteData, fieldName, layoutPath);

    // 4. Generate EVERY preset for this image
    for (const presetName of presetsToGenerate) {
      const resolvedPreset = this.resolvePreset(presetName, themeManifest, layoutManifest);
      const processedUrl = await imageService.getDisplayUrl(manifest, imageRef, transformOptions, isExport, forIframe);

      // 5. Store: contentPath → fieldName → presetName → URL
      this.processedImages.set(contentPath, {
        [fieldName]: {
          [presetName]: processedUrl
        }
      });
    }
  }
}
```

**Key insight:** The system generates **ALL** available presets for **EVERY** image. No selective generation, no context-awareness. This ensures synchronous lookup during rendering.

### Getting available presets

**Function**: `getPresetsForField()` (lines 339-369)

```typescript
private getPresetsForField(siteData: LocalSiteData, fieldName: string, layoutPath: string): string[] {
  const presetNames = new Set<string>();

  // Add ALL core presets from BASE_IMAGE_PRESETS
  Object.keys(BASE_IMAGE_PRESETS).forEach(name => presetNames.add(name));

  // Add ALL theme presets
  const themeManifest = this.getThemeManifest(siteData, themeName);
  if (themeManifest?.image_presets) {
    Object.keys(themeManifest.image_presets).forEach(name => presetNames.add(name));
  }

  // Add ALL layout presets
  const layoutManifest = this.getLayoutManifest(siteData, layoutPath);
  if (layoutManifest?.image_presets) {
    Object.keys(layoutManifest.image_presets).forEach(name => presetNames.add(name));
  }

  // For markdown images, ensure page_display and original are included
  if (fieldName.startsWith('markdown_image_')) {
    presetNames.add('page_display');
    presetNames.add('original');
  }

  return Array.from(presetNames);
}
```

**Result**: Every image gets every preset generated, regardless of whether it will be used.

### 3-tier preset inheritance

**Function**: `resolvePreset()` (lines 415-473)

**How presets are resolved with inheritance**:

```typescript
private resolvePreset(presetName: string, themeManifest: any, layoutManifest: any): ImagePreset | null {
  // Layer 1: Start with core preset from BASE_IMAGE_PRESETS
  const corePreset = BASE_IMAGE_PRESETS[presetName];

  // Layer 2: Theme manifest override
  const themePreset = themeManifest?.image_presets?.[presetName];

  // Layer 3: Layout manifest override
  const layoutPreset = layoutManifest?.image_presets?.[presetName];

  // If preset not found anywhere, return null
  if (!corePreset && !themePreset && !layoutPreset) {
    return null;
  }

  // Build final preset by merging layers (later layers override earlier ones)
  let preset: ImagePreset = { crop: 'scale', gravity: 'center' };

  // Apply core preset
  if (corePreset) {
    preset = { ...preset, ...corePreset };
  }

  // Apply theme overrides
  if (themePreset) {
    preset = { ...preset, ...themePreset };
  }

  // Apply layout overrides (highest priority)
  if (layoutPreset) {
    preset = { ...preset, ...layoutPreset };
  }

  return preset;
}
```

**Inheritance priority**: Layout > Theme > Core

**Example**:
```typescript
// Core preset (BASE_IMAGE_PRESETS)
thumbnail: { width: 300, height: 200, crop: 'fill', gravity: 'center' }

// Theme override (themes/sparksite/theme.json)
thumbnail: { width: 350 }  // Keeps height: 200, crop: 'fill', gravity: 'center'

// Layout override (layouts/blog-post/layout.json)
thumbnail: { height: 250 }  // Final: width: 350, height: 250, crop: 'fill', gravity: 'center'
```

### Image discovery

**Sources of image references** (lines 101-214):

1. **Frontmatter fields**: Images defined in YAML frontmatter
   ```yaml
   featured_image:
     serviceId: local
     src: assets/originals/image.jpg
   ```

2. **Markdown content**: Inline markdown images
   ```markdown
   ![Alt text](assets/originals/photo.jpg)
   ```

3. **Manifest images**: Site-wide images (logo, favicon)
   ```json
   {
     "logo": { "serviceId": "local", "src": "assets/originals/logo.png" },
     "favicon": { "serviceId": "local", "src": "assets/originals/favicon.ico" }
   }
   ```

---

## Phase 3: Image rendering process

### Synchronous image helper

**Location**: `src/core/services/renderer/helpers/image.helper.ts`

**How templates use images**:
```handlebars
{{! Explicitly specify preset - required }}
{{{image fieldname="featured_image" preset="thumbnail" alt="Post image"}}}

{{! Different preset for full page }}
{{{image fieldname="featured_image" preset="page_display" alt="Featured image"}}}

{{! URL only for meta tags }}
<meta property="og:image" content="{{{image fieldname="featured_image" preset="social" url_only=true}}}" />

{{! Custom attributes }}
{{{image fieldname="banner_image" preset="hero" class="hero-img" lazy=false}}}
```

**Important**: The `preset` parameter is **required** (defaults to 'original' if omitted). There is no automatic preset selection.

### Helper implementation

**Function**: `image()` (lines 39-150)

```typescript
image: function(this: any, ...args: unknown[]): Handlebars.SafeString {
  const options = args[args.length - 1] as Handlebars.HelperOptions;
  const rootContext = options.data.root as RootTemplateContext;

  // 1. Get field name from template
  const fieldName = options.hash.fieldname;
  if (!fieldName) {
    return new Handlebars.SafeString('<!-- No fieldname provided -->');
  }

  // 2. Get preset name from template (defaults to 'original')
  const presetName = options.hash.preset || 'original';

  // 3. Find the ImageRef in context (collection item, page, or manifest)
  let imageRef: ImageRef | null = null;
  if (this?.frontmatter?.[fieldName]) {
    imageRef = this.frontmatter[fieldName]; // Collection item
  } else if (rootContext.contentFile?.frontmatter?.[fieldName]) {
    imageRef = rootContext.contentFile.frontmatter[fieldName]; // Page
  } else if (rootContext.headContext?.[fieldName]) {
    imageRef = rootContext.headContext[fieldName]; // Manifest (logo/favicon)
  }

  // 4. Determine content path
  let contentPath = '';
  if (rootContext.headContext?.[fieldName] && (fieldName === 'logo' || fieldName === 'favicon')) {
    contentPath = '_manifest';
  } else if (this?.path) {
    contentPath = this.path; // Collection item
  } else if (rootContext.contentFile?.path) {
    contentPath = rootContext.contentFile.path; // Page
  }

  // 5. Look up preprocessed URL (synchronous!)
  let processedUrl = imagePreprocessor.getProcessedImageUrl(contentPath, fieldName, presetName);

  if (!processedUrl) {
    return new Handlebars.SafeString(`<!-- Image not preprocessed: ${fieldName} with preset ${presetName} -->`);
  }

  // 6. Convert to relative path for export mode
  if (rootContext.options.isExport && rootContext.contentFile) {
    const relativePath = getRelativePath(currentPagePath, processedUrl);
    processedUrl = relativePath;
  }

  // 7. Return URL only for meta tags, full img tag otherwise
  if (options.hash.url_only) {
    return new Handlebars.SafeString(processedUrl);
  } else {
    const alt = options.hash.alt || imageRef.alt || '';
    const className = options.hash.class || '';
    const lazy = options.hash.lazy !== false ? 'loading="lazy"' : '';

    const imgTag = `<img src="${processedUrl}" alt="${alt}" class="${className}" ${lazy}>`;
    return new Handlebars.SafeString(imgTag);
  }
}
```

**Key points:**
- Helper is **synchronous** - no async/await needed
- Preset is **explicitly specified** in template
- URL is **pre-generated** during preprocessing
- No context detection or dynamic selection

---

## Phase 4: Image transformation and caching

### Canvas-based image processing

**Location**: `src/core/services/images/imageManipulation.service.ts`

**Crop modes**:
- **`fill`**: Crop to exact dimensions, maintain aspect ratio
- **`fit`**: Fit within dimensions, maintain aspect ratio, no cropping
- **`scale`**: Scale to exact dimensions, may distort

**Processing pipeline**:
```typescript
async function cropAndResizeImage(sourceBlob: Blob, options: ImageTransformOptions): Promise<Blob> {
  // 1. Load source image
  const img = await createImageFromBlob(sourceBlob);

  // 2. Calculate crop/resize parameters
  const cropParams = calculateCropDimensions(
    img.naturalWidth, img.naturalHeight,
    targetWidth, targetHeight,
    crop, gravity
  );

  // 3. Create canvas and context
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = cropParams.canvasWidth;
  canvas.height = cropParams.canvasHeight;

  // 4. Draw processed image
  ctx.drawImage(img, ...cropParams);

  // 5. Convert to optimised blob
  return new Promise(resolve => {
    canvas.toBlob(resolve, outputFormat, quality);
  });
}
```

### Derivative caching system

**Location**: `src/core/services/images/derivativeCache.service.ts`

**Cache structure**:
```typescript
// IndexedDB store configuration
const derivativeCacheStore = localforage.createInstance({
  name: 'SparktypeDB',
  storeName: 'derivativeCacheStore'
});

// Cache key format
const cacheKey = `${siteId}/assets/derivatives/{filename}_w{width}_h{height}_c-{crop}_g-{gravity}.{ext}`;
```

**Concurrency-safe processing**:
```typescript
// Prevent duplicate processing with promise maps
const processingPromises = new Map<string, Promise<Blob>>();

private async getOrProcessDerivative(
  siteId: string,
  srcPath: string,
  cacheKey: string,
  options: ImageTransformOptions
): Promise<Blob> {
  // 1. Check persistent cache (IndexedDB)
  const cachedBlob = await getCachedDerivative(cacheKey);
  if (cachedBlob) return cachedBlob;

  // 2. Check if already processing
  if (processingPromises.has(cacheKey)) {
    return processingPromises.get(cacheKey)!;
  }

  // 3. Create new processing promise
  const processingPromise = this.processNewDerivative(siteId, srcPath, options);
  processingPromises.set(cacheKey, processingPromise);

  return processingPromise;
}
```

### Multi-layer caching strategy

**Cache hierarchy**:
1. **In-memory cache**: `sourceImageCache` for source blobs
2. **Processing promises**: `processingPromises` to prevent duplicate work
3. **IndexedDB cache**: `derivativeCacheStore` for persistent storage
4. **Blob URL cache**: Browser-managed blob URLs for display

---

## Phase 5: Static site export process

### Export asset bundling

**Location**: `src/core/services/builder/asset.builder.ts`

**Export flow**:
```typescript
export async function bundleAllAssets(bundle: SiteBundle, siteData: LocalSiteData): Promise<void> {
  // 1. Image cleanup (remove orphaned images)
  const cleanupResult = await cleanupOrphanedImages(siteData);

  // 2. Find all image references in content
  const allImageRefs = findAllImageRefs(siteData);

  // 3. Get exportable assets from image service
  const imageService = getActiveImageService(siteData.manifest);
  const assetsToBundle = await imageService.getExportableAssets(siteData.siteId, allImageRefs);

  // 4. Add to bundle
  for (const asset of assetsToBundle) {
    bundle[asset.path] = asset.data;
  }
}
```

### Local image service export

**Export asset structure**:
```typescript
async getExportableAssets(siteId: string, allImageRefs: ImageRef[]): Promise<{path: string; data: Blob}[]> {
  const exportableMap = new Map<string, Blob>();

  // 1. Add original source images
  for (const ref of allImageRefs) {
    if (ref.serviceId === 'local') {
      const sourceBlob = await localSiteFs.getImageAsset(siteId, ref.src);
      const filename = ref.src.split('/').pop();
      const exportPath = `_site/assets/originals/${filename}`;
      exportableMap.set(exportPath, sourceBlob);
    }
  }

  // 2. Add all cached derivatives (from preprocessing)
  const derivativeKeys = await getAllCacheKeys(siteId);
  for (const key of derivativeKeys) {
    const relativePath = key.substring(siteId.length + 1);
    const derivativeBlob = await getCachedDerivative(key);
    exportableMap.set(relativePath, derivativeBlob);
  }

  return Array.from(exportableMap.entries()).map(([path, data]) => ({ path, data }));
}
```

**Bundle structure**:
```
exported-site.zip
├── _site/
│   ├── assets/originals/
│   │   ├── 1234567890-hero-banner.jpg
│   │   └── 1234567891-featured-image.jpg
│   └── assets/derivatives/
│       ├── hero-banner_w1200_h600_c-fill_g-center.jpg
│       ├── featured-image_w300_h200_c-fill_g-center.jpg
│       ├── featured-image_w800_c-fill_g-center.jpg
│       └── featured-image_w1200_h630_c-fill_g-center.jpg
├── assets/css/styles.css
├── index.html
└── [other generated HTML files]
```

---

## Performance optimisations

### 1. Eager preprocessing

**Strategy**: Generate all presets during preprocessing, before template rendering

**Benefits**:
- ✅ Synchronous template rendering (no async helpers needed)
- ✅ Predictable performance (no runtime processing)
- ✅ Simple caching (all derivatives pre-generated)

**Tradeoffs**:
- ❌ Generates presets that may not be used
- ❌ Longer preprocessing time
- ✅ But preprocessing is one-time per image change

### 2. Concurrency management

**Source blob fetching**:
```typescript
// Prevent duplicate IndexedDB reads
const sourceBlobPromises = new Map<string, Promise<Blob>>();

private async getSourceBlob(siteId: string, srcPath: string): Promise<Blob> {
  if (sourceImageCache.has(srcPath)) {
    return sourceImageCache.get(srcPath)!;
  }

  if (sourceBlobPromises.has(srcPath)) {
    return sourceBlobPromises.get(srcPath)!;
  }

  const promise = this.fetchSourceBlob(siteId, srcPath);
  sourceBlobPromises.set(srcPath, promise);
  return promise;
}
```

**Derivative processing**:
```typescript
// Prevent duplicate processing jobs
const processingPromises = new Map<string, Promise<Blob>>();

// Only one processing job per unique cache key
if (processingPromises.has(cacheKey)) {
  return processingPromises.get(cacheKey)!;
}
```

### 3. Compression and optimisation

**Multi-stage compression**:
```typescript
// 1. Canvas-based processing (crop, resize)
const processedBlob = await cropAndResizeImage(sourceBlob, options);

// 2. Additional compression for large files
if (processedBlob.size > 1.5 * 1024 * 1024) {
  const compressionOptions = {
    maxSizeMB: 1.5,
    initialQuality: 0.85,
    useWebWorker: true
  };
  finalBlob = await imageCompression(processedBlob, compressionOptions);
}
```

**Format optimisation**:
- **JPEG**: Default for photos (85% quality)
- **PNG**: Preserved for transparency
- **WebP**: Used when browser supports
- **SVG**: Passed through unchanged

---

## Error handling and recovery

### Graceful degradation

**Processing failures**:
```typescript
try {
  processedBlob = await cropAndResizeImage(sourceBlob, options);
} catch (canvasError) {
  console.error('Canvas processing failed, falling back to compression only');
  // Fallback to compression-only processing
  processedBlob = await imageCompression(sourceBlob, compressionOptions);
}
```

**Layout manifest parsing**:
```typescript
try {
  const layoutManifest = JSON.parse(layoutFile.content);
  return layoutManifest;
} catch (error) {
  console.warn(`[ImagePreprocessor] Failed to parse layout manifest for ${layoutPath}:`, error);
  return null; // Continue with core/theme presets only
}
```

**Cache corruption**:
```typescript
// Auto-recovery from cache corruption
export async function clearAllDerivativeCache(): Promise<void> {
  await derivativeCacheStore.clear();
  console.log('[DerivativeCache] Cleared entire cache for recovery');
}
```

**Export continuity**:
```typescript
// Export continues even if some assets fail
if (errors.length > 0) {
  console.warn(`[LocalImageService] Export errors:`, errors);
  // Don't throw - allow export to continue with available assets
}
```

---

## Complete example workflow

### 1. User uploads image

```typescript
// User selects image via ImageUploadWidget
const file = /* user selected file */;

// Upload creates ImageRef
const imageRef = await localImageService.upload(file, siteId);
// Result: {
//   serviceId: 'local',
//   src: 'assets/originals/1234567890-photo.jpg',
//   width: 1920,
//   height: 1080
// }

// ImageRef stored in content frontmatter
```

### 2. User adds to content

```yaml
---
title: My Blog Post
featured_image:
  serviceId: local
  src: assets/originals/1234567890-photo.jpg
  width: 1920
  height: 1080
---
```

### 3. Preprocessing phase

```typescript
// Before rendering, preprocess all images
await imagePreprocessor.preprocessImages(siteData, isExport);

// For featured_image in blog post:
// 1. Get all available presets: [thumbnail, page_display, hero, full, original, social, ...]
// 2. For EACH preset:
//    - Resolve with 3-tier inheritance
//    - Generate derivative (300x200, 960x360, 1200x600, etc.)
//    - Store URL: processedImages['content/blog/my-post.md']['featured_image']['thumbnail'] = 'blob:...'
```

### 4. Template rendering

```handlebars
{{! In blog listing (card view) }}
<article class="card">
  {{{image fieldname="featured_image" preset="thumbnail"}}}
  {{! Helper looks up: processedImages[this.path]['featured_image']['thumbnail'] }}
  {{! Returns: <img src="blob:..." alt="..." loading="lazy"> }}
</article>

{{! In individual blog post }}
<article class="post">
  {{{image fieldname="featured_image" preset="page_display"}}}
  {{! Helper looks up: processedImages[contentPath]['featured_image']['page_display'] }}
  {{! Returns: <img src="blob:..." alt="..." loading="lazy"> }}
</article>
```

### 5. Static site export

```typescript
// Export bundles all referenced images and their derivatives
const bundle = await buildSiteBundle(siteData);

// Bundle contains:
// - _site/assets/originals/1234567890-photo.jpg (original)
// - _site/assets/derivatives/photo_w300_h200_c-fill_g-center.jpg (thumbnail)
// - _site/assets/derivatives/photo_w960_h360_c-fill_g-center.jpg (page_display)
// - _site/assets/derivatives/photo_w1200_h600_c-fill_g-center.jpg (hero)
// - ... all other generated presets
```

---

## Key benefits

### For developers

- **Simple API**: Just `{{{image fieldname="name" preset="preset"}}}`
- **Explicit control**: Templates choose exactly which preset to use
- **Synchronous rendering**: No async helpers, no race conditions
- **Predictable behaviour**: No hidden context detection or magic
- **Easy debugging**: Clear logging shows exactly what's preprocessed

### For performance

- **Fast rendering**: All URLs pre-generated, templates just look them up
- **Efficient caching**: Multi-layer cache hierarchy prevents duplicate work
- **Optimised compression**: Canvas + compression pipeline
- **Smart bundling**: Only referenced images exported

### For users

- **Fast uploads**: Efficient validation and storage
- **Instant previews**: Blob URLs for immediate feedback
- **Reliable exports**: Complete asset bundling with processed derivatives

---

## Summary

The Sparktype image pipeline is designed for simplicity and predictability:

1. **Upload**: Validate, store, create ImageRef
2. **Preprocess**: Generate ALL presets for ALL images (eager strategy)
3. **Render**: Templates explicitly choose preset, helper does synchronous lookup
4. **Export**: Bundle originals and all cached derivatives

**No context detection, no dynamic selection, no magic** - just straightforward template-driven image handling with 3-tier preset inheritance.
