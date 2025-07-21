// src/core/libraries/markdownParser.ts
import matter, { type Input } from 'gray-matter';
import { type MarkdownFrontmatter, type ParsedMarkdownFile } from '@/core/types';
import yaml from 'js-yaml'; 

/**
 * Parses a raw markdown string (which includes YAML frontmatter) into an object
 * containing the frontmatter (as an object) and the markdown body content.
 *
 * @param rawMarkdown The complete markdown string with frontmatter.
 * @returns An object with `frontmatter` and `content` (markdown body).
 * @throws Error if frontmatter parsing fails.
 */

export function parseMarkdownString(rawMarkdown: string): { frontmatter: MarkdownFrontmatter, content: string } {
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

    return { 
      frontmatter: { ...data, title } as MarkdownFrontmatter,
      content: bodyContent.trim() 
    };
  } catch (e) {
    console.error("Error parsing markdown string with gray-matter:", e);
    throw new Error("Invalid YAML frontmatter format. Please check for syntax errors (e.g., unclosed quotes, incorrect indentation).");
  }
}

/**
 * Converts a frontmatter object and a markdown body content string back into
 * a single string formatted as YAML frontmatter followed by the markdown content.
 * Uses js-yaml for robust YAML serialization.
 *
 * @param frontmatter The frontmatter object.
 * @param content The markdown body content.
 * @returns A string combining serialized YAML frontmatter and markdown content.
 */
export function stringifyToMarkdown(frontmatter: MarkdownFrontmatter, content: string): string {
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

    if (fmString) {
        return `---\n${fmString}---\n\n${content}`;
    }
    return content;
  } catch (e) {
    console.error("Error stringifying frontmatter to YAML:", e);

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
 * Parses a raw markdown string. This function is a utility wrapper.
 */
export function parseAndRenderMarkdown(slug: string, path: string, rawMarkdownContent: string): ParsedMarkdownFile {
  const { frontmatter, content } = parseMarkdownString(rawMarkdownContent);
  
  return {
    slug,
    path,
    frontmatter,
    content,
  };
}