# Image documentation accuracy report

## Executive summary

The IMAGE_PIPELINE_PROCESS.md and IMAGE_PRESET_SYSTEM.md documents contain **significant inaccuracies** that misrepresent how the image system actually works. The documentation describes a complex "declarative context-aware" system with functions and concepts that don't exist in the codebase.

## Critical inaccuracies in IMAGE_PIPELINE_PROCESS.md

### 1. Non-existent context resolution system

**What the doc claims:**
The document extensively describes a "declarative context-aware" preset resolution system with functions like:
- `resolvePresetForContext(fieldName, context, layoutManifest)`
- `determinePresetsForField(siteData, contentPath, fieldName, layoutPath)`
- `getAvailableContexts(siteData)`
- `getImageContextFromDisplayType(displayType, rootContext)`

**Reality:**
**None of these functions exist** in the codebase. The actual implementation is much simpler:

```typescript
// Actual function (line 339-369):
private getPresetsForField(siteData: LocalSiteData, fieldName: string, layoutPath: string): string[] {
  const presetNames = new Set<string>();

  // Add ALL core presets
  Object.keys(BASE_IMAGE_PRESETS).forEach(name => presetNames.add(name));

  // Add ALL theme presets
  if (themeManifest?.image_presets) {
    Object.keys(themeManifest.image_presets).forEach(name => presetNames.add(name));
  }

  // Add ALL layout presets
  if (layoutManifest?.image_presets) {
    Object.keys(layoutManifest.image_presets).forEach(name => presetNames.add(name));
  }

  return Array.from(presetNames);
}
```

The system **generates ALL available presets** for every image field, not context-specific ones.

### 2. Non-existent collection item special handling

**What the doc claims:**
```typescript
if (isCollectionItem) {
  // Collection items need presets for all possible display contexts
  const contexts = this.getAvailableContexts(siteData);
  // Generate preset for each available context
  for (const context of contexts) {
    const presetName = this.resolvePresetForContext(fieldName, context, layoutManifest);
    presets.push({ presetName, context });
  }
}
```

**Reality:**
There is **no distinction** between collection items and regular pages in preprocessing. All images get all available presets generated, regardless of whether they're collection items.

### 3. Incorrect context detection in image helper

**What the doc claims:**
The helper uses complex context detection via `displayTypes` configuration:
```typescript
const displayTypeConfig = collectionLayoutManifest?.displayTypes?.[displayType];
return displayTypeConfig?.imageContext;  // e.g., "card", "full", "list"
```

**Reality:**
The actual image helper (line 39-150 in image.helper.ts) works completely differently:

```typescript
image: function(this: any, ...args: unknown[]): Handlebars.SafeString {
  const options = args[args.length - 1] as Handlebars.HelperOptions;

  // Get preset name - defaults to 'original'
  const presetName = options.hash.preset || 'original';

  // Get preprocessed URL for this field + preset combination
  let processedUrl = imagePreprocessor.getProcessedImageUrl(contentPath, fieldName, presetName);

  // ... render img tag
}
```

**The preset is explicitly specified in templates**, not detected from context. There's no context resolution logic at all.

### 4. Template usage is wrong

**What the doc claims:**
```handlebars
{{! Basic usage - context-aware preset selection }}
{{{image fieldname="featured_image"}}}
```

**Reality:**
Templates **must explicitly specify the preset**:
```handlebars
{{! Correct usage - preset must be specified }}
{{{image fieldname="featured_image" preset="thumbnail"}}}
{{{image fieldname="featured_image" preset="full"}}}
```

If no preset is specified, it defaults to 'original', not to any context-aware selection.

### 5. Preset resolution flow is incorrect

**What the doc claims:**
1. Layout manifest configuration (explicit `image_presets` configuration)
2. Context-specific presets (from `contexts` mapping)
3. Field defaults (from `default` property)
4. System fallbacks (full → `page_display`, others → `thumbnail`)

**Reality:**
The actual resolution (line 415-461) is simpler 3-tier inheritance:
```typescript
private resolvePreset(presetName: string, themeManifest: any, layoutManifest: any): ImagePreset | null {
  // Layer 1: Core preset from BASE_IMAGE_PRESETS
  const corePreset = BASE_IMAGE_PRESETS[presetName];

  // Layer 2: Theme manifest override
  const themePreset = themeManifest?.image_presets?.[presetName];

  // Layer 3: Layout manifest override
  const layoutPreset = layoutManifest?.image_presets?.[presetName];

  // Merge: core <- theme <- layout (later overrides earlier)
  return { ...preset, ...corePreset, ...themePreset, ...layoutPreset };
}
```

There are no "context-specific presets", "field defaults", or "system fallbacks". Just straightforward preset name lookup with 3-tier override.

## Inaccuracies in IMAGE_PRESET_SYSTEM.md

### 1. Preset dimensions are wrong

**What the doc claims:**
| Preset | Dimensions | Crop | Use Case |
|--------|------------|------|----------|
| `thumbnail` | 300×200 | fill | Card previews |
| `full` | 960×360 | fill | Standard page content |
| `hero` | 1200×600 | fill | Large headers |

