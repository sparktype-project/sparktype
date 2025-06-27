// src/features/editor/components/FileTreeNode.tsx

import { Link } from 'react-router-dom'; // CORRECT: Import from react-router-dom
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronRight, File as FileIcon, LayoutGrid, Home } from 'lucide-react';
import { cn } from '@/core/libraries/utils';
import type { FlattenedNode } from '@/core/services/fileTree.service';
import type { MarkdownFrontmatter } from '@/core/types';

/**
 * Defines the shape of the visual drop indicator state.
 */
interface DndProjection {
  parentId: string | null;
  depth: number;
  index: number;
}

interface FileTreeNodeProps {
  item: FlattenedNode;
  isClone?: boolean;
  // --- Props for UI state ---
  activeId: string | null;
  projected: DndProjection | null;
  baseEditPath: string;
  activePath: string | undefined;
  homepagePath: string | undefined;
  onCollapse: (id: string) => void;
}

/**
 * Renders a single item in the file tree. It handles displaying the correct icon,
 * indentation, collapse state, and drag-and-drop visual feedback.
 */
export default function FileTreeNode({
  item,
  isClone,
  activeId,
  projected,
  baseEditPath,
  activePath,
  homepagePath,
  onCollapse,
}: FileTreeNodeProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.path,
    // The homepage is not draggable.
    disabled: item.path === homepagePath,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const isHomepage = item.path === homepagePath;
  const frontmatter = item.frontmatter as MarkdownFrontmatter | undefined;
  const isCollection = !!(frontmatter?.collection);
  const hasChildren = item.children && item.children.length > 0;

  const showCollapseButton = hasChildren && !isCollection && !isHomepage;

  // CORRECT: Generate the `to` prop for the react-router-dom Link
  const editorSlug = item.path.replace(/^content\//, '').replace(/\.md$/, '');
  const to = `${baseEditPath}/content/${editorSlug}`;

  const isOver = projected?.parentId === item.parentId && projected?.index === item.index;
  const projectedDepth = projected && isOver ? projected.depth : item.depth;
  const indentation = isClone ? item.depth * 24 : projectedDepth * 24;

  const showDropLine = activeId && projected && isOver && projected.depth === item.depth;
  const showNestingHighlight = activeId && projected && isOver && projected.depth > item.depth;
  
  return (
    <li
      ref={setNodeRef}
      style={{ paddingLeft: indentation, ...style }}
      className={cn(
        'relative list-none my-0.5 rounded-md transition-shadow',
        isDragging && 'opacity-50 z-10 shadow-lg',
        showNestingHighlight && 'bg-blue-100 dark:bg-blue-900/40'
      )}
    >
      {showDropLine && (
        <div className="absolute -top-[3px] left-0 right-0 h-1 bg-blue-500 rounded-full z-20" />
      )}
      
      <div
        className={cn(
          "flex items-center group w-full relative transition-colors h-9",
          activePath === item.path && "bg-accent text-accent-foreground"
        )}
      >
        <button
          {...attributes}
          {...listeners}
          disabled={isHomepage}
          className={cn(
            "p-1.5 touch-none",
            isHomepage ? "cursor-default text-muted-foreground/30" : "cursor-grab text-muted-foreground/50 hover:text-muted-foreground"
          )}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        
        <div className="flex-grow flex items-center pl-1 pr-1 overflow-hidden">
          {showCollapseButton ? (
            <button onClick={() => onCollapse(item.path)} className="p-0.5 mr-1" aria-label={`Collapse ${item.title}`}>
                <ChevronRight className={cn("h-4 w-4 shrink-0 transition-transform duration-200", !item.collapsed && "rotate-90")} />
            </button>
          ) : (
            // A spacer is used to keep alignment consistent for items without a collapse button.
            <span className="w-5 mr-1 shrink-0" />
          )}

          {isHomepage ? (
            <Home className="h-4 w-4 shrink-0 text-primary" />
          ) : isCollection ? (
            <LayoutGrid className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          
          {/* CORRECT: Use the react-router-dom Link with the `to` prop */}
          <Link to={to} className="truncate flex-grow mx-1.5 text-sm hover:underline" title={item.title}>
            {item.menuTitle || item.title}
          </Link>
        </div>
      </div>
    </li>
  );
}