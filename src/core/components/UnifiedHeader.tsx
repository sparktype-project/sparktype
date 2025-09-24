// src/core/components/UnifiedHeader.tsx

import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Leaf } from 'lucide-react';
import { cn } from '@/core/libraries/utils';
import { usePlatformContext } from '@/core/providers/PlatformProvider';

interface UnifiedHeaderProps {
  children: ReactNode;
  title?: string;
  showLogo?: boolean;
  className?: string;
}

export default function UnifiedHeader({
  children,
  title,
  showLogo = true,
  className
}: UnifiedHeaderProps) {
  const { isTauri, isDesktop } = usePlatformContext();

  // For Tauri Desktop: Custom titlebar with draggable area and native traffic lights
  if (isTauri && isDesktop) {
    return (
      <header
        data-tauri-drag-region
        className={cn(
          "sticky top-0 z-[90] w-full  pl-18",
          // Transparent background for Tauri to maintain rounded corners and native appearance
          "bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl supports-[backdrop-filter]:backdrop-blur-xl border-b",
          className
        )}
      >
        <div
        
          className="flex items-center justify-between h-[45px] px-4"
          data-tauri-drag-region
        >
          {/* Logo section */}
          {showLogo && (
            <div
              className="flex items-center space-x-2 shrink-0"
              data-tauri-drag-region
            >
              <Link to="/" className="flex items-center space-x-2">
                <img src="/sparktype.svg" width={20} height={20} alt="Sparktype" className='m-auto'/>
                <span className="text-sm font-bold ml-2 text-foreground hidden sm:inline">
                  {title || 'Sparktype'}
                </span>
              </Link>
            </div>
          )}

          {/* Content area */}
          <div className="flex-1 flex items-center justify-end"
          data-tauri-drag-region>
             {children}
          </div>
        </div>
      </header>
    );
  }

  // For web: Standard header without drag regions
  return (
    <header className={cn(
      "sticky top-0 z-[100] w-full  bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b",
      className
    )}>
      <div className="flex h-16 items-center justify-between px-4">
        {/* Logo section */}
        {showLogo && (
          <div className="flex items-center space-x-2 shrink-0">
            <Link to="/" className="flex items-center space-x-2">
              <Leaf className="h-7 w-7 text-primary" />
              <span className="text-2xl font-bold text-foreground hidden sm:inline">
                {title || 'Sparktype'}
              </span>
            </Link>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 flex items-center justify-end">
          {children}
        </div>
      </div>
    </header>
  );
}