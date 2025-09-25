'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useUIStore } from '@/core/state/uiStore';
import { cn } from '@/core/libraries/utils';
import EditorHeaderContent from '@/core/components/header-content/EditorHeaderContent';
import { useHeaderContext } from '@/core/contexts/HeaderContext';

interface ThreeColumnLayoutProps {
  leftSidebar: ReactNode;
  rightSidebar: ReactNode;
  children: ReactNode;
  headerActions?: ReactNode;
}

export default function ThreeColumnLayout({ leftSidebar, rightSidebar, children, headerActions }: ThreeColumnLayoutProps) {
  const isLeftOpen = useUIStore((state) => state.sidebar.isLeftOpen);
  const isRightOpen = useUIStore((state) => state.sidebar.isRightOpen);
  const toggleLeftSidebar = useUIStore((state) => state.sidebar.toggleLeftSidebar);
  const toggleRightSidebar = useUIStore((state) => state.sidebar.toggleRightSidebar);
  const { setHeaderContent } = useHeaderContext();

  // Set the header content when this layout mounts
  useEffect(() => {
    setHeaderContent(<EditorHeaderContent actions={headerActions} />);

    // Clean up when unmounting
    return () => {
      setHeaderContent(null);
    };
  }, [headerActions, setHeaderContent]);

  return (
    <div className="h-full w-full flex flex-col">
      {/* This is now the positioning context for all three columns */}
      <div className="relative flex-1 overflow-hidden min-h-0">

        {/* Mobile Overlays - only visible on mobile when sidebars are open */}
        {/* Left Sidebar Overlay */}
        {isLeftOpen && (
          <div
            className="absolute inset-0 z-[60] dark:bg-black/60 bg-white/50 transition-opacity duration-300 ease-in-out lg:hidden cursor-pointer backdrop-blur"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleLeftSidebar();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleLeftSidebar();
            }}
            aria-label="Close left sidebar"
            role="button"
            tabIndex={0}
          />
        )}

        {/* Right Sidebar Overlay */}
        {isRightOpen && (
          <div
            className="absolute inset-0 z-[60] dark:g-black/60 bg-white/50 transition-opacity duration-300 ease-in-out lg:hidden cursor-pointer  backdrop-blur"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleRightSidebar();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleRightSidebar();
            }}
            aria-label="Close right sidebar"
            role="button"
            tabIndex={0}
          />
        )}

        {/* Left Sidebar: Absolutely positioned within the parent div */}
        <aside
          className={cn(
            'absolute inset-y-0 left-0 z-[65] h-full w-72 border-r bg-background transition-transform duration-300 ease-in-out',
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
            'h-full overflow-hidden transition-all duration-300 ease-in-out',
            // When left sidebar is open, add left padding
            isLeftOpen ? 'lg:pl-72' : 'lg:pl-0',
            // When right sidebar is open, add right padding
            isRightOpen ? 'lg:pr-72' : 'lg:pr-0'
          )}
        >
          <div className="h-full overflow-y-auto">
            {children}
          </div>
        </main>

        {/* Right Sidebar: Absolutely positioned within the parent div */}
        <aside
          className={cn(
            'absolute inset-y-0 right-0 z-[65] h-full w-72 border-l bg-background transition-transform duration-300 ease-in-out overflow-y-auto',
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