// src/packages/sparkblock/types/index.ts

import type { ReactNode } from 'react';

// === CORE BLOCK TYPES ===

export interface SparkBlock<TContent = Record<string, unknown>> {
  id: string;
  type: string;
  content: TContent;
  config?: Record<string, unknown>;
  regions?: Record<string, SparkBlock[]>;
  metadata?: {
    createdAt?: number;
    updatedAt?: number;
    version?: number;
    [key: string]: unknown;
  };
}

export interface BlockDefinition {
  id: string;
  name: string;
  category: string;
  description?: string;
  icon?: ReactNode;
  keywords?: string[];
  
  // Field schema for the block content
  fields?: Record<string, BlockField>;
  
  // Configuration schema for the block settings
  config?: Record<string, BlockField>;
  
  // Region definitions for container blocks
  regions?: Record<string, BlockRegion>;
  
  // Auto-detection patterns
  triggers?: BlockTrigger[];
  
  // Behavior configuration
  behavior?: BlockBehavior;
  
  // Custom validation
  validate?: (block: SparkBlock) => ValidationResult;
}

export interface BlockField {
  type: 'text' | 'number' | 'boolean' | 'select' | 'array' | 'object' | 'image' | 'url';
  label: string;
  required?: boolean;
  default?: unknown;
  placeholder?: string;
  options?: string[]; // for select fields
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    custom?: (value: unknown) => string | null;
  };
}

export interface BlockRegion {
  label: string;
  allowedBlocks?: string[]; // empty = all blocks allowed
  required?: boolean;
  maxItems?: number;
  minItems?: number;
}

export interface BlockTrigger {
  pattern: string | RegExp;
  confidence: number;
  cleanText?: (text: string) => string;
}

export interface BlockBehavior {
  insertable?: boolean;
  duplicatable?: boolean;
  deletable?: boolean;
  moveable?: boolean;
  splittable?: boolean;
  mergeable?: boolean;
  
  // Keyboard shortcuts
  shortcuts?: BlockShortcut[];
  
  // Auto-formatting
  autoFormat?: boolean;
}

export interface BlockShortcut {
  key: string;
  modifier?: 'ctrl' | 'cmd' | 'alt' | 'shift' | Array<'ctrl' | 'cmd' | 'alt' | 'shift'>;
  description?: string;
  action: string; // command name
}

// === VALIDATION ===

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings?: ValidationWarning[];
}

export interface ValidationError {
  field?: string;
  message: string;
  code?: string;
}

export interface ValidationWarning {
  field?: string;
  message: string;
  code?: string;
}

// === OPERATIONS ===

export interface InsertPosition {
  targetId?: string;
  position: 'before' | 'after' | 'inside';
  regionName?: string;
}

export interface MoveOperation {
  blockId: string;
  targetId?: string;
  position: 'before' | 'after' | 'inside';
  regionName?: string;
}

export interface UpdateOperation {
  blockId: string;
  content?: Partial<Record<string, unknown>>;
  config?: Partial<Record<string, unknown>>;
}

// === ADAPTER INTERFACE ===

export interface SparkBlockAdapter<TDocument = unknown> {
  // Document transformation
  parse(document: TDocument): Promise<SparkBlock[]>;
  serialize(blocks: SparkBlock[]): Promise<TDocument>;
  
  // Block registry
  getAvailableBlocks(): Promise<BlockDefinition[]>;
  getBlockDefinition(type: string): Promise<BlockDefinition | null>;
  createBlock(type: string, initialData?: Record<string, unknown>): Promise<SparkBlock>;
  validateBlock(block: SparkBlock): Promise<ValidationResult>;
  
  // Optional: Custom rendering
  renderBlock?(block: SparkBlock, context: RenderContext): ReactNode;
  
  // Optional: Custom commands
  executeCommand?(command: string, ...args: unknown[]): Promise<unknown>;
}

export interface RenderContext {
  isEditing: boolean;
  isSelected: boolean;
  isFocused: boolean;
  isDragging: boolean;
  nestingLevel: number;
  readonly: boolean;
  theme?: SparkBlockTheme;
  
  // Callbacks
  onFocus?: () => void; // A simple notification that focus occurred.
  onBlur?: () => void;
  // A simple callback with the new content object.
  onChange?: (newContent: Record<string, unknown>) => void;
  // Passes the standard React keyboard event.
  onKeyDown?: (event: React.KeyboardEvent) => void;
}

// === THEMING ===

export interface SparkBlockTheme {
  name: string;
  colors: {
    background: string;
    foreground: string;
    primary: string;
    secondary: string;
    muted: string;
    accent: string;
    border: string;
    
    // Block-specific
    blockBackground: string;
    blockBorder: string;
    blockHover: string;
    blockSelected: string;
    blockFocused: string;
  };
  
  spacing: {
    blockGap: string;
    inlineGap: string;
    padding: string;
    margin: string;
  };
  
  typography: {
    fontFamily: string;
    fontSize: string;
    lineHeight: string;
    
    // Block-specific typography
    heading1: { fontSize: string; fontWeight: string; lineHeight: string };
    heading2: { fontSize: string; fontWeight: string; lineHeight: string };
    heading3: { fontSize: string; fontWeight: string; lineHeight: string };
    body: { fontSize: string; fontWeight: string; lineHeight: string };
    code: { fontFamily: string; fontSize: string; };
  };
  