**Reality (from editorConfig.ts line 147-220):**
| Preset | Dimensions | Crop | Use Case |
|--------|------------|------|----------|
| `thumbnail` | 300×200 | fill | ✅ Correct |
| `full` | **800×auto** | fill | ❌ Wrong - no height constraint |
| `hero` | 1200×600 | fill | ✅ Correct |
| `logo` | **256×256** | fill | ❌ Doc says 200×200 |
| `page_display` | **960×360** | fill | ❌ Missing from doc entirely |

The doc confuses `full` with `page_display` - they're different presets with different dimensions.

### 2. Missing presets

**Missing from documentation:**
- `page_display` (960×360) - Actually used in templates
- `gallery` (400×400) - Square gallery images
- `banner_small` (600×200) - Small banners

These are all in BASE_IMAGE_PRESETS but not documented.

## What the system actually does

### Simple template-based approach

**How it really works:**

1. **Preprocessing phase** (imagePreprocessor.service.ts):
   - Finds all image fields in all content files
   - For EACH image field, generates **ALL available presets**:
     - All presets from BASE_IMAGE_PRESETS
     - All presets from theme manifest
     - All presets from layout manifest
   - Stores: `contentPath → fieldName → presetName → URL`

2. **Template rendering** (image.helper.ts):
   - Template explicitly specifies preset: `{{{image fieldname="featured_image" preset="thumbnail"}}}`
   - Helper looks up preprocessed URL: `getProcessedImageUrl(contentPath, fieldName, "thumbnail")`
   - Returns `<img>` tag with the URL

3. **Preset inheritance** (resolvePreset):
   - Core presets (BASE_IMAGE_PRESETS)
   - Theme presets override core
   - Layout presets override both
   - Simple property merge, no complex logic

**Key insight:** There's no context detection, no displayType mapping, no dynamic preset selection. Templates choose presets explicitly.

## Why this matters

### Performance implications

**Doc implies:** Smart context-aware system generates only needed derivatives
**Reality:** System generates ALL presets for ALL images, which is:
- ✅ Simpler to understand
- ❌ Potentially wasteful (generates unused derivatives)
- ✅ Ensures all presets available synchronously

### Developer experience implications

**Doc implies:** Complex declarative configuration required
**Reality:** Just specify `preset="name"` in templates
- ✅ Much simpler API
- ✅ Explicit and predictable
- ❌ Doc makes it sound more complex than it is

### Maintenance implications

**Doc describes:** ~500 lines of complex context resolution code
**Reality:** ~150 lines of simple preset lookup and URL retrieval
- ❌ Doc will confuse future developers
- ❌ May lead to implementing features that don't exist
- ❌ Makes debugging harder

## Recommendations

### 1. Rewrite IMAGE_PIPELINE_PROCESS.md

**Remove these sections entirely:**
- "Declarative Preset Resolution"
- "Context Discovery"
- "Collection Item Processing"
- "Declarative Context Detection"
- All code examples showing context resolution

**Replace with:**
- Simple explanation: "All presets are generated for all images"
- Template-first approach: "Templates choose presets explicitly"
- 3-tier inheritance explanation (keep this - it's accurate)

### 2. Fix IMAGE_PRESET_SYSTEM.md

**Corrections needed:**
- Fix `full` preset dimensions (800×auto, not 960×360)
- Fix `logo` preset dimensions (256×256, not 200×200)
- Add missing presets: `page_display`, `gallery`, `banner_small`
- Clarify that ALL presets are generated, not context-specific ones

### 3. Add clarity about the actual architecture

**Key points to emphasize:**
- **Template-driven**: Templates explicitly specify which preset to use
- **Generate all**: All available presets are generated during preprocessing
- **Simple lookup**: Runtime just looks up pre-generated URLs
- **No magic**: No context detection, no dynamic selection

## Accurate code examples

### What preprocessing actually does

```typescript
// For each image in content:
// 1. Find all available presets
const presets = [
  ...Object.keys(BASE_IMAGE_PRESETS),
  ...Object.keys(themeManifest?.image_presets || {}),
  ...Object.keys(layoutManifest?.image_presets || {})
];

// 2. Generate ALL of them
for (const preset of presets) {
  const url = await imageService.getDisplayUrl(imageRef, preset);
  store(contentPath, fieldName, preset, url);
}
```

### What templates actually do

```handlebars
{{! Explicitly choose preset - no automatic detection }}
<article class="card">
  {{{image fieldname="featured_image" preset="thumbnail"}}}
</article>

<article class="full-page">
  {{{image fieldname="featured_image" preset="page_display"}}}
</article>
```

### What the helper actually does

```typescript
// Get the preset name from template
const presetName = options.hash.preset || 'original';

// Look up pre-generated URL
const url = imagePreprocessor.getProcessedImageUrl(contentPath, fieldName, presetName);

// Return img tag
return `<img src="${url}" alt="${alt}">`;
```

## Summary

The image documentation describes an elaborate "context-aware declarative" system that **does not exist**. The actual implementation is much simpler: generate all presets for all images, let templates choose which one to use. This needs to be corrected to avoid confusion and maintenance issues.

**Severity:** High - Documentation fundamentally misrepresents the architecture
**Impact:** Developers will be confused, debugging will be harder, future changes may try to match the incorrect documentation
**Recommendation:** Complete rewrite of both documents to match actual implementation
