# SparkBlock Editor Test Scenarios

## Test Cases to Verify

### 1. Basic Block Creation
- [ ] Type text and press Enter → Creates paragraph block
- [ ] Type `## Hello` and press Enter → Creates H2 block with "Hello"
- [ ] Type `- Item` and press Enter → Creates list block

### 2. Block Type Conversion  
- [ ] Edit paragraph, add `##` → Converts to H2
- [ ] Edit H2, remove `##` → Reverts to paragraph
- [ ] Edit paragraph, add `>` → Converts to quote
- [ ] Edit quote, remove `>` → Reverts to paragraph

### 3. Content Persistence
- [ ] Type content in H2, press Enter → Content is saved
- [ ] Edit existing block, change text → Changes persist
- [ ] Convert block type → Original content preserved

### 4. Race Condition Tests
- [ ] Rapid typing and Enter → No content loss
- [ ] Quick block type changes → No block disappearance
- [ ] Multiple simultaneous edits → State remains consistent

### 5. Edge Cases
- [ ] Empty block handling
- [ ] Special characters in content
- [ ] Very long content
- [ ] Rapid block creation/deletion

## Debugging Steps

1. **Open browser console** to see detailed logs
2. **Watch debug panel** for real-time state
3. **Check log patterns** for race conditions:
   - 🔄 Parse markdown triggered
   - ⏸️ Skipping parse (good)
   - 💾 updateMarkdown called
   - 🔧 updateBlock called
   - 🔀 Block conversion

## Expected Log Flow for Successful Edit

1. ✏️ Starting edit mode
2. 🔀 Block conversion in handleSave
3. 💾 Calling onUpdate with content
4. 🔧 updateBlock called
5. 💾 updateMarkdown: serialized and calling onChange
6. ⏸️ Skipping parse - update in progress or saving
7. 🚪 Calling onBlur to exit edit mode

## Red Flags (Indicates Race Condition)

- ❌ Parse happening immediately after updateMarkdown
- ❌ Block count changing unexpectedly  
- ❌ Content object showing old values
- ❌ Multiple parse triggers in quick succession