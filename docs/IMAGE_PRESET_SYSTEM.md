# Image preset system documentation

The Sparktype image preset system uses **template-based preset selection** with **3-tier inheritance** for simple, explicit image processing. Presets are specified directly in templates, making it clear which image size is used where.

## Overview

The system follows these principles:
- **Template-level selection**: Templates explicitly specify which preset to use
- **3-tier inheritance**: Core → Theme Config → Layout Config
- **Preprocessed for performance**: All images generated before template rendering
- **Simple and explicit**: No hidden context detection or magic

---

## How it works

### 1. Template-based preset selection

Templates explicitly specify which preset to use with the `preset` parameter:

```handlebars
{{! Small thumbnail for card views }}
{{{image fieldname="featured_image" preset="thumbnail" alt="Post image"}}}

{{! Full-size image for individual pages }}
{{{image fieldname="featured_image" preset="page_display" alt="Post image"}}}

{{! Large hero image for headers }}
{{{image fieldname="banner_image" preset="hero" alt="Header image"}}}

{{! No preset specified - uses 'original' (no resizing) }}
{{{image fieldname="photo" preset="original"}}}
```

**Important**: Always specify the preset explicitly. If omitted, defaults to 'original'.

### 2. Three-tier preset inheritance

Presets are defined in three layers, with later layers overriding earlier ones:

```
Core Presets (BASE_IMAGE_PRESETS in code)
  ↓ overridden by
Theme Config (themes/{name}/theme.json → image_presets)
  ↓ overridden by
Layout Config (layouts/{name}/layout.json → image_presets)
```

**Example inheritance:**

```typescript
// Layer 1: Core preset (editorConfig.ts)
thumbnail: { width: 300, height: 200, crop: 'fill', gravity: 'center' }

// Layer 2: Theme config override (themes/sparksite/theme.json)
thumbnail: { width: 350, height: 250 }  // Overrides width and height, keeps crop and gravity

// Layer 3: Layout config override (layouts/blog-post/layout.json)
thumbnail: { width: 320 }  // Final: width: 320, height: 250, crop: 'fill', gravity: 'center'
```

**Inheritance priority**: Layout > Theme > Core (later layers win)

### 3. Available base presets

All core presets are defined in `src/config/editorConfig.ts`:

| Preset | Dimensions | Crop | Use Case |
|--------|------------|------|----------|
| `thumbnail` | 300×200 | fill | Card previews and small displays |
| `page_display` | 960×360 | fill | Standard page content images |
| `full` | 800×auto | fill | Full-width images (no height constraint) |
| `hero` | 1200×600 | fill | Large header and banner images |
| `logo` | 256×256 | fill | Logos and icons (square) |
| `avatar` | 150×150 | fill | Profile and author images |
| `social` | 1200×630 | fill | Social media sharing (Open Graph, Twitter) |
| `gallery` | 400×400 | fill | Square gallery grid images |
| `banner_small` | 600×200 | fill | Small banner images |
| `original` | No resize | scale | Original image with optimisation only |

**Note**: `auto` means no height constraint - image maintains aspect ratio based on width.

---

## Basic usage

### In templates

```handlebars
{{! Blog post card - small thumbnail }}
<article class="card">
  {{{image
    fieldname="featured_image"
    preset="thumbnail"
    alt=this.frontmatter.title
    class="card-image"
  }}}
  <h2>{{this.frontmatter.title}}</h2>
</article>

{{! Individual blog post - full size }}
<article class="post">
  {{{image
    fieldname="featured_image"
    preset="page_display"
    alt="Featured image"
    class="post-image"
  }}}
  <div class="content">{{{content}}}</div>
</article>

{{! Hero section - large banner }}
<header class="hero">
  {{{image
    fieldname="banner_image"
    preset="hero"
    alt="Hero banner"
    class="hero-image"
  }}}
</header>

{{! Social meta tags - URL only }}
<meta property="og:image" content="{{{image fieldname="featured_image" preset="social" url_only=true}}}" />
```

### Helper parameters

```handlebars
{{{image
  fieldname="featured_image"  (required) - Field name in frontmatter
  preset="thumbnail"           (optional) - Preset name (defaults to 'original')
  alt="Alt text"              (optional) - Alt text for img tag
  class="css-class"           (optional) - CSS class for img tag
  url_only=true               (optional) - Return URL only, not full img tag
  lazy=false                  (optional) - Disable lazy loading (default: true)
}}}
```

