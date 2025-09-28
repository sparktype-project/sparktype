// src/core/components/ImportModal.tsx
import { useState } from 'react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/core/components/ui/alert-dialog';
import { Loader2, Github } from 'lucide-react';

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (value: string, branch?: string) => Promise<void>;
}

export default function ImportModal({ open, onOpenChange, onImport }: ImportModalProps) {
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
    } catch (error) {
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

  const title = 'Import from GitHub';
  const placeholder = 'https://github.com/username/repository';
  const description = 'Enter a GitHub repository URL containing a built Sparktype site. We\'ll look for the _site folder in the repository.';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="import-value">
              Repository URL
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