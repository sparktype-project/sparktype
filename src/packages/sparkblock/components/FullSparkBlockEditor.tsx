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

  const editorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Update markdown content helper
  const updateMarkdownContent = useCallback((newMarkdown: string) => {
    if (newMarkdown !== value) {
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
        setBlocks(parsedBlocks);
      } catch (error) {
        console.error('Parse error:', error);
        setParseError(error as Error);
        setBlocks([]);
      }
    };

    parseMarkdown();
  }, [value, adapter]);

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
        updateMarkdownContent(newMarkdown);
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

      setBlocks(newBlocks);

      // Update markdown
      const newMarkdown = await adapter.serialize(newBlocks);
      updateMarkdownContent(newMarkdown);

      // Auto-select and edit the new block
      setSelectedBlockId(newBlock.id);
      setEditingBlockId(newBlock.id);
    } catch (error) {
      console.error('Failed to create block:', error);
    }
  }, [adapter, blocks, updateMarkdownContent]);

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
        updateMarkdownContent(newMarkdown);
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
        updateMarkdownContent(newMarkdown);
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

    setEditingBlockId(blockId);
    setSelectedBlockId(blockId);
  }, [readonly, editingBlockId]);

  const handleBlockBlur = useCallback(() => {
    setEditingBlockId(null);
  }, []);

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

  const handleKeyDown = useCallback(async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
          updateMarkdownContent(newMarkdown);

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
          updateMarkdownContent(newMarkdown);
        }
      }

      setCurrentInput('');
      setShowSlashMenu(false);
    }

    if (e.key === 'Escape') {
      setShowSlashMenu(false);
      setCurrentInput('');
    }
  }, [currentInput, adapter, blocks, createBlock, updateMarkdownContent]);

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
        <div className="text-center text-red-600">
          <h3 className="text-lg font-semibold mb-2">Parse Error</h3>
          <p className="mb-4">Failed to parse markdown: {parseError.message}</p>
          <details className="text-left">
            <summary className="cursor-pointer">Raw Content</summary>
            <pre className="mt-2 p-2 bg-gray-100 rounded text-sm overflow-auto">{value}</pre>
          </details>
        </div>
      </div>
    );
  }

  if (!adapter) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px]">
        <div className="text-center text-gray-600">
          <h3 className="text-lg font-semibold mb-2">SparkBlock Unavailable</h3>
          <p>No adapter available for block editing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col w-full font-sans text-sm leading-relaxed text-gray-900 bg-white focus:outline-none" ref={editorRef}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="p-4 md:p-3 overflow-visible focus:outline-none">
          <div className="max-w-4xl mx-auto md:max-w-full md:mx-auto" style={{ marginLeft: 'calc(50% - 28rem + 5.625rem)', marginRight: 'calc(50% - 28rem)' }}>
            {blocks.length === 0 ? (
              <div className="flex items-center justify-center h-full min-h-[200px]">
                <div className="text-center text-gray-500">
                  <div className="text-5xl mb-4">✏️</div>
                  <div className="text-base mb-4">Start writing your story...</div>
                </div>
              </div>
            ) : (
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
                    onMarkdownUpdate={(newMarkdown) => {
                      // Replace this block's content in the full markdown
                      updateBlockInMarkdown(block.id, newMarkdown);
                    }}
                    onBlur={handleBlockBlur}
                    onSave={handleSave}
                    onCancel={handleCancel}
                    onShowBlockMenu={handleShowBlockMenu}
                    adapter={adapter}
                  />
                ))}
              </SortableContext>
            )}

            {/* Main typing area */}
            <div className={blocks.length > 0 ? 'mt-4' : ''}>
              <textarea
                ref={inputRef}
                value={currentInput}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={readonly}
                placeholder={blocks.length === 0 ? "Start writing, or type '/' for commands..." : "Continue writing..."}
                className="w-full min-h-[60px] border-none outline-none resize-y text-base leading-6 font-inherit bg-transparent px-3 py-2 focus:outline-none"
              />
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