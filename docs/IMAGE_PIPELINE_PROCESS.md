# Sparktype Image Pipeline: Upload, Render & Export Process

## Overview

Sparktype's image pipeline is a sophisticated system that handles the complete lifecycle of images from upload through rendering to static site export. It combines **declarative preset configuration**, efficient caching, canvas-based image processing, and optimized export bundling to deliver high-performance image handling.

## Pipeline Architecture

```
[Upload] → [Validation] → [Storage] → [Preprocessing] → [Rendering] → [Export]
    ↓           ↓           ↓             ↓              ↓           ↓
  File      Type/Size    IndexedDB    Declarative     Template    Bundle
 Select    Validation    Storage      Presets         Helpers     Creation
```

## Phase 1: Image Upload Process

### Entry Point: ImageUploadWidget

**Location**: `src/features/editor/components/widgets/ImageUploadWidget.tsx`

**Process Flow**:
1. User selects image file via file input
2. File validation against `MEMORY_CONFIG` constraints
3. Upload to selected image service (local or Cloudinary)
4. ImageRef creation with metadata
5. Form data update with ImageRef object

### File Validation

**Validation Rules** (from `MEMORY_CONFIG`):
```typescript
{
  SUPPORTED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  MAX_UPLOAD_SIZE: 5 * 1024 * 1024, // 5MB for raster images  
  MAX_SVG_SIZE: 512 * 1024,          // 512KB for SVG files
  SUPPORTED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
}
```

**Validation Process**:
```typescript
// 1. MIME type check
if (!MEMORY_CONFIG.SUPPORTED_IMAGE_TYPES.includes(file.type as typeof MEMORY_CONFIG.SUPPORTED_IMAGE_TYPES[number])) {
  const errorMsg = `Unsupported file type: ${file.type}.`;
  toast.error(errorMsg);
  throw new Error(errorMsg);
}

// 2. Size limit check  
const maxSize = isSvg ? MEMORY_CONFIG.MAX_SVG_SIZE : MEMORY_CONFIG.MAX_UPLOAD_SIZE;
if (file.size > maxSize) {
  const maxSizeFormatted = (maxSize / 1024 / (isSvg ? 1 : 1024)).toFixed(1);
  const unit = isSvg ? 'KB' : 'MB';
  const errorMsg = `Image is too large. Max size is ${maxSizeFormatted}${unit}.`;
  toast.error(errorMsg);
  throw new Error(errorMsg);
}
```

### Local Image Service Upload

**Location**: `src/core/services/images/localImage.service.ts`

**Upload Process**:
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

**Storage Structure**:
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

## Phase 2: Image Preprocessing (Declarative System)

### Declarative Preset Resolution

**Location**: `src/core/services/images/imagePreprocessor.service.ts`

**Preprocessing Trigger**:
```typescript
// Called before template rendering
await imagePreprocessor.preprocessImages(siteData, isExport);
```

**Declarative Preset Resolution**:
```typescript
private resolvePresetForContext(
  fieldName: string, 
  context: string,
  layoutManifest: any
): string {
  const fieldConfig = layoutManifest?.image_presets?.[fieldName];
  
  if (typeof fieldConfig === 'string') {
    // Simple string preset - same for all contexts
    return fieldConfig;
  }
  
  if (fieldConfig?.contexts?.[context]) {
    // Context-specific preset found
    return fieldConfig.contexts[context];
  }
  
  if (fieldConfig?.default) {
    // Field-specific default
    return fieldConfig.default;
  }
  
  // System fallback based on context
  return context === 'full' ? 'page_display' : 'thumbnail';
}
```

**Context Discovery**:
```typescript
private getAvailableContexts(siteData: LocalSiteData): string[] {
  const contexts = new Set<string>();
  
  // Look for collection pages that could render this content
  const collectionPages = siteData.contentFiles?.filter(file => 
    file.frontmatter.layoutConfig?.collectionId
  ) || [];
  
  for (const collectionPage of collectionPages) {
    const collectionLayoutPath = collectionPage.frontmatter.layout || 'page';
    const collectionLayoutManifest = this.getLayoutManifest(siteData, collectionLayoutPath);
    
    // Extract contexts from displayTypes configuration
    if (collectionLayoutManifest?.displayTypes) {
      for (const displayType of Object.values(collectionLayoutManifest.displayTypes)) {
        if (displayType && typeof displayType === 'object' && 'imageContext' in displayType) {
          contexts.add(displayType.imageContext as string);
        }
      }
    }
  }
  
  // If no contexts found, fall back to standard contexts
  if (contexts.size === 0) {
    contexts.add('listing');
  }
  
  return Array.from(contexts);
}
```

