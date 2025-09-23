// src/core/components/header-content/DashboardHeaderContent.tsx

import { useRef } from 'react';
import { Button } from '@/core/components/ui/button';
import { Upload, FilePlus2, ChevronDown, Github } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/core/components/ui/dropdown-menu';

interface DashboardHeaderContentProps {
  onImportZip?: () => void;
  onImportGitHub?: () => void;
  onCreateSite?: () => void;
  isImporting?: boolean;
}

export default function DashboardHeaderContent({
  onImportZip,
  onImportGitHub,
  onCreateSite,
  isImporting = false
}: DashboardHeaderContentProps) {
  const importDropdownRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={importDropdownRef}
            variant="ghost"
            disabled={isImporting}
            onMouseDown={(e) => e.stopPropagation()} // Prevent dragging on button
          >
            <Upload className="h-4 w-4" />
            {isImporting ? 'Importing...' : 'Import site'}
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onImportZip} disabled={isImporting}>
            <Upload className="mr-2 h-4 w-4" />
            Upload ZIP file
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onImportGitHub} disabled={isImporting}>
            <Github className="mr-2 h-4 w-4" />
            Import from GitHub repo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="outline"
        onClick={onCreateSite}
        onMouseDown={(e) => e.stopPropagation()} // Prevent dragging on button
      >
        <FilePlus2 className="h-4 w-4" />
        Create new site
      </Button>
    </div>
  );
}