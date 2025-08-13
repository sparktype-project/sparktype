# Image Preset System Documentation

The Sparktype image preset system provides **declarative, manifest-driven** image processing that generates context-aware image derivatives based on explicit layout configuration. All images are preprocessed before template rendering for optimal performance.

## Overview

The system follows a **"declarative over magic"** approach:
- Explicit preset configuration in layout manifests
- Context-aware processing (card vs list vs full page views)
- All images preprocessed during build for synchronous template rendering
- Flexible context mapping for different display types

## How It Works

### 1. Declarative Preset Configuration

The system uses explicit configuration in layout manifests instead of field name conventions:

```json
{
  "name": "Blog Post Layout",
  "layoutType": "single",
  "image_presets": {
    "featured_image": {
      "contexts": {
        "card": "thumbnail",
        "list": "banner_small", 
        "full": "page_display"
      },
      "default": "page_display"
    },
    "banner_image": "hero"
  }
}
```

### 2. Context-Aware Processing

The system detects rendering context through explicit `displayTypes` configuration:

**Collection Layout (`blog-listing/layout.json`):**
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

### 3. Context Resolution Flow

1. Template renders with `displayType: "post-card"`
2. System looks up `displayTypes["post-card"].imageContext` → `"card"`
3. System finds field config: `featured_image.contexts.card` → `"thumbnail"`
4. Returns preprocessed image with thumbnail preset (300×200)

### 4. Available Base Presets

All presets are defined in `src/config/editorConfig.ts`:

| Preset | Dimensions | Use Case |
|--------|------------|----------|
| `thumbnail` | 300×200 | Card previews and small displays |
| `page_display` | 600×400 | Standard page content images |
| `hero` | 1200×600 | Large header and banner images |
| `banner_small` | 600×200 | List view banners |
| `social` | 1200×630 | Social media sharing (Open Graph, Twitter) |
| `avatar` | 150×150 | Profile and author images |
| `gallery` | 400×400 | Square gallery grid images |
| `original` | No resize | Original with optimization only |

## Basic Usage

### Adding Image Fields to Layouts

1. **Define image fields in your layout schema**:

```json
{
  "name": "Blog Post",
  "layoutType": "single",
  "schema": {
    "type": "object",
    "properties": {
      "featured_image": {
        "title": "Featured Image",
        "description": "Main image for the blog post",
        "type": "string"
      },
      "banner_image": {
        "title": "Banner Image", 
        "description": "Large header image",
        "type": "string"
      }
    }
  },
  "uiSchema": {
    "featured_image": {
      "ui:widget": "imageUploader"
    },
    "banner_image": {
      "ui:widget": "imageUploader"
    }
  }
}
```

2. **Configure image presets**:

```json
{
  "image_presets": {
    "featured_image": {
      "contexts": {
        "card": "thumbnail",
        "list": "banner_small",
        "full": "page_display"
      },
      "default": "page_display"
    },
    "banner_image": "hero"
  }
}
```

3. **Use in templates** (unchanged syntax):

```handlebars
{{! Basic usage - preset resolved from context }}
{{{image fieldname="featured_image"}}}

{{! For meta tags - returns URL only }}
<meta property="og:image" content="{{{image fieldname="featured_image" url_only=true}}}" />

{{! With custom CSS classes and alt text }}
{{{image fieldname="banner_image" class="hero-image" alt="Article banner"}}}

{{! Disable lazy loading for above-the-fold images }}
{{{image fieldname="featured_image" lazy=false}}}
```

## Advanced Configuration

### Context-Specific Presets

Define different presets for the same field based on rendering context:

```json
{
  "image_presets": {
    "featured_image": {
      "contexts": {
        "card": "thumbnail",      // 300×200 for card views
        "list": "banner_small",   // 600×200 for list views
        "grid": "gallery",        // 400×400 for grid views
        "full": "page_display"    // 600×400 for full page
      },
      "default": "page_display"   // Fallback when context not found
    }
  }
}
```

### Simple String Presets

For fields that always use the same preset:

```json
{
  "image_presets": {
    "banner_image": "hero",
    "author_avatar": "avatar",
    "og_image": "social"
  }
}
```

### Display Types Configuration

Map display types to image contexts in collection layouts:

```json
{
  "displayTypes": {
    "post-card": {
      "partial": "post-card",
      "imageContext": "card",
      "description": "Compact cards with title, excerpt, and thumbnail"
    },
    "post-list": {
      "partial": "post-list",
      "imageContext": "list", 
      "description": "List items with banner images"
    },
    "post-grid": {
      "partial": "post-grid",
      "imageContext": "grid",
      "description": "Grid layout with square images"
    },
    "post-full": {
      "partial": "post-full",
      "imageContext": "full",
      "description": "Complete posts with full content"
    }
  }
}
```