**Preset Resolution Flow**:
1. **Layout manifest configuration** (explicit `image_presets` configuration)
2. **Context-specific presets** (from `contexts` mapping)
3. **Field defaults** (from `default` property)
4. **System fallbacks** (full → `page_display`, others → `thumbnail`)

### Collection Item Processing

**Processing Determination**:
```typescript
private determinePresetsForField(
  siteData: LocalSiteData,
  contentPath: string,
  fieldName: string,
  layoutPath: string
): Array<{presetName: string, context?: string}> {
  const isCollectionItem = this.isCollectionItem(siteData, contentFile);
  
  if (isCollectionItem) {
    // Collection items need presets for all possible display contexts
    const contexts = this.getAvailableContexts(siteData);
    const presets: Array<{presetName: string, context?: string}> = [];
    
    // Generate preset for each available context
    for (const context of contexts) {
      const presetName = this.resolvePresetForContext(fieldName, context, layoutManifest);
      presets.push({ presetName, context });
    }
    
    // Always include a 'full' context for individual page views
    if (!contexts.includes('full')) {
      const fullPreset = this.resolvePresetForContext(fieldName, 'full', layoutManifest);
      presets.push({ presetName: fullPreset, context: 'full' });
    }
    
    return presets;
  } else {
    // Regular pages just need full context preset
    const presetName = this.resolvePresetForContext(fieldName, 'full', layoutManifest);
    return [{ presetName, context: 'full' }];
  }
}
```

### Image Processing Pipeline

**Processing Flow**:
```typescript
for (const { imageRef, fieldName, layoutPath, contentPath } of allImageRefs) {
  // 1. Determine presets using declarative configuration
  const presetConfigs = this.determinePresetsForField(siteData, contentPath, fieldName, layoutPath);
  
  // 2. For each preset configuration
  for (const { presetName, context } of presetConfigs) {
    // 3. Resolve preset with inheritance (base → site manifest)
    const resolvedPreset = this.resolvePreset(siteData.manifest, presetName);
    
    // 4. Generate derivative using image service
    const processedUrl = await imageService.getDisplayUrl(
      siteData.manifest, imageRef, transformOptions, isExport
    );
    
    // 5. Store processed URL with context-aware key
    const storageKey = context ? `${context}_context` : presetName;
    contentData[fieldName][storageKey] = processedUrl;
  }
}
```

## Phase 3: Image Rendering Process

### Synchronous Image Helper

**Location**: `src/core/services/renderer/helpers/image.helper.ts`

**Template Usage**:
```handlebars
{{! Basic usage - context-aware preset selection }}
{{{image fieldname="featured_image"}}}

{{! URL only for meta tags }}
<meta property="og:image" content="{{{image fieldname="featured_image" url_only=true}}}" />

{{! With custom attributes }}
{{{image fieldname="banner_image" class="hero-img" lazy=false}}}
```

**Declarative Context Detection**:

The system uses **pure declarative lookup** - no pattern matching on field names or displayType strings. Context resolution reads the explicit `imageContext` mapping from layout manifests:

```typescript
const getImageContextFromDisplayType = (displayType: string, rootContext: RootTemplateContext): string | undefined => {
  // Find the collection layout that's rendering this content
  const collectionLayoutPath = rootContext.layoutConfig?.layout || 'page';
  const collectionLayoutFile = siteData.layoutFiles?.find(
    file => file.path === `layouts/${collectionLayoutPath}/layout.json`
  );

  if (!collectionLayoutFile) {
    return undefined;
  }

  try {
    const collectionLayoutManifest = JSON.parse(collectionLayoutFile.content);
    // Direct lookup of imageContext from displayTypes configuration
    const displayTypeConfig = collectionLayoutManifest?.displayTypes?.[displayType];
    return displayTypeConfig?.imageContext;  // e.g., "card", "full", "list"
  } catch (error) {
    console.warn(`[ImageHelper] Failed to parse collection layout manifest for ${collectionLayoutPath}:`, error);
    return undefined;
  }
};
```

