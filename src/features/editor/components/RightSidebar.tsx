'use client';

import { type ReactNode } from 'react';
import { useUIStore } from '@/core/state/uiStore';
import { cn } from '@/core/libraries/utils';

interface RightSidebarProps {
  children: ReactNode;
}

export default function RightSidebar({ children }: RightSidebarProps) {
  const { isRightOpen } = useUIStore((state) => state.sidebar);

  return (
    <aside
      className={cn(
        // Base styles
        'h-full w-80 shrink-0 border-l bg-muted/20 transition-all duration-300 ease-in-out',
        
        // Hide/Show Logic
        isRightOpen ? 'ml-0' : '-mr-[320px] w-0 border-l-0 opacity-0'
      )}
    >
      <div className="h-full overflow-y-auto">
        {children}
      </div>
    </aside>
  );
}