// src/core/components/header-content/ViewHeaderContent.tsx

import { useParams, Link } from 'react-router-dom';
import { useCallback, useState, useEffect } from 'react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Edit3, ExternalLink, ChevronLeft, ChevronRight, Home, RotateCcw } from 'lucide-react';
import { useAppStore } from '@/core/state/useAppStore';
import { type AppStore } from '@/core/state/useAppStore';
import { useBrowserNavigation } from '@/features/viewer/hooks/useBrowserNavigation';

export default function ViewHeaderContent() {
  const { siteId = '' } = useParams<{ siteId: string }>();
  const site = useAppStore(useCallback((state: AppStore) => state.getSiteById(siteId), [siteId]));
  const navigation = useBrowserNavigation();

  // Address bar state
  const [addressBarValue, setAddressBarValue] = useState(navigation.currentPath);
  const [isEditing, setIsEditing] = useState(false);

  // Update address bar when navigation changes
  useEffect(() => {
    if (!isEditing) {
      setAddressBarValue(navigation.currentPath);
    }
  }, [navigation.currentPath, isEditing]);

  // Handle address bar input
  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddressBarValue(e.target.value);
  };

  // Handle address bar key events
  const handleAddressKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      navigation.navigateToPath(addressBarValue);
      setIsEditing(false);
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setAddressBarValue(navigation.currentPath);
      setIsEditing(false);
      (e.target as HTMLInputElement).blur();
    }
  };

  // Handle address bar focus
  const handleAddressFocus = () => {
    setIsEditing(true);
  };

  const handleAddressBlur = () => {
    setIsEditing(false);
    setAddressBarValue(navigation.currentPath);
  };

  // Determine edit path - try to link to the current page being viewed
  const currentEditPath = navigation.currentPath !== '/' ? navigation.currentPath : '';

  if (!site) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="flex items-center gap-2 w-full" data-tauri-drag-region>
      {/* Navigation Controls */}
      <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
        <Button
          size="sm"
          variant="ghost"
          disabled={!navigation.canGoBack}
          onClick={navigation.goBack}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!navigation.canGoForward}
          onClick={navigation.goForward}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={navigation.goHome}
          className="h-8 w-8 p-0"
        >
          <Home className="h-4 w-4" />
        </Button>
      </div>

      {/* URL Address Bar */}
      <div className="flex-1 mx-3" onMouseDown={(e) => e.stopPropagation()}>
        <Input
          value={addressBarValue}
          onChange={handleAddressChange}
          onKeyDown={handleAddressKeyDown}
          onFocus={handleAddressFocus}
          onBlur={handleAddressBlur}
          placeholder="Enter site path..."
          className="h-8 browser-address-bar"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
        <Button
          size="sm"
          variant="ghost"
          onClick={navigation.refresh}
          className="h-8 w-8 p-0"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        <Button
          size="sm"
          variant="ghost"
          asChild
          className="h-8 w-8 p-0"
        >
          <Link to={`/sites/${siteId}/edit${currentEditPath}`}>
            <Edit3 className="h-4 w-4" />
          </Link>
        </Button>

        {site.manifest.baseUrl && (
          <Button
            size="sm"
            variant="ghost"
            asChild
            className="h-8 w-8 p-0"
          >
            <a href={`${site.manifest.baseUrl}${navigation.currentPath}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}