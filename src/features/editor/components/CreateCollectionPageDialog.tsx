// src/features/editor/components/CreateCollectionPageDialog.tsx

import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom'; // Import the navigate hook

// State Management
import { useAppStore } from '@/core/state/useAppStore';

// Services and Config
import { slugify } from '@/core/libraries/utils';
import { getLayoutManifest } from '@/core/services/config/configHelpers.service';
import { DEFAULT_COLLECTION_LAYOUT_PATH } from '@/config/editorConfig';
import { toast } from 'sonner';
import yaml from 'js-yaml';

// UI & Type Imports
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/core/components/ui/dialog";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Plus } from 'lucide-react';
import { type MarkdownFrontmatter, type CollectionConfig } from '@/core/types';

interface CreateCollectionPageDialogProps {
  siteId: string;
  children: ReactNode;
  onComplete?: () => void;
}

export default function CreateCollectionPageDialog({ siteId, children, onComplete }: CreateCollectionPageDialogProps) {
  const navigate = useNavigate(); // Use the navigate hook for routing
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const site = useAppStore((state) => state.getSiteById(siteId));
  const { addOrUpdateContentFile } = useAppStore.getState();

  // This effect to auto-generate the slug from the name is correct and needs no changes.
  useEffect(() => {
    setSlug(slugify(name));
  }, [name]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Reset state when the dialog is closed
      setTimeout(() => {
        setName('');
        setSlug('');
        setIsSubmitting(false);
      }, 200);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Collection name cannot be empty.");
      return;
    }

    const filePath = `content/${slug}.md`;
    if (site?.contentFiles?.some(f => f.path === filePath)) {
        toast.error(`A page with the folder name "${slug}" already exists.`);
        return;
    }

    setIsSubmitting(true);

    try {
      const defaultLayoutManifest = site ? await getLayoutManifest(site, DEFAULT_COLLECTION_LAYOUT_PATH) : null;

      // Start with base config
      const initialCollectionConfig: CollectionConfig = { 
          sort_by: 'date',
          sort_order: 'desc',
          items_per_page: 10,
      };
      
      // Merge in defaults from the layout's display_options if they exist
      if (defaultLayoutManifest?.display_options) {
        for (const [key, option] of Object.entries(defaultLayoutManifest.display_options)) {
            initialCollectionConfig[key] = option.default;
        }
      }

      const frontmatter: MarkdownFrontmatter = {
          title: name.trim(),
          layout: DEFAULT_COLLECTION_LAYOUT_PATH,
          collection: initialCollectionConfig,
      };

      const initialContent = `---\n${yaml.dump(frontmatter)}---\n\n## Welcome to the ${name.trim()} collection!\n\nYou can write an introduction for this collection here.`;
    
      const success = await addOrUpdateContentFile(siteId, filePath, initialContent);
      if (success) {
        toast.success(`Collection page "${name}" created!`);
        handleOpenChange(false);
        onComplete?.();
        
        // --- CHANGE: Use navigate to redirect the user to the new page's editor ---
        navigate(`/sites/${siteId}/edit/content/${slug}`);
      } else {
        throw new Error("Failed to update manifest or save file.");
      }
    } catch (error) {
      toast.error(`Failed to create page: ${(error as Error).message}`);
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Collection Page</DialogTitle>
            <DialogDescription>
              Create a new page that will list other pages, like a blog or a portfolio.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="name">Collection Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Blog Posts"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="slug">Folder Name (URL)</Label>
              <Input id="slug" value={slug} readOnly className="bg-muted" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button type="submit" disabled={!name.trim() || isSubmitting}>
                {isSubmitting ? 'Creating...' : <><Plus className="mr-2 h-4 w-4" /> Create Collection</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}