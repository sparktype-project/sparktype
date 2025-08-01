// Test unique ID generation with block index
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// Test blocks with similar content
const blocks = [
  { type: 'core:paragraph', content: { text: '' }, config: {}, index: 0 },
  { type: 'core:paragraph', content: { text: '' }, config: {}, index: 1 },
  { type: 'core:paragraph', content: { text: 'hello' }, config: {}, index: 2 },
  { type: 'core:paragraph', content: { text: 'hello' }, config: {}, index: 3 },
  { type: 'core:heading_3', content: { text: '' }, config: {}, index: 4 },
];

console.log('Testing unique ID generation with block index:');
const ids = blocks.map((block, i) => {
  const contentStr = JSON.stringify(block);
  const hash = simpleHash(contentStr);
  const id = `block_${hash}`;
  console.log(`Block ${i}: ${id} (content: ${JSON.stringify(block.content)})`);
  return id;
});

const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
console.log('\nDuplicates:', duplicates.length > 0 ? duplicates : 'none');
console.log('All unique:', new Set(ids).size === ids.length);