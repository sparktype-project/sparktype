// Sortable Block Renderer with drag handles and controls
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SparkBlock } from '../types';

interface SortableBlockRendererProps {
  block: SparkBlock;
  isEditing: boolean;
  isSelected: boolean;
  readonly: boolean;
  onClick: () => void;
  onUpdate: (content: Record<string, unknown>) => void;
  onDelete: () => void;
  onInsertBelow?: () => void;
  onShowTypeMenu?: (position: { x: number; y: number }) => void;
}

export function SortableBlockRenderer({
  block,
  isEditing,
  isSelected,
  readonly,
  onClick,
  onUpdate,
  onDelete,
  onInsertBelow,
  onShowTypeMenu,
}: SortableBlockRendererProps) {
  const [localContent, setLocalContent] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Initialize local content when entering edit mode
  useEffect(() => {
    if (isEditing) {
      const rawMarkdown = blockToMarkdown(block);
      setLocalContent(rawMarkdown);
      // Focus the input after state update
      setTimeout(() => {
        if (editInputRef.current) {
          editInputRef.current.focus();
          editInputRef.current.select();
        }
      }, 0);
    }
  }, [isEditing, block]);

  // Convert block back to markdown for editing
  const blockToMarkdown = useCallback((block: SparkBlock): string => {
    switch (block.type) {
      case 'core:heading_1':
        return `# ${(block.content.text as string) || ''}`;
      case 'core:heading_2':
        return `## ${(block.content.text as string) || ''}`;
      case 'core:heading_3':
        return `### ${(block.content.text as string) || ''}`;
      case 'core:quote':
        return `> ${(block.content.text as string) || ''}`;
      case 'core:unordered_list':
        return `- ${(block.content.text as string) || ''}`;
      case 'core:ordered_list':
        return `1. ${(block.content.text as string) || ''}`;
      case 'core:code':
        const language = (block.content.language as string) || '';
        const code = (block.content.code as string) || '';
        return language ? `\`\`\`${language}\n${code}\n\`\`\`` : `\`\`\`\n${code}\n\`\`\``;
      case 'core:divider':
        return '---';
      case 'core:image':
        const src = (block.content.src as string) || '';
        const alt = (block.content.alt as string) || '';
        return `::image{src="${src}" alt="${alt}"}`;
      case 'core:paragraph':
      default:
        return (block.content.text as string) || '';
    }
  }, []);

  // Parse markdown back to block content
  const parseMarkdownToContent = useCallback((markdown: string): Record<string, unknown> => {
    // Heading patterns
    if (markdown.startsWith('# ')) {
      return { text: markdown.slice(2) };
    }
    if (markdown.startsWith('## ')) {
      return { text: markdown.slice(3) };
    }
    if (markdown.startsWith('### ')) {
      return { text: markdown.slice(4) };
    }
    
    // Quote
    if (markdown.startsWith('> ')) {
      return { text: markdown.slice(2) };
    }
    
    // Lists
    if (markdown.startsWith('- ')) {
      return { text: markdown.slice(2) };
    }
    if (markdown.match(/^\d+\. /)) {
      return { text: markdown.replace(/^\d+\. /, '') };
    }
    
    // Code block
    const codeMatch = markdown.match(/^```(\w*)\n?(.*?)\n?```$/s);
    if (codeMatch) {
      return { language: codeMatch[1] || 'text', code: codeMatch[2] };
    }
    
    // Image directive
    const imageMatch = markdown.match(/^::image\{src="([^"]*)" alt="([^"]*)"\}$/);
    if (imageMatch) {
      return { src: imageMatch[1], alt: imageMatch[2] };
    }
    
    // Default to text
    return { text: markdown };
  }, []);

  // Handle save from edit mode
  const handleSave = useCallback(() => {
    const newContent = parseMarkdownToContent(localContent);
    onUpdate(newContent);
  }, [localContent, onUpdate, parseMarkdownToContent]);

  // Handle key events in edit mode
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onClick(); // Exit edit mode without saving
    }
  }, [handleSave, onClick]);

  // Handle clicks on controls
  const handleDragHandleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onShowTypeMenu) {
      const rect = e.currentTarget.getBoundingClientRect();
      onShowTypeMenu({ x: rect.right + 10, y: rect.top });
    }
  }, [onShowTypeMenu]);

  const handlePlusClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onInsertBelow?.();
  }, [onInsertBelow]);

  // Render block content based on type
  const renderBlockContent = useCallback(() => {
    const content = block.content;
    
    switch (block.type) {
      case 'core:heading_1':
        return (
          <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', lineHeight: '1.2' }}>
            {(content.text as string) || 'Untitled'}
          </h1>
        );
      
      case 'core:heading_2':
        return (
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', lineHeight: '1.3' }}>
            {(content.text as string) || 'Untitled'}
          </h2>
        );
      
      case 'core:heading_3':
        return (
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', lineHeight: '1.4' }}>
            {(content.text as string) || 'Untitled'}
          </h3>
        );
      
      case 'core:paragraph':
        return (
          <p style={{ margin: 0, lineHeight: '1.6', fontSize: '16px' }}>
            {(content.text as string) || 'Empty paragraph'}
          </p>
        );
      
      case 'core:quote':
        return (
          <blockquote style={{ 
            margin: 0, 
            paddingLeft: '16px', 
            borderLeft: '4px solid #e1e5e9',
            fontStyle: 'italic',
            color: '#6b7280'
          }}>
            {(content.text as string) || 'Empty quote'}
          </blockquote>
        );
      
      case 'core:unordered_list':
        return (
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            <li>{(content.text as string) || 'Empty list item'}</li>
          </ul>
        );
      
      case 'core:ordered_list':
        return (
          <ol style={{ margin: 0, paddingLeft: '20px' }}>
            <li>{(content.text as string) || 'Empty list item'}</li>
          </ol>
        );
      
      case 'core:code':
        return (
          <pre style={{ 
            margin: 0, 
            padding: '12px', 
            backgroundColor: '#f8f9fa',
            border: '1px solid #e9ecef',
            borderRadius: '6px',
            fontSize: '14px',
            fontFamily: 'Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            overflow: 'auto'
          }}>
            <code>{(content.code as string) || 'Empty code block'}</code>
          </pre>
        );
      
      case 'core:divider':
        return (
          <hr style={{
            margin: '16px 0',
            border: 'none',
            height: '1px',
            backgroundColor: '#e1e5e9'
          }} />
        );
      
      case 'core:image':
        const src = content.src as string;
        const alt = content.alt as string;
        return (
          <div style={{ 
            margin: 0, 
            padding: '12px', 
            border: '2px dashed #e1e5e9', 
            borderRadius: '8px', 
            textAlign: 'center',
            backgroundColor: '#f8f9fa'
          }}>
            {src ? (
              <img 
                src={src} 
                alt={alt || 'Image'} 
                style={{ maxWidth: '100%', height: 'auto', borderRadius: '4px' }}
              />
            ) : (
              <div style={{ color: '#6b7280', fontStyle: 'italic' }}>
                📷 {alt || 'Image placeholder'}
              </div>
            )}
          </div>
        );
      
      default:
        return (
          <div style={{ fontStyle: 'italic', color: '#6b7280' }}>
            Unknown block type: {block.type}
          </div>
        );
    }
  }, [block]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="sparkblock-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        padding: '8px',
        borderRadius: '6px',
        border: isSelected ? '2px solid #3b82f6' : '2px solid transparent',
        backgroundColor: isSelected ? '#eff6ff' : 'transparent',
        transition: 'all 0.15s ease',
        position: 'relative',
      }}>
        
        {/* Block Controls - show on hover or when selected */}
        {(isHovered || isSelected) && !readonly && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            marginRight: '4px',
            opacity: isHovered || isSelected ? 1 : 0,
            transition: 'opacity 0.15s ease',
          }}>
            {/* Drag Handle */}
            <button
              {...attributes}
              {...listeners}
              onClick={handleDragHandleClick}
              style={{
                width: '20px',
                height: '20px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                backgroundColor: '#f9fafb',
                cursor: 'grab',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                color: '#6b7280',
              }}
              title="Drag to reorder, click for block menu"
            >
              ⋮⋮
            </button>
            
            {/* Plus Button */}
            <button
              onClick={handlePlusClick}
              style={{
                width: '20px',
                height: '20px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                backgroundColor: '#f9fafb',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                color: '#6b7280',
              }}
              title="Add block below"
            >
              +
            </button>
          </div>
        )}

        {/* Block Content */}
        <div 
          style={{ flex: 1, minWidth: 0 }}
          onClick={!isEditing ? onClick : undefined}
        >
          {isEditing ? (
            <textarea
              ref={editInputRef}
              value={localContent}
              onChange={(e) => setLocalContent(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              style={{
                width: '100%',
                minHeight: '60px',
                padding: '8px',
                border: '2px solid #3b82f6',
                borderRadius: '4px',
                fontSize: '16px',
                lineHeight: '1.5',
                fontFamily: 'Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                resize: 'vertical',
                outline: 'none',
              }}
              placeholder="Edit block content..."
            />
          ) : (
            <div style={{ cursor: readonly ? 'default' : 'pointer' }}>
              {renderBlockContent()}
            </div>
          )}
        </div>

        {/* Delete Button - show on hover */}
        {(isHovered || isSelected) && !readonly && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{
              width: '20px',
              height: '20px',
              border: '1px solid #ef4444',
              borderRadius: '4px',
              backgroundColor: '#fef2f2',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: '#ef4444',
              opacity: isHovered || isSelected ? 1 : 0,
              transition: 'opacity 0.15s ease',
            }}
            title="Delete block"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}