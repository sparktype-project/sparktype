# Image Context Detection System

## Overview

The Sparktype image system uses context detection to automatically select appropriate image presets based on where and how images are being rendered. This eliminates the need for manual preset specification in most cases.

## Context Types

### 1. Listing Context
**When:** Images appear in collection listings (cards, grids, lists)
**Preset:** Uses `thumbnail` (300×200) or smart convention presets
**Template Examples:**
- `blog-listing/partials/post-card.hbs` 
- `portfolio-grid/partials/project-card.hbs`

### 2. Full Context  
**When:** Images appear on individual content pages
**Preset:** Uses `page_display` (600×400) or smart convention presets
**Template Examples:**
- `blog-post/index.hbs`
- `portfolio-project/index.hbs`
- `page/index.hbs`

### 3. Undefined Context
**When:** Context cannot be determined
**Fallback:** Preprocessor uses first available processed URL

## Detection Logic

### Template Context Analysis

The image helper analyzes the Handlebars template context to determine how to render images:

```javascript
// Collection item context: this.path exists (item being rendered by collection page)
if (this?.path && rootContext.layoutConfig) {
  const displayType = rootContext.layoutConfig.displayType;
  
  // Listing context: collection items rendered in card/grid/list views
  if (displayType === 'post-card' || 
      displayType === 'project-card' || 
      displayType?.includes('card')) {
    context = 'listing';
  }
  // Full context: collection items rendered in full view
  else if (displayType === 'post-full' || displayType?.includes('full')) {
    context = 'full';
  }
  // Default to listing for collection rendering
  else {
    context = 'listing';
  }
}
// Individual page context: rootContext.contentFile exists, no this.path
else if (rootContext.contentFile && !this?.path) {
  context = 'full';
}
```

### Context Indicators

| Template Context | `this.path` | `rootContext.layoutConfig` | `displayType` | Detected Context |
|------------------|-------------|----------------------------|---------------|------------------|
| Collection card | ✅ (item path) | ✅ (layout config) | `post-card` | `listing` |
| Collection full | ✅ (item path) | ✅ (layout config) | `post-full` | `full` |
| Individual page | ❌ | ❌ | ❌ | `full` |
| Unknown | varies | varies | ❌ | `undefined` |

## Real-World Examples

### Blog Collection Rendering

**Collection Page:** `content/blog/index.md`
```yaml
---
layout: blog-listing
layoutConfig:
  collectionId: blog
  displayType: post-card  # ← This determines context
---
```

**Collection Template:** `blog-listing/index.hbs`
```handlebars
{{#each collectionItems}}
  {{! this.path = "content/blog/my-post.md" }}
  {{! rootContext.layoutConfig.displayType = "post-card" }}
  {{> blog-listing/partials/post-card this}}
{{/each}}
```

**Card Partial:** `blog-listing/partials/post-card.hbs`
```handlebars
{{! Context Detection Result: }}
{{! - this.path exists (collection item) }}
{{! - rootContext.layoutConfig.displayType = "post-card" }}
{{! - displayType.includes('card') = true }}
{{! → context = 'listing' → uses thumbnail preset }}

{{{image fieldname="featured_image" class="w-full"}}}
```

**Individual Post:** `blog-post/index.hbs`
```handlebars
{{! Context Detection Result: }}
{{! - this.path = undefined (not collection item) }}
{{! - rootContext.contentFile exists (individual page) }}
{{! → context = 'full' → uses page_display preset }}

{{{image fieldname="featured_image" class="w-full"}}}
```

### Portfolio Collection Rendering

**Collection Page:** `content/portfolio/index.md`
```yaml
---
layout: portfolio-grid
layoutConfig:
  collectionId: portfolio
  displayType: project-card
---
```

**Grid Template:** `portfolio-grid/index.hbs`
```handlebars
{{#each collectionItems}}
  {{! Context: listing (project-card) }}
  {{> portfolio-grid/partials/project-card this}}
{{/each}}
```

