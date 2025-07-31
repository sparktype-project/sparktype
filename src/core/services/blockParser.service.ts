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
  _regionBlocks?: Record<string, Block[]>; // Store actual nested blocks from new parser
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
 * Extracts and parses blocks with nested region support.
 * Handles the format created by serializeBlock including region markers.
 */
function extractBlockSections(content: string): BlockSection[] {
  // Parse the content to extract blocks with their nested structure
  const parsedBlocks = parseBlocksWithRegions(content);
  
  // Convert Block[] back to BlockSection[] format for compatibility
  return parsedBlocks.map(block => ({
    id: block.id,
    type: block.type,
    content: block.content,
    config: block.config,
    regions: Object.keys(block.regions),
    _regionBlocks: block.regions // Store actual nested blocks
  }));
}

/**
 * Parses blocks with full region support, returning proper Block objects
 */
function parseBlocksWithRegions(content: string): Block[] {
  const blocks: Block[] = [];
  let pos = 0;
  
  while (pos < content.length) {
    // Find next block start
    const blockStart = content.indexOf('```block:', pos);
    if (blockStart === -1) break;
    
    // Determine block type
    const blockTypeMatch = content.slice(blockStart).match(/```block:(container|content)/);
    if (!blockTypeMatch) {
      pos = blockStart + 1;
      continue;
    }
    
    const blockType = blockTypeMatch[1];
    
    if (blockType === 'container') {
      // Parse container block with regions
      const result = parseContainerBlock(content, blockStart);
      if (result.block) {
        blocks.push(result.block);
      }
      pos = result.nextPos;
    } else {
      // Parse simple content block
      const result = parseContentBlock(content, blockStart);
      if (result.block) {
        blocks.push(result.block);
      }
      pos = result.nextPos;
    }
  }
  
  return blocks;
}

/**
 * Parses a container block with its regions and nested blocks
 */
function parseContainerBlock(content: string, startPos: number): { block: Block | null; nextPos: number } {
  // Find the block definition end
  const defStart = content.indexOf('\n', startPos) + 1;
  const defEnd = content.indexOf('```', defStart);
  if (defEnd === -1) return { block: null, nextPos: startPos + 1 };
  
  // Parse the block definition YAML
  const yamlContent = content.slice(defStart, defEnd).trim();
  let blockDef: any;
  try {
    blockDef = yaml.load(yamlContent);
  } catch (e) {
    console.error("Error parsing container block YAML:", e);
    return { block: null, nextPos: defEnd + 3 };
  }
  
  if (!blockDef?.type) {
    return { block: null, nextPos: defEnd + 3 };
  }
  
  // Create the base block
  const block: Block = {
    id: blockDef.id || nanoid(8),
    type: blockDef.type,
    content: blockDef.content || {},
    config: blockDef.config || {},
    regions: {}
  };
  
  // Find the block end marker
  let searchPos = defEnd + 3;
  const endMarker = '```block:end```';
  const blockEnd = content.indexOf(endMarker, searchPos);
  if (blockEnd === -1) {
    return { block, nextPos: content.length };
  }
  
  // Parse regions between definition and end marker
  const regionContent = content.slice(searchPos, blockEnd);
  parseRegions(regionContent, block);
  
  return { block, nextPos: blockEnd + endMarker.length };
}

/**
 * Parses regions within a container block
 */
function parseRegions(content: string, containerBlock: Block): void {
  const regionRegex = /---region:([^-]+)---/g;
  const regionMatches: Array<{ name: string; start: number; end: number }> = [];
  let match;
  
  // First, find all region markers
  while ((match = regionRegex.exec(content)) !== null) {
    regionMatches.push({
      name: match[1],
      start: match.index + match[0].length,
      end: content.length // Will be updated below
    });
  }
  
  // Update end positions based on next region start
  for (let i = 0; i < regionMatches.length; i++) {
    if (i + 1 < regionMatches.length) {
      // Find the start of the next region marker
      const nextRegionMarkerStart = content.indexOf(`---region:${regionMatches[i + 1].name}---`, regionMatches[i].start);
      regionMatches[i].end = nextRegionMarkerStart;
    }
  }
  
  // Parse blocks for each region
  for (const region of regionMatches) {
    const regionContent = content.slice(region.start, region.end).trim();
    const regionBlocks = parseBlocksWithRegions(regionContent);
    containerBlock.regions[region.name] = regionBlocks;
  }
}

/**
 * Parses a simple content block
 */
function parseContentBlock(content: string, startPos: number): { block: Block | null; nextPos: number } {
  const defStart = content.indexOf('\n', startPos) + 1;
  const defEnd = content.indexOf('```', defStart);
  if (defEnd === -1) return { block: null, nextPos: startPos + 1 };
  
  const yamlContent = content.slice(defStart, defEnd).trim();
  let blockDef: any;
  try {
    blockDef = yaml.load(yamlContent);
  } catch (e) {
    console.error("Error parsing content block YAML:", e);
    return { block: null, nextPos: defEnd + 3 };
  }
  
  if (!blockDef?.type) {
    return { block: null, nextPos: defEnd + 3 };
  }
  
  const block: Block = {
    id: blockDef.id || nanoid(8),
    type: blockDef.type,
    content: blockDef.content || {},
    config: blockDef.config || {},
    regions: {}
  };
  
  return { block, nextPos: defEnd + 3 };
}

/**
 * Builds a nested Block tree from BlockSection array.
 * Now handles the new parsing structure with _regionBlocks.
 */
function buildBlockTree(sections: BlockSection[]): Block[] {
  const blocks: Block[] = [];

  for (const section of sections) {
    const block: Block = {
      id: section.id || nanoid(8),
      type: section.type,
      content: section.content || {},
      config: section.config || {},
      regions: {}
    };

    // If this section has _regionBlocks (from new parser), use them
    if (section._regionBlocks) {
      block.regions = section._regionBlocks;
    }

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