// src/features/editor/components/NewPageDialog.tsx

import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom'; // Import the navigate hook
import { useAppStore } from '@/core/state/useAppStore';
import { slugify } from '@/core/libraries/utils';
import { toast } from 'sonner';
import yaml from 'js-yaml';

// UI & Type Imports
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/core/components/ui/dialog";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Plus } from 'lucide-react';
import { type MarkdownFrontmatter } from '@/core/types';
import { DEFAULT_PAGE_LAYOUT_PATH } from '@/config/editorConfig';

interface NewPageDialogProps {
  siteId: string;
  children: ReactNode;
  onComplete?: () => void;
}

export default function NewPageDialog({ siteId, children, onComplete }: NewPageDialogProps) {
  const navigate = useNavigate(); // Use the navigate hook for routing
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const site = useAppStore((state) => state.getSiteById(siteId));
  const { addOrUpdateContentFile } = useAppStore.getState();

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setTimeout(() => {
        setTitle('');
        setIsSubmitting(false);
      }, 200);
    }
  };

  const handleCreatePage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!title.trim()) {
      toast.error("Page title cannot be empty.");
      return;
    }
    setIsSubmitting(true);
    const slug = slugify(title);
    const filePath = `content/${slug}.md`;

    const slugExists = site?.contentFiles?.some(f => f.slug === slug);
    if (slugExists) {
        toast.error(`A page with the slug "${slug}" already exists.`);
        setIsSubmitting(false);
        return;
    }
    
    const frontmatter: MarkdownFrontmatter = {
        title: title.trim(),
        layout: DEFAULT_PAGE_LAYOUT_PATH,
        date: new Date().toISOString().split('T')[0],
    };

    const initialContent = `---\n${yaml.dump(frontmatter)}---\n\nStart writing your content here.\n`;

    try {
      const success = await addOrUpdateContentFile(siteId, filePath, initialContent);
      if (success) {
        toast.success(`Page "${title}" created!`);
        handleOpenChange(false);
        onComplete?.();
        
        // --- CHANGE: Use navigate to redirect to the new page's editor ---
        navigate(`/sites/${siteId}/edit/content/${slug}`);
      } else { 
        throw new Error("Failed to update manifest or save file.");
      }
    } catch (error) {
      toast.error(`Failed to create page: ${(error as Error).message}`);
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create a new page</DialogTitle>
          <DialogDescription>
            Give your new page a title. You can add content and change settings later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreatePage}>
          <div className="grid gap-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="title">Page title</Label>
              <Input 
                id="title" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                placeholder="e.g., About us"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button type="submit" disabled={!title.trim() || isSubmitting}>
              {isSubmitting ? 'Creating...' : <><Plus className="mr-2 h-4 w-4" /> Create page</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}