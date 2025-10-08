# Image System Summary

Quick reference for Sparktype's template-based image preset system.

## Quick Start

### 1. Use in Templates

```handlebars
{{! Specify preset explicitly }}
{{{image fieldname="featured_image" preset="thumbnail" alt="Image"}}}
{{{image fieldname="banner" preset="hero"}}}
{{{image fieldname="logo" preset="logo"}}}

{{! No preset = 'original' (no resizing) }}
{{{image fieldname="photo"}}}
```

### 2. Override Presets

**Site-wide (manifest.json):**
```json
{
  "imagePresets": {
    "thumbnail": { "width": 350, "height": 250 }
  }
}
```

**Layout-specific (layout.json):**
```json
{
  "presets": {
    "thumbnail": { "width": 320, "height": 240 }
  }
}
```

### 3. Inheritance Chain

```
Core → Site Config → Layout Config
```

Later layers override earlier ones.

## Core Presets

| Preset | Size | Use Case |
|--------|------|----------|
| `thumbnail` | 300×200 | Card views |
| `full` | 960×360 | Page content |
| `hero` | 1200×600 | Headers/banners |
| `logo` | 200×200 | Logos/icons |
| `avatar` | 150×150 | Profiles |
| `social` | 1200×630 | Social media |
| `original` | No resize | Optimization only |

## Common Patterns

### Blog Cards
```handlebars
{{! post-card.hbs }}
{{{image fieldname="featured_image" preset="thumbnail"}}}
```

### Blog Posts
```handlebars
{{! blog-post/index.hbs }}
{{{image fieldname="featured_image" preset="full"}}}
```

### Hero Sections
```handlebars
{{{image fieldname="banner_image" preset="hero"}}}
```

### Meta Tags
```handlebars
<meta property="og:image" content="{{{image fieldname="featured_image" preset="social" url_only=true}}}" />
```

## Files

- **Full guide**: `docs/IMAGE_PRESET_SYSTEM.md`
- **Pipeline details**: `docs/IMAGE_PIPELINE_PROCESS.md`
- **Core presets**: `src/config/editorConfig.ts`
- **Preprocessor**: `src/core/services/images/imagePreprocessor.service.ts`
- **Template helper**: `src/core/services/renderer/helpers/image.helper.ts`

## Key Points

✅ Templates specify presets explicitly
✅ No context detection or magic
✅ Simple 3-tier inheritance
✅ Override at any level
✅ Preprocessed for performance
