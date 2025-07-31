// New directive syntax examples
const newDirectiveSyntax = `
# Heading

This is a paragraph with **bold** and *italic* text.

::image{src="assets/images/sunset.jpg" alt="A beautiful sunset" alignment="center" size="large"}

Another paragraph here.

::container{layout="two-columns" gap="medium"}
Left column content here.

---

Right column content here.
::

::collection_view{collectionId="blog" layout="cards" maxItems=3}

> This is a quote block

- List item 1
- List item 2
- List item 3
`;

console.log("New directive syntax:");
console.log(newDirectiveSyntax);