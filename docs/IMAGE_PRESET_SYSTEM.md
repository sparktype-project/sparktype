# Image Preset System Documentation

The Sparktype image preset system uses **template-based preset selection** with **3-tier inheritance** for simple, explicit image processing. Presets are specified directly in templates, making it clear which image size is used where.

## Overview

The system follows these principles:
- **Template-level selection**: Templates explicitly specify which preset to use
- **3-tier inheritance**: Core → Site Config → Layout Config
- **Preprocessed for performance**: All images generated before template rendering
- **Simple and explicit**: No hidden context detection or magic

## How It Works

### 1. Template-Based Preset Selection

Templates explicitly specify which preset to use with the `preset` parameter:

```handlebars
{{! Small thumbnail for card views }}
{{{image fieldname="featured_image" preset="thumbnail" alt="Post image"}}}

{{! Full-size image for individual pages }}
{{{image fieldname="featured_image" preset="full" alt="Post image"}}}

{{! Large hero image for headers }}
{{{image fieldname="banner_image" preset="hero" alt="Header image"}}}

{{! No preset specified - uses 'original' (no resizing) }}
{{{image fieldname="photo"}}}
```

### 2. Three-Tier Preset Inheritance

Presets are defined in three layers, with later layers overriding earlier ones:

```
Core Presets (BASE_IMAGE_PRESETS in code)
  ↓ overridden by
Site Config (manifest.imagePresets)
  ↓ overridden by
Layout Config (layout.json presets)
```

**Example inheritance:**

```typescript
// Layer 1: Core preset (editorConfig.ts)
thumbnail: { width: 300, height: 200, crop: 'fill', gravity: 'center' }

// Layer 2: Site config override (manifest.imagePresets)
thumbnail: { width: 350, height: 250 }  // Overrides core

// Layer 3: Layout config override (layout.json)
thumbnail: { width: 320, height: 240 }  // Overrides site & core
```

### 3. Available Base Presets

All core presets are defined in `src/config/editorConfig.ts`:

| Preset | Dimensions | Crop | Use Case |
|--------|------------|------|----------|
| `thumbnail` | 300×200 | fill | Card previews and small displays |
| `full` | 960×360 | fill | Standard page content images |
| `hero` | 1200×600 | fill | Large header and banner images |
| `logo` | 200×200 | fit | Logos and icons |
| `avatar` | 150×150 | fill | Profile and author images |
| `social` | 1200×630 | fill | Social media sharing (Open Graph, Twitter) |
| `original` | No resize | scale | Original with optimization only |

## Basic Usage

### In Templates

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
    preset="full"
    alt="Featured image"
    class="post-image"
  }}}
  <div class="content">{{content}}</div>
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

