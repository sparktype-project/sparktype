// src/features/editor/components/blocks/BlockWrapper.tsx

import { useState, useMemo } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { 
  GripVertical, 
  Settings, 
  Trash2, 
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/core/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/core/components/ui/collapsible';
import SchemaDrivenForm from '@/core/components/SchemaDrivenForm';
import { type Block, type BlockManifest } from '@/core/types';
import { useAppStore } from '@/core/state/useAppStore';
import AddBlockMenu from './AddBlockMenu';

// Droppable Region Component
function DroppableRegion({ 
  blockId, 
  regionName, 
  children, 
  isEmpty 
}: { 
  blockId: string; 
  regionName: string; 
  children: React.ReactNode;
  isEmpty: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `region:${blockId}:${regionName}:0`
  });

  return (
    <div 
      ref={setNodeRef}
      className={`region-content min-h-[100px] border-2 border-dashed rounded-lg p-2 transition-colors ${
        isOver ? 'border-blue-500 bg-blue-50' : 'border-muted'
      }`}
      data-region={regionName}
    >
      {isEmpty ? (
        <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
          Drop blocks here
        </div>
      ) : (
        <div className="space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}

interface BlockWrapperProps {
  siteId: string;
  block: Block;
  manifest?: BlockManifest;
  onChange: (blockId: string, newBlockData: Partial<Block>) => void;
  onDelete: (blockId: string) => void;
  depth?: number; // For nested blocks
  isDragging?: boolean; // For drag overlay styling
}

/**
 * BlockWrapper is the main editing interface for individual blocks.
 * It handles:
 * - Drag and drop functionality
 * - Content editing (inline forms)
 * - Config editing (settings modal)
 * - Region management (nested blocks)
 * - Block controls (delete, settings)
 */
export default function BlockWrapper({
  siteId,
  block,
  manifest,
  onChange,
  onDelete,
  depth = 0,
  isDragging = false
}: BlockWrapperProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isContentCollapsed, setIsContentCollapsed] = useState(false);

  // Set up drag and drop
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Handle content changes
  const handleContentChange = (newContent: Record<string, unknown>) => {
    onChange(block.id, { content: newContent });
  };

  // Handle config changes
  const handleConfigChange = (newConfig: Record<string, unknown>) => {
    onChange(block.id, { config: newConfig });
    setIsSettingsOpen(false);
  };

  // Handle nested block changes
  const handleNestedBlockChange = (regionName: string, regionBlocks: Block[]) => {
    const newRegions = { ...block.regions, [regionName]: regionBlocks };
    onChange(block.id, { regions: newRegions });
  };

  // Handle nested block addition
  const handleNestedBlockAdd = (regionName: string, newBlockManifest: BlockManifest) => {
    const newBlock: Block = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: newBlockManifest.id,
      content: newBlockManifest.contentSchema?.properties 
        ? Object.entries(newBlockManifest.contentSchema.properties).reduce((acc, [key, prop]) => {
            if (typeof prop === 'object' && 'default' in prop) {
              acc[key] = prop.default;
            }
            return acc;
          }, {} as Record<string, unknown>)
        : {},
      config: newBlockManifest.configSchema?.properties
        ? Object.entries(newBlockManifest.configSchema.properties).reduce((acc, [key, prop]) => {
            if (typeof prop === 'object' && 'default' in prop) {
              acc[key] = prop.default;
            }
            return acc;
          }, {} as Record<string, unknown>)
        : {},
      regions: newBlockManifest.regions
        ? newBlockManifest.regions.reduce((acc, regionName) => {
            acc[regionName] = [];
            return acc;
          }, {} as Record<string, Block[]>)
        : {},
    };

    const currentRegionBlocks = block.regions[regionName] || [];
    handleNestedBlockChange(regionName, [...currentRegionBlocks, newBlock]);
  };

  // Handle nested block deletion
  const handleNestedBlockDelete = (regionName: string, blockId: string) => {
    const currentRegionBlocks = block.regions[regionName] || [];
    const updatedBlocks = currentRegionBlocks.filter(b => b.id !== blockId);
    handleNestedBlockChange(regionName, updatedBlocks);
  };

  // Determine if block has content fields
  const hasContentFields = useMemo(() => {
    return manifest?.contentSchema?.properties && 
           Object.keys(manifest.contentSchema.properties).length > 0;
  }, [manifest]);

  // Determine if block has config fields
  const hasConfigFields = useMemo(() => {
    return manifest?.configSchema?.properties && 
           Object.keys(manifest.configSchema.properties).length > 0;
  }, [manifest]);

  // Determine if block has regions
  const hasRegions = useMemo(() => {
    return manifest?.regions && manifest.regions.length > 0;
  }, [manifest]);

  // Get block display name
  const blockDisplayName = manifest?.name || block.type;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        block-wrapper relative group border rounded-lg bg-background
        ${isDragging || isSortableDragging ? 'opacity-50' : ''}
        ${depth > 0 ? 'ml-4 border-dashed' : 'border-solid'}
        hover:border-primary/50 transition-colors
      `}
    >
      {/* Block Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          {/* Drag Handle */}
          <Button
            variant="ghost"
            size="sm"
            className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="w-4 h-4" />
          </Button>

          {/* Block Type */}
          <span className="text-sm font-medium text-muted-foreground">
            {blockDisplayName}
          </span>

          {/* Content Collapse Toggle (if has content) */}
          {hasContentFields && (
            <Collapsible open={!isContentCollapsed} onOpenChange={setIsContentCollapsed}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isContentCollapsed ? 
                    <ChevronRight className="w-4 h-4" /> : 
                    <ChevronDown className="w-4 h-4" />
                  }
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Settings Button (if has config) */}
          {hasConfigFields && (
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Settings className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{blockDisplayName} Settings</DialogTitle>
                </DialogHeader>
                <SchemaDrivenForm
                  schema={manifest?.configSchema!}
                  uiSchema={manifest?.configUiSchema}
                  formData={block.config}
                  onFormChange={handleConfigChange as (data: object) => void}
                  formContext={{ siteId }}
                />
              </DialogContent>
            </Dialog>
          )}

          {/* Delete Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(block.id)}
            className="text-destructive hover:text-destructive/80 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Block Content Editor */}
      {hasContentFields && (
        <Collapsible open={!isContentCollapsed}>
          <CollapsibleContent>
            <div className="p-4 border-b">
              <SchemaDrivenForm
                schema={manifest?.contentSchema!}
                uiSchema={manifest?.contentUiSchema}
                formData={block.content}
                onFormChange={handleContentChange as (data: object) => void}
                liveValidate={true}
                formContext={{ siteId }}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Regions (for container blocks) */}
      {hasRegions && (
        <div className="p-4 space-y-4">
          {manifest?.regions!.map((regionName) => (
            <div key={regionName} className="region">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-muted-foreground capitalize">
                  {regionName.replace('_', ' ')}
                </h4>
                <AddBlockMenu
                  siteId={siteId}
                  onBlockAdd={(blockManifest) => handleNestedBlockAdd(regionName, blockManifest)}
                />
              </div>
              
              <DroppableRegion
                blockId={block.id}
                regionName={regionName}
                isEmpty={block.regions[regionName]?.length === 0}
              >
                <SortableContext 
                  items={block.regions[regionName]?.map(b => b.id) || []} 
                  strategy={verticalListSortingStrategy}
                >
                  {block.regions[regionName]?.map((nestedBlock) => {
                    const getBlockManifest = useAppStore.getState().getBlockManifest;
                    return (
                      <BlockWrapper
                        key={nestedBlock.id}
                        siteId={siteId}
                        block={nestedBlock}
                        manifest={getBlockManifest(nestedBlock.type)}
                        onChange={(blockId, changes) => handleNestedBlockChange(regionName, 
                          block.regions[regionName].map(b => 
                            b.id === blockId ? { ...b, ...changes } : b
                          )
                        )}
                        onDelete={(blockId) => handleNestedBlockDelete(regionName, blockId)}
                        depth={depth + 1}
                      />
                    );
                  })}
                </SortableContext>
              </DroppableRegion>
            </div>
          ))}
        </div>
      )}

      {/* Empty State (for blocks with no content, config, or regions) */}
      {!hasContentFields && !hasConfigFields && !hasRegions && (
        <div className="p-8 text-center text-muted-foreground">
          <p className="text-sm">This block has no editable properties.</p>
        </div>
      )}
    </div>
  );
}