**Context Resolution Flow**:
```typescript
// Determine the rendering context using declarative displayType configuration
let context: string | undefined = undefined;

// Collection item context: this.path exists (item being rendered by collection page)
if (this?.path && rootContext.layoutConfig) {
  const displayType = rootContext.layoutConfig.displayType;

  // Direct declarative lookup - NO pattern matching on displayType string
  if (displayType) {
    context = getImageContextFromDisplayType(displayType, rootContext);
    // Example: displayType="post-card" → looks up displayTypes["post-card"].imageContext → "card"
  }

  // Fallback to 'listing' for collection rendering if no specific context found
  if (!context) {
    context = 'listing';
  }
}
// Individual page context: rootContext.contentFile exists, no this.path
else if (rootContext.contentFile && !this?.path) {
  context = 'full';
}
// Fallback: if we can't determine context, let preprocessor decide
else {
  context = undefined;
}
```

**Key Point:**
- All mappings are explicit in layout manifests via declarative configuration

**URL Retrieval**:
```typescript
// Get preprocessed URL using context awareness
const processedUrl = imagePreprocessor.getProcessedImageUrlForField(
  contentPath, 
  fieldName, 
  context
);

// Context-aware output
if (isInMetaTag) {
  return new Handlebars.SafeString(processedUrl); // URL only
} else {
  const imgTag = `<img src="${processedUrl}" alt="${alt}" class="${className}" loading="lazy">`;
  return new Handlebars.SafeString(imgTag); // Full img tag
}
```

## Phase 4: Image Transformation & Caching

### Canvas-Based Image Processing

**Location**: `src/core/services/images/imageManipulation.service.ts`

**Crop Modes**:
- **`fill`**: Crop to exact dimensions, maintain aspect ratio
- **`fit`**: Fit within dimensions, maintain aspect ratio, no cropping  
- **`scale`**: Scale to exact dimensions, may distort

**Processing Pipeline**:
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
  
  // 5. Convert to optimized blob
  return new Promise(resolve => {
    canvas.toBlob(resolve, outputFormat, quality);
  });
}
```

### Derivative Caching System

**Location**: `src/core/services/images/derivativeCache.service.ts`

**Cache Structure**:
```typescript
// IndexedDB store configuration
const derivativeCacheStore = localforage.createInstance({
  name: 'SparktypeDB',
  storeName: 'derivativeCacheStore'
});

// Cache key format: {siteId}/assets/derivatives/{filename}_w{width}_h{height}_c-{crop}_g-{gravity}.{ext}
const cacheKey = `${siteId}/assets/derivatives/image_w600_h400_c-fill_g-center.jpg`;
```

**Concurrency-Safe Processing**:
```typescript
// Prevent duplicate processing with promise maps
const processingPromises = new Map<string, Promise<Blob>>();

