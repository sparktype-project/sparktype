// src/features/editor/components/FileTree.tsx
'use client';

import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import FileTreeNode from './FileTreeNode';
import type { FlattenedNode } from '@/core/services/fileTree.service';

/**
 * Defines the shape of the visual drop indicator state, passed from the parent.
 */
interface DndProjection {
  parentId: string | null;
  depth: number;
  index: number;
}

/**
 * Defines the props accepted by the FileTree component.
 * It now receives a pre-filtered list of items to render, and a separate
 * list of IDs that are valid sortable targets.
 */
interface FileTreeProps {
  itemsToRender: FlattenedNode[];
  sortableIds: string[];
  activeId: string | null;
  projected: DndProjection | null;
  baseEditPath: string;
  activePath: string | undefined;
  homepagePath: string | undefined;
  onCollapse: (id: string) => void;
}

/**
 * Renders the sortable list of pages.
 * This component is now a "dumb" presenter; all filtering and state management
 * is handled by its parent (LeftSidebar).
 */
export default function FileTree({
  itemsToRender,
  sortableIds,
  activeId,
  projected,
  baseEditPath,
  activePath,
  homepagePath,
  onCollapse,
}: FileTreeProps) {
  return (
    // The SortableContext is given only the IDs of items that can be dragged.
    // The homepage ID is excluded by the parent component.
    <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
      <ul className="space-y-0.5">
        {/* It maps over the pre-filtered list of items to render each node. */}
        {itemsToRender.map((item) => (
          <FileTreeNode
            key={item.path}
            item={item}
            activeId={activeId}
            projected={projected}
            baseEditPath={baseEditPath}
            activePath={activePath}
            homepagePath={homepagePath}
            onCollapse={onCollapse}
          />
        ))}
      </ul>
    </SortableContext>
  );
}