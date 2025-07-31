// src/packages/sparkblock/engine/SparkBlockEngine.ts

import type { Patch } from 'immer';
import { produceWithPatches, applyPatches, enablePatches } from 'immer';

// Enable patches for undo/redo functionality
enablePatches();
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  SparkBlock,
  SparkBlockAdapter,
  SparkBlockEngine,
  SparkBlockEngineOptions,
  SparkBlockEngineState,
  SparkBlockPlugin,
  SparkBlockCommand,
  SparkBlockEvent,
  SparkBlockEventListener,
  InsertPosition,
  MoveOperation,
  UpdateOperation,
  ValidationResult,
} from '../types';
import { SparkBlockError } from '../errors';
import { BlockOperations } from '../utils/blockOperations';

// A single entry in the history stack.
interface HistoryEntry {
  patches: Patch[];
  inversePatches: Patch[];
}

// The state properties of the store.
interface StoreState extends SparkBlockEngineState {
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
}

// The actions (methods) available on the store that mutate state.
interface StoreActions {
  _updateBlocksAndHistory: (newBlocks: SparkBlock[]) => void;
  undo: () => void;
  redo: () => void;
  selectBlock: (blockId: string, addToSelection?: boolean) => void;
  deselectBlock: (blockId: string) => void;
  reset: () => void;
}

// Define the initial state for the store.
const initialState: StoreState = {
  blocks: [],
  selectedBlockIds: [],
  focusedBlockId: null,
  isDirty: false,
  isLoading: false,
  isSaving: false,
  canUndo: false,
  canRedo: false,
  showPlusMenu: false,
  showBlockMenu: false,
  dragState: {
    isDragging: false,
  },
  undoStack: [],
  redoStack: [],
};

/**
 * The Zustand store, created with the immer middleware for safe and simple state updates.
 * This is the single source of truth for the editor's state and state-mutating logic.
 */
export const useSparkBlockEngineStore = create<StoreState & StoreActions>()(
  immer((set, get) => ({
    ...initialState,

    // === STORE ACTIONS (The only place state is mutated) ===

    _updateBlocksAndHistory: (newBlocks: SparkBlock[]) => {
      const [nextState, patches, inversePatches] = produceWithPatches(
        get().blocks,
        () => newBlocks
      );

      if (patches.length > 0) {
        set(state => {
          state.blocks = nextState;
          state.undoStack.push({ patches, inversePatches });
          state.redoStack = [];
          state.isDirty = true;
          state.canUndo = true;
          state.canRedo = false;
        });
      }
    },

    undo: () => {
      set(state => {
        const historyEntry = state.undoStack.pop();
        if (historyEntry) {
          state.blocks = applyPatches(state.blocks, historyEntry.inversePatches);
          state.redoStack.push(historyEntry);
          state.canUndo = state.undoStack.length > 0;
          state.canRedo = true;
        }
      });
    },

    redo: () => {
      set(state => {
        const historyEntry = state.redoStack.pop();
        if (historyEntry) {
          state.blocks = applyPatches(state.blocks, historyEntry.patches);
          state.undoStack.push(historyEntry);
          state.canRedo = state.redoStack.length > 0;
          state.canUndo = true;
        }
      });
    },

    selectBlock: (blockId: string, addToSelection: boolean = false) => {
      set(state => {
        const currentSelection = new Set(state.selectedBlockIds);
        if (addToSelection) {
          currentSelection.add(blockId);
        } else {
          currentSelection.clear();
          currentSelection.add(blockId);
        }
        state.selectedBlockIds = Array.from(currentSelection);
      });
    },

    deselectBlock: (blockId: string) => {
      set(state => {
        state.selectedBlockIds = state.selectedBlockIds.filter(id => id !== blockId);
      });
    },
    
    reset: () => set(initialState),
  }))
);

/**
 * The SparkBlockEngine class. It acts as a "controller" that orchestrates actions
 * and business logic, but delegates all state management to the Zustand store.
 */
export class SparkBlockEngineImpl implements SparkBlockEngine {
  private adapter: SparkBlockAdapter;
  private plugins: Map<string, SparkBlockPlugin> = new Map();
  private commands: Map<string, SparkBlockCommand> = new Map();
  private eventListeners: Map<string, Set<SparkBlockEventListener<unknown>>> = new Map();

  private readonly autoSave: boolean;
  private readonly autoSaveDelay: number;
  private autoSaveTimer?: NodeJS.Timeout;

  constructor(options: SparkBlockEngineOptions) {
    this.adapter = options.adapter;
    this.autoSave = options.autoSave ?? true;
    this.autoSaveDelay = options.autoSaveDelay ?? 1000;

    this.initializeBuiltInCommands();
    options.plugins?.forEach(plugin => this.addPlugin(plugin));
  }

  // === STATE & LIFECYCLE (Wrappers around the store) ===

  getState(): SparkBlockEngineState {
    return useSparkBlockEngineStore.getState();
  }

  subscribe(listener: (state: SparkBlockEngineState) => void): () => void {
    return useSparkBlockEngineStore.subscribe(state => listener(state));
  }