private async getOrProcessDerivative(siteId: string, srcPath: string, cacheKey: string, options: ImageTransformOptions): Promise<Blob> {
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

### Multi-Layer Caching Strategy

**Cache Hierarchy**:
1. **In-Memory Cache**: `sourceImageCache` for source blobs
2. **Processing Promises**: `processingPromises` to prevent duplicate work
3. **IndexedDB Cache**: `derivativeCacheStore` for persistent storage
4. **Blob URL Cache**: Browser-managed blob URLs for display

## Phase 5: Static Site Export Process

### Export Asset Bundling

**Location**: `src/core/services/builder/asset.builder.ts`

**Export Flow**:
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

### Local Image Service Export

**Export Asset Structure**:
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
  
  // 2. Pre-generate essential derivatives (social media images)
  const essentialTransforms = [
    { width: 1200, height: 630, crop: 'fill' } // Social sharing
  ];
  
  // 3. Add all cached derivatives
  const derivativeKeys = await getAllCacheKeys(siteId);
  for (const key of derivativeKeys) {
    const relativePath = key.substring(siteId.length + 1);
    const derivativeBlob = await getCachedDerivative(key);
    exportableMap.set(relativePath, derivativeBlob);
  }
  
  return Array.from(exportableMap.entries()).map(([path, data]) => ({ path, data }));
}
```

**Bundle Structure**:
```
exported-site.zip
├── _site/
│   ├── themes/default/
│   │   ├── theme.json
│   │   ├── base.hbs
│   │   └── variables.css
│   ├── layouts/blog-post/
│   │   ├── layout.json
│   │   └── index.hbs
│   ├── assets/originals/
│   │   ├── 1234567890-hero-banner.jpg
│   │   └── 1234567891-featured-image.jpg
│   └── assets/derivatives/
│       ├── hero-banner_w1200_h600_c-fill_g-center.jpg
│       ├── featured-image_w300_h200_c-fill_g-center.jpg
│       ├── featured-image_w600_h400_c-fill_g-center.jpg
│       └── featured-image_w1200_h630_c-fill_g-center.jpg
├── assets/css/styles.css
├── index.html
└── [other generated HTML files]
```

## Performance Optimizations

### 1. Concurrency Management

**Source Blob Fetching**:
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

**Derivative Processing**:
```typescript
// Prevent duplicate processing jobs
const processingPromises = new Map<string, Promise<Blob>>();