{{! URL only for meta tags }}
<meta property="og:image" content="{{{image fieldname="featured_image" preset="social" url_only=true}}}" />
```

## Advanced Configuration

### Overriding Core Presets in Site Config

Override core presets globally for your entire site:

```json
{
  "siteId": "my-site",
  "title": "My Site",

  "imagePresets": {
    "thumbnail": {
      "width": 350,
      "height": 250,
      "crop": "fill",
      "gravity": "center",
      "description": "Custom site-wide thumbnail"
    },
    "full": {
      "width": 1024,
      "height": 400,
      "crop": "fill",
      "gravity": "center"
    }
  }
}
```

Now all templates using `preset="thumbnail"` will get 350×250 images instead of 300×200.

### Layout-Specific Presets

Define presets specific to a layout in `layout.json`:

```json
{
  "name": "Blog Post",
  "layoutType": "single",

  "schema": {
    "properties": {
      "featured_image": {
        "type": "string",
        "title": "Featured Image"
      }
    }
  },

  "uiSchema": {
    "featured_image": {
      "ui:widget": "imageUploader"
    }
  },

  "presets": {
    "thumbnail": {
      "width": 320,
      "height": 240,
      "crop": "fill",
      "gravity": "center",
      "description": "Blog-specific thumbnail"
    },
    "blog_hero": {
      "width": 1400,
      "height": 500,
      "crop": "fill",
      "gravity": "center",
      "description": "Custom blog hero size"
    }
  }
}
```

**Then use in templates:**

```handlebars
{{! Uses layout's thumbnail override (320×240) }}
{{{image fieldname="featured_image" preset="thumbnail"}}}

{{! Uses layout-specific preset }}
{{{image fieldname="banner" preset="blog_hero"}}}

{{! Uses core hero preset (1200×600) }}
{{{image fieldname="header" preset="hero"}}}
```

### Custom Site-Wide Presets

Add completely new presets in site config:

```json
{
  "imagePresets": {
    "product_card": {
      "width": 400,
      "height": 400,
      "crop": "fill",
      "gravity": "center",
      "description": "Square product card"
    },
    "product_detail": {
      "width": 800,
      "height": 600,
      "crop": "fit",
      "gravity": "center",
      "description": "Product detail page"
    }
  }
}
```

**Use in templates:**

```handlebars
{{! Product card }}
{{{image fieldname="product_image" preset="product_card"}}}

{{! Product detail page }}
{{{image fieldname="product_image" preset="product_detail"}}}
```

## Complete Examples

### Example 1: Blog with Cards and Full Posts

**Site Config (manifest.json):**
```json
{
  "imagePresets": {
    "thumbnail": {
      "width": 350,
      "height": 250
    }
  }
}
```

**Blog Card Template (blog-listing/partials/post-card.hbs):**
```handlebars
<article class="card">
  {{{image
    fieldname="featured_image"
    preset="thumbnail"
    alt=this.frontmatter.title
  }}}
  <h2>{{this.frontmatter.title}}</h2>
</article>
```
**Result:** Uses site's thumbnail override (350×250)

**Blog Post Template (blog-post/index.hbs):**
```handlebars
<article class="post">
  {{{image
    fieldname="featured_image"
    preset="full"
    alt="Featured image"
  }}}
  <div class="content">{{content}}</div>
</article>
```
**Result:** Uses core full preset (960×360)

### Example 2: Portfolio with Layout-Specific Presets

**Portfolio Project Layout (portfolio-project/layout.json):**
```json
{
  "name": "Portfolio Project",
  "presets": {
    "portfolio_hero": {
      "width": 1400,
      "height": 700,
      "crop": "fill",
      "gravity": "center"
    },
    "gallery_image": {
      "width": 600,
      "height": 450,
      "crop": "fill",
      "gravity": "center"
    }
  }
}
```

**Project Page Template (portfolio-project/index.hbs):**
```handlebars
<article>
  {{! Uses layout's custom preset }}
  {{{image
    fieldname="featured_image"
    preset="portfolio_hero"
    alt=contentFile.frontmatter.title
  }}}

  {{! Gallery images }}
  {{#each contentFile.frontmatter.gallery}}
    {{{image
      fieldname="gallery"
      preset="gallery_image"
      alt="Gallery image"
    }}}
  {{/each}}
</article>
```

**Project Card Template (portfolio-grid/partials/project-card.hbs):**
```handlebars
<article class="project-card">
  {{! Uses core thumbnail preset }}
  {{{image
    fieldname="featured_image"
    preset="thumbnail"
    alt=this.frontmatter.title
  }}}
  <h3>{{this.frontmatter.title}}</h3>
</article>
```

## Preset Resolution Examples

### Example 1: Core Only
```typescript
// Core preset exists
BASE_IMAGE_PRESETS.avatar = { width: 150, height: 150 }

// No site override
// No layout override

// Template
{{{image fieldname="author_photo" preset="avatar"}}}

// Result: 150×150 (core preset)
```

### Example 2: Site Override
```typescript
// Core preset
BASE_IMAGE_PRESETS.hero = { width: 1200, height: 600 }

// Site override
manifest.imagePresets.hero = { width: 1400, height: 700 }

// No layout override

// Template
{{{image fieldname="banner" preset="hero"}}}

// Result: 1400×700 (site override)
```

### Example 3: Full Override Chain
```typescript
// Core preset
BASE_IMAGE_PRESETS.thumbnail = { width: 300, height: 200, crop: 'fill' }

// Site override
manifest.imagePresets.thumbnail = { width: 350, height: 250 }

// Layout override
layout.presets.thumbnail = { width: 320, height: 240 }

// Template
{{{image fieldname="photo" preset="thumbnail"}}}

// Result: 320×240 (layout override wins)
```

### Example 4: Custom Preset (No Core)
```typescript
// No core preset

// Site defines new preset
manifest.imagePresets.banner_wide = {
  width: 1600,
  height: 400,
  crop: 'fill',
  gravity: 'center'
}

// Template
{{{image fieldname="header" preset="banner_wide"}}}

// Result: 1600×400 (custom site preset)
```

## Template Helper Options

The `image` helper accepts these parameters:

| Parameter | Required | Description | Example |
|-----------|----------|-------------|---------|
| `fieldname` | Yes | The frontmatter field containing the image | `fieldname="featured_image"` |
| `preset` | No | Which preset to use (defaults to 'original') | `preset="thumbnail"` |
| `alt` | No | Alt text for the image | `alt="Description"` |
| `class` | No | CSS classes to apply | `class="w-full rounded"` |
| `lazy` | No | Enable lazy loading (default: true) | `lazy=false` |
| `url_only` | No | Return URL only (for meta tags) | `url_only=true` |

**Examples:**

```handlebars
{{! Full featured usage }}
{{{image
  fieldname="featured_image"
  preset="thumbnail"
  alt="Post thumbnail"
  class="rounded shadow"
  lazy=true
}}}

{{! Minimal usage (uses 'original' preset) }}
{{{image fieldname="photo"}}}

{{! URL only for meta tags }}
<meta property="og:image" content="{{{image fieldname="featured_image" preset="social" url_only=true}}}" />

{{! Disable lazy loading for above-the-fold images }}
{{{image fieldname="hero" preset="hero" lazy=false}}}
```

## Best Practices

### 1. Use Descriptive Preset Names

```json
// Good - clear purpose
{
  "presets": {
    "product_thumbnail": { "width": 300, "height": 300 },
    "product_detail": { "width": 800, "height": 600 }
  }
}

// Less clear
{
  "presets": {
    "small": { "width": 300, "height": 300 },
    "big": { "width": 800, "height": 600 }
  }
}
```

### 2. Be Consistent Across Templates

Use the same preset names for similar purposes:

```handlebars
{{! All card views use 'thumbnail' }}
{{! blog-listing/partials/post-card.hbs }}
{{{image fieldname="featured_image" preset="thumbnail"}}}

{{! portfolio-grid/partials/project-card.hbs }}
{{{image fieldname="featured_image" preset="thumbnail"}}}

{{! All full pages use 'full' }}
{{! blog-post/index.hbs }}
{{{image fieldname="featured_image" preset="full"}}}

{{! portfolio-project/index.hbs }}
{{{image fieldname="featured_image" preset="full"}}}
```

### 3. Override Strategically

- **Core presets**: Good defaults for most sites
- **Site overrides**: Adjust for your site's design system
- **Layout overrides**: Only when a layout needs different sizing

### 4. Document Custom Presets

Add descriptions to help other developers:

```json
{
  "presets": {
    "feature_card": {
      "width": 400,
      "height": 300,
      "crop": "fill",
      "gravity": "center",
      "description": "Used in the features section cards on the homepage"
    }
  }
}
```

### 5. Use Semantic Names

Preset names should describe their purpose, not their size:

```json
// Good - semantic
{
  "presets": {
    "card_image": { "width": 300 },
    "header_banner": { "width": 1200 }
  }
}

// Less good - size-based
{
  "presets": {
    "300px": { "width": 300 },
    "1200px": { "width": 1200 }
  }
}
```

## Troubleshooting

### Image not appearing

**Check:**
1. Field name matches exactly: `fieldname="featured_image"`
2. Field exists in content frontmatter with valid ImageRef
3. Preset exists in core, site config, or layout config
4. Browser console for preprocessing errors

### Wrong image size

**Check:**
1. Which preset the template is using: `preset="thumbnail"`
2. Site config for preset overrides: `manifest.imagePresets.thumbnail`
3. Layout config for preset overrides: `layout.presets.thumbnail`
4. Inheritance chain: Core → Site → Layout

### Preset not found warning

```
[ImagePreprocessor] Preset 'custom_preset' not found in core, site, or layout
```

**Solution:** Define the preset in site config or layout config:

```json
{
  "presets": {
    "custom_preset": {
      "width": 500,
      "height": 400,
      "crop": "fill",
      "gravity": "center"
    }
  }
}
```

### Different sizes on different pages

This is expected! Templates specify which preset to use:

```handlebars
{{! Card partial - thumbnail }}
{{{image fieldname="featured_image" preset="thumbnail"}}}

{{! Full page - full size }}
{{{image fieldname="featured_image" preset="full"}}}
```

## Technical Details

### Preprocessing

Images are preprocessed before template rendering:

1. Preprocessor scans all content for image references
2. For each image field, generates common presets: `['thumbnail', 'full', 'hero', 'original']`
3. Each preset is resolved through 3-tier inheritance
4. Derivatives are generated and cached
5. URLs stored in memory for synchronous template rendering

### Resolution Algorithm

```typescript
function resolvePreset(presetName, manifest, layoutManifest) {
  // 1. Start with core preset (if exists)
  let preset = BASE_IMAGE_PRESETS[presetName] || { crop: 'scale', gravity: 'center' };

  // 2. Apply site manifest overrides (if exists)
  if (manifest.imagePresets?.[presetName]) {
    preset = { ...preset, ...manifest.imagePresets[presetName] };
  }

  // 3. Apply layout overrides (if exists) - highest priority
  if (layoutManifest?.presets?.[presetName]) {
    preset = { ...preset, ...layoutManifest.presets[presetName] };
  }

  return preset;
}
```

### Key Files

- **Core presets**: `src/config/editorConfig.ts` (BASE_IMAGE_PRESETS)
- **Preprocessor**: `src/core/services/images/imagePreprocessor.service.ts`
- **Template helper**: `src/core/services/renderer/helpers/image.helper.ts`
- **Types**: `src/core/types/index.ts` (ImageRef, ImagePreset)

## Summary

The template-based preset system provides:

- **Explicit control**: Templates specify exactly which preset to use
- **Simple inheritance**: Core → Site → Layout (easy to understand)
- **No magic**: What you see in the template is what you get
- **Flexible overrides**: Customize at any level as needed
- **Performance**: All images preprocessed for fast rendering

Use explicit preset selection in templates, override presets at the appropriate level, and let the system handle the rest.
