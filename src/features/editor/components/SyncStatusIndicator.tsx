// src/features/editor/components/SyncStatusIndicator.tsx

import { useState, useEffect } from 'react';
import { GitBranch, GitPullRequest, AlertTriangle, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/core/components/ui/tooltip';
import { toast } from 'sonner';

import { gitSyncService, type GitSyncState } from '@/core/services/publishing/gitSync.service';
import { conflictDetectionService } from '@/core/services/publishing/gitConflict.service';
import { ConflictResolutionDialog } from '@/components/ui/conflict-resolution-dialog';
import type { GitHubConfig } from '@/core/services/publishing/git.service';
import type { LocalSiteData } from '@/core/types';
import type { SimpleConflict, ConflictChoice } from '@/core/services/publishing/gitSync.service';

interface SyncStatusIndicatorProps {
  siteId: string;
  site: LocalSiteData;
}

export function SyncStatusIndicator({ siteId, site }: SyncStatusIndicatorProps) {
  const [syncState, setSyncState] = useState<GitSyncState | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [conflicts, setConflicts] = useState<SimpleConflict[]>([]);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [isResolvingConflicts, setIsResolvingConflicts] = useState(false);

  // Check if this site has GitHub publishing configured
  const githubConfig = site.manifest.publishingConfig?.provider === 'github'
    ? {
      ...site.manifest.publishingConfig.github,
      accessToken: site.secrets?.publishing?.github?.accessToken || ''
    } as GitHubConfig
    : null;

  const loadSyncState = async () => {
    const state = await gitSyncService.getSyncState(siteId);
    setSyncState(state);
  };

  useEffect(() => {
    if (githubConfig) {
      loadSyncState();
    }
  }, [siteId, githubConfig]);

  const checkSync = async () => {
    if (!githubConfig) return;

    setIsChecking(true);
    try {
      const status = await conflictDetectionService.checkSyncStatus(
        siteId,
        githubConfig,
        syncState?.branch || 'main'
      );

      await gitSyncService.updateSyncState(siteId, { syncStatus: status });

      if (status === 'behind' || status === 'diverged') {
        // Check for conflicts
        const detectedConflicts = await conflictDetectionService.detectConflicts(
          site,
          githubConfig,
          syncState?.branch || 'main'
        );

        if (detectedConflicts.length > 0) {
          setConflicts(detectedConflicts);
          setShowConflictDialog(true);
          await gitSyncService.updateSyncState(siteId, {
            syncStatus: 'conflict',
            conflictedFiles: detectedConflicts.map(c => c.filePath)
          });
        }
      }

      await loadSyncState();
      toast.success('Sync status updated');
    } catch (error) {
      console.error('Error checking sync:', error);
      toast.error('Failed to check sync status');
    } finally {
      setIsChecking(false);
    }
  };

  const handleResolveConflicts = async (choices: ConflictChoice[]) => {
    if (!githubConfig) return;

    setIsResolvingConflicts(true);
    try {
      await conflictDetectionService.applyResolutions(siteId, choices, githubConfig);
      setShowConflictDialog(false);
      setConflicts([]);
      await loadSyncState();
      toast.success('Conflicts resolved successfully');
    } catch (error) {
      console.error('Error resolving conflicts:', error);
      toast.error('Failed to resolve conflicts');
    } finally {
      setIsResolvingConflicts(false);
    }
  };

  // Don't render if GitHub is not configured
  if (!githubConfig || !syncState) {
    return null;
  }

  const getSyncIcon = () => {
    if (isChecking) return <RefreshCw className="h-3 w-3 animate-spin" />;

    switch (syncState.syncStatus) {
      case 'synced': return <CheckCircle2 className="h-3 w-3 text-green-600" />;
      case 'ahead': return <GitPullRequest className="h-3 w-3 text-blue-600" />;
      case 'behind': return <Clock className="h-3 w-3 text-yellow-600" />;
      case 'diverged': return <GitBranch className="h-3 w-3 text-orange-600" />;
      case 'conflict': return <AlertTriangle className="h-3 w-3 text-red-600" />;
      default: return <GitBranch className="h-3 w-3 text-gray-600" />;
    }
  };

  const getSyncLabel = () => {
    switch (syncState.syncStatus) {
      case 'synced': return 'Synced';
      case 'ahead': return 'Ahead';
      case 'behind': return 'Behind';
      case 'diverged': return 'Diverged';
      case 'conflict': return 'Conflicts';
      default: return 'Unknown';
    }
  };

  const getSyncDescription = () => {
    switch (syncState.syncStatus) {
      case 'synced': return 'Local and remote are in sync';
      case 'ahead': return 'Local has unpublished changes';
      case 'behind': return 'Remote has newer changes';
      case 'diverged': return 'Local and remote have different changes';
      case 'conflict': return `${conflicts.length} conflicted files need resolution`;
      default: return 'Sync status unknown';
    }
  };

  const getVariant = (): "default" | "secondary" | "destructive" | "outline" => {
    switch (syncState.syncStatus) {
      case 'synced': return 'secondary';
      case 'ahead': return 'default';
      case 'behind': return 'outline';
      case 'diverged': return 'outline';
      case 'conflict': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <Badge variant={getVariant()} className="flex items-center gap-1 text-xs">
                {getSyncIcon()}
                {getSyncLabel()}
              </Badge>
              {syncState.syncStatus !== 'synced' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={checkSync}
                  disabled={isChecking}
                  className="h-6 px-2 text-xs"
                >
                  {isChecking ? 'Checking...' : 'Check'}
                </Button>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-center">
              <div className="font-medium">{getSyncLabel()}</div>
              <div className="text-xs text-muted-foreground">{getSyncDescription()}</div>
              {syncState.lastSyncTimestamp > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  Last checked: {new Date(syncState.lastSyncTimestamp).toLocaleTimeString()}
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <ConflictResolutionDialog
        open={showConflictDialog}
        onOpenChange={setShowConflictDialog}
        conflicts={conflicts}
        onResolve={handleResolveConflicts}
        isLoading={isResolvingConflicts}
      />
    </>
  );
}