  // Component-specific styles
  components?: {
    plusButton?: Record<string, string>;
    dragHandle?: Record<string, string>;
    blockMenu?: Record<string, string>;
    toolbar?: Record<string, string>;
  };
}

// === PLUGINS ===

export interface SparkBlockPlugin {
  id: string;
  name: string;
  version?: string;
  dependencies?: string[];
  
  // Lifecycle hooks
  onEditorMount?(engine: SparkBlockEngine): void | Promise<void>;
  onEditorUnmount?(engine: SparkBlockEngine): void | Promise<void>;
  
  // Block lifecycle
  onBlockCreate?(block: SparkBlock): SparkBlock | Promise<SparkBlock>;
  onBlockUpdate?(block: SparkBlock, previousBlock: SparkBlock): SparkBlock | Promise<SparkBlock>;
  onBlockDelete?(block: SparkBlock): void | Promise<void>;
  onBlockMove?(block: SparkBlock, operation: MoveOperation): void | Promise<void>;
  
  // Document lifecycle
  onDocumentLoad?(blocks: SparkBlock[]): SparkBlock[] | Promise<SparkBlock[]>;
  onDocumentSave?(blocks: SparkBlock[]): SparkBlock[] | Promise<SparkBlock[]>;
  
  // UI extensions
  renderToolbar?(): ReactNode;
  renderSidebar?(): ReactNode;
  renderBlockOverlay?(block: SparkBlock, context: RenderContext): ReactNode;
  renderFloatingMenu?(): ReactNode;
  
  // Custom commands
  commands?: Record<string, SparkBlockCommand>;
  
  // Custom block types
  blockTypes?: BlockDefinition[];
  
  // Custom shortcuts
  shortcuts?: Record<string, SparkBlockCommand>;
}

export interface SparkBlockCommand {
  name: string;
  description?: string;
  execute: (engine: SparkBlockEngine, ...args: unknown[]) => void | Promise<void>;
  canExecute?: (engine: SparkBlockEngine) => boolean;
}

// === ENGINE ===

export interface SparkBlockEngineOptions {
  adapter: SparkBlockAdapter;
  plugins?: SparkBlockPlugin[];
  theme?: SparkBlockTheme;
  readonly?: boolean;
  autoSave?: boolean;
  autoSaveDelay?: number;
  maxUndoSteps?: number;
}

export interface SparkBlockEngineState {
  blocks: SparkBlock[];
  selectedBlockIds: string[];
  focusedBlockId: string | null;
  isDirty: boolean;
  isLoading: boolean;
  isSaving: boolean;
  
  // History
  canUndo: boolean;
  canRedo: boolean;
  
  // UI state
  showPlusMenu: boolean;
  plusMenuPosition?: { x: number; y: number };
  showBlockMenu: boolean;
  blockMenuBlockId?: string;
  
  // Drag & drop state
  dragState: {
    isDragging: boolean;
    draggedBlockId?: string;
    dropTarget?: string;
    dropPosition?: 'before' | 'after' | 'inside';
    dropRegion?: string;
  };
}

// === EVENTS ===

export interface SparkBlockEvent<TData = unknown> {
  type: string;
  data: TData;
  timestamp: number;
  blockId?: string;
}

export type SparkBlockEventListener<TData = unknown> = (event: SparkBlockEvent<TData>) => void;

// === ENGINE INTERFACE ===

export interface SparkBlockEngine {
  // State management
  getState(): SparkBlockEngineState;
  subscribe(listener: (state: SparkBlockEngineState) => void): () => void;
  
  // Document lifecycle
  loadDocument<TDocument>(document: TDocument): Promise<void>;
  saveDocument<TDocument>(): Promise<TDocument>;
  
  // Block operations
  createBlock(type: string, position?: InsertPosition, initialData?: Record<string, unknown>): Promise<void>;
  updateBlock(blockId: string, updates: UpdateOperation): Promise<void>;
  deleteBlock(blockId: string): Promise<void>;
  moveBlock(operation: MoveOperation): Promise<void>;
  duplicateBlock(blockId: string, position?: InsertPosition): Promise<void>;
  
  // Block queries
  getBlock(blockId: string): SparkBlock | null;
  getBlocks(): SparkBlock[];
  getSelectedBlocks(): SparkBlock[];
  getFocusedBlock(): SparkBlock | null;
  
  // Selection management
  selectBlock(blockId: string, addToSelection?: boolean): void;
  deselectBlock(blockId: string): void;
  clearSelection(): void;
  focusBlock(blockId: string): void;
  blurBlock(): void;
  
  // History
  undo(): Promise<void>;
  redo(): Promise<void>;
  
  // Commands
  executeCommand(command: string, ...args: unknown[]): Promise<void>;
  registerCommand(name: string, command: SparkBlockCommand): void;
  
  // Events
  emit<TData>(type: string, data: TData, blockId?: string): void;
  on<TData>(type: string, listener: SparkBlockEventListener<TData>): () => void;
  
  // Plugins
  addPlugin(plugin: SparkBlockPlugin): Promise<void>;
  removePlugin(pluginId: string): Promise<void>;
  getPlugin(pluginId: string): SparkBlockPlugin | null;
  
  // Validation
  validateBlock(blockId: string): Promise<ValidationResult>;
  validateDocument(): Promise<ValidationResult>;
  
  // Utility
  destroy(): void;
}

// === ERROR TYPES ===
// Error classes are implemented in ./errors.ts and exported from index.ts