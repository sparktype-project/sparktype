// src/packages/sparkblock/index.ts

// === CORE TYPES ===
export type {
  SparkBlock,
  BlockDefinition,
  BlockField,
  BlockRegion,
  BlockTrigger,
  BlockBehavior,
  BlockShortcut,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  InsertPosition,
  MoveOperation,
  UpdateOperation,
  SparkBlockAdapter,
  RenderContext,
  SparkBlockTheme,
  SparkBlockPlugin,
  SparkBlockCommand,
  SparkBlockEngine,
  SparkBlockEngineOptions,
  SparkBlockEngineState,
  SparkBlockEvent,
  SparkBlockEventListener
} from './types';

// === ENGINE ===
export { createSparkBlockEngine } from './engine/SparkBlockEngine';
export type { SparkBlockEngineImpl } from './engine/SparkBlockEngine';

// === UTILITIES ===
export { BlockOperations, BlockQueries } from './utils/blockOperations';
export type { BlockPath, BlockLocation } from './utils/blockOperations';

// === REACT COMPONENTS ===
export { SparkBlockEditor } from './components/SparkBlockEditor';
export { SparkBlockProvider, useSparkBlock } from './components/SparkBlockProvider';
export { BlockCanvas } from './components/BlockCanvas';
export { BlockRenderer } from './components/BlockRenderer';
export { BlockToolbar } from './components/BlockToolbar';
export { PlusMenu } from './components/PlusMenu';
export { BlockMenu } from './components/BlockMenu';
export { FloatingToolbar } from './components/FloatingToolbar';

// === DEFAULT BLOCK RENDERERS ===
export { DefaultBlockRenderers } from './components/blocks/DefaultBlockRenderers';
export type { BlockComponentProps } from './components/blocks/DefaultBlockRenderers';

// === ERROR TYPES ===
export {
  SparkBlockError,
  SparkBlockValidationError,
  SparkBlockAdapterError
} from './errors';

// === DEFAULT THEME ===
import type { SparkBlockTheme } from './types';

export const DEFAULT_SPARKBLOCK_THEME: SparkBlockTheme = {
  name: 'default',
  colors: {
    background: '#ffffff',
    foreground: '#1a1a1a',
    primary: '#0066cc',
    secondary: '#666666',
    muted: '#f5f5f5',
    accent: '#0052a3',
    border: '#e0e0e0',
    
    blockBackground: '#ffffff',
    blockBorder: '#e0e0e0',
    blockHover: '#f8f9fa',
    blockSelected: '#e3f2fd',
    blockFocused: '#1976d2'
  },
  
  spacing: {
    blockGap: '8px',
    inlineGap: '4px',
    padding: '12px',
    margin: '8px'
  },
  
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '14px',
    lineHeight: '1.5',
    
    heading1: { fontSize: '32px', fontWeight: '700', lineHeight: '1.2' },
    heading2: { fontSize: '24px', fontWeight: '600', lineHeight: '1.3' },
    heading3: { fontSize: '20px', fontWeight: '600', lineHeight: '1.4' },
    body: { fontSize: '14px', fontWeight: '400', lineHeight: '1.5' },
    code: { fontFamily: 'Monaco, Consolas, "Courier New", monospace', fontSize: '13px' }
  }
};

// === VERSION ===
export const SPARKBLOCK_VERSION = '1.0.0';