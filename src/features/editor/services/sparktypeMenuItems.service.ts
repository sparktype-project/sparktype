// src/features/editor/services/sparktypeMenuItems.service.ts

import { insertOrUpdateBlock } from '@blocknote/core';
import type { BlockNoteEditor, DefaultReactSuggestionItem } from '@blocknote/react';
import { getDefaultReactSlashMenuItems } from '@blocknote/react';
import { BlockDiscoveryService } from '@/core/services/blockDiscovery.service';
import type { LocalSiteData } from '@/core/types';

/**
 * Creates slash menu items for Sparktype blocks
 */
export async function getSparktypeSlashMenuItems(
  editor: BlockNoteEditor,
  siteData?: LocalSiteData
): Promise<DefaultReactSuggestionItem[]> {
  console.log('getSparktypeSlashMenuItems called with editor:', !!editor, 'siteData:', !!siteData);
  
  const discoveredBlocks = await BlockDiscoveryService.discoverBlocks(siteData);
  console.log('Discovered blocks for menu:', discoveredBlocks.length, discoveredBlocks.map(b => b.definition.id));
  
  const sparktypeItems: DefaultReactSuggestionItem[] = [];

  for (const discoveredBlock of discoveredBlocks) {
    const blockType = discoveredBlock.definition.id.replace(':', '_');
    
    const item: DefaultReactSuggestionItem = {
      title: `Insert ${discoveredBlock.definition.name}`,
      onItemClick: () => {
        console.log(`Inserting Sparktype block: ${blockType} (${discoveredBlock.definition.name})`);
        console.log('Editor schema blockSpecs:', Object.keys(editor.schema.blockSpecs));
        
        // Check if the block type exists in the schema
        if (!editor.schema.blockSpecs[blockType]) {
          console.error(`Block type ${blockType} not found in schema!`);
          return;
        }
        
        console.log(`Found block spec for ${blockType}:`, editor.schema.blockSpecs[blockType]);
        
        try {
          // Try the simplest possible insertion first
          insertOrUpdateBlock(editor, {
            type: blockType,
          });
          console.log(`Successfully inserted ${blockType} block`);
        } catch (error) {
          console.error(`Failed to insert ${blockType} block:`, error);
          
          // Try with minimal props as fallback
          try {
            console.log('Trying fallback insertion...');
            insertOrUpdateBlock(editor, {
              type: blockType,
              props: {},
            });
            console.log(`Fallback insertion succeeded for ${blockType}`);
          } catch (fallbackError) {
            console.error(`Fallback insertion also failed for ${blockType}:`, fallbackError);
          }
        }
      },
      aliases: [
        discoveredBlock.definition.name.toLowerCase().replace(/\s+/g, ''),
        discoveredBlock.definition.id.toLowerCase(),
        blockType.toLowerCase(),
      ],
      group: 'Sparktype Blocks',
      subtext: `Insert a ${discoveredBlock.definition.name} block${discoveredBlock.definition.isCore ? ' (Core)' : ' (Custom)'}`,
    };

    sparktypeItems.push(item);
  }

  return sparktypeItems;
}

/**
 * Gets combined slash menu items (default + Sparktype)
 */
export async function getCustomSlashMenuItems(
  editor: BlockNoteEditor,
  siteData?: LocalSiteData
): Promise<DefaultReactSuggestionItem[]> {
  const defaultItems = getDefaultReactSlashMenuItems(editor);
  const sparktypeItems = await getSparktypeSlashMenuItems(editor, siteData);
  
  return [
    ...defaultItems,
    ...sparktypeItems,
  ];
}

/**
 * Creates block type select items for Sparktype blocks
 */
export async function getSparktypeBlockTypeItems(
  editor: BlockNoteEditor,
  siteData?: LocalSiteData
): Promise<Array<{
  name: string;
  type: string;
  icon?: any;
  isSelected: (block: any) => boolean;
}>> {
  const discoveredBlocks = await BlockDiscoveryService.discoverBlocks(siteData);
  const blockTypeItems = [];

  for (const discoveredBlock of discoveredBlocks) {
    const blockType = discoveredBlock.definition.id.replace(':', '_');
    
    const item = {
      name: discoveredBlock.definition.name,
      type: blockType,
      isSelected: (block: any) => block.type === blockType,
    };

    blockTypeItems.push(item);
  }

  return blockTypeItems;
}