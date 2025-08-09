// src/components/ui/conflict-resolution-dialog.tsx

import { useState } from 'react';
import { AlertTriangle, Clock, User, FileText, Settings } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/core/components/ui/dialog';
import { Label } from '@/core/components/ui/label';
// Using standard HTML radio inputs since RadioGroup component doesn't exist
import { Card, CardContent } from '@/core/components/ui/card';
import { Badge } from '@/core/components/ui/badge';
import type { SimpleConflict, ConflictChoice, ConflictResolution } from '@/core/services/gitSync.service';

interface ConflictResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: SimpleConflict[];
  onResolve: (choices: ConflictChoice[]) => void;
  isLoading?: boolean;
}

interface ConflictItemProps {
  conflict: SimpleConflict;
  choice: ConflictResolution | undefined;
  onChange: (resolution: ConflictResolution) => void;
}

function ConflictItem({ conflict, choice, onChange }: ConflictItemProps) {
  const formatDate = (timestamp: number) => {
    if (timestamp === 0) return 'New file';
    return new Date(timestamp).toLocaleString();
  };

  const getConflictIcon = () => {
    switch (conflict.conflictType) {
      case 'content': return <FileText className="h-4 w-4" />;
      case 'frontmatter': return <Settings className="h-4 w-4" />;
      case 'both': return <FileText className="h-4 w-4" />;
    }
  };

  const getConflictLabel = () => {
    switch (conflict.conflictType) {
      case 'content': return 'Content changed';
      case 'frontmatter': return 'Settings changed';
      case 'both': return 'Content & settings changed';
    }
  };

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            {getConflictIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-medium text-gray-900">{conflict.fileName}</h4>
              <Badge variant="secondary" className="text-xs">
                {getConflictLabel()}
              </Badge>
            </div>
            
            <div className="text-sm text-gray-600 space-y-1 mb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                <span>Remote: {formatDate(conflict.remoteModified)}</span>
                {conflict.remoteAuthor && (
                  <>
                    <User className="h-3 w-3 ml-2" />
                    <span>{conflict.remoteAuthor}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                <span>Local: {formatDate(conflict.localModified)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  name={`conflict-${conflict.filePath}`}
                  value="keep-local"
                  id={`${conflict.filePath}-local`}
                  checked={choice === 'keep-local'}
                  onChange={(e) => onChange(e.target.value as ConflictResolution)}
                  className="h-4 w-4"
                />
                <Label 
                  htmlFor={`${conflict.filePath}-local`}
                  className="flex-1 cursor-pointer text-sm"
                >
                  <span className="font-medium text-blue-600">Keep Local Version</span>
                  <span className="text-gray-500 block">Use my current changes</span>
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  name={`conflict-${conflict.filePath}`}
                  value="accept-remote"
                  id={`${conflict.filePath}-remote`}
                  checked={choice === 'accept-remote'}
                  onChange={(e) => onChange(e.target.value as ConflictResolution)}
                  className="h-4 w-4"
                />
                <Label 
                  htmlFor={`${conflict.filePath}-remote`}
                  className="flex-1 cursor-pointer text-sm"
                >
                  <span className="font-medium text-green-600">Accept Remote Version</span>
                  <span className="text-gray-500 block">Use the version from GitHub</span>
                </Label>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ConflictResolutionDialog({ 
  open, 
  onOpenChange, 
  conflicts, 
  onResolve, 
  isLoading = false 
}: ConflictResolutionDialogProps) {
  const [choices, setChoices] = useState<Record<string, ConflictResolution>>({});

  const handleChoiceChange = (filePath: string, resolution: ConflictResolution) => {
    setChoices(prev => ({ ...prev, [filePath]: resolution }));
  };

  const handleResolve = () => {
    const resolutions: ConflictChoice[] = conflicts.map(conflict => ({
      filePath: conflict.filePath,
      resolution: choices[conflict.filePath] || 'keep-local'
    }));
    
    onResolve(resolutions);
  };

  const handleApplyToAll = (resolution: ConflictResolution) => {
    const allChoices = conflicts.reduce((acc, conflict) => ({
      ...acc,
      [conflict.filePath]: resolution
    }), {});
    setChoices(allChoices);
  };

  const allResolved = conflicts.every(conflict => choices[conflict.filePath]);
  const hasChoices = Object.keys(choices).length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <DialogTitle>Sync Conflicts Detected</DialogTitle>
          </div>
          <DialogDescription>
            Changes were made both locally and on GitHub. Choose which version to keep for each file.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {conflicts.length > 1 && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700 mb-2">Apply to all conflicts:</p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleApplyToAll('keep-local')}
                  className="text-blue-600"
                >
                  Keep All Local
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleApplyToAll('accept-remote')}
                  className="text-green-600"
                >
                  Accept All Remote
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {conflicts.map(conflict => (
              <ConflictItem
                key={conflict.filePath}
                conflict={conflict}
                choice={choices[conflict.filePath]}
                onChange={(resolution) => handleChoiceChange(conflict.filePath, resolution)}
              />
            ))}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0">
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1">
              {hasChoices && !allResolved && (
                <p className="text-sm text-gray-500">
                  {Object.keys(choices).length} of {conflicts.length} conflicts resolved
                </p>
              )}
            </div>
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleResolve} 
              disabled={isLoading}
            >
              {isLoading ? 'Resolving...' : 'Resolve Conflicts'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}