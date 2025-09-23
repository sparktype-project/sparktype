// src/core/components/header-content/DefaultHeaderContent.tsx

import { useParams, Link } from 'react-router-dom';
import { useCallback } from 'react';
import { Button } from '@/core/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useAppStore } from '@/core/state/useAppStore';
import { type AppStore } from '@/core/state/useAppStore';
import { usePlatformContext } from '@/core/providers/PlatformProvider';

export default function DefaultHeaderContent() {
  const { siteId = '' } = useParams<{ siteId: string }>();
  const site = useAppStore(useCallback((state: AppStore) => state.getSiteById(siteId), [siteId]));
  const { isTauri, isDesktop } = usePlatformContext();

  if (!site) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <>
      {/* Site title - draggable area */}
      <div
        className="flex-1 text-lg text-muted-foreground truncate text-center cursor-move"
        {...(isTauri && isDesktop ? { 'data-tauri-drag-region': true } : {})}
      >
        <span className="font-bold text-foreground">{site.manifest.title}</span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          asChild
          onMouseDown={(e) => e.stopPropagation()} // Prevent dragging on button
        >
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            <span className='hidden md:block ml-2'>Dashboard</span>
          </Link>
        </Button>
      </div>
    </>
  );
}