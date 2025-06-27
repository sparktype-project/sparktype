// src/core/services/blocknote.service.ts
import { type Block, BlockNoteEditor } from '@blocknote/core';

/**
 * Converts a Markdown string into an array of Blocknote `Block` objects.
 * This works by creating a headless editor and using the `tryParseMarkdownToBlocks`
 * instance method.
 *
 * @param markdown The Markdown string to convert.
 * @returns A promise that resolves to an array of Blocks.
 */
export async function markdownToBlocks(markdown: string): Promise<Block[]> {
  // If the incoming markdown is empty, return an empty array to avoid
  // creating an unnecessary editor instance.
  if (!markdown || markdown.trim() === '') {
    return [];
  }
  
  const editor = await BlockNoteEditor.create();
  const blocks = await editor.tryParseMarkdownToBlocks(markdown);
  
  return blocks;
}

/**
 * Converts an array of Blocknote `Block` objects into a Markdown string.
 * This works by creating a headless editor pre-populated with the blocks
 * and then using its instance method to serialize them to Markdown.
 *
 * @param blocks The array of Blocks to convert.
 * @returns A promise that resolves to a Markdown string.
 */
export async function blocksToMarkdown(blocks: Block[]): Promise<string> {
  // If the blocks array is empty or undefined, return an empty string immediately.
  if (!blocks || blocks.length === 0) {
    return "";
  }
  
  // Only create an editor instance if there are blocks to process.
  const editor = await BlockNoteEditor.create({
    initialContent: blocks,
  });
  
  const markdown = await editor.blocksToMarkdownLossy();

  return markdown;
}