### Custom Site Presets

Add custom presets in your site manifest:

```json
{
  "imagePresets": {
    "product_thumb": {
      "width": 250,
      "height": 250,
      "crop": "fill",
      "gravity": "center",
      "description": "Product thumbnail for listings"
    },
    "product_detail": {
      "width": 800,
      "height": 600,
      "crop": "fit",
      "gravity": "center",
      "description": "Product detail page image"
    }
  }
}
```

Then reference in layout `image_presets`:

```json
{
  "image_presets": {
    "product_image": {
      "contexts": {
        "card": "product_thumb",
        "full": "product_detail"
      },
      "default": "product_detail"
    }
  }
}
```

## Template Usage Examples

### Context-Specific Rendering

Images are automatically preprocessed for all contexts. The same template code works differently based on rendering context:

```handlebars
{{! In a collection listing partial (post-card context) }}
{{! Example: blog-listing/partials/post-card.hbs }}
<article class="border-b">
    {{#if this.frontmatter.featured_image}}
        <a href="{{getCollectionItemUrl this}}" class="block mb-4">
            {{{image fieldname="featured_image" alt=this.frontmatter.title class="w-full"}}}
            {{! ↑ Uses thumbnail preset automatically in card context }}
        </a>
    {{/if}}
</article>

{{! In a full post template (full context) }}
{{! Example: blog-post/index.hbs }}
<article>
    {{#if contentFile.frontmatter.featured_image}}
        <div class="mb-8">
            {{{image fieldname="featured_image" class="w-full" alt="Featured image"}}}
            {{! ↑ Uses page_display preset automatically in full context }}
        </div>
    {{/if}}
</article>
```

### Meta Tags

```handlebars
<head>
  <meta property="og:image" content="{{{image fieldname="featured_image" url_only=true}}}" />
  <meta name="twitter:image" content="{{{image fieldname="featured_image" url_only=true}}}" />
</head>
```

### Lazy Loading Control

```handlebars
{{! Disable lazy loading for above-the-fold images }}
{{{image fieldname="featured_image" lazy=false}}}

{{! Default behavior includes lazy loading }}
{{{image fieldname="featured_image"}}}
```

## Working Example: Blog Collection

### Layout Setup

**Individual Post Layout: `blog-post/layout.json`**
```json
{
  "name": "Blog post",
  "layoutType": "single",
  "schema": {
    "properties": {
      "featured_image": {
        "title": "Featured Image",
        "type": "string"
      },
      "banner_image": {
        "title": "Banner Image", 
        "type": "string"
      }
    }
  },
  "uiSchema": {
    "featured_image": {
      "ui:widget": "imageUploader"
    },
    "banner_image": {
      "ui:widget": "imageUploader"
    }
  },
  "image_presets": {
    "featured_image": {
      "contexts": {
        "card": "thumbnail",
        "list": "banner_small", 
        "full": "page_display"
      },
      "default": "page_display"
    },
    "banner_image": "hero"
  }
}
```

**Collection Page Layout: `blog-listing/layout.json`**
```json
{
  "name": "Blog listing",
  "layoutType": "collection",
  "displayTypes": {
    "post-card": {
      "partial": "post-card",
      "imageContext": "card",
      "description": "Compact cards with thumbnails"
    },
    "post-list": {
      "partial": "post-list",
      "imageContext": "list",
      "description": "List items with banner images"
    },
    "post-full": {
      "partial": "post-full",
      "imageContext": "full", 
      "description": "Complete posts with full content"
    }
  }
}
```

**Collection Page: `blog/index.md`**
```yaml
---
layout: blog-listing
layoutConfig:
  collectionId: blog
  displayType: post-card
---
```

### Automatic Processing Result

With this setup:

1. **Blog posts** (`content/blog/*.md`) with `featured_image` get:
   - **Card context** (`displayType: post-card`): `thumbnail` preset (300×200)
   - **List context** (`displayType: post-list`): `banner_small` preset (600×200)  
   - **Full context** (individual page view): `page_display` preset (600×400)

2. **Blog posts** with `banner_image` get:
   - **All contexts**: `hero` preset (1200×600) due to simple string configuration

3. **Template rendering**:
   - `blog-listing/partials/post-card.hbs` automatically shows thumbnails
   - `blog-listing/partials/post-list.hbs` automatically shows banner_small
   - `blog-post/index.hbs` automatically shows full-size images

## System Fallbacks

When configuration is missing, the system provides sensible defaults:

### 1. Context Fallbacks
- If specific context not found in `contexts`, uses `default` preset
- If no `default` specified, uses system fallback:
  - `full` context → `page_display` preset
  - Other contexts → `thumbnail` preset

