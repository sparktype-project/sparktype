/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { parseMarkdownString, stringifyToMarkdown, parseAndRenderMarkdown } from '../markdownParser';
import { MarkdownFrontmatter } from '@/core/types';

describe('markdownParser', () => {
  describe('parseMarkdownString', () => {
    test('parses markdown with valid frontmatter', () => {
      const input = `---
title: Test Post
date: 2024-01-01
tags: [test, markdown]
---

# Hello World

This is a test post.`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe('Test Post');
      expect(result.frontmatter.date).toEqual(new Date('2024-01-01'));
      expect(result.frontmatter.tags).toEqual(['test', 'markdown']);
      expect(result.content).toBe('# Hello World\n\nThis is a test post.');
    });

    test('handles markdown without frontmatter', () => {
      const input = `# Just Markdown

No frontmatter here.`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe('Untitled');
      expect(result.content).toBe('# Just Markdown\n\nNo frontmatter here.');
    });

    test('provides default title when missing', () => {
      const input = `---
date: 2024-01-01
---

Content without title.`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe('Untitled');
      expect(result.frontmatter.date).toEqual(new Date('2024-01-01'));
    });

    test('handles non-string title', () => {
      const input = `---
title: 123
---

Content with numeric title.`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe('Untitled');
    });

    test('trims content whitespace', () => {
      const input = `---
title: Test
---


  # Content with extra whitespace  


`;

      const result = parseMarkdownString(input);
      
      expect(result.content).toBe('# Content with extra whitespace');
    });

    test('throws error for invalid YAML frontmatter', () => {
      const input = `---
title: "Unclosed quote
date: invalid-yaml
---

Content`;

      expect(() => parseMarkdownString(input)).toThrow('Invalid YAML frontmatter format');
    });

    test('handles empty frontmatter', () => {
      const input = `---
---

Just content.`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe('Untitled');
      expect(result.content).toBe('Just content.');
    });

    test('handles complex frontmatter data types', () => {
      const input = `---
title: Complex Post
published: true
priority: 5
tags:
  - web
  - development
author:
  name: John Doe
  email: john@example.com
---

Complex frontmatter content.`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe('Complex Post');
      expect(result.frontmatter.published).toBe(true);
      expect(result.frontmatter.priority).toBe(5);
      expect(result.frontmatter.tags).toEqual(['web', 'development']);
      expect(result.frontmatter.author).toEqual({
        name: 'John Doe',
        email: 'john@example.com'
      });
    });

    test('handles malformed frontmatter delimiters', () => {
      const input = `--
title: Test
--

Content`;

      const result = parseMarkdownString(input);
      
      // Should treat the whole thing as content since delimiters are wrong
      expect(result.frontmatter.title).toBe('Untitled');
      expect(result.content).toContain('--\ntitle: Test\n--\n\nContent');
    });

    test('handles frontmatter with tabs and mixed indentation', () => {
      const input = `---
title: Test With Tabs
date: 2024-01-01
tags:
  - mixed
  - indentation
---

Content with tabs.`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe('Test With Tabs');
      expect(result.frontmatter.date).toEqual(new Date('2024-01-01'));
      expect(result.frontmatter.tags).toEqual(['mixed', 'indentation']);
    });

    test('handles frontmatter with Unicode characters', () => {
      const input = `---
title: "Tëst Pøst with 中文 and 🚀"
author: "Jürgen Müller"
tags: [中文, "русский", "العربية"]
---

# Content with émojis 🎉

Some Unicode content: café, naïve, résumé.`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe('Tëst Pøst with 中文 and 🚀');
      expect(result.frontmatter.author).toBe('Jürgen Müller');
      expect(result.frontmatter.tags).toEqual(['中文', 'русский', 'العربية']);
      expect(result.content).toContain('émojis 🎉');
      expect(result.content).toContain('café, naïve, résumé');
    });

    test('handles extremely long frontmatter values', () => {
      const longString = 'a'.repeat(10000);
      const input = `---
title: ${longString}
description: Short description
---

Content here.`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe(longString);
      expect(result.frontmatter.description).toBe('Short description');
      expect(result.content).toBe('Content here.');
    });

    test('handles YAML with special characters and escaping', () => {
      const input = `---
title: "Quote test: \\"nested quotes\\" work"
path: "C:\\\\Windows\\\\path"
regex: "/test[a-z]+\\\\d{3}/"
multiline: |
  Line 1
  Line 2 with "quotes"
  Line 3
---

Content with special chars.`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe('Quote test: "nested quotes" work');
      expect(result.frontmatter.path).toBe('C:\\Windows\\path');
      expect(result.frontmatter.regex).toBe('/test[a-z]+\\d{3}/');
      expect(result.frontmatter.multiline).toContain('Line 1\nLine 2 with "quotes"\nLine 3');
    });

    test('handles YAML parsing edge cases', () => {
      const input = `---
boolean_true: true
boolean_false: false
number_int: 42
number_float: 3.14
null_value: null
empty_string: ""
zero: 0
negative: -5
scientific: 1.23e-4
---

Edge case content.`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.boolean_true).toBe(true);
      expect(result.frontmatter.boolean_false).toBe(false);
      expect(result.frontmatter.number_int).toBe(42);
      expect(result.frontmatter.number_float).toBe(3.14);
      expect(result.frontmatter.null_value).toBe(null);
      expect(result.frontmatter.empty_string).toBe('');
      expect(result.frontmatter.zero).toBe(0);
      expect(result.frontmatter.negative).toBe(-5);
      expect(result.frontmatter.scientific).toBe(1.23e-4);
    });

    test('handles frontmatter only (no content)', () => {
      const input = `---
title: Frontmatter Only
date: 2024-01-01
---`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe('Frontmatter Only');
      expect(result.frontmatter.date).toEqual(new Date('2024-01-01'));
      expect(result.content).toBe('');
    });

    test('handles content only (no frontmatter markers)', () => {
      const input = `This is just plain content
with multiple lines
and no frontmatter at all.

Even with line breaks.`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe('Untitled');
      expect(result.content).toBe(input);
    });

    test('handles multiple frontmatter delimiter attempts', () => {
      const input = `---
title: First
---

Some content

---
title: Second
---

More content`;

      const result = parseMarkdownString(input);
      
      // Should only parse the first frontmatter block
      expect(result.frontmatter.title).toBe('First');
      expect(result.content).toContain('Some content\n\n---\ntitle: Second\n---\n\nMore content');
    });

    test('handles YAML with deeply nested objects', () => {
      const input = `---
title: Deep Nesting
config:
  level1:
    level2:
      level3:
        deep_value: "found it"
        array_deep:
          - item1
          - nested_item: true
---

Deep content.`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe('Deep Nesting');
      const config = result.frontmatter.config as Record<string, unknown>;
      const level1 = config.level1 as Record<string, unknown>;
      const level2 = level1.level2 as Record<string, unknown>;
      const level3 = level2.level3 as Record<string, unknown>;
      expect(level3.deep_value).toBe('found it');
      expect((level3.array_deep as unknown[])[0]).toBe('item1');
      expect((level3.array_deep as unknown[])[1]).toEqual({ nested_item: true });
    });
  });

  describe('stringifyToMarkdown', () => {
    test('converts frontmatter and content to markdown string', () => {
      const frontmatter: MarkdownFrontmatter = {
        title: 'Test Post',
        layout: 'post',
        date: '2024-01-01',
        tags: ['test', 'markdown']
      };
      const content = '# Hello World\n\nThis is a test.';

      const result = stringifyToMarkdown(frontmatter, content);
      
      expect(result).toContain('---\n');
      expect(result).toContain('title: Test Post');
      expect(result).toContain('layout: post');
      expect(result).toContain('date: \'2024-01-01\'');
      expect(result).toContain('tags:\n  - test\n  - markdown');
      expect(result).toContain('---\n\n# Hello World\n\nThis is a test.');
    });

    test('handles empty frontmatter', () => {
      const content = 'Just content.';

      // Clear all properties except title to simulate empty frontmatter
      const emptyFrontmatter = { title: undefined } as any;
      
      const result = stringifyToMarkdown(emptyFrontmatter, content);
      
      expect(result).toBe('Just content.');
      expect(result).not.toContain('---');
    });

    test('filters out null and undefined values', () => {
      const frontmatter: MarkdownFrontmatter = {
        title: 'Test Post',
        layout: 'post',
        date: undefined as any,
        tags: null as any,
        published: true
      };
      const content = 'Content here.';

      const result = stringifyToMarkdown(frontmatter, content);
      
      expect(result).toContain('title: Test Post');
      expect(result).toContain('published: true');
      expect(result).not.toContain('date:');
      expect(result).not.toContain('tags:');
    });

    test('handles complex nested objects', () => {
      const frontmatter: MarkdownFrontmatter = {
        title: 'Complex Post',
        layout: 'post',
        author: {
          name: 'John Doe',
          email: 'john@example.com'
        } as Record<string, unknown>,
        metadata: {
          priority: 5,
          featured: true
        } as Record<string, unknown>
      };
      const content = 'Complex content.';

      const result = stringifyToMarkdown(frontmatter, content);
      
      expect(result).toContain('title: Complex Post');
      expect(result).toContain('author:');
      expect(result).toContain('name: John Doe');
      expect(result).toContain('email: john@example.com');
      expect(result).toContain('metadata:');
      expect(result).toContain('priority: 5');
      expect(result).toContain('featured: true');
    });

    test('handles arrays in frontmatter', () => {
      const frontmatter: MarkdownFrontmatter = {
        title: 'Array Test',
        layout: 'post',
        tags: ['one', 'two', 'three'] as any,
        numbers: [1, 2, 3] as any
      };
      const content = 'Array content.';

      const result = stringifyToMarkdown(frontmatter, content);
      
      expect(result).toContain('tags:\n  - one\n  - two\n  - three');
      expect(result).toContain('numbers:\n  - 1\n  - 2\n  - 3');
    });

    test('escapes special YAML characters', () => {
      const frontmatter: MarkdownFrontmatter = {
        title: 'Title with: colon',
        layout: 'post',
        description: 'Description with "quotes" and \'apostrophes\'' as any
      };
      const content = 'Special characters content.';

      const result = stringifyToMarkdown(frontmatter, content);
      
      // YAML should properly escape these
      expect(result).toContain('title: \'Title with: colon\'');
      expect(result).toMatch(/description: ['"]?Description with "quotes".*['"]?/);
    });

    test('roundtrip test - parse then stringify', () => {
      const original = `---
title: Roundtrip Test
date: '2024-01-01'
tags:
  - test
  - roundtrip
published: true
---

# Roundtrip Content

This should survive the roundtrip.`;

      const parsed = parseMarkdownString(original);
      const stringified = stringifyToMarkdown(parsed.frontmatter, parsed.content);
      const reparsed = parseMarkdownString(stringified);

      expect(reparsed.frontmatter.title).toBe('Roundtrip Test');
      expect(reparsed.frontmatter.date).toBe('2024-01-01');
      expect(reparsed.frontmatter.tags).toEqual(['test', 'roundtrip']);
      expect(reparsed.frontmatter.published).toBe(true);
      expect(reparsed.content).toBe('# Roundtrip Content\n\nThis should survive the roundtrip.');
    });

    test('handles empty content', () => {
      const frontmatter: MarkdownFrontmatter = {
        title: 'Empty Content Test',
        layout: 'post'
      };
      const content = '';

      const result = stringifyToMarkdown(frontmatter, content);
      
      expect(result).toContain('title: Empty Content Test');
      expect(result).toContain('layout: post');
      expect(result).toContain('---\n\n');
      expect(result.endsWith('\n\n')).toBe(true);
    });

    test('handles content with only whitespace', () => {
      const frontmatter: MarkdownFrontmatter = {
        title: 'Whitespace Test',
        layout: 'post'
      };
      const content = '   \n\n\t  \n   ';

      const result = stringifyToMarkdown(frontmatter, content);
      
      expect(result).toContain('title: Whitespace Test');
      // Should trim whitespace content
      expect(result.trim()).toMatch(/---\s*$/);
    });

    test('preserves boolean false values', () => {
      const frontmatter: MarkdownFrontmatter = {
        title: 'Boolean Test',
        layout: 'post',
        published: false as any,
        draft: true as any
      };
      const content = 'Boolean content.';

      const result = stringifyToMarkdown(frontmatter, content);
      
      expect(result).toContain('published: false');
      expect(result).toContain('draft: true');
    });

    test('preserves zero values', () => {
      const frontmatter: MarkdownFrontmatter = {
        title: 'Zero Test',
        layout: 'post',
        rating: 0 as any,
        count: 0 as any
      };
      const content = 'Zero content.';

      const result = stringifyToMarkdown(frontmatter, content);
      
      expect(result).toContain('rating: 0');
      expect(result).toContain('count: 0');
    });

    test('handles Unicode in frontmatter output', () => {
      const frontmatter: MarkdownFrontmatter = {
        title: 'Ünïcødé Tést 🎉',
        layout: 'post',
        author: 'José María' as any,
        tags: ['中文', 'русский'] as any
      };
      const content = 'Unicode content with émojis 🚀.';

      const result = stringifyToMarkdown(frontmatter, content);
      
      expect(result).toMatch(/title: ['"]?Ünïcødé Tést 🎉['"]?/);
      expect(result).toMatch(/author: ['"]?José María['"]?/);
      expect(result).toContain('- 中文');
      expect(result).toContain('- русский');
      expect(result).toContain('Unicode content with émojis 🚀');
    });

    test('handles very large arrays', () => {
      const largeTags = Array.from({ length: 100 }, (_, i) => `tag${i}`);
      const frontmatter: MarkdownFrontmatter = {
        title: 'Large Array Test',
        layout: 'post',
        tags: largeTags as any
      };
      const content = 'Large array content.';

      const result = stringifyToMarkdown(frontmatter, content);
      
      expect(result).toContain('title: Large Array Test');
      expect(result).toContain('- tag0');
      expect(result).toContain('- tag99');
      largeTags.forEach(tag => {
        expect(result).toContain(`- ${tag}`);
      });
    });
  });

  describe('parseAndRenderMarkdown', () => {
    test('creates ParsedMarkdownFile object', () => {
      const rawContent = `---
title: Test File
date: 2024-01-01
---

# Test Content

This is a test file.`;

      const result = parseAndRenderMarkdown('test-slug', '/path/to/file.md', rawContent);

      expect(result.slug).toBe('test-slug');
      expect(result.path).toBe('/path/to/file.md');
      expect(result.frontmatter.title).toBe('Test File');
      expect(result.frontmatter.date).toEqual(new Date('2024-01-01'));
      expect(result.content).toBe('# Test Content\n\nThis is a test file.');
    });

    test('handles file without frontmatter', () => {
      const rawContent = `# Just Content

No frontmatter in this file.`;

      const result = parseAndRenderMarkdown('content-only', '/content.md', rawContent);

      expect(result.slug).toBe('content-only');
      expect(result.path).toBe('/content.md');
      expect(result.frontmatter.title).toBe('Untitled');
      expect(result.content).toBe('# Just Content\n\nNo frontmatter in this file.');
    });

    test('passes through parsing errors', () => {
      const rawContent = `---
title: "Invalid YAML
---

Content`;

      expect(() => parseAndRenderMarkdown('error-test', '/error.md', rawContent))
        .toThrow('Invalid YAML frontmatter format');
    });

    test('handles empty raw content', () => {
      const result = parseAndRenderMarkdown('empty', '/empty.md', '');

      expect(result.slug).toBe('empty');
      expect(result.path).toBe('/empty.md');
      expect(result.frontmatter.title).toBe('Untitled');
      expect(result.content).toBe('');
    });

    test('handles very long file paths', () => {
      const longPath = '/very/deep/nested/directory/structure/with/many/levels/of/nesting/that/goes/on/and/on/file.md';
      const rawContent = `---
title: Long Path Test
---

Content for long path.`;

      const result = parseAndRenderMarkdown('long-path', longPath, rawContent);

      expect(result.slug).toBe('long-path');
      expect(result.path).toBe(longPath);
      expect(result.frontmatter.title).toBe('Long Path Test');
    });

    test('handles special characters in slug and path', () => {
      const specialSlug = 'test-slug-with-中文-and-émojis-🚀';
      const specialPath = '/path/with spaces/and-中文/file.md';
      const rawContent = `---
title: Special Characters
---

Special content.`;

      const result = parseAndRenderMarkdown(specialSlug, specialPath, rawContent);

      expect(result.slug).toBe(specialSlug);
      expect(result.path).toBe(specialPath);
      expect(result.frontmatter.title).toBe('Special Characters');
    });

    test('preserves all frontmatter properties', () => {
      const rawContent = `---
title: Complete Test
author: Test Author
date: 2024-01-01
published: true
tags: [test, complete]
metadata:
  category: testing
  priority: high
---

Complete content.`;

      const result = parseAndRenderMarkdown('complete', '/complete.md', rawContent);

      expect(result.frontmatter.title).toBe('Complete Test');
      expect(result.frontmatter.author).toBe('Test Author');
      expect(result.frontmatter.date).toEqual(new Date('2024-01-01'));
      expect(result.frontmatter.published).toBe(true);
      expect(result.frontmatter.tags).toEqual(['test', 'complete']);
      expect((result.frontmatter.metadata as any).category).toBe('testing');
      expect((result.frontmatter.metadata as any).priority).toBe('high');
    });
  });

  describe('Performance and Edge Cases', () => {
    test('handles very large markdown content', () => {
      const largeContent = 'This is a line of content.\n'.repeat(10000);
      const input = `---
title: Large Content Test
---

${largeContent}`;

      const start = performance.now();
      const result = parseMarkdownString(input);
      const end = performance.now();

      expect(result.frontmatter.title).toBe('Large Content Test');
      expect(result.content).toContain('This is a line of content.');
      expect(result.content.split('\n')).toHaveLength(10000); // 10000 lines
      expect(end - start).toBeLessThan(1000); // Should complete within 1 second
    });

    test('handles very large frontmatter with many properties', () => {
      const frontmatterEntries = Array.from({ length: 1000 }, (_, i) => `prop${i}: value${i}`).join('\n');
      const input = `---
title: Large Frontmatter Test
${frontmatterEntries}
---

Content here.`;

      const start = performance.now();
      const result = parseMarkdownString(input);
      const end = performance.now();

      expect(result.frontmatter.title).toBe('Large Frontmatter Test');
      expect((result.frontmatter as any).prop0).toBe('value0');
      expect((result.frontmatter as any).prop999).toBe('value999');
      expect(end - start).toBeLessThan(1000); // Should complete within 1 second
    });

    test('handles markdown with no line breaks', () => {
      const input = '---\ntitle: No Breaks\n---\nContent without any line breaks in a very long single line that goes on and on and should still be parsed correctly by the markdown parser.';

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe('No Breaks');
      expect(result.content).toContain('Content without any line breaks');
    });

    test('handles extremely nested YAML structures', () => {
      const input = `---
title: Deep Nesting
level1:
  level2:
    level3:
      level4:
        level5:
          level6:
            level7:
              level8:
                level9:
                  level10:
                    deep_value: "maximum depth"
---

Deep nesting content.`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe('Deep Nesting');
      expect((result.frontmatter as any).level1.level2.level3.level4.level5.level6.level7.level8.level9.level10.deep_value).toBe('maximum depth');
    });

    test('handles frontmatter with binary-like data', () => {
      const binaryString = Array.from({ length: 100 }, () => Math.random() > 0.5 ? '1' : '0').join('');
      const input = `---
title: Binary Test
binary_data: "${binaryString}"
hex_data: "0x${Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}"
---

Binary content.`;

      const result = parseMarkdownString(input);
      
      expect(result.frontmatter.title).toBe('Binary Test');
      expect((result.frontmatter as any).binary_data).toBe(binaryString);
      expect((result.frontmatter as any).hex_data).toMatch(/^0x[0-9a-f]{32}$/);
    });

    test('handles roundtrip with complex Unicode and special characters', () => {
      const complexContent = `# Test with 中文, Ñoño, and 🎉

This content has:
- Unicode: café, naïve, résumé
- Emojis: 🚀 🎯 💻 🔥
- Mathematical symbols: ∑ ∆ π ∞
- Currency: € $ ¥ £
- Special chars: @#$%^&*()_+-={}[]|\\:";'<>?,./`;

      const frontmatter: MarkdownFrontmatter = {
        title: 'Complex Unicode Test 🌍',
        layout: 'post',
        tags: ['unicode', '中文', 'émojis'] as any,
        description: 'Test with café and naïve words 🎉' as any
      };

      const stringified = stringifyToMarkdown(frontmatter, complexContent);
      const reparsed = parseMarkdownString(stringified);

      expect(reparsed.frontmatter.title).toBe('Complex Unicode Test 🌍');
      expect(reparsed.frontmatter.tags).toEqual(['unicode', '中文', 'émojis']);
      expect(reparsed.content).toContain('café, naïve, résumé');
      expect(reparsed.content).toContain('🚀 🎯 💻 🔥');
      expect(reparsed.content).toContain('∑ ∆ π ∞');
    });

    test('performance test for parseAndRenderMarkdown with large files', () => {
      const largeRawContent = `---
title: Performance Test
author: Test Author
tags: ${JSON.stringify(Array.from({ length: 100 }, (_, i) => `tag${i}`))}
metadata:
  large_array: ${JSON.stringify(Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item${i}` })))}
---

${'# Performance test content\n\nThis is line content.\n'.repeat(1000)}`;

      const start = performance.now();
      const result = parseAndRenderMarkdown('perf-test', '/large-file.md', largeRawContent);
      const end = performance.now();

      expect(result.slug).toBe('perf-test');
      expect(result.frontmatter.title).toBe('Performance Test');
      expect((result.frontmatter.tags as any)).toHaveLength(100);
      expect((result.frontmatter.metadata as any).large_array).toHaveLength(1000);
      expect(end - start).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });
});