---

## Advanced configuration

### Site-level overrides

Override presets globally in `manifest.json`:

```json
{
  "imagePresets": {
    "thumbnail": {
      "width": 350,
      "height": 250,
      "crop": "fill",
      "gravity": "center",
      "description": "Custom site thumbnail"
    },
    "custom_preset": {
      "width": 500,
      "height": 300,
      "crop": "fit",
      "gravity": "center"
    }
  }
}
```

**Usage in templates**:
```handlebars
{{{image fieldname="featured_image" preset="custom_preset"}}}
```

### Theme-level presets

Define theme-specific presets in `themes/{name}/theme.json`:

```json
{
  "name": "My Theme",
  "image_presets": {
    "thumbnail": {
      "width": 400,
      "height": 300
    },
    "theme_banner": {
      "width": 1600,
      "height": 400,
      "crop": "fill",
      "gravity": "center"
    }
  }
}
```

These override core presets and are available to all layouts using this theme.

### Layout-level presets

Define layout-specific presets in `layouts/{name}/layout.json`:

```json
{
  "name": "Blog Post",
  "layoutType": "single",
  "image_presets": {
    "thumbnail": {
      "width": 320,
      "height": 240
    },
    "blog_featured": {
      "width": 1200,
      "height": 500,
      "crop": "fill",
      "gravity": "center"
    }
  }
}
```

**Highest priority** - these override both theme and core presets.

---

## Image processing

### Preprocessing phase

**What happens** (before template rendering):

1. **Discovery**: System finds all image references in all content files
2. **Preset gathering**: Collects ALL available presets (core + theme + layout)
3. **Generation**: Generates EVERY preset for EVERY image
4. **Storage**: Stores URLs in memory: `contentPath → fieldName → presetName → URL`

**Code location**: `src/core/services/images/imagePreprocessor.service.ts`

**Key insight**: ALL presets are generated for ALL images during preprocessing, not selectively.

### Runtime rendering

**What happens** (during template compilation):

1. **Template specifies**: `{{{image fieldname="featured_image" preset="thumbnail"}}}`
2. **Helper looks up**: Pre-generated URL from preprocessing phase
3. **Returns immediately**: Synchronous lookup, no async processing needed

**Code location**: `src/core/services/renderer/helpers/image.helper.ts`

**Key insight**: Rendering is synchronous because all URLs are pre-generated.

### Preset resolution

**How inheritance works**:

```typescript
// Start with defaults
let preset = { crop: 'scale', gravity: 'center' };

// Layer 1: Apply core preset (if exists)
if (BASE_IMAGE_PRESETS[presetName]) {
  preset = { ...preset, ...BASE_IMAGE_PRESETS[presetName] };
}

// Layer 2: Apply theme overrides (if exists)
if (themeManifest.image_presets?.[presetName]) {
  preset = { ...preset, ...themeManifest.image_presets[presetName] };
}

// Layer 3: Apply layout overrides (if exists)
if (layoutManifest.image_presets?.[presetName]) {
  preset = { ...preset, ...layoutManifest.image_presets[presetName] };
}

// Result: Merged preset with highest priority properties winning
```

---

## Export and caching

### Static site export

**What gets exported**:

1. **Original images**: All source images from `assets/originals/`
2. **Generated derivatives**: All cached derivatives from preprocessing
3. **Bundle structure**:
   ```
   _site/
   ├── assets/originals/
   │   └── {timestamp}-{filename}.{ext}
   └── assets/derivatives/
       └── {filename}_w{width}_h{height}_c-{crop}_g-{gravity}.{ext}
   ```

**Code location**: `src/core/services/builder/asset.builder.ts`

### Derivative caching

**Cache location**: IndexedDB (`derivativeCacheStore`)

**Cache key format**:
```
{siteId}/assets/derivatives/{filename}_w{width}_h{height}_c-{crop}_g-{gravity}.{ext}
```

**Example**:
```
site-123/assets/derivatives/photo_w300_h200_c-fill_g-center.jpg
```

**Persistence**: Derivatives are cached permanently until:
- Source image is deleted
- Preset configuration changes
- Cache is manually cleared

---

## Best practices

### Preset selection

**Choose presets based on context**:

