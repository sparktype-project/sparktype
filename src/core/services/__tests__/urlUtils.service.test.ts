/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { getUrlForNode, generatePreviewUrl, generateExportUrl, addPagination } from '../urlUtils.service';
import type { Manifest, StructureNode, CollectionItemRef } from '@/core/types';

describe('urlUtils.service', () => {
  // Helper function to create a mock manifest
  const createManifest = (structure: StructureNode[]): Manifest => ({
    siteId: 'test-site',
    generatorVersion: '1.0.0',
    title: 'Test Site',
    description: 'A test site',
    theme: {
      name: 'default',
      config: {}
    },
    structure
  });

  // Helper function to create mock nodes
  const createNode = (path: string, slug: string): StructureNode => ({
    type: 'page',
    title: path.replace('content/', '').replace('.md', ''),
    path,
    slug
  });

  // Sample structure for testing
  const sampleStructure: StructureNode[] = [
    createNode('content/home.md', 'home'),
    createNode('content/about.md', 'about'),
    createNode('content/blog.md', 'blog'),
    createNode('content/contact.md', 'contact')
  ];

  const manifest = createManifest(sampleStructure);

  describe('getUrlForNode', () => {
    describe('Homepage Detection', () => {
      test('identifies first node as homepage', () => {
        const homeNode = sampleStructure[0]; // content/home.md
        
        // Export mode
        expect(getUrlForNode(homeNode, manifest, true)).toBe('index.html');
        
        // Preview mode
        expect(getUrlForNode(homeNode, manifest, false)).toBe('');
      });

      test('does not treat other nodes as homepage', () => {
        const aboutNode = sampleStructure[1]; // content/about.md
        
        // Export mode
        expect(getUrlForNode(aboutNode, manifest, true)).toBe('about/index.html');
        
        // Preview mode
        expect(getUrlForNode(aboutNode, manifest, false)).toBe('about');
      });

      test('handles empty structure gracefully', () => {
        const emptyManifest = createManifest([]);
        const testNode = createNode('content/test.md', 'test');
        
        // Should not be treated as homepage since structure is empty
        expect(getUrlForNode(testNode, emptyManifest, true)).toBe('test/index.html');
        expect(getUrlForNode(testNode, emptyManifest, false)).toBe('test');
      });

      test('handles single node structure', () => {
        const singleNodeStructure = [createNode('content/only.md', 'only')];
        const singleNodeManifest = createManifest(singleNodeStructure);
        const onlyNode = singleNodeStructure[0];
        
        // Single node should be treated as homepage
        expect(getUrlForNode(onlyNode, singleNodeManifest, true)).toBe('index.html');
        expect(getUrlForNode(onlyNode, singleNodeManifest, false)).toBe('');
      });
    });

    describe('Export Mode URLs', () => {
      test('generates correct URLs for regular pages', () => {
        expect(getUrlForNode(sampleStructure[1], manifest, true)).toBe('about/index.html');
        expect(getUrlForNode(sampleStructure[2], manifest, true)).toBe('blog/index.html');
        expect(getUrlForNode(sampleStructure[3], manifest, true)).toBe('contact/index.html');
      });

      test('handles pages with complex slugs', () => {
        const complexNode = createNode('content/my-long-page-name.md', 'my-long-page-name');
        expect(getUrlForNode(complexNode, manifest, true)).toBe('my-long-page-name/index.html');
      });

      test('handles pages with nested slugs', () => {
        const nestedNode = createNode('content/blog/post1.md', 'blog/post1');
        expect(getUrlForNode(nestedNode, manifest, true)).toBe('blog/post1/index.html');
      });

      test('handles pages with special characters in slugs', () => {
        const specialNode = createNode('content/café-niño.md', 'cafe-nino');
        expect(getUrlForNode(specialNode, manifest, true)).toBe('cafe-nino/index.html');
      });
    });

    describe('Preview Mode URLs', () => {
      test('generates correct URLs for regular pages', () => {
        expect(getUrlForNode(sampleStructure[1], manifest, false)).toBe('about');
        expect(getUrlForNode(sampleStructure[2], manifest, false)).toBe('blog');
        expect(getUrlForNode(sampleStructure[3], manifest, false)).toBe('contact');
      });

      test('handles pages with complex slugs', () => {
        const complexNode = createNode('content/my-long-page-name.md', 'my-long-page-name');
        expect(getUrlForNode(complexNode, manifest, false)).toBe('my-long-page-name');
      });

      test('handles pages with nested slugs', () => {
        const nestedNode = createNode('content/blog/post1.md', 'blog/post1');
        expect(getUrlForNode(nestedNode, manifest, false)).toBe('blog/post1');
      });

      test('handles empty slug gracefully', () => {
        const emptySlugNode = createNode('content/empty.md', '');
        expect(getUrlForNode(emptySlugNode, manifest, false)).toBe('');
      });
    });

    describe('Pagination Support', () => {
      describe('Homepage Pagination', () => {
        test('handles homepage pagination in export mode', () => {
          const homeNode = sampleStructure[0];
          
          expect(getUrlForNode(homeNode, manifest, true, 1)).toBe('index.html');
          expect(getUrlForNode(homeNode, manifest, true, 2)).toBe('page/2/index.html');
          expect(getUrlForNode(homeNode, manifest, true, 3)).toBe('page/3/index.html');
          expect(getUrlForNode(homeNode, manifest, true, 10)).toBe('page/10/index.html');
        });

        test('handles homepage pagination in preview mode', () => {
          const homeNode = sampleStructure[0];
          
          expect(getUrlForNode(homeNode, manifest, false, 1)).toBe('');
          expect(getUrlForNode(homeNode, manifest, false, 2)).toBe('page/2');
          expect(getUrlForNode(homeNode, manifest, false, 3)).toBe('page/3');
          expect(getUrlForNode(homeNode, manifest, false, 10)).toBe('page/10');
        });

        test('handles edge cases for homepage pagination', () => {
          const homeNode = sampleStructure[0];
          
          // Page 0 should be treated as page 1
          expect(getUrlForNode(homeNode, manifest, true, 0)).toBe('index.html');
          expect(getUrlForNode(homeNode, manifest, false, 0)).toBe('');
          
          // Negative page numbers
          expect(getUrlForNode(homeNode, manifest, true, -1)).toBe('index.html');
          expect(getUrlForNode(homeNode, manifest, false, -1)).toBe('');
        });
      });

      describe('Regular Page Pagination', () => {
        test('handles regular page pagination in export mode', () => {
          const blogNode = sampleStructure[2]; // blog
          
          expect(getUrlForNode(blogNode, manifest, true, 1)).toBe('blog/index.html');
          expect(getUrlForNode(blogNode, manifest, true, 2)).toBe('blog/page/2/index.html');
          expect(getUrlForNode(blogNode, manifest, true, 3)).toBe('blog/page/3/index.html');
          expect(getUrlForNode(blogNode, manifest, true, 10)).toBe('blog/page/10/index.html');
        });

        test('handles regular page pagination in preview mode', () => {
          const blogNode = sampleStructure[2]; // blog
          
          expect(getUrlForNode(blogNode, manifest, false, 1)).toBe('blog');
          expect(getUrlForNode(blogNode, manifest, false, 2)).toBe('blog/page/2');
          expect(getUrlForNode(blogNode, manifest, false, 3)).toBe('blog/page/3');
          expect(getUrlForNode(blogNode, manifest, false, 10)).toBe('blog/page/10');
        });

        test('handles nested page pagination', () => {
          const nestedNode = createNode('content/blog/category.md', 'blog/category');
          
          expect(getUrlForNode(nestedNode, manifest, true, 1)).toBe('blog/category/index.html');
          expect(getUrlForNode(nestedNode, manifest, true, 2)).toBe('blog/category/page/2/index.html');
          
          expect(getUrlForNode(nestedNode, manifest, false, 1)).toBe('blog/category');
          expect(getUrlForNode(nestedNode, manifest, false, 2)).toBe('blog/category/page/2');
        });

        test('handles edge cases for regular page pagination', () => {
          const aboutNode = sampleStructure[1];
          
          // Page 0 and negative numbers should be treated as page 1
          expect(getUrlForNode(aboutNode, manifest, true, 0)).toBe('about/index.html');
          expect(getUrlForNode(aboutNode, manifest, false, 0)).toBe('about');
          
          expect(getUrlForNode(aboutNode, manifest, true, -5)).toBe('about/index.html');
          expect(getUrlForNode(aboutNode, manifest, false, -5)).toBe('about');
        });
      });

      test('handles undefined page number (should default to page 1)', () => {
        const homeNode = sampleStructure[0];
        const aboutNode = sampleStructure[1];
        
        expect(getUrlForNode(homeNode, manifest, true, undefined)).toBe('index.html');
        expect(getUrlForNode(homeNode, manifest, false, undefined)).toBe('');
        
        expect(getUrlForNode(aboutNode, manifest, true, undefined)).toBe('about/index.html');
        expect(getUrlForNode(aboutNode, manifest, false, undefined)).toBe('about');
      });
    });

    describe('Edge Cases and Validation', () => {
      test('handles nodes with different path formats', () => {
        const variations = [
          createNode('content/page.md', 'page'),
          createNode('content/section/page.md', 'section/page'),
          createNode('content/deep/nested/page.md', 'deep/nested/page')
        ];
        
        variations.forEach(node => {
          expect(getUrlForNode(node, manifest, true)).toBe(`${node.slug}/index.html`);
          expect(getUrlForNode(node, manifest, false)).toBe(node.slug);
        });
      });

      test('handles node with same path as homepage but different object', () => {
        const homeNode = sampleStructure[0];
        const duplicatePathNode = createNode(homeNode.path, homeNode.slug);
        
        // Should still be treated as homepage because path matches
        expect(getUrlForNode(duplicatePathNode, manifest, true)).toBe('index.html');
        expect(getUrlForNode(duplicatePathNode, manifest, false)).toBe('');
      });

      test('handles manifest with complex structure', () => {
        const complexStructure = [
          createNode('content/index.md', ''), // Empty slug homepage
          createNode('content/about/index.md', 'about'),
          createNode('content/blog/index.md', 'blog'),
          createNode('content/projects/web/index.md', 'projects/web')
        ];
        const complexManifest = createManifest(complexStructure);
        
        // First node should be homepage regardless of slug
        expect(getUrlForNode(complexStructure[0], complexManifest, true)).toBe('index.html');
        expect(getUrlForNode(complexStructure[0], complexManifest, false)).toBe('');
        
        // Other nodes should use their slugs
        expect(getUrlForNode(complexStructure[1], complexManifest, true)).toBe('about/index.html');
        expect(getUrlForNode(complexStructure[3], complexManifest, true)).toBe('projects/web/index.html');
      });

      test('preserves slug formatting', () => {
        const specialSlugs = [
          createNode('content/test.md', 'my-page'),
          createNode('content/test.md', 'my_page'),
          createNode('content/test.md', 'mypage'),
          createNode('content/test.md', 'my-page-123'),
          createNode('content/test.md', 'blog/2024/post')
        ];
        
        specialSlugs.forEach(node => {
          expect(getUrlForNode(node, manifest, true)).toBe(`${node.slug}/index.html`);
          expect(getUrlForNode(node, manifest, false)).toBe(node.slug);
        });
      });

      test('handles very long page numbers', () => {
        const aboutNode = sampleStructure[1];
        const largePage = 9999;
        
        expect(getUrlForNode(aboutNode, manifest, true, largePage)).toBe(`about/page/${largePage}/index.html`);
        expect(getUrlForNode(aboutNode, manifest, false, largePage)).toBe(`about/page/${largePage}`);
      });

      test('maintains consistent behavior across different node properties', () => {
        const nodeWithExtraProps: StructureNode = {
          type: 'page',
          title: 'Special Page',
          path: 'content/special.md',
          slug: 'special',
          menuTitle: 'Special Menu',
          navOrder: 5,
          customProperty: 'custom value'
        };
        
        expect(getUrlForNode(nodeWithExtraProps, manifest, true)).toBe('special/index.html');
        expect(getUrlForNode(nodeWithExtraProps, manifest, false)).toBe('special');
        expect(getUrlForNode(nodeWithExtraProps, manifest, true, 2)).toBe('special/page/2/index.html');
      });
    });

    describe('Performance and Consistency', () => {
      test('performs consistently with large structures', () => {
        const largeStructure = Array.from({ length: 1000 }, (_, i) =>
          createNode(`content/page${i}.md`, `page${i}`)
        );
        const largeManifest = createManifest(largeStructure);
        
        const start = performance.now();
        
        // Test first node (homepage)
        expect(getUrlForNode(largeStructure[0], largeManifest, true)).toBe('index.html');
        
        // Test random nodes
        expect(getUrlForNode(largeStructure[500], largeManifest, true)).toBe('page500/index.html');
        expect(getUrlForNode(largeStructure[999], largeManifest, true)).toBe('page999/index.html');
        
        const end = performance.now();
        expect(end - start).toBeLessThan(10); // Should be very fast
      });

      test('maintains referential transparency (pure function)', () => {
        const testNode = sampleStructure[1];
        
        // Multiple calls with same inputs should return same results
        const result1 = getUrlForNode(testNode, manifest, true, 2);
        const result2 = getUrlForNode(testNode, manifest, true, 2);
        const result3 = getUrlForNode(testNode, manifest, true, 2);
        
        expect(result1).toBe(result2);
        expect(result2).toBe(result3);
        expect(result1).toBe('about/page/2/index.html');
      });

      test('does not mutate input objects', () => {
        const originalNode = { ...sampleStructure[1] };
        const originalManifest = { ...manifest };
        
        getUrlForNode(sampleStructure[1], manifest, true, 5);
        
        expect(sampleStructure[1]).toEqual(originalNode);
        expect(manifest.siteId).toBe(originalManifest.siteId);
        expect(manifest.structure.length).toBe(originalManifest.structure.length);
      });
    });
  });

  describe('Simplified URL Functions', () => {
    const siteId = 'test-site-123';
    const homepageFile = { path: 'content/home.md', frontmatter: { homepage: true } };
    const siteDataWithHomepage = { contentFiles: [homepageFile] };

    describe('addPagination', () => {
      test('handles homepage pagination', () => {
        expect(addPagination('', 1, false)).toBe('');
        expect(addPagination('', 2, false)).toBe('page/2');
        expect(addPagination('', 3, true)).toBe('page/3/index.html');
      });

      test('handles regular page pagination', () => {
        expect(addPagination('blog', 1, false)).toBe('blog');
        expect(addPagination('blog', 2, false)).toBe('blog/page/2');
        expect(addPagination('blog', 3, true)).toBe('blog/page/3/index.html');
      });

      test('handles edge cases', () => {
        expect(addPagination('about', 0, false)).toBe('about');
        expect(addPagination('about', -1, false)).toBe('about');
        expect(addPagination('about', undefined, false)).toBe('about');
      });
    });

    describe('generatePreviewUrl', () => {
      test('generates correct preview URLs for homepage', () => {
        const homeNode = sampleStructure[0];

        expect(generatePreviewUrl(homeNode, manifest, siteId, undefined, siteDataWithHomepage))
          .toBe(`#/sites/${siteId}/view`);
      });

      test('generates correct preview URLs for regular pages', () => {
        const aboutNode = sampleStructure[1]; // about

        expect(generatePreviewUrl(aboutNode, manifest, siteId))
          .toBe(`#/sites/${siteId}/view/about`);
      });

      test('generates correct preview URLs with pagination', () => {
        const blogNode = sampleStructure[2]; // blog

        expect(generatePreviewUrl(blogNode, manifest, siteId, 2))
          .toBe(`#/sites/${siteId}/view/blog/page/2`);
      });

      test('handles collection items', () => {
        const collectionItem: CollectionItemRef = {
          collectionId: 'blog',
          slug: 'my-post',
          path: 'content/blog/my-post.md',
          title: 'My Post',
          url: ''
        };

        expect(generatePreviewUrl(collectionItem, manifest, siteId))
          .toBe(`#/sites/${siteId}/view/blog/my-post`);
      });
    });

    describe('generateExportUrl', () => {
      test('generates correct export URLs for homepage', () => {
        const homeNode = sampleStructure[0];

        expect(generateExportUrl(homeNode, manifest, undefined, siteDataWithHomepage))
          .toBe('');
        expect(generateExportUrl(homeNode, manifest, undefined, siteDataWithHomepage, undefined, true))
          .toBe('index.html');
      });

      test('generates correct export URLs for regular pages', () => {
        const aboutNode = sampleStructure[1];

        expect(generateExportUrl(aboutNode, manifest))
          .toBe('about');
        expect(generateExportUrl(aboutNode, manifest, undefined, undefined, undefined, true))
          .toBe('about/index.html');
      });

      test('generates correct export URLs with pagination', () => {
        const blogNode = sampleStructure[2];

        expect(generateExportUrl(blogNode, manifest, 2))
          .toBe('blog/page/2');
        expect(generateExportUrl(blogNode, manifest, 2, undefined, undefined, true))
          .toBe('blog/page/2/index.html');
      });

      test('handles collection items', () => {
        const collectionItem: CollectionItemRef = {
          collectionId: 'blog',
          slug: 'my-post',
          path: 'content/blog/my-post.md',
          title: 'My Post',
          url: ''
        };

        expect(generateExportUrl(collectionItem, manifest))
          .toBe('blog/my-post');
        expect(generateExportUrl(collectionItem, manifest, undefined, undefined, undefined, true))
          .toBe('blog/my-post/index.html');
      });

      test('generates relative paths when currentPagePath is provided', () => {
        const aboutNode = sampleStructure[1];
        const currentPath = 'blog/index.html';

        const relativePath = generateExportUrl(aboutNode, manifest, undefined, undefined, currentPath);
        expect(relativePath).toBe('../about');
      });
    });

    describe('Cross-context consistency', () => {
      test('preview and export URLs should be consistent for same content', () => {
        const aboutNode = sampleStructure[1];

        const previewUrl = generatePreviewUrl(aboutNode, manifest, siteId);
        const exportUrl = generateExportUrl(aboutNode, manifest);

        // Extract path from preview URL
        const previewPath = previewUrl.replace(`#/sites/${siteId}/view/`, '');

        expect(previewPath).toBe(exportUrl);
      });

      test('homepage handling is consistent', () => {
        const homeNode = sampleStructure[0];

        const previewUrl = generatePreviewUrl(homeNode, manifest, siteId, undefined, siteDataWithHomepage);
        const exportUrl = generateExportUrl(homeNode, manifest, undefined, siteDataWithHomepage);

        expect(previewUrl).toBe(`#/sites/${siteId}/view`);
        expect(exportUrl).toBe('');
      });
    });

    describe('Legacy compatibility', () => {
      test('getUrlForNode still works for existing code', () => {
        const aboutNode = sampleStructure[1];

        // Export mode
        expect(getUrlForNode(aboutNode, manifest, true)).toBe('about/index.html');

        // Preview mode
        expect(getUrlForNode(aboutNode, manifest, false)).toBe('about');
      });
    });
  });
});