## Preprocessing vs Runtime Detection

### During Build (Preprocessing)

The `ImagePreprocessorService` determines which contexts each image needs:

1. **Scans content** for image references in frontmatter
2. **Identifies collection items** (content that can be rendered by collection pages)
3. **Generates multiple presets** for collection items:
   - Listing context preset (e.g., `thumbnail`)
   - Full context preset (e.g., `page_display`)
4. **Stores processed URLs** with context keys:
   - `listing_context` → thumbnail URL
   - `full_context` → page_display URL

### During Template Rendering (Runtime)

The `image` helper uses context detection to select the right preprocessed URL:

1. **Analyzes template context** to determine listing vs full
2. **Looks up preprocessed URL** using detected context
3. **Returns appropriate image** without async operations

## Advanced Context Detection

### Display Type Patterns

The system recognizes these `displayType` patterns:

```javascript
// Listing context triggers
displayType === 'post-card'      // Exact match
displayType === 'project-card'   // Exact match  
displayType?.includes('card')    // Pattern match

// Full context triggers  
displayType === 'post-full'      // Exact match
displayType?.includes('full')    // Pattern match

// Default behavior
// Any other displayType in collection context → listing
// No collection context → full
```

### Smart Convention Override

Field names can override context-based detection:

```javascript
// These always use specific presets regardless of context:
'hero_image'    → 'hero' preset (1200×600)
'avatar_image'  → 'avatar' preset (150×150)  
'gallery_photo' → 'gallery' preset (400×400)
'og_image'      → 'social' preset (1200×630)

// These respect context detection:
'featured_image' → 'thumbnail' (listing) or 'page_display' (full)
'main_image'     → 'thumbnail' (listing) or 'page_display' (full)
```

## Debugging Context Detection

### Console Logging

Enable debug logs to see context detection in action:

```javascript
// In image.helper.ts, context detection logs:
console.log(`[ImageHelper] Context detected: ${context} for ${fieldName}`);
console.log(`[ImageHelper] Template context:`, {
  'this.path': this?.path,
  'layoutConfig': rootContext.layoutConfig,
  'displayType': rootContext.layoutConfig?.displayType
});
```

### Preprocessor Debugging

View what contexts were preprocessed:

```javascript
// In browser dev tools:
imagePreprocessor.getProcessedImages()

// Example output:
Map {
  "content/blog/my-post.md" => {
    "featured_image": {
      "listing_context": "/images/thumb_123.jpg",
      "full_context": "/images/page_123.jpg"
    }
  }
}
```

### Template Context Inspection

Add temporary debug output to templates:

```handlebars
{{! Debug: Current template context }}
<!-- Debug: this.path = {{this.path}} -->
<!-- Debug: displayType = {{../contentFile.frontmatter.layoutConfig.displayType}} -->
<!-- Debug: contentFile.path = {{contentFile.path}} -->

{{{image fieldname="featured_image"}}}
```

## Common Issues and Solutions

### Issue: Wrong image size in collection
**Cause:** `displayType` doesn't match expected patterns
**Solution:** Use recognized values like `post-card`, `project-card`, or ensure `displayType` contains `card`

### Issue: Images not appearing
**Cause:** Context mismatch between preprocessing and runtime
**Solution:** Check that content is properly identified as collection item during preprocessing

### Issue: Same image everywhere
**Cause:** Context detection failing, falling back to first available URL
**Solution:** Verify template context setup and `layoutConfig` presence

## Summary

Context detection automatically selects appropriate image presets by:

1. **Analyzing template context** to understand rendering situation
2. **Using displayType patterns** to detect listing vs full contexts  
3. **Applying smart conventions** for special field names
4. **Looking up preprocessed URLs** that match the detected context

This system eliminates manual preset configuration while ensuring optimal image sizes for each rendering context.