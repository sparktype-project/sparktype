// src/packages/sparkblock/components/SparkBlockProvider.tsx

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react'; // FIX: Use type-only import for ReactNode
import type { SparkBlockEngine, SparkBlockTheme } from '../types';

/**
 * Defines the value provided by the SparkBlockContext.
 *
 * In our refined architecture, this context is responsible for providing STABLE
 * dependencies that do not change frequently. This prevents unnecessary re-renders.
 *
 * - `engine`: The main engine instance for calling methods.
 * - `theme`: The theme object for styling.
 * - `readonly`: The editor's read-only status.
 *
 * For DYNAMIC state that changes often (like blocks, selection), components
 * should use the `useSparkBlockEngineStore` hook directly.
 */
interface SparkBlockContextValue {
  engine: SparkBlockEngine;
  theme?: SparkBlockTheme;
  readonly: boolean;
}

const SparkBlockContext = createContext<SparkBlockContextValue | null>(null);

export interface SparkBlockProviderProps {
  engine: SparkBlockEngine;
  theme?: SparkBlockTheme;
  readonly?: boolean;
  children: ReactNode;
}

export function SparkBlockProvider({
  engine,
  theme,
  readonly = false,
  children,
}: SparkBlockProviderProps) {
  const value: SparkBlockContextValue = {
    engine,
    theme,
    readonly,
  };

  return (
    <SparkBlockContext.Provider value={value}>
      <div className="sparkblock-provider" data-theme={theme?.name}>
        {children}
      </div>
    </SparkBlockContext.Provider>
  );
}

/**
 * The "Two-Hook" System for Interacting with the Editor:
 *
 * 1. useSparkBlock():
 *    - PURPOSE: To get stable dependencies and configuration.
 *    - USE WHEN: You need to call an engine method (e.g., `engine.createBlock()`)
 *      or access static config like the theme.
 *    - Re-renders: Very rarely, only if the entire editor is re-initialized.
 *
 * 2. useSparkBlockEngineStore():
 *    - PURPOSE: To get dynamic, frequently changing state.
 *    - USE WHEN: You need to read state like `blocks`, `selectedBlockIds`, `canUndo`,
 *      and have your component re-render when *that specific state* changes.
 *    - Re-renders: Frequently, but targeted to the state you select.
 */

/**
 * Custom hook to access the stable SparkBlock context (engine, theme, readonly).
 */
export function useSparkBlock(): SparkBlockContextValue {
  const context = useContext(SparkBlockContext);
  if (!context) {
    throw new Error('useSparkBlock must be used within a SparkBlockProvider');
  }
  return context;
}