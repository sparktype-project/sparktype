# SparkBlock Editor Behavior Test

## Expected User Flows

### 1. Basic Typing Flow
**User action:** Types "Hello world" and presses Enter
**Expected result:** 
- Creates a paragraph block with "Hello world"
- New empty input appears below for next block

### 2. Markdown Auto-formatting
**User action:** Types "## My Heading" and presses Enter
**Expected result:**
- Creates a heading_2 block with "My Heading" 
- Block displays as proper H2 styling
- New empty input appears below

**Other examples:**
- `# Title` → heading_1 block
- `### Subtitle` → heading_3 block  
- `> Quote text` → quote block
- `- List item` → unordered_list block
- `1. Item` → ordered_list block

### 3. Plus Button Block Creation
**User action:** Clicks + button on existing block, selects "Heading 2"
**Expected result:**
- New heading_2 block created directly below clicked block
- Block is in edit mode ready for typing
- User can immediately type the heading text

### 4. Custom Block Display
**User action:** Has a Collection View block with configured settings
**Expected result (closed state):**
```
⚙️ Collection View
Title: Recent Posts  
Collection: posts
Layout: list
Max Items: 5
```

**User action:** Clicks on the Collection View block
**Expected result:**
- Form opens with all settings (Title, Collection, Layout, Max Items, Sort By, Sort Order)
- Form has Save and Cancel buttons
- Form stays open until user clicks Save or Cancel

### 5. Block Selection and Editing
**User action:** Clicks on existing paragraph block
**Expected result:**
- Block becomes editable (contentEditable=true)
- User can modify text inline
- Changes save automatically on blur

## Technical Implementation

### Block Creation Flow
1. User types markdown syntax
2. `handleKeyDown` detects Enter key
3. `adapter.parse(currentInput)` determines block type
4. Creates SparkBlock with correct type and content
5. Adds to blocks array and updates markdown

### Block Rendering Flow  
1. `SimpleBlockRenderer` receives SparkBlock
2. If custom block: shows `renderCustomBlockSummary()`
3. If core block: uses `DefaultBlockRenderers[blockType]`
4. Renders with proper context for editing/display

### Form Editing Flow
1. User clicks custom block
2. `handleBlockClick` sets `editingBlockId`
3. `renderContent()` shows schema-driven form
4. User makes changes, form updates `formData` state
5. User clicks Save: `handleSave` serializes and saves
6. User clicks Cancel: `handleCancel` reverts changes