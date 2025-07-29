// src/core/libraries/markdownParser.ts
import matter, { type Input } from 'gray-matter';
import { type MarkdownFrontmatter, type ParsedMarkdownFile, type Block } from '@/core/types';
import yaml from 'js-yaml';
import { parseMarkdownToBlocks, serializeBlocksToMarkdown } from '@/core/services/blockParser.service'; 

/**
 * Extended result type that includes blocks when they are present in the content
 */
export interface ParsedMarkdownResult {
  frontmatter: MarkdownFrontmatter;
  content: string;
  blocks?: Block[];
}

/**
 * Parses a raw markdown string (which includes YAML frontmatter) into an object
 * containing the frontmatter (as an object) and the markdown body content.
 * If the content contains block definitions, they will be parsed into a blocks array.
 *
 * @param rawMarkdown The complete markdown string with frontmatter.
 * @returns An object with `frontmatter`, `content` (markdown body), and optionally `blocks`.
 * @throws Error if frontmatter or block parsing fails.
 */

export function parseMarkdownString(rawMarkdown: string): ParsedMarkdownResult {
  try {
    
    const { data, content: bodyContent } = matter(rawMarkdown as Input, {
      engines: {
        yaml: {
          parse: yaml.load as (input: string) => object,
          stringify: yaml.dump,
        },
      },
    });
    
    const title = typeof data.title === 'string' ? data.title : 'Untitled';
    const trimmedContent = bodyContent.trim();

    // Check if the content contains block definitions
    const hasBlocks = trimmedContent.includes('```block:');
    
    const result: ParsedMarkdownResult = { 
      frontmatter: { ...data, title } as MarkdownFrontmatter,
      content: trimmedContent
    };

    // Parse blocks if they exist in the content
    if (hasBlocks) {
      try {
        result.blocks = parseMarkdownToBlocks(trimmedContent);
      } catch (blockError) {
        console.warn("Failed to parse blocks, treating as regular markdown:", blockError);
        // Continue without blocks if parsing fails
      }
    }

    return result;
  } catch (e) {
    console.error("Error parsing markdown string with gray-matter:", e);
    throw new Error("Invalid YAML frontmatter format. Please check for syntax errors (e.g., unclosed quotes, incorrect indentation).");
  }
}

/**
 * Converts a frontmatter object and content back into a markdown string.
 * Supports both traditional markdown content and block-based content.
 * Uses js-yaml for robust YAML serialization.
 *
 * @param frontmatter The frontmatter object.
 * @param content The markdown body content (used if blocks is not provided).
 * @param blocks Optional array of blocks to serialize instead of content.
 * @returns A string combining serialized YAML frontmatter and content/blocks.
 */
export function stringifyToMarkdown(
  frontmatter: MarkdownFrontmatter, 
  content: string, 
  blocks?: Block[]
): string {
  try {
    const cleanedFrontmatter: Partial<MarkdownFrontmatter> = {};
    for (const key in frontmatter) {
      if (Object.prototype.hasOwnProperty.call(frontmatter, key) && frontmatter[key] !== undefined && frontmatter[key] !== null) {
        cleanedFrontmatter[key] = frontmatter[key];
      }
    }

    const fmString = Object.keys(cleanedFrontmatter).length > 0 
      ? yaml.dump(cleanedFrontmatter, { skipInvalid: true, indent: 2 })
      : '';

    // Use blocks if provided, otherwise use content
    const bodyContent = blocks && blocks.length > 0 
      ? serializeBlocksToMarkdown(blocks)
      : content;

    if (fmString) {
        return `---\n${fmString}---\n\n${bodyContent}`;
    }
    return bodyContent;
  } catch (e) {
    console.error("Error stringifying frontmatter to YAML:", e);

    // Fallback handling for YAML errors - use blocks if provided
    const bodyContent = blocks && blocks.length > 0 
      ? serializeBlocksToMarkdown(blocks)
      : content;

    let fallbackFmString = '';
    for (const key in frontmatter) {
        if (Object.prototype.hasOwnProperty.call(frontmatter, key)) {
            fallbackFmString += `${key}: ${String(frontmatter[key])}\n`;
        }
    }
    if (fallbackFmString) {
        return `---\n${fallbackFmString}---\n\n${bodyContent}`;
    }
    return bodyContent;
  }
}

/**
 * Extended ParsedMarkdownFile type that includes blocks
 */
export interface ExtendedParsedMarkdownFile extends ParsedMarkdownFile {
  blocks?: Block[];
}

/**
 * Parses a raw markdown string into a complete file object.
 * This function is a utility wrapper that maintains compatibility with existing code.
 */
export function parseAndRenderMarkdown(slug: string, path: string, rawMarkdownContent: string): ExtendedParsedMarkdownFile {
  const { frontmatter, content, blocks } = parseMarkdownString(rawMarkdownContent);
  
  const result: ExtendedParsedMarkdownFile = {
    slug,
    path,
    frontmatter,
    content,
  };

  // Include blocks if they were parsed
  if (blocks && blocks.length > 0) {
    result.blocks = blocks;
  }

  return result;
}