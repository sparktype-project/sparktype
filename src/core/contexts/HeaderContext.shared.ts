import { createContext, useContext, type ReactNode } from 'react';

export interface HeaderContextType {
  setHeaderContent: (content: ReactNode) => void;
}

export const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export function useHeaderContext(): HeaderContextType {
  const context = useContext(HeaderContext);
  if (!context) {
    throw new Error('useHeaderContext must be used within HeaderProvider');
  }
  return context;
}
