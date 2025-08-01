Example of how the modular rendering system works:

## Traditional Block-Specific Approach (OLD)
```typescript
// Before: Each block type needed its own specific renderer
switch (blockType) {
  case 'collection_view':
    return renderCollectionView(block, siteData);
  case 'image_gallery':
    return renderImageGallery(block, siteData);
  case 'featured_content':
    return renderFeaturedContent(block, siteData);
}
```

## New Modular Component Approach

Instead of creating block-specific renderers, custom blocks are now composed of modular functions that the renderer can handle generically:

### Block Manifest Example
```json
{
  "id": "custom:featured_articles",
  "name": "Featured Articles",
  "components": [
    {
      "type": "text",
      "config": {
        "format": "markdown"
      }
    },
    {
      "type": "collection",
      "config": {
        "layout": "cards",
        "maxItems": 3
      }
    }
  ],
  "fields": {
    "title": {
      "type": "text",
      "label": "Section Title"
    }
  },
  "config": {
    "collectionId": {
      "type": "select",
      "label": "Collection"
    },
    "layout": {
      "type": "select",
      "options": ["list", "grid", "cards"],
      "default": "cards"
    }
  }
}
```

### Rendering Process
1. **ModularRenderHelper** receives the block
2. Checks if block has custom template → loads and renders with Handlebars
3. If no template, uses **component-based rendering**:
   - Looks at `components` array in manifest
   - For each component, calls the appropriate modular renderer:
     - `TextRenderer` - handles text content with various formats
     - `ImageRenderer` - handles image display with captions
     - `CollectionRenderer` - handles collection data with sorting/layout
     - `RegionRenderer` - handles nested block regions

### Benefits
- **Reusable**: Same components work across different custom blocks
- **Composable**: Mix and match components (text + collection, image + region, etc.)
- **Maintainable**: One implementation per component type, not per block type
- **Extensible**: Add new component types that work with all blocks

### Example Custom Block Usage
```markdown
::featured_articles{title="Latest News" collectionId="news" layout="cards" maxItems="3"}
```

This would render:
1. A text component showing "Latest News" title
2. A collection component showing 3 news items in card layout
3. All without needing a custom block-specific renderer