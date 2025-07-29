// src/core/services/__tests__/blockParser.service.test.ts

import { parseMarkdownToBlocks, serializeBlocksToMarkdown, validateBlockStructure } from '../blockParser.service';
import { type Block } from '@/core/types';

describe('blockParser.service', () => {
  describe('parseMarkdownToBlocks', () => {
    it('should parse simple content block', () => {
      const markdown = `
\`\`\`block:content
type: core:rich_text
content:
  text: "Hello world"
\`\`\`
      `;

      const blocks = parseMarkdownToBlocks(markdown);
      
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('core:rich_text');
      expect(blocks[0].content.text).toBe('Hello world');
      expect(blocks[0].config).toEqual({});
      expect(blocks[0].regions).toEqual({});
    });

    it('should parse container block with config', () => {
      const markdown = `
\`\`\`block:container
type: core:two_column
config:
  layout: "equal"
\`\`\`

\`\`\`block:content
type: core:rich_text
content:
  text: "Column content"
\`\`\`

\`\`\`block:end
\`\`\`
      `;

      const blocks = parseMarkdownToBlocks(markdown);
      
      expect(blocks).toHaveLength(2);
      expect(blocks[0].type).toBe('core:two_column');
      expect(blocks[0].config.layout).toBe('equal');
      expect(blocks[1].type).toBe('core:rich_text');
    });

    it('should return empty array for empty content', () => {
      const blocks = parseMarkdownToBlocks('');
      expect(blocks).toEqual([]);
    });

    it('should handle malformed YAML gracefully', () => {
      const markdown = `
\`\`\`block:content
type: core:rich_text
content:
  text: "unclosed quote
\`\`\`
      `;

      expect(() => parseMarkdownToBlocks(markdown)).toThrow();
    });
  });

  describe('serializeBlocksToMarkdown', () => {
    it('should serialize simple content block', () => {
      const blocks: Block[] = [{
        id: 'test-1',
        type: 'core:rich_text',
        content: { text: 'Hello world' },
        config: {},
        regions: {}
      }];

      const result = serializeBlocksToMarkdown(blocks);
      
      expect(result).toContain('```block:content');
      expect(result).toContain('type: core:rich_text');
      expect(result).toContain('text: Hello world');
    });

    it('should serialize container block with regions', () => {
      const blocks: Block[] = [{
        id: 'container-1',
        type: 'core:two_column',
        content: {},
        config: { layout: 'equal' },
        regions: {
          column_1: [{
            id: 'nested-1',
            type: 'core:rich_text',
            content: { text: 'Column 1 content' },
            config: {},
            regions: {}
          }]
        }
      }];

      const result = serializeBlocksToMarkdown(blocks);
      
      expect(result).toContain('```block:container');
      expect(result).toContain('layout: equal');
      expect(result).toContain('---region:column_1---');
      expect(result).toContain('```block:end');
    });

    it('should return empty string for empty blocks array', () => {
      const result = serializeBlocksToMarkdown([]);
      expect(result).toBe('');
    });
  });

  describe('validateBlockStructure', () => {
    it('should validate correct block structure', () => {
      const blocks: Block[] = [{
        id: 'valid-block',
        type: 'core:rich_text',
        content: { text: 'Valid content' },
        config: {},
        regions: {}
      }];

      const validation = validateBlockStructure(blocks);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should detect missing required fields', () => {
      const blocks: Block[] = [{
        id: '',
        type: '',
        content: { text: 'Content' },
        config: {},
        regions: {}
      }];

      const validation = validateBlockStructure(blocks);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Block missing required \'id\' field');
      expect(validation.errors).toContain('Block  missing required \'type\' field');
    });

    it('should validate nested blocks recursively', () => {
      const blocks: Block[] = [{
        id: 'container',
        type: 'core:container',
        content: {},
        config: {},
        regions: {
          main: [{
            id: '', // Invalid nested block
            type: 'core:rich_text',
            content: { text: 'Nested content' },
            config: {},
            regions: {}
          }]
        }
      }];

      const validation = validateBlockStructure(blocks);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Block missing required \'id\' field');
    });
  });
});