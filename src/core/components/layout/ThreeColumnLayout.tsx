'use client';

import type { ReactNode } from 'react';
import { useUIStore } from '@/core/state/uiStore';
import { cn } from '@/core/libraries/utils';
import EditorHeader from '@/features/editor/components/EditorHeader';

interface ThreeColumnLayoutProps {
  leftSidebar: ReactNode;
  rightSidebar: ReactNode;
  children: ReactNode;
  headerActions?: ReactNode;
}

export default function ThreeColumnLayout({ leftSidebar, rightSidebar, children, headerActions }: ThreeColumnLayoutProps) {
  const isLeftOpen = useUIStore((state) => state.sidebar.isLeftOpen);
  const isRightOpen = useUIStore((state) => state.sidebar.isRightOpen);

  return (
    <div className="flex h-screen w-full flex-col">
      <EditorHeader actions={headerActions} />
      
      {/* This is now the positioning context for all three columns */}
      <div className="relative flex-1 overflow-hidden">
        
        
        {/* Left Sidebar: Absolutely positioned within the parent div */}
        <aside
          className={cn(
            'absolute inset-y-0 left-0 z-20 h-full w-72 border-r bg-background transition-transform duration-300 ease-in-out',
            isLeftOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {/* This container ensures its direct child can scroll */}
          <div className="h-full w-full overflow-y-auto">
            {leftSidebar}
          </div>
        </aside>

        {/* Main Content: The layout is now controlled by padding */}
        <main
          className={cn(
            'h-full overflow-y-auto transition-all duration-300 ease-in-out',
            // When left sidebar is open, add left padding
            isLeftOpen ? 'lg:pl-72' : 'lg:pl-0',
            // When right sidebar is open, add right padding
            isRightOpen ? 'lg:pr-80' : 'lg:pr-0'
          )}
        >
          {children}
        </main>

        {/* Right Sidebar: Absolutely positioned within the parent div */}
        <aside
          className={cn(
            'absolute inset-y-0 right-0 z-10 h-full w-80 border-l bg-background transition-transform duration-300 ease-in-out',
            isRightOpen ? 'translate-x-0' : 'translate-x-full'
          )}
        >
          {/* This container ensures its direct child can scroll */}
          <div className="h-full w-full overflow-y-auto">
            {rightSidebar}
          </div>
        </aside>
      </div>
    </div>
  );
}