// Only one processing job per unique cache key
if (processingPromises.has(cacheKey)) {
  return processingPromises.get(cacheKey)!;
}
```

### 2. Declarative Preprocessing

**Context-Aware Generation**:
- **Collection items**: Generate presets for all discovered contexts from collection layouts
- **Regular pages**: Generate only full context preset
- **Layout configuration**: Respect explicit `image_presets` configuration
- **Fallback system**: System defaults when configuration missing

**Efficient Context Discovery**:
- Scans collection layouts for `displayTypes` configuration
- Extracts unique `imageContext` values
- Generates context-specific presets only as needed

### 3. Compression & Optimization

**Multi-Stage Compression**:
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

**Format Optimization**:
- **JPEG**: Default for photos (85% quality)
- **PNG**: Preserved for transparency
- **WebP**: Used when browser supports
- **SVG**: Passed through unchanged

## Error Handling & Recovery

### Graceful Degradation

**Processing Failures**:
```typescript
try {
  processedBlob = await cropAndResizeImage(sourceBlob, options);
} catch (canvasError) {
  console.error('Canvas processing failed, falling back to compression only');
  // Fallback to compression-only processing
  processedBlob = await imageCompression(sourceBlob, compressionOptions);
}
```

**Layout Manifest Parsing**:
```typescript
try {
  const layoutManifest = JSON.parse(layoutFile.content);
  return layoutManifest;
} catch (error) {
  console.warn(`[ImagePreprocessor] Failed to parse layout manifest for ${layoutPath}:`, error);
  return null; // Continue with system defaults
}
```

**Cache Corruption**:
```typescript
// Auto-recovery from cache corruption
export async function clearAllDerivativeCache(): Promise<void> {
  await derivativeCacheStore.clear();
  console.log('[DerivativeCache] Cleared entire cache for recovery');
}
```

**Export Continuity**:
```typescript
// Export continues even if some assets fail
if (errors.length > 0) {
  console.warn(`[LocalImageService] Export errors:`, errors);
  // Don't throw - allow export to continue with available assets
}
```

## Monitoring & Debugging

### Comprehensive Logging

**Processing Visibility**:
```typescript
console.log(`[ImagePreprocessor] Found ${allImageRefs.length} image references`);
console.log(`[ImagePreprocessor] Processed ${fieldName} with preset '${presetName}'${context ? ` (${context})` : ''} (${resolvedPreset.width}x${resolvedPreset.height}): ${processedUrl}`);
```

**Configuration Debugging**:
```typescript
console.warn(`[ImagePreprocessor] No presets determined for field '${fieldName}' in ${contentPath}`);
console.warn(`[ImagePreprocessor] Could not resolve preset '${presetName}'`);
console.warn(`[ImageHelper] No preprocessed URL found for field '${fieldName}' in ${contentPath}`);
```

**Performance Metrics**:
```typescript
const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
console.log(`[LocalImageService] Export completed: ${exportableAssets.length} assets, ${totalSizeMB}MB total`);
```

**Cache Analytics**:
```typescript
console.log(`[ImageService] Found cached derivative: ${cacheKey}, size: ${cachedBlob.size}`);
console.log(`[ImageService] Canvas processing complete: ${sourceBlob.size} -> ${processedBlob.size} bytes`);
```

## Integration Points

### Template System Integration

**Handlebars Helper Registration**:
```typescript
// Image helper provides synchronous access to preprocessed images
Handlebars.registerHelper('image', imageHelper(siteData).image);
```

**Context-Aware Rendering**:
```typescript
// Helper detects context from displayType configuration and selects appropriate preset
const context = getImageContextFromDisplayType(displayType, rootContext) || 'full';
const processedUrl = imagePreprocessor.getProcessedImageUrlForField(contentPath, fieldName, context);
```

### Layout System Integration

**Layout Manifest Configuration**:
```typescript
// Layouts define explicit image preset configuration
{
  "name": "Blog Post",
  "image_presets": {
    "featured_image": {
      "contexts": {
        "card": "thumbnail",
        "list": "banner_small",
        "full": "page_display"
      },
      "default": "page_display"
    }
  }
}
```

**Collection Layout Configuration**:
```typescript
// Collection layouts map display types to image contexts
{
  "displayTypes": {
    "post-card": {
      "partial": "post-card",
      "imageContext": "card"
    },
    "post-full": {
      "partial": "post-full",
      "imageContext": "full"
    }
  }
}
```

### Form System Integration

**ImageRef Object Structure**:
```typescript
interface ImageRef {
  serviceId: string;    // 'local' | 'cloudinary'
  src: string;         // 'assets/originals/image.jpg'
  alt?: string;        // 'Image description'
  width?: number;      // Original width
  height?: number;     // Original height
}
```

**Form Data Flow**:
1. User uploads via `ImageUploadWidget`
2. File processed by image service
3. `ImageRef` stored in form data
4. Content saved with image references
5. Images preprocessed using declarative configuration

## Key Benefits

### Performance Benefits
- **Synchronous rendering**: No async operations in templates
- **Intelligent caching**: Multi-layer cache hierarchy
- **Optimized compression**: Canvas + compression pipeline
- **Bundle optimization**: Only referenced images exported
- **Context-aware processing**: Right-sized images for each context

### Developer Experience
- **Declarative configuration**: Explicit preset mapping in layout manifests
- **No magic**: All behavior explicitly configured
- **Flexible contexts**: Custom context mapping per collection layout
- **Comprehensive logging**: Full visibility into processing and configuration
- **Error recovery**: Graceful handling of failures with system fallbacks

### User Experience
- **Fast uploads**: Efficient validation and storage
- **Instant previews**: Blob URLs for immediate feedback
- **Optimized delivery**: Context-appropriate images automatically selected
- **Reliable exports**: Complete asset bundling with processed derivatives

## Configuration Philosophy

The image system uses **explicit declarative configuration** throughout:

### Field to Preset Mapping

All field-to-preset mappings are configured in layout manifests:

```json
{
  "image_presets": {
    "hero_image": "hero",
    "avatar_image": "avatar",
    "featured_image": {
      "contexts": {
        "card": "thumbnail",
        "full": "page_display"
      },
      "default": "page_display"
    }
  }
}
```

### Display Type to Context Mapping

Context detection uses explicit `imageContext` mapping:

```json
{
  "displayTypes": {
    "post-card": {
      "partial": "post-card",
      "imageContext": "card"
    },
    "post-full": {
      "partial": "post-full",
      "imageContext": "full"
    }
  }
}
```

### Benefits

- **Predictable**: All behavior is explicitly configured
- **Maintainable**: Configuration is visible and documented in manifests
- **Flexible**: Use any field names without hidden side effects
- **Clear**: No magic - what you configure is what you get

This declarative approach provides explicit control over image processing while maintaining performance, reliability, and ease of use.