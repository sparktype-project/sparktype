// src/core/libraries/markdownParser.ts
import matter, { type Input } from 'gray-matter';
import { type MarkdownFrontmatter, type ParsedMarkdownFile } from '@/core/types';
import yaml from 'js-yaml'; 

/**
 * Simplified result type for BlockNote-based parsing
 */
export interface ParsedMarkdownResult {
  frontmatter: MarkdownFrontmatter;
  content: string;
}

/**
 * Parses a raw markdown string (which includes YAML frontmatter) into an object
 * containing the frontmatter (as an object) and the markdown body content.
 * Simplified for BlockNote integration.
 *
 * @param rawMarkdown The complete markdown string with frontmatter.
 * @returns An object with `frontmatter` and `content` (markdown body).
 * @throws Error if frontmatter parsing fails.
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

    return { 
      frontmatter: { ...data, title } as MarkdownFrontmatter,
      content: trimmedContent
    };
  } catch (e) {
    console.error("Error parsing markdown string with gray-matter:", e);
    throw new Error("Invalid YAML frontmatter format. Please check for syntax errors (e.g., unclosed quotes, incorrect indentation).");
  }
}

/**
 * Converts a frontmatter object and content back into a markdown string.
 * Simplified for BlockNote integration.
 *
 * @param frontmatter The frontmatter object.
 * @param content The markdown body content.
 * @returns A string combining serialized YAML frontmatter and content.
 */
export function stringifyToMarkdown(
  frontmatter: MarkdownFrontmatter, 
  content: string
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

    return fmString ? `---\n${fmString}---\n\n${content}` : content;
  } catch (yamlError) {
    console.error("YAML serialization error:", yamlError);
    
    // Fallback handling for YAML errors
    let fallbackFmString = '';
    for (const key in frontmatter) {
        if (Object.prototype.hasOwnProperty.call(frontmatter, key)) {
            fallbackFmString += `${key}: ${String(frontmatter[key])}\n`;
        }
    }
    if (fallbackFmString) {
        return `---\n${fallbackFmString}---\n\n${content}`;
    }
    return content;
  }
}

/**
 * Parses a raw markdown string into a complete file object.
 * This function is a utility wrapper that maintains compatibility with existing code.
 */
export function parseAndRenderMarkdown(
  slug: string, 
  path: string, 
  rawMarkdownContent: string
): ParsedMarkdownFile {
  const { frontmatter, content } = parseMarkdownString(rawMarkdownContent);
  
  return {
    slug,
    path,
    frontmatter,
    content,
  };
}