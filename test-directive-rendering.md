# Testing Directive Rendering

## What should happen now:

1. **File Saving**: When SparkBlock editor saves content with directives like `::collection_view{...}`, the `saveContentFile` function now:
   - Uses `parseMarkdownStringAsync` with directive support
   - Detects directive syntax using regex `/::[\w-]+(?:\{[^}]*\})?/`
   - Calls `DirectiveParser` to parse directives into blocks
   - Sets `hasBlocks: true` on the saved file

2. **Preview/Render**: When rendering pages, the render service now:
   - First checks if `contentFile.hasBlocks && contentFile.blocks` (parsed blocks)
   - If not, checks for directive syntax in content using same regex
   - If directives found, parses them on-the-fly and renders using `DirectiveRenderHelper`
   - Uses the new `ModularRenderHelper` for component-based rendering

3. **Modular Rendering**: Custom blocks are now rendered using:
   - `TextRenderer` for text content
   - `ImageRenderer` for images  
   - `CollectionRenderer` for collection views
   - `RegionRenderer` for nested regions
   - Components can be mixed and matched based on block manifest

## Test Case:
```
::collection_view{collectionId="blog" layout="list" maxItems="5" sortBy="date" sortOrder="desc"}
```

Should now render as actual collection content instead of literal text.

## Flow:
1. User types directive in SparkBlock editor
2. Editor saves content → `saveContentFile` → `parseMarkdownStringAsync` with directive support
3. File saved with `hasBlocks: true` and parsed blocks
4. On preview → `render.service.ts` → `preRenderBlocks` → `DirectiveRenderHelper` → `ModularRenderHelper`
5. Collection renderer fetches data and generates HTML