```handlebars
{{! Card/grid views - use thumbnail }}
<div class="card">
  {{{image fieldname="featured_image" preset="thumbnail"}}}
</div>

{{! List views - use page_display }}
<div class="list-item">
  {{{image fieldname="featured_image" preset="page_display"}}}
</div>

{{! Full page views - use page_display or full }}
<article>
  {{{image fieldname="featured_image" preset="page_display"}}}
</article>

{{! Hero sections - use hero }}
<header class="hero">
  {{{image fieldname="banner_image" preset="hero"}}}
</header>

{{! Social meta tags - use social }}
<meta property="og:image" content="{{{image fieldname="featured_image" preset="social" url_only=true}}}" />
```

### Custom presets

**When to create custom presets**:

1. **Specific aspect ratios**: Need a non-standard size
   ```json
   {
     "wide_banner": {
       "width": 1400,
       "height": 300,
       "crop": "fill"
     }
   }
   ```

2. **Theme-specific layouts**: Different thumbnail sizes per theme
   ```json
   {
     "theme_thumbnail": {
       "width": 350,
       "height": 250
     }
   }
   ```

3. **Layout-specific images**: Special sizes for specific layouts
   ```json
   {
     "case_study_hero": {
       "width": 1600,
       "height": 900,
       "crop": "fill"
     }
   }
   ```

**Where to define them**:
- **Layout-specific**: Define in `layouts/{name}/layout.json`
- **Theme-specific**: Define in `themes/{name}/theme.json`
- **Site-wide**: Define in `manifest.json` (though this is less common)

### Performance tips

1. **Use appropriate presets**: Don't use `hero` when `thumbnail` will do
   ```handlebars
   {{! Bad - loads 1200x600 image in small card }}
   {{{image fieldname="featured_image" preset="hero"}}}

   {{! Good - loads 300x200 image in small card }}
   {{{image fieldname="featured_image" preset="thumbnail"}}}
   ```

2. **Limit custom presets**: More presets = more derivatives = more storage
   - Reuse existing presets where possible
   - Delete unused custom presets

3. **Use `lazy=false` sparingly**: Only for above-the-fold images
   ```handlebars
   {{! Hero image - disable lazy loading }}
   {{{image fieldname="hero_image" preset="hero" lazy=false}}}

   {{! Below-fold images - use lazy loading (default) }}
   {{{image fieldname="gallery_image" preset="gallery"}}}
   ```

---

## Troubleshooting

### Image not displaying

**Check these things**:

1. **Preset specified**: Template must include `preset` parameter
   ```handlebars
   {{! Wrong - no preset specified }}
   {{{image fieldname="featured_image"}}}

   {{! Correct }}
   {{{image fieldname="featured_image" preset="thumbnail"}}}
   ```

2. **Preset exists**: Verify preset is defined in core/theme/layout
   - Check console for warnings: `[ImagePreprocessor] Could not resolve preset`

3. **Image preprocessed**: Check console for preprocessing logs
   - Look for: `[ImagePreprocessor] Processed featured_image with preset 'thumbnail'`

4. **Field name matches**: Frontmatter field must match `fieldname` parameter
   ```yaml
   # In frontmatter
   featured_image:
     serviceId: local
     src: assets/originals/image.jpg
   ```
   ```handlebars
   {{! In template - field name must match }}
   {{{image fieldname="featured_image" preset="thumbnail"}}}
   ```

### Wrong size displayed

**Possible causes**:

1. **Wrong preset used**: Check which preset is specified in template
2. **Preset overridden**: Layout/theme may override core preset dimensions
   - Check console: `[ImagePreprocessor] Resolved preset 'thumbnail': core: 300x200, theme: 350x250, layout: 320x240, final: 320x240`
3. **CSS override**: Image size may be constrained by CSS

### Performance issues

**If preprocessing is slow**:

1. **Too many presets**: Reduce number of custom presets
2. **Too many images**: Consider lazy loading or pagination
3. **Large source images**: Compress before upload (aim for <5MB)

---

## Summary

The Sparktype image preset system is straightforward:

1. **Define presets**: Core → Theme → Layout (3-tier inheritance)
2. **Preprocess all**: System generates ALL presets for ALL images
3. **Template chooses**: `{{{image fieldname="name" preset="preset"}}}`
4. **Helper looks up**: Synchronous lookup of pre-generated URL
5. **Export bundles**: All derivatives included in site bundle

**No automatic selection, no context detection** - templates explicitly choose which preset to use.
