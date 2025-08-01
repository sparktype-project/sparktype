// Test stable ID generation
const content1 = `# Test Heading

This is a paragraph.

::collection_view{title="Test" collectionId="blog"}`;

const content2 = `# Test Heading

This is a paragraph.

::collection_view{title="Test" collectionId="blog"}`;

console.log('Testing stable ID generation...');
console.log('Content 1 and 2 are identical:', content1 === content2);

// Simulate hash function
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

const hash1 = simpleHash(JSON.stringify({ type: 'core:heading_1', content: { text: 'Test Heading' }, config: {} }));
const hash2 = simpleHash(JSON.stringify({ type: 'core:heading_1', content: { text: 'Test Heading' }, config: {} }));

console.log('Hash 1:', hash1);
console.log('Hash 2:', hash2);
console.log('Hashes are identical:', hash1 === hash2);

const hash3 = simpleHash(JSON.stringify({ type: 'core:heading_1', content: { text: 'Different Heading' }, config: {} }));
console.log('Hash 3 (different content):', hash3);
console.log('Hash 1 and 3 are different:', hash1 !== hash3);