### 2. Configuration Fallbacks
- If no `image_presets` in layout, uses system defaults
- If field not in `image_presets`, uses context-appropriate system preset
- If layout manifest missing or invalid, logs warning and uses defaults

### 3. Error Handling
- Invalid JSON in layout manifests: logs warning, continues with defaults
- Missing presets: logs warning, uses fallback presets
- Image processing errors: logs error, returns error comment in HTML

## Best Practices

### 1. Explicit Configuration
```json
// Good - clear and declarative
{
  "image_presets": {
    "featured_image": {
      "contexts": {
        "card": "thumbnail",
        "full": "page_display"
      },
      "default": "page_display"
    },
    "hero_image": "hero"
  }
}
```

### 2. Consistent Context Names
Use consistent context names across layouts:
- `card` for compact card views
- `list` for list item views  
- `grid` for grid layout views
- `full` for individual page views

### 3. Always Provide Defaults
```json
{
  "image_presets": {
    "featured_image": {
      "contexts": {
        "card": "thumbnail"
      },
      "default": "page_display"  // Always include default
    }
  }
}
```

### 4. Template Consistency
```handlebars
{{! Consistent pattern across all templates }}
{{{image fieldname="featured_image" class="content-image"}}}
{{{image fieldname="banner_image" class="hero-banner"}}}
```

## Troubleshooting

### Common Issues

**1. Image not appearing**
- Check that the field name matches exactly: `{{{image fieldname="featured_image"}}}`
- Verify the field exists in frontmatter and is a valid ImageRef object
- Check browser console for preprocessing errors during build

**2. Wrong image size**
- Check `image_presets` configuration in layout manifest
- Verify context mapping in collection layout's `displayTypes`
- Check that `imageContext` matches a context in the field's `contexts`

**3. Context not resolving**
- Ensure collection layouts define `displayTypes` with `imageContext`
- Check that `displayType` is set correctly in collection page frontmatter
- Verify template context (collection items vs individual pages)

### Debug Information

View preprocessing logs in browser console:
```
[ImagePreprocessor] Starting image preprocessing...
[ImagePreprocessor] Found X image references  
[ImagePreprocessor] Processed featured_image with preset 'thumbnail' (card) (300x200): /path/to/image
```

View processed image data in dev tools:
```javascript
// Access preprocessor instance
imagePreprocessor.getProcessedImages()
```

## Migration from Magic System

The old "smart convention" system has been completely removed. To migrate:

### 1. Remove Field Name Dependencies
Old system relied on field names like `hero_image`, `avatar_image`, etc. 
New system uses explicit configuration regardless of field names.

### 2. Add Explicit Presets
```json
// Replace magic field name detection with explicit config
{
  "image_presets": {
    "any_field_name": {
      "contexts": {
        "card": "thumbnail",
        "full": "page_display"  
      },
      "default": "page_display"
    }
  }
}
```

### 3. Update Context Detection
Old system detected context from `displayType` containing `card`.
New system uses explicit `imageContext` mapping in `displayTypes`.

## Technical Implementation

### Architecture Overview

1. **Preprocessing Phase** (during build):
   - Scans all content frontmatter for ImageRef objects
   - Reads layout manifests for `image_presets` configuration
   - Determines contexts from collection layouts' `displayTypes`  
   - Generates derivatives for each required context
   - Stores URLs in memory map with context-aware keys

2. **Template Rendering** (synchronous):
   - `image` helper detects current rendering context
   - Looks up context from `displayTypes` configuration
   - Retrieves preprocessed URL for field + context combination
   - Returns HTML `<img>` tag or URL for meta tags

3. **Declarative Resolution** (`imagePreprocessor.service.ts:292-316`):
   - Reads field configuration from layout `image_presets`
   - Resolves context-specific presets or defaults
   - No field name pattern matching

4. **Image Services** (`images.service.ts`):
   - Local file service for development
   - Cloudinary service for production  
   - Abstracted through common interface

### Key Files

- `src/config/editorConfig.ts` - Base preset definitions
- `src/core/services/images/imagePreprocessor.service.ts` - Main processing logic
- `src/core/services/renderer/helpers/image.helper.ts` - Template helper
- `src/core/types/index.ts` - ImageRef, ImagePreset, and DisplayTypeConfig types

## Summary

The declarative image preset system provides:

- **Explicit configuration** through layout manifests
- **Context-aware processing** with flexible context mapping
- **Build-time preprocessing** for optimal performance
- **Fallback systems** for missing configuration
- **Template simplicity** with unchanged syntax

Configure image presets explicitly in layout manifests, map display types to contexts, and let the system handle preprocessing automatically.