// src/core/libraries/markdownParser.ts
import matter, { type Input } from 'gray-matter';
import { type MarkdownFrontmatter, type ParsedMarkdownFile, type Block, type Manifest } from '@/core/types';
import yaml from 'js-yaml';
import { parseMarkdownToBlocks, serializeBlocksToMarkdown } from '@/core/services/blockParser.service';
import { DirectiveParser } from '@/core/services/directiveParser.service'; 

/**
 * Extended result type that includes blocks when they are present in the content
 */
export interface ParsedMarkdownResult {
  frontmatter: MarkdownFrontmatter;
  content: string;
  blocks?: Block[];
  hasBlocks?: boolean;
}

/**
 * Configuration for markdown parsing with directive support
 */
export interface MarkdownParserOptions {
  useDirectives?: boolean;
  manifest?: Manifest;
  availableBlocks?: Record<string, any>;
}

/**
 * Parses a raw markdown string (which includes YAML frontmatter) into an object
 * containing the frontmatter (as an object) and the markdown body content.
 * If the content contains block definitions, they will be parsed into a blocks array.
 * Supports both legacy custom block syntax and new directive syntax.
 *
 * @param rawMarkdown The complete markdown string with frontmatter.
 * @param options Optional configuration for directive parsing.
 * @returns An object with `frontmatter`, `content` (markdown body), and optionally `blocks`.
 * @throws Error if frontmatter or block parsing fails.
 */