  async loadDocument<TDocument>(document: TDocument): Promise<void> {
    useSparkBlockEngineStore.setState({ isLoading: true });
    try {
      let blocks = await this.adapter.parse(document);
      for (const plugin of this.plugins.values()) {
        if (plugin.onDocumentLoad) {
          blocks = await plugin.onDocumentLoad(blocks);
        }
      }
      // Set only the state properties, not the actions
      useSparkBlockEngineStore.setState({ ...initialState, blocks, isLoading: false });
      this.emit('document:loaded', { blocks });
    } catch (error) {
      useSparkBlockEngineStore.setState({ isLoading: false });
      throw new SparkBlockError(`Failed to load document: ${(error as Error).message}`);
    }
  }

  async saveDocument<TDocument>(): Promise<TDocument> {
    useSparkBlockEngineStore.setState({ isSaving: true });
    try {
      let blocks = [...this.getBlocks()];
      for (const plugin of this.plugins.values()) {
        if (plugin.onDocumentSave) blocks = await plugin.onDocumentSave(blocks);
      }
      const doc = await this.adapter.serialize(blocks);
      useSparkBlockEngineStore.setState({ isDirty: false, isSaving: false });
      this.emit('document:saved', { document: doc });
      return doc as TDocument;
    } catch (error) {
      useSparkBlockEngineStore.setState({ isSaving: false });
      throw new SparkBlockError(`Failed to save document: ${(error as Error).message}`);
    }
  }

  // === BLOCK OPERATIONS (Calling store actions) ===

  private _commit(newBlocks: SparkBlock[]) {
    useSparkBlockEngineStore.getState()._updateBlocksAndHistory(newBlocks);
    this.scheduleAutoSave();
  }

  async createBlock(type: string, position?: InsertPosition, initialData?: Record<string, unknown>): Promise<void> {
    let block = await this.adapter.createBlock(type, initialData);
    for (const plugin of this.plugins.values()) {
      if (plugin.onBlockCreate) block = await plugin.onBlockCreate(block);
    }
    const newBlocks = BlockOperations.insertBlock(this.getBlocks(), block, position);
    this._commit(newBlocks);
    this.focusBlock(block.id);
    this.emit('block:created', { block, position });
  }

  async updateBlock(blockId: string, updates: UpdateOperation): Promise<void> {
    const oldBlock = this.getBlock(blockId);
    if (!oldBlock) throw new SparkBlockError(`Block ${blockId} not found`);

    let newBlocks = BlockOperations.updateBlock(this.getBlocks(), blockId, updates);
    let newBlock = BlockOperations.findBlock(newBlocks, blockId)?.block;
    if (newBlock) {
      for (const plugin of this.plugins.values()) {
        if (plugin.onBlockUpdate) {
          newBlock = await plugin.onBlockUpdate(newBlock, oldBlock);
          newBlocks = BlockOperations.updateBlock(newBlocks, blockId, {
            blockId, // The missing property
            content: newBlock.content,
            config: newBlock.config,
          });
        }
      }
    }
    this._commit(newBlocks);
    this.emit('block:updated', { blockId, updates, oldBlock, newBlock });
  }

  async deleteBlock(blockId: string): Promise<void> {
    const block = this.getBlock(blockId);
    if (!block) return;
    for (const plugin of this.plugins.values()) {
      await plugin.onBlockDelete?.(block);
    }
    const newBlocks = BlockOperations.removeBlock(this.getBlocks(), blockId);
    this._commit(newBlocks);
    this.deselectBlock(blockId);
    if (this.getState().focusedBlockId === blockId) this.blurBlock();
    this.emit('block:deleted', { block });
  }

  async moveBlock(operation: MoveOperation): Promise<void> {
    const block = this.getBlock(operation.blockId);
    if (!block) return;
    for (const plugin of this.plugins.values()) {
      await plugin.onBlockMove?.(block, operation);
    }
    const newBlocks = BlockOperations.moveBlock(this.getBlocks(), operation);
    this._commit(newBlocks);
    this.emit('block:moved', { block, operation });
  }

  async duplicateBlock(blockId: string, position?: InsertPosition): Promise<void> {
    const newBlocks = BlockOperations.duplicateBlock(this.getBlocks(), blockId, position);
    this._commit(newBlocks);
    this.emit('block:duplicated', { originalBlockId: blockId, position });
  }

  // === HISTORY (Calling store actions) ===

  async undo(): Promise<void> {
    useSparkBlockEngineStore.getState().undo();
    this.emit('history:undo', { blocks: this.getBlocks() });
  }

  async redo(): Promise<void> {
    useSparkBlockEngineStore.getState().redo();
    this.emit('history:redo', { blocks: this.getBlocks() });
  }

  // === QUERIES, SELECTION & FOCUS ===

  getBlock(blockId: string): SparkBlock | null {
    return BlockOperations.findBlock(this.getBlocks(), blockId)?.block || null;
  }

  getBlocks(): SparkBlock[] {
    return useSparkBlockEngineStore.getState().blocks;
  }
  
  // FIX: Re-implementing missing methods
  getSelectedBlocks(): SparkBlock[] {
      return this.getState().selectedBlockIds
          .map(id => this.getBlock(id))
          .filter((b): b is SparkBlock => !!b);
  }

