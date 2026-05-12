// src/core/components/ImportModal.tsx
import { useState } from 'react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/core/components/ui/alert-dialog';
import { Loader2, Github, Globe } from 'lucide-react';

export type ImportModalMode = 'github' | 'url';

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ImportModalMode;
  onImport: (value: string, branch?: string) => Promise<void>;
}

export default function ImportModal({ open, onOpenChange, mode, onImport }: ImportModalProps) {
  const [value, setValue] = useState('');
  const [branch, setBranch] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;

    setIsImporting(true);
    try {
      await onImport(value.trim(), branch.trim() || undefined);
      setValue('');
      setBranch('');
      onOpenChange(false);
    } catch {
      // Error is handled by parent component
    } finally {
      setIsImporting(false);
    }
  };

  const handleCancel = () => {
    if (!isImporting) {
      setValue('');
      setBranch('');
      onOpenChange(false);
    }
  };

  const isGitHub = mode === 'github';
  const title = isGitHub ? 'Import from GitHub' : 'Import from URL';
  const placeholder = isGitHub
    ? 'https://github.com/username/repository'
    : 'https://example.com/site/';
  const description = isGitHub
    ? 'Enter a GitHub repository URL containing a built Sparktype site. We\'ll look for the _site folder in the repository.'
    : 'Enter a published Sparktype site URL. We\'ll fetch the bundled _site source files from that site.';
  const valueLabel = isGitHub ? 'Repository URL' : 'Site URL';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isGitHub ? <Github className="h-5 w-5" /> : <Globe className="h-5 w-5" />}
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="import-value">
              {valueLabel}
            </Label>
            <Input
              id="import-value"
              placeholder={placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={isImporting}
              required
            />
          </div>

          {isGitHub && (
            <div className="space-y-2">
              <Label htmlFor="branch">Branch (optional)</Label>
              <Input
                id="branch"
                placeholder="main"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                disabled={isImporting}
              />
              <p className="text-sm text-muted-foreground">
                Leave empty to use the default branch (main/master)
              </p>
            </div>
          )}

          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isImporting || !value.trim()}
            >
              {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isImporting ? 'Importing...' : 'Import Site'}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