export function parseMarkdownString(rawMarkdown: string, options?: MarkdownParserOptions): ParsedMarkdownResult {
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

    const result: ParsedMarkdownResult = { 
      frontmatter: { ...data, title } as MarkdownFrontmatter,
      content: trimmedContent
    };

    // Parse blocks based on the content and options
    let hasBlocks = false;
    let parseMethod: 'directive' | 'legacy' | 'none' = 'none';

    // Check for directive syntax (::directive{})
    const hasDirectives = /::[\w-]+(?:\{[^}]*\})?/.test(trimmedContent);
    
    // Check for legacy block syntax (```block:)
    const hasLegacyBlocks = trimmedContent.includes('```block:');

    if (options?.useDirectives && hasDirectives && options.manifest && options.availableBlocks) {
      parseMethod = 'directive';
      hasBlocks = true;
    } else if (hasLegacyBlocks) {
      parseMethod = 'legacy';
      hasBlocks = true;
    }

    if (hasBlocks) {
      try {
        if (parseMethod === 'directive' && options?.manifest && options?.availableBlocks) {
          // For now, skip directive parsing in sync mode to avoid async issues
          // This will be handled by a separate async function when needed
          console.warn("Directive parsing skipped in synchronous mode");
          result.hasBlocks = false;
        } else if (parseMethod === 'legacy') {
          // Use legacy block parser
          result.blocks = parseMarkdownToBlocks(trimmedContent);
          result.hasBlocks = true;
        }
      } catch (blockError) {
        console.warn("Failed to parse blocks, treating as regular markdown:", blockError);
        // Continue without blocks if parsing fails
        result.hasBlocks = false;
      }
    } else {
      result.hasBlocks = false;
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
 * @param options Optional configuration for directive serialization.
 * @returns A string combining serialized YAML frontmatter and content/blocks.
 */
export function stringifyToMarkdown(
  frontmatter: MarkdownFrontmatter, 
  content: string, 
  blocks?: Block[],
  options?: MarkdownParserOptions
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
    let bodyContent: string;
    
    if (blocks && blocks.length > 0) {
      if (options?.useDirectives && options.manifest && options.availableBlocks) {
        // For now, skip directive serialization in sync mode
        console.warn("Directive serialization skipped in synchronous mode");
        bodyContent = serializeBlocksToMarkdown(blocks);
      } else {
        // Use legacy block serialization
        bodyContent = serializeBlocksToMarkdown(blocks);
      }
    } else {
      bodyContent = content;
    }

    if (fmString) {
        return `---\n${fmString}---\n\n${bodyContent}`;
    }
    return bodyContent;
  } catch (e) {
    console.error("Error stringifying frontmatter to YAML:", e);

    // Fallback handling for YAML errors - use blocks if provided
    let bodyContent: string;
    
    if (blocks && blocks.length > 0) {
      if (options?.useDirectives && options.manifest && options.availableBlocks) {
        // For now, skip directive serialization in sync mode
        console.warn("Directive serialization skipped in synchronous mode");
        bodyContent = serializeBlocksToMarkdown(blocks);
      } else {
        bodyContent = serializeBlocksToMarkdown(blocks);
      }
    } else {
      bodyContent = content;
    }

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
export function parseAndRenderMarkdown(
  slug: string, 
  path: string, 
  rawMarkdownContent: string, 
  options?: MarkdownParserOptions
): ExtendedParsedMarkdownFile {
  const { frontmatter, content, blocks } = parseMarkdownString(rawMarkdownContent, options);
  
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

/**
 * Async version of parseMarkdownString that supports directive parsing
 * @param rawMarkdown The complete markdown string with frontmatter
 * @param options Configuration for directive parsing
 * @returns Promise resolving to parsed markdown result with blocks
 */
export async function parseMarkdownStringAsync(rawMarkdown: string, options?: MarkdownParserOptions): Promise<ParsedMarkdownResult> {
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

    const result: ParsedMarkdownResult = { 
      frontmatter: { ...data, title } as MarkdownFrontmatter,
      content: trimmedContent
    };

    // Parse blocks based on the content and options
    let hasBlocks = false;
    let parseMethod: 'directive' | 'legacy' | 'none' = 'none';

    // Check for directive syntax (::directive{})
    const hasDirectives = /::[\w-]+(?:\{[^}]*\})?/.test(trimmedContent);
    
    // Check for legacy block syntax (```block:)
    const hasLegacyBlocks = trimmedContent.includes('```block:');

    if (options?.useDirectives && hasDirectives && options.manifest && options.availableBlocks) {
      parseMethod = 'directive';
      hasBlocks = true;
    } else if (hasLegacyBlocks) {
      parseMethod = 'legacy';
      hasBlocks = true;
    }

    if (hasBlocks) {
      try {
        if (parseMethod === 'directive' && options?.manifest && options?.availableBlocks) {
          // Use DirectiveParser for async parsing
          const directiveParser = new DirectiveParser({
            manifest: options.manifest,
            availableBlocks: options.availableBlocks
          });
          result.blocks = await directiveParser.parseToBlocks(trimmedContent);
          result.hasBlocks = true;
        } else if (parseMethod === 'legacy') {
          // Use legacy block parser
          result.blocks = parseMarkdownToBlocks(trimmedContent);
          result.hasBlocks = true;
        }
      } catch (blockError) {
        console.warn("Failed to parse blocks, treating as regular markdown:", blockError);
        // Continue without blocks if parsing fails
        result.hasBlocks = false;
      }
    } else {
      result.hasBlocks = false;
    }

    return result;
  } catch (e) {
    console.error("Error parsing markdown string with gray-matter:", e);
    throw new Error("Invalid YAML frontmatter format. Please check for syntax errors (e.g., unclosed quotes, incorrect indentation).");
  }
}

/**
 * Async version of stringifyToMarkdown that supports directive serialization
 * @param frontmatter The frontmatter object
 * @param content The markdown body content (used if blocks is not provided)
 * @param blocks Optional array of blocks to serialize instead of content
 * @param options Optional configuration for directive serialization
 * @returns Promise resolving to markdown string with frontmatter and content/blocks
 */
export async function stringifyToMarkdownAsync(
  frontmatter: MarkdownFrontmatter, 
  content: string, 
  blocks?: Block[],
  options?: MarkdownParserOptions
): Promise<string> {
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
    let bodyContent: string;
    
    if (blocks && blocks.length > 0) {
      if (options?.useDirectives && options.manifest && options.availableBlocks) {
        // Use DirectiveParser for async serialization
        const directiveParser = new DirectiveParser({
          manifest: options.manifest,
          availableBlocks: options.availableBlocks
        });
        bodyContent = await directiveParser.blocksToMarkdown(blocks);
      } else {
        // Use legacy block serialization
        bodyContent = serializeBlocksToMarkdown(blocks);
      }
    } else {
      bodyContent = content;
    }

    if (fmString) {
        return `---\n${fmString}---\n\n${bodyContent}`;
    }
    return bodyContent;
  } catch (e) {
    console.error("Error stringifying frontmatter to YAML:", e);

    // Fallback handling for YAML errors - use blocks if provided
    let bodyContent: string;
    
    if (blocks && blocks.length > 0) {
      if (options?.useDirectives && options.manifest && options.availableBlocks) {
        // Use DirectiveParser for async serialization even in fallback
        try {
          const directiveParser = new DirectiveParser({
            manifest: options.manifest,
            availableBlocks: options.availableBlocks
          });
          bodyContent = await directiveParser.blocksToMarkdown(blocks);
        } catch (directiveError) {
          console.warn("Directive serialization failed, using legacy:", directiveError);
          bodyContent = serializeBlocksToMarkdown(blocks);
        }
      } else {
        bodyContent = serializeBlocksToMarkdown(blocks);
      }
    } else {
      bodyContent = content;
    }

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