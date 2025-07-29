// src/core/services/blockParser.service.ts

import yaml from 'js-yaml';
import { nanoid } from 'nanoid';
import { type Block } from '@/core/types';

/**
 * Represents a parsed block section from markdown before tree construction
 */
interface BlockSection {
  type: string;
  content?: Record<string, unknown>;
  config?: Record<string, unknown>;
  regions?: string[];
  id?: string;
}

/**
 * Parses a markdown string containing block definitions into a Block[] array.
 * Follows the same error handling patterns as existing markdownParser.ts
 * 
 * Expected format:
 * ```block:container
 * type: core:two_column
 * config:
 *   layout: "equal"
 * ```
 * 
 * ```block:content
 * type: core:rich_text
 * content:
 *   text: "Hello world"
 * ```
 * 
 * ```block:end
 * ```
 * 
 * @param markdownContent The markdown content containing block definitions
 * @returns Array of parsed Block objects
 * @throws Error if block parsing fails
 */
export function parseMarkdownToBlocks(markdownContent: string): Block[] {
  try {
    if (!markdownContent.trim()) {
      return [];
    }

    const blockSections = extractBlockSections(markdownContent);
    return buildBlockTree(blockSections);
  } catch (e) {
    console.error("Error parsing markdown blocks:", e);
    throw new Error("Invalid block format. Please check for syntax errors in block definitions.");
  }
}

/**
 * Converts a Block[] array back into markdown format.
 * Follows the same patterns as stringifyToMarkdown in markdownParser.ts
 * 
 * @param blocks Array of Block objects to serialize
 * @returns Markdown string with block definitions
 */
export function serializeBlocksToMarkdown(blocks: Block[]): string {
  try {
    if (!blocks || blocks.length === 0) {
      return '';
    }

    return blocks.map(block => serializeBlock(block, 0)).join('\n\n');
  } catch (e) {
    console.error("Error serializing blocks to markdown:", e);
    throw new Error("Failed to serialize blocks to markdown format.");
  }
}

/**
 * Extracts block sections from markdown content.
 * Uses regex patterns similar to gray-matter's approach.
 */
function extractBlockSections(content: string): BlockSection[] {
  const sections: BlockSection[] = [];
  const blockRegex = /```block:(container|content|end)\n([\s\S]*?)```/g;
  let match;
  let containerStack: BlockSection[] = [];

  while ((match = blockRegex.exec(content)) !== null) {
    const [, blockType, yamlContent] = match;

    if (blockType === 'end') {
      // End of container block
      if (containerStack.length > 0) {
        const container = containerStack.pop()!;
        sections.push(container);
      }
      continue;
    }

    if (!yamlContent?.trim()) {
      continue;
    }

    try {
      const parsed = yaml.load(yamlContent.trim()) as any;
      
      if (!parsed?.type) {
        console.warn("Block missing required 'type' field, skipping");
        continue;
      }

      const section: BlockSection = {
        type: parsed.type,
        content: parsed.content || {},
        config: parsed.config || {},
        id: parsed.id || nanoid(8)
      };

      if (blockType === 'container') {
        // Start of container block - will be closed by block:end
        containerStack.push(section);
      } else {
        // Content block - add to current container or root
        sections.push(section);
      }
    } catch (yamlError) {
      console.error("Error parsing YAML in block section:", yamlError);
      throw new Error(`Invalid YAML in block section: ${yamlError}`);
    }
  }

  // Handle unclosed containers
  if (containerStack.length > 0) {
    console.warn("Unclosed container blocks detected, adding them anyway");
    sections.push(...containerStack);
  }

  return sections;
}

/**
 * Builds a nested Block tree from flat BlockSection array.
 * Follows similar patterns to existing tree-building logic in the codebase.
 */
function buildBlockTree(sections: BlockSection[]): Block[] {
  const blocks: Block[] = [];

  for (const section of sections) {
    const block: Block = {
      id: section.id || nanoid(8),
      type: section.type,
      content: section.content || {},
      config: section.config || {},
      regions: {} // Initialize empty regions - will be populated based on manifest
    };

    blocks.push(block);
  }

  return blocks;
}

/**
 * Serializes a single block to markdown format.
 * Recursive to handle nested regions.
 */
function serializeBlock(block: Block, depth: number): string {
  const hasRegions = Object.keys(block.regions).length > 0;
  const blockType = hasRegions ? 'container' : 'content';
  
  // Build the block definition object
  const blockDef: any = {
    type: block.type,
    id: block.id
  };

  // Add content if it has any properties
  if (Object.keys(block.content).length > 0) {
    blockDef.content = block.content;
  }

  // Add config if it has any properties
  if (Object.keys(block.config).length > 0) {
    blockDef.config = block.config;
  }

  try {
    const yamlString = yaml.dump(blockDef, { 
      skipInvalid: true, 
      indent: 2,
      lineWidth: -1 // Prevent line wrapping
    });

    let result = `\`\`\`block:${blockType}\n${yamlString}\`\`\``;

    // Handle regions for container blocks
    if (hasRegions) {
      const regionContent = Object.entries(block.regions)
        .map(([regionName, regionBlocks]) => {
          if (regionBlocks.length === 0) return '';
          
          const regionBlocksMarkdown = regionBlocks
            .map(nestedBlock => serializeBlock(nestedBlock, depth + 1))
            .join('\n\n');
          
          return `\n\n---region:${regionName}---\n\n${regionBlocksMarkdown}`;
        })
        .filter(Boolean)
        .join('');

      result += regionContent + '\n\n```block:end\n```';
    }

    return result;
  } catch (yamlError) {
    console.error("Error serializing block to YAML:", yamlError);
    throw new Error(`Failed to serialize block ${block.id}: ${yamlError}`);
  }
}

/**
 * Helper function to validate block structure.
 * Follows validation patterns from existing services.
 */
export function validateBlockStructure(blocks: Block[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const block of blocks) {
    if (!block.id) {
      errors.push(`Block missing required 'id' field`);
    }
    
    if (!block.type) {
      errors.push(`Block ${block.id} missing required 'type' field`);
    }

    if (typeof block.content !== 'object' || block.content === null) {
      errors.push(`Block ${block.id} has invalid 'content' field`);
    }

    if (typeof block.config !== 'object' || block.config === null) {
      errors.push(`Block ${block.id} has invalid 'config' field`);
    }

    if (typeof block.regions !== 'object' || block.regions === null) {
      errors.push(`Block ${block.id} has invalid 'regions' field`);
    }

    // Recursively validate nested blocks
    for (const [regionName, nestedBlocks] of Object.entries(block.regions)) {
      if (!Array.isArray(nestedBlocks)) {
        errors.push(`Block ${block.id} region '${regionName}' is not an array`);
        continue;
      }

      const nestedValidation = validateBlockStructure(nestedBlocks);
      errors.push(...nestedValidation.errors);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}