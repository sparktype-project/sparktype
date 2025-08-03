// Full SparkBlock Editor - comprehensive block editing interface
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { SparkBlock, SparkBlockAdapter } from '../types';
import { SimpleBlockRenderer } from './SimpleBlockRenderer';
import { BlockMenu } from './BlockMenu';
import { SlashMenu } from './SlashMenu';
import { BLOCK_ICONS } from '../utils/BlockIcons';
import { isCustomBlock } from '../utils/SchemaConverter';

export interface FullSparkBlockEditorProps {
  adapter: SparkBlockAdapter<string> | null;
  value: string; // Current markdown content
  onChange: (markdown: string) => void; // Called when content changes
  readonly?: boolean;
}

/**
 * Full-featured SparkBlock editor with seamless typing experience,
 * block management, drag & drop, and slash commands.
 */
export function FullSparkBlockEditor({
  adapter,
  value,
  onChange,
  readonly = false,
}: FullSparkBlockEditorProps) {
  const [blocks, setBlocks] = useState<SparkBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [currentInput, setCurrentInput] = useState('');
  const [showBlockMenu, setShowBlockMenu] = useState<{ type: 'create' | 'convert', blockId?: string, position?: { x: number, y: number } } | null>(null);
  const [parseError, setParseError] = useState<Error | null>(null);
  const [availableBlocks, setAvailableBlocks] = useState<any[]>([]);
  const [isInternalUpdate, setIsInternalUpdate] = useState(false);
  const [pendingEditBlockId, setPendingEditBlockId] = useState<string | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Update markdown content helper
  const updateMarkdownContent = useCallback((newMarkdown: string, isInternal: boolean = false) => {
    if (newMarkdown !== value) {
      if (isInternal) {
        setIsInternalUpdate(true);
      }
      onChange(newMarkdown);
    }
  }, [value, onChange]);

  // Parse markdown content into blocks
  useEffect(() => {
    if (!adapter) return;

    const parseMarkdown = async () => {
      try {
        setParseError(null);
        const parsedBlocks = await adapter.parse(value);
        
        // If this is an internal update, preserve editing state
        if (isInternalUpdate) {
          console.log('Internal update - preserving editing state. Parsed blocks:', parsedBlocks.map(b => b.id));
          setBlocks(parsedBlocks);
          setIsInternalUpdate(false);
          // Don't reset editing state during internal updates
        } else {
          console.log('External update - resetting editing state. Parsed blocks:', parsedBlocks.map(b => b.id));
          setBlocks(parsedBlocks);
          // Reset editing state for external updates
          setSelectedBlockId(null);
          setEditingBlockId(null);
        }
      } catch (error) {
        console.error('Parse error:', error);
        setParseError(error as Error);
        setBlocks([]);
      }
    };

    parseMarkdown();
  }, [value, adapter, isInternalUpdate]);

  // Handle pending edit state after blocks are updated
  useEffect(() => {
    if (pendingEditBlockId) {
      const matchingBlock = blocks.find(block => block.id === pendingEditBlockId);
      if (matchingBlock) {
        console.log('Setting edit mode for matching block:', matchingBlock.id);
        setSelectedBlockId(matchingBlock.id);
        setEditingBlockId(matchingBlock.id);
        setPendingEditBlockId(null);
      } else {
        // If exact ID match fails, try to find the last block with empty content (likely the new one)
        const emptyBlocks = blocks.filter(block => 
          block.content.text === '' || 
          (block.content.code === '' && block.type === 'core:code') ||
          (block.content.src === '' && block.type === 'core:image')
        );
        if (emptyBlocks.length > 0) {
          const lastEmptyBlock = emptyBlocks[emptyBlocks.length - 1];
          console.log('Setting edit mode for last empty block:', lastEmptyBlock.id);
          setSelectedBlockId(lastEmptyBlock.id);
          setEditingBlockId(lastEmptyBlock.id);
          setPendingEditBlockId(null);
        }
      }
    }
  }, [blocks, pendingEditBlockId]);

  // Load available block types
  useEffect(() => {
    if (!adapter) return;

    const loadAvailableBlocks = async () => {
      try {
        const blockTypes = await adapter.getAvailableBlocks();
        const processedBlocks = blockTypes.map(block => ({
          ...block,
          fullId: block.id,
          id: block.id.replace('core:', ''),
          icon: BLOCK_ICONS[block.id.replace('core:', '')] || '?',
          keywords: block.keywords || []
        }));
        setAvailableBlocks(processedBlocks);
      } catch (error) {
        console.error('Failed to load available blocks:', error);
        setAvailableBlocks([]);
      }
    };

    loadAvailableBlocks();
  }, [adapter]);


  // Handle drag and drop reordering
  const handleDragEnd = useCallback(async (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id && adapter) {
      const oldIndex = blocks.findIndex(block => block.id === active.id);
      const newIndex = blocks.findIndex(block => block.id === over.id);

      const newBlocks = arrayMove(blocks, oldIndex, newIndex);
      setBlocks(newBlocks);

      // Serialize and update markdown directly
      try {
        const newMarkdown = await adapter.serialize(newBlocks);
        updateMarkdownContent(newMarkdown, true);
      } catch (error) {
        console.error('Failed to serialize after drag:', error);
      }
    }
  }, [blocks, adapter, updateMarkdownContent]);

  // Handle creating new blocks
  const createBlock = useCallback(async (blockType: string, afterBlockId?: string, position: 'before' | 'after' = 'after') => {
    if (!adapter) return;

    try {
      // Initialize content based on block type
      let initialContent: Record<string, any> = {};

      switch (blockType) {
        case 'core:paragraph':
          initialContent = { text: '' };
          break;
        case 'core:heading_1':
          initialContent = { text: '' };
          break;
        case 'core:heading_2':
          initialContent = { text: '' };
          break;
        case 'core:heading_3':
          initialContent = { text: '' };
          break;
        case 'core:quote':
          initialContent = { text: '' };
          break;
        case 'core:code':
          initialContent = { code: '', language: 'text' };
          break;
        case 'core:unordered_list':
          initialContent = { text: '' };
          break;
        case 'core:ordered_list':
          initialContent = { text: '' };
          break;
        case 'core:image':
          initialContent = { src: '', alt: '' };
          break;
        default:
          initialContent = {};
      }

      // Create new block
      const newBlock: SparkBlock = {
        id: `block_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        type: blockType,
        content: initialContent,
        config: {},
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1
        }
      };

      let newBlocks: SparkBlock[];
      if (afterBlockId) {
        const insertIndex = blocks.findIndex(b => b.id === afterBlockId);
        if (insertIndex >= 0) {
          const targetIndex = position === 'after' ? insertIndex + 1 : insertIndex;
          newBlocks = [
            ...blocks.slice(0, targetIndex),
            newBlock,
            ...blocks.slice(targetIndex)
          ];
        } else {
          newBlocks = [...blocks, newBlock];
        }
      } else {
        newBlocks = [...blocks, newBlock];
      }

      // Schedule the new block for editing before updating markdown
      console.log('Scheduling block for edit:', newBlock.id);
      setPendingEditBlockId(newBlock.id);

      // Update markdown and flag as internal update (this will trigger parsing and block update)
      const newMarkdown = await adapter.serialize(newBlocks);
      updateMarkdownContent(newMarkdown, true);
    } catch (error) {
      console.error('Failed to create block:', error);
    }
  }, [adapter, blocks, updateMarkdownContent]);

  // Handle splitting a block at cursor position
  const splitBlockAtCursor = useCallback(async (blockId: string, beforeText: string, afterText: string, blockType: string = 'core:paragraph') => {
    if (!adapter) return;

    try {
      const blockIndex = blocks.findIndex(b => b.id === blockId);
      if (blockIndex < 0) return;

      const currentBlock = blocks[blockIndex];
      
      // Update current block with before text
      const updatedCurrentBlock = {
        ...currentBlock,
        content: { ...currentBlock.content, text: beforeText }
      };

      // Create new block with after text
      const newBlock: SparkBlock = {
        id: `block_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        type: blockType,
        content: { text: afterText },
        config: {},
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1
        }
      };

      // Insert the new block after the current one
      const newBlocks = [
        ...blocks.slice(0, blockIndex),
        updatedCurrentBlock,
        newBlock,
        ...blocks.slice(blockIndex + 1)
      ];

      // Schedule the new block for editing before updating markdown
      setPendingEditBlockId(newBlock.id);

      // Update markdown
      const newMarkdown = await adapter.serialize(newBlocks);
      updateMarkdownContent(newMarkdown, true);
    } catch (error) {
      console.error('Failed to split block:', error);
    }
  }, [adapter, blocks, updateMarkdownContent]);

  // Handle pasting multi-line content into an existing block
  const handlePasteInBlock = useCallback(async (blockId: string, beforeText: string, pastedLines: string[], afterText: string) => {
    if (!adapter || pastedLines.length === 0) return;

    try {
      const blockIndex = blocks.findIndex(b => b.id === blockId);
      if (blockIndex < 0) return;

      const currentBlock = blocks[blockIndex];
      const newBlocks = [...blocks];
      
      // Parse each pasted line to determine block type
      const parsedBlocks: SparkBlock[] = [];
      
      for (let i = 0; i < pastedLines.length; i++) {
        const line = pastedLines[i].trim();
        if (!line) continue;
        
        // Parse the line to determine block type
        const parsedResult = await adapter.parse(line);
        
        if (parsedResult.length > 0) {
          const parsedBlock = parsedResult[0];
          
          // Create a new block with unique ID
          const newBlock: SparkBlock = {
            id: `block_${Date.now()}_${Math.random().toString(36).substring(2, 11)}_${i}`,
            type: parsedBlock.type,
            content: parsedBlock.content,
            config: parsedBlock.config || {},
            metadata: {
              createdAt: Date.now(),
              updatedAt: Date.now(),
              version: 1
            }
          };
          
          parsedBlocks.push(newBlock);
        }
      }
      
      if (parsedBlocks.length === 0) return;
      
      // Update current block with beforeText + first pasted line
      const firstParsedBlock = parsedBlocks[0];
      const updatedCurrentBlock = {
        ...currentBlock,
        content: { 
          ...currentBlock.content, 
          text: beforeText + (firstParsedBlock.content.text || '') 
        }
      };
      
      newBlocks[blockIndex] = updatedCurrentBlock;
      
      // Insert remaining parsed blocks
      const additionalBlocks = parsedBlocks.slice(1);
      newBlocks.splice(blockIndex + 1, 0, ...additionalBlocks);
      
      // If there's afterText, create a final block with it
      let lastBlockId = firstParsedBlock.id; // Will be updated if we create an after block
      
      if (afterText.trim()) {
        const afterBlock: SparkBlock = {
          id: `block_${Date.now()}_${Math.random().toString(36).substring(2, 11)}_after`,
          type: 'core:paragraph',
          content: { text: afterText },
          config: {},
          metadata: {
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: 1
          }
        };
        
        newBlocks.splice(blockIndex + 1 + additionalBlocks.length, 0, afterBlock);
        lastBlockId = afterBlock.id;
      } else if (additionalBlocks.length > 0) {
        lastBlockId = additionalBlocks[additionalBlocks.length - 1].id;
      }
      
      // Schedule the last block for editing
      setPendingEditBlockId(lastBlockId);
      
      // Update markdown
      const newMarkdown = await adapter.serialize(newBlocks);
      updateMarkdownContent(newMarkdown, true);
      
    } catch (error) {
      console.error('Failed to paste in block:', error);
    }
  }, [adapter, blocks, updateMarkdownContent]);

  // Handle deleting a block
  const deleteBlock = useCallback(async (blockId: string) => {
    if (!adapter) return;

    try {
      const blockIndex = blocks.findIndex(b => b.id === blockId);
      if (blockIndex < 0) return;

      // Don't delete the last remaining block
      if (blocks.length <= 1) {
        console.log('Cannot delete the last remaining block');
        return;
      }

      const newBlocks = blocks.filter(b => b.id !== blockId);
      
      // Clear editing state if we're deleting the currently edited block
      if (editingBlockId === blockId) {
        setEditingBlockId(null);
      }
      if (selectedBlockId === blockId) {
        setSelectedBlockId(null);
      }

      // Update markdown
      const newMarkdown = await adapter.serialize(newBlocks);
      updateMarkdownContent(newMarkdown, true);
      
    } catch (error) {
      console.error('Failed to delete block:', error);
    }
  }, [adapter, blocks, updateMarkdownContent, editingBlockId, selectedBlockId]);

  // Check if a block is empty
  const isBlockEmpty = useCallback((block: SparkBlock): boolean => {
    if (!block.content) return true;
    
    // Check different content types
    if (typeof block.content.text === 'string') {
      return !block.content.text.trim();
    }
    
    if (typeof block.content.code === 'string') {
      return !block.content.code.trim();
    }
    
    if (typeof block.content.src === 'string') {
      return !block.content.src.trim();
    }
    
    // For other content types, check if all values are empty
    const values = Object.values(block.content);
    return values.every(value => {
      if (typeof value === 'string') return !value.trim();
      if (typeof value === 'number') return value === 0;
      if (Array.isArray(value)) return value.length === 0;
      if (typeof value === 'object' && value !== null) return Object.keys(value).length === 0;
      return !value;
    });
  }, []);

  // Handle sequential deletion - delete blocks one by one going backwards
  const handleSequentialDelete = useCallback(async () => {
    if (!adapter || blocks.length === 0) return;

    try {
      let blockToDelete: SparkBlock | null = null;

      if (selectedBlockId && !editingBlockId) {
        // If a block is selected but not being edited, delete it
        blockToDelete = blocks.find(b => b.id === selectedBlockId) || null;
      } else if (blocks.length > 0) {
        // Otherwise, delete the last block
        blockToDelete = blocks[blocks.length - 1];
      }

      if (!blockToDelete) return;

      // Don't delete the last remaining block if it has content
      if (blocks.length === 1 && !isBlockEmpty(blockToDelete)) {
        // If it's the last block with content, clear its content instead of deleting
        const updatedBlock = {
          ...blockToDelete,
          content: { text: '' }
        };
        
        const newBlocks = [updatedBlock];
        const newMarkdown = await adapter.serialize(newBlocks);
        updateMarkdownContent(newMarkdown, true);
        
        // Select the now-empty block
        setSelectedBlockId(blockToDelete.id);
        setEditingBlockId(null);
        return;
      }

      // Delete the block
      const newBlocks = blocks.filter(b => b.id !== blockToDelete.id);
      
      // Clear editing/selection state
      if (editingBlockId === blockToDelete.id) {
        setEditingBlockId(null);
      }
      if (selectedBlockId === blockToDelete.id) {
        // Select the previous block if available
        const blockIndex = blocks.findIndex(b => b.id === blockToDelete.id);
        const previousBlockIndex = blockIndex - 1;
        if (previousBlockIndex >= 0 && newBlocks[previousBlockIndex]) {
          setSelectedBlockId(newBlocks[previousBlockIndex].id);
        } else if (newBlocks.length > 0) {
          setSelectedBlockId(newBlocks[0].id);
        } else {
          setSelectedBlockId(null);
        }
      }
      
      // Update markdown
      const newMarkdown = await adapter.serialize(newBlocks);
      updateMarkdownContent(newMarkdown, true);
      
    } catch (error) {
      console.error('Failed to handle sequential delete:', error);
    }
  }, [adapter, blocks, selectedBlockId, editingBlockId, isBlockEmpty, updateMarkdownContent]);

  // Global keyboard event handler for block operations
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Only handle keys when we're not in an input field, textarea, or contenteditable
      const target = e.target as HTMLElement;
      const isInputElement = target.tagName === 'INPUT' || 
                           target.tagName === 'TEXTAREA' || 
                           target.isContentEditable ||
                           target.getAttribute('contenteditable') === 'true';
      
      if (!isInputElement && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        handleSequentialDelete();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleSequentialDelete]);

  // Handle converting block types
  const convertBlock = useCallback(async (blockId: string, newBlockType: string) => {
    if (!adapter) return;

    try {
      const blockIndex = blocks.findIndex(b => b.id === blockId);
      if (blockIndex >= 0) {
        const updatedBlocks = [...blocks];
        updatedBlocks[blockIndex] = {
          ...updatedBlocks[blockIndex],
          type: newBlockType,
          // Reset content and config when converting
          content: {},
          config: {},
        };

        setBlocks(updatedBlocks);

        // Update markdown
        const newMarkdown = await adapter.serialize(updatedBlocks);
        updateMarkdownContent(newMarkdown, true);
      }
    } catch (error) {
      console.error('Failed to convert block:', error);
    }
  }, [adapter, blocks, updateMarkdownContent]);

  // Handle updating block content from markdown
  const updateBlockInMarkdown = useCallback(async (blockId: string, blockMarkdown: string) => {
    if (!adapter) return;

    try {
      // Find the block to update
      const blockIndex = blocks.findIndex(b => b.id === blockId);
      if (blockIndex < 0) return;

      // Parse the markdown to get updated content
      const parsedBlocks = await adapter.parse(blockMarkdown);
      if (parsedBlocks.length > 0) {
        const updatedBlock = { ...blocks[blockIndex], ...parsedBlocks[0] };
        const newBlocks = [...blocks];
        newBlocks[blockIndex] = updatedBlock;

        setBlocks(newBlocks);

        // Serialize all blocks back to markdown
        const newMarkdown = await adapter.serialize(newBlocks);
        updateMarkdownContent(newMarkdown, true);
      }
    } catch (error) {
      console.error('Failed to update block:', error);
    }
  }, [adapter, blocks, updateMarkdownContent]);

  // Handle block interactions - restore original behavior
  const handleBlockClick = useCallback((blockId: string) => {
    if (readonly) return;

    if (editingBlockId === blockId) {
      // Already editing, do nothing
      return;
    }

    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    
    // For custom blocks, just select them (don't auto-edit)
    if (isCustomBlock(block.type)) {
      setSelectedBlockId(blockId);
      setEditingBlockId(null); // Clear editing mode
      return;
    }
    
    // For core text blocks, auto-enter edit mode
    setEditingBlockId(blockId);
    setSelectedBlockId(blockId);
  }, [readonly, editingBlockId, blocks]);

  // Handle double-click to edit custom blocks
  const handleBlockDoubleClick = useCallback((blockId: string) => {
    if (readonly) return;
    
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    
    // For custom blocks, double-click enters edit mode
    if (isCustomBlock(block.type)) {
      setSelectedBlockId(blockId);
      setEditingBlockId(blockId);
    }
  }, [readonly, blocks]);

  const handleBlockBlur = useCallback(async () => {
    if (editingBlockId) {
      // Find the block that was being edited
      const editedBlock = blocks.find(b => b.id === editingBlockId);
      
      if (editedBlock && isBlockEmpty(editedBlock)) {
        console.log('Deleting empty block on blur:', editingBlockId);
        await deleteBlock(editingBlockId);
      }
    }
    
    setEditingBlockId(null);
  }, [editingBlockId, blocks, isBlockEmpty, deleteBlock]);

  const handleSave = useCallback(() => {
    setEditingBlockId(null);
  }, []);

  const handleCancel = useCallback(() => {
    setEditingBlockId(null);
  }, []);

  const handleShowBlockMenu = useCallback((type: 'create' | 'convert', blockId?: string, position?: { x: number, y: number }) => {
    setShowBlockMenu({ type, blockId, position });
  }, []);

  // Handle slash command input
  const handleInputChange = useCallback((inputValue: string) => {
    setCurrentInput(inputValue);

    if (inputValue.startsWith('/')) {
      setShowSlashMenu(true);
    } else {
      setShowSlashMenu(false);
    }
  }, []);

  // Handle pasting content with line break splitting and markdown parsing
  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    if (!adapter) return;
    
    const pastedText = e.clipboardData.getData('text/plain');
    if (!pastedText.trim()) return;
    
    try {
      // Split pasted text by paragraph breaks (double line breaks) first, then single line breaks
      const paragraphs = pastedText.split(/\n\s*\n/).filter(p => p.trim());
      const lines: string[] = [];
      
      // Further split each paragraph by single line breaks to handle mixed content
      paragraphs.forEach(paragraph => {
        const paragraphLines = paragraph.split('\n').filter(line => line.trim());
        lines.push(...paragraphLines);
      });
      
      if (lines.length === 0) return;
      
      // Clear current input
      setCurrentInput('');
      e.currentTarget.textContent = '';
      
      // Process each line and create blocks
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Parse the line to determine block type
        const parsedBlocks = await adapter.parse(line);
        
        if (parsedBlocks.length > 0) {
          const parsedBlock = parsedBlocks[0];
          
          // Create a new block with a unique ID
          const newBlock: SparkBlock = {
            id: `block_${Date.now()}_${Math.random().toString(36).substring(2, 11)}_${i}`,
            type: parsedBlock.type,
            content: parsedBlock.content,
            config: parsedBlock.config || {},
            metadata: {
              createdAt: Date.now(),
              updatedAt: Date.now(),
              version: 1
            }
          };
          
          const newBlocks = [...blocks, newBlock];
          setBlocks(newBlocks);
          
          // Update markdown
          const newMarkdown = await adapter.serialize(newBlocks);
          updateMarkdownContent(newMarkdown, true);
          
          // If this is the last line, set it to editing mode
          if (i === lines.length - 1) {
            setPendingEditBlockId(newBlock.id);
          }
        }
      }
    } catch (error) {
      console.error('Failed to process pasted content:', error);
      // Fallback: create a single paragraph with the pasted text
      await createBlock('core:paragraph');
      if (blocks.length >= 0) {
        const lastBlock = blocks[blocks.length - 1] || { content: {} };
        const updatedBlock = { ...lastBlock, content: { text: pastedText } };
        const newMarkdown = await adapter.serialize([...blocks.slice(0, -1), updatedBlock]);
        updateMarkdownContent(newMarkdown, true);
      }
    }
  }, [adapter, blocks, updateMarkdownContent, createBlock]);

  const handleKeyDown = useCallback(async (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Handle delete/backspace in empty input - sequential delete
    if ((e.key === 'Delete' || e.key === 'Backspace') && !currentInput.trim() && blocks.length > 0) {
      e.preventDefault();
      await handleSequentialDelete();
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey && currentInput.trim()) {
      e.preventDefault();

      if (currentInput.startsWith('/')) {
        // Don't create blocks for slash commands - let menu handle it
        return;
      }

      if (!adapter) return;

      try {
        // Parse the input to detect the correct block type
        const parsedBlocks = await adapter.parse(currentInput);
        if (parsedBlocks.length > 0) {
          const parsedBlock = parsedBlocks[0];

          // Create the correct block type with the parsed content
          const newBlock: SparkBlock = {
            id: `block_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            type: parsedBlock.type,
            content: parsedBlock.content,
            config: parsedBlock.config || {},
            metadata: {
              createdAt: Date.now(),
              updatedAt: Date.now(),
              version: 1
            }
          };

          const newBlocks = [...blocks, newBlock];
          setBlocks(newBlocks);

          // Update markdown
          const newMarkdown = await adapter.serialize(newBlocks);
          updateMarkdownContent(newMarkdown, true);

          // Auto-select the new block for continued editing if it's a text block
          if (['core:paragraph', 'core:heading_1', 'core:heading_2', 'core:heading_3', 'core:quote'].includes(parsedBlock.type)) {
            setSelectedBlockId(newBlock.id);
          }
        }
      } catch (error) {
        console.error('Failed to parse input:', error);
        // Fallback: create a paragraph block with the raw text
        await createBlock('core:paragraph');
        if (blocks.length >= 0) {
          const lastBlock = blocks[blocks.length - 1] || { content: {} };
          const updatedBlock = { ...lastBlock, content: { text: currentInput } };
          const newMarkdown = await adapter.serialize([...blocks.slice(0, -1), updatedBlock]);
          updateMarkdownContent(newMarkdown, true);
        }
      }

      setCurrentInput('');
      setShowSlashMenu(false);
      
      // Also clear the input element directly to prevent duplication
      if (inputRef.current) {
        inputRef.current.textContent = '';
      }
    }

    if (e.key === 'Escape') {
      setShowSlashMenu(false);
      setCurrentInput('');
    }
  }, [currentInput, adapter, blocks, createBlock, updateMarkdownContent, handleSequentialDelete]);

  // Handle slash menu selection
  const handleSlashCommand = useCallback(async (blockType: string) => {
    await createBlock(blockType);
    setCurrentInput('');
    setShowSlashMenu(false);

    // Focus the input after creating block
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, [createBlock]);

  // Handle block menu actions
  const handleBlockMenuAction = useCallback((blockType: string, action: 'create' | 'convert', blockId?: string) => {
    if (action === 'create' && blockId) {
      createBlock(blockType, blockId, 'after');
    } else if (action === 'convert' && blockId) {
      convertBlock(blockId, blockType);
    }
  }, [createBlock, convertBlock]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowBlockMenu(null);
      setShowSlashMenu(false);
    };

    if (showBlockMenu || showSlashMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showBlockMenu, showSlashMenu]);

  if (parseError) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px]">
        <div className="text-center text-red-600 dark:text-red-400">
          <h3 className="text-lg font-semibold mb-2">Parse Error</h3>
          <p className="mb-4">Failed to parse markdown: {parseError.message}</p>
          <details className="text-left">
            <summary className="cursor-pointer">Raw Content</summary>
            <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 dark:text-gray-300 rounded text-sm overflow-auto">{value}</pre>
          </details>
        </div>
      </div>
    );
  }

  if (!adapter) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px]">
        <div className="text-center text-gray-600 dark:text-gray-400">
          <h3 className="text-lg font-semibold mb-2">SparkBlock Unavailable</h3>
          <p>No adapter available for block editing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col w-full prose prose-gray max-w-none bg-white dark:bg-gray-900 focus:outline-none prose-p:mt-0 prose-headings:mt-0 prose-blockquote:mt-0 dark:prose-invert" ref={editorRef}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-visible focus:outline-none md:pr-16">
          <div className="max-w-4xl mx-auto">
            {blocks.length > 0 && (
              <SortableContext
                items={blocks.map(block => block.id)}
                strategy={verticalListSortingStrategy}
              >
                {blocks.map((block) => (
                  <SimpleBlockRenderer
                    key={block.id}
                    block={block}
                    isSelected={selectedBlockId === block.id}
                    isEditing={editingBlockId === block.id}
                    readonly={readonly}
                    onClick={() => handleBlockClick(block.id)}
                    onDoubleClick={() => handleBlockDoubleClick(block.id)}
                    onMarkdownUpdate={(newMarkdown) => {
                      // Replace this block's content in the full markdown
                      updateBlockInMarkdown(block.id, newMarkdown);
                    }}
                    onBlur={handleBlockBlur}
                    onSave={handleSave}
                    onCancel={handleCancel}
                    onShowBlockMenu={handleShowBlockMenu}
                    onSplitBlock={splitBlockAtCursor}
                    onPasteInBlock={handlePasteInBlock}
                    onDeleteBlock={deleteBlock}
                    adapter={adapter}
                  />
                ))}
              </SortableContext>
            )}

            {/* Main typing area */}
            <div className={blocks.length > 0 ? 'mt-4' : ''}>
              <div className="flex items-start gap-2">
                {/* Space to align with block controls */}
                <div className="flex-shrink-0 w-16"></div>
                {/* Contenteditable area - matches block content padding */}
                <div
                  ref={(element) => {
                    if (element) {
                      inputRef.current = element;
                      // Don't automatically sync content - let user input control it
                    }
                  }}
                  contentEditable={!readonly}
                  suppressContentEditableWarning
                  onInput={(e) => {
                    const newValue = e.currentTarget.textContent || '';
                    handleInputChange(newValue);
                  }}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  data-placeholder={blocks.length === 0 ? "Start writing or press '/' for commands..." : "Write or press '/' for commands..."}
                  className="flex-1 min-h-[60px] border-none outline-none bg-transparent py-2 focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 dark:empty:before:text-gray-500 dark:text-gray-100"
                />
              </div>
            </div>
          </div>
        </div>
      </DndContext>

      {/* Block menu for create/convert */}
      <BlockMenu
        show={showBlockMenu}
        availableBlocks={availableBlocks}
        onSelectBlock={handleBlockMenuAction}
        onClose={() => setShowBlockMenu(null)}
      />

      {/* Slash command menu */}
      <SlashMenu
        show={showSlashMenu}
        availableBlocks={availableBlocks}
        currentInput={currentInput}
        onSelectBlock={handleSlashCommand}
        inputRef={inputRef}
      />
    </div>
  );
}