  getFocusedBlock(): SparkBlock | null {
      const { focusedBlockId } = this.getState();
      return focusedBlockId ? this.getBlock(focusedBlockId) : null;
  }

  selectBlock(blockId: string, addToSelection?: boolean): void {
    if (!this.getBlock(blockId)) return;
    useSparkBlockEngineStore.getState().selectBlock(blockId, addToSelection);
    this.emit('selection:changed', { selectedBlockIds: this.getState().selectedBlockIds });
  }

  deselectBlock(blockId: string): void {
    useSparkBlockEngineStore.getState().deselectBlock(blockId);
    this.emit('selection:changed', { selectedBlockIds: this.getState().selectedBlockIds });
  }

  clearSelection(): void {
    useSparkBlockEngineStore.setState({ selectedBlockIds: [] });
    this.emit('selection:changed', { selectedBlockIds: [] });
  }

  focusBlock(blockId: string): void {
    if (!this.getBlock(blockId)) return;
    useSparkBlockEngineStore.setState({ focusedBlockId: blockId });
    this.emit('focus:changed', { focusedBlockId: blockId });
  }

  blurBlock(): void {
    useSparkBlockEngineStore.setState({ focusedBlockId: null });
    this.emit('focus:changed', { focusedBlockId: null });
  }

  // === COMMANDS, EVENTS, PLUGINS, etc. ===

  async executeCommand(command: string, ...args: unknown[]): Promise<void> {
    const cmd = this.commands.get(command);
    if (!cmd) throw new SparkBlockError(`Command "${command}" not found`);
    if (cmd.canExecute && !cmd.canExecute(this)) throw new SparkBlockError(`Command "${command}" cannot be executed`);
    await cmd.execute(this, ...args);
    this.emit('command:executed', { command, args });
  }

  registerCommand(name: string, command: SparkBlockCommand): void {
    this.commands.set(name, command);
  }

  emit<TData>(type: string, data: TData, blockId?: string): void {
    const event: SparkBlockEvent<TData> = { type, data, timestamp: Date.now(), blockId };
    this.eventListeners.get(type)?.forEach(listener => listener(event));
  }

  on<TData>(type: string, listener: SparkBlockEventListener<TData>): () => void {
    if (!this.eventListeners.has(type)) this.eventListeners.set(type, new Set());
    const listeners = this.eventListeners.get(type)!;
    listeners.add(listener as SparkBlockEventListener<unknown>);
    return () => listeners.delete(listener as SparkBlockEventListener<unknown>);
  }

  async addPlugin(plugin: SparkBlockPlugin): Promise<void> {
    this.plugins.set(plugin.id, plugin);
    if (plugin.commands) Object.entries(plugin.commands).forEach(([name, command]) => this.registerCommand(name, command));
    await plugin.onEditorMount?.(this);
    this.emit('plugin:added', { plugin });
  }

  async removePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;
    await plugin.onEditorUnmount?.(this);
    if (plugin.commands) Object.keys(plugin.commands).forEach(name => this.commands.delete(name));
    this.plugins.delete(pluginId);
    this.emit('plugin:removed', { pluginId });
  }

  getPlugin(pluginId: string): SparkBlockPlugin | null {
    return this.plugins.get(pluginId) || null;
  }
  
  // FIX: Re-implementing missing method
  async validateDocument(): Promise<ValidationResult> {
      const results = await Promise.all(this.getBlocks().map(block => this.validateBlock(block.id)));
      const allErrors = results.flatMap(r => r.errors);
      const allWarnings = results.flatMap(r => r.warnings || []);
      return { valid: allErrors.length === 0, errors: allErrors, warnings: allWarnings };
  }

  async validateBlock(blockId: string): Promise<ValidationResult> {
    const block = this.getBlock(blockId);
    if (!block) return { valid: false, errors: [{ message: `Block ${blockId} not found` }] };
    return this.adapter.validateBlock(block);
  }

  destroy(): void {
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.plugins.forEach(async plugin => await plugin.onEditorUnmount?.(this));
    this.eventListeners.clear();
    this.emit('engine:destroyed', {});
  }

  private scheduleAutoSave(): void {
    if (!this.autoSave) return;
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(async () => {
      if (this.getState().isDirty) {
        try {
          await this.saveDocument();
        } catch (error) {
          this.emit('autosave:failed', { error });
        }
      }
    }, this.autoSaveDelay);
  }

  private initializeBuiltInCommands(): void {
    this.registerCommand('delete-selected', {
      name: 'Delete Selected',
      execute: async engine => {
        const selectedIds = [...engine.getState().selectedBlockIds];
        const finalBlocks = selectedIds.reduce((blocks, id) => {
          return BlockOperations.removeBlock(blocks, id);
        }, engine.getBlocks());
        this._commit(finalBlocks);
      },
      canExecute: engine => engine.getState().selectedBlockIds.length > 0,
    });
  }
}

// Factory function
export function createSparkBlockEngine(options: SparkBlockEngineOptions): SparkBlockEngine {
  return new SparkBlockEngineImpl(options);
}