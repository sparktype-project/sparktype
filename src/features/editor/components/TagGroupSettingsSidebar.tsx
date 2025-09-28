// src/features/editor/components/TagGroupSettingsSidebar.tsx

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/core/state/useAppStore';
import {
  getTagGroup,
  updateTagGroup,
  deleteTagGroup,
} from '@/core/services/tagGroups.service';
import { getCollections } from '@/core/services/collections.service';
import { getTagsInGroup } from '@/core/services/tags.service';

// UI Components
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Textarea } from '@/core/components/ui/textarea';
import { Separator } from '@/core/components/ui/separator';
import { Checkbox } from '@/core/components/ui/checkbox';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/core/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/core/components/ui/alert-dialog';

// Icons
import { Trash2, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface TagGroupSettingsSidebarProps {
  siteId: string;
  tagGroupId: string;
}

/**
 * A sidebar component for managing the settings of a single Tag Group.
 */
export default function TagGroupSettingsSidebar({ siteId, tagGroupId }: TagGroupSettingsSidebarProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [applicableCollections, setApplicableCollections] = useState<string[]>([]);

  // Store actions
  const getSiteById = useAppStore(state => state.getSiteById);
  const updateManifest = useAppStore(state => state.updateManifest);
  const siteData = getSiteById(siteId);

  const tagGroup = useMemo(() => {
    if (!siteData) return null;
    return getTagGroup(siteData.manifest, tagGroupId);
  }, [siteData, tagGroupId]);

  const collections = useMemo(() => {
    if (!siteData) return [];
    return getCollections(siteData.manifest);
  }, [siteData]);

  const tagCount = useMemo(() => {
    if (!siteData || !tagGroup) return 0;
    return getTagsInGroup(siteData.manifest, tagGroup.id).length;
  }, [siteData, tagGroup]);

  // Initialize form with tag group data
  useEffect(() => {
    if (tagGroup) {
      setName(tagGroup.name);
      setDescription(tagGroup.description || '');
      setApplicableCollections(tagGroup.applicableCollections);
    }
  }, [tagGroup]);

  const handleCollectionToggle = useCallback((collectionId: string, checked: boolean) => {
    setApplicableCollections(prev => {
      if (checked) {
        return [...prev, collectionId];
      } else {
        return prev.filter(id => id !== collectionId);
      }
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!siteData || !tagGroup) return;
    try {
      setIsLoading(true);
      const updates = {
        name: name.trim(),
        description: description.trim() || undefined,
        applicableCollections
      };
      const updatedManifest = updateTagGroup(siteData.manifest, tagGroup.id, updates);
      await updateManifest(siteId, updatedManifest);
      toast.success('Tag group updated successfully');
    } catch (error) {
      toast.error(`Failed to update tag group: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, [siteData, tagGroup, name, description, applicableCollections, siteId, updateManifest]);

  const handleDelete = useCallback(async () => {
    if (!siteData || !tagGroup) return;
    try {
      setIsLoading(true);
      const { manifest: updatedManifest } = deleteTagGroup(siteData.manifest, tagGroup.id);
      await updateManifest(siteId, updatedManifest);
      toast.success(`Tag group "${tagGroup.name}" deleted successfully`);
      navigate(`/sites/${siteId}/edit`);
    } catch (error) {
      toast.error(`Failed to delete tag group: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
      setDeleteDialogOpen(false);
    }
  }, [siteData, tagGroup, siteId, updateManifest, navigate]);

  if (!tagGroup) {
    return <div className="p-4"><p className="text-sm text-muted-foreground">Tag group not found</p></div>;
  }

  const hasChanges = name !== tagGroup.name ||
    description !== (tagGroup.description || '') ||
    JSON.stringify(applicableCollections.sort()) !== JSON.stringify(tagGroup.applicableCollections.sort());


  return (
    <div className="h-full flex flex-col">

      <div className="flex-grow overflow-y-auto">
        <Accordion type="multiple" defaultValue={['basic', 'collections', 'info']}>
          <AccordionItem value="basic">
            <AccordionTrigger className="px-4">Settings</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="taggroup-name">Name</Label>
                  <Input id="taggroup-name" value={name} onChange={(e) => setName(e.target.value)} disabled={isLoading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taggroup-description">Description</Label>
                  <Textarea id="taggroup-description" value={description} onChange={(e) => setDescription(e.target.value)} disabled={isLoading} rows={3} placeholder="Optional description..." />
                </div>
                {hasChanges && (
                  <Button onClick={handleSave} disabled={isLoading || !name.trim()} className="w-full">
                    {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : <><Save className="h-4 w-4 mr-2" />Save Changes</>}
                  </Button>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="collections">
            <AccordionTrigger className="px-4">Collections</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Select which collections can use tags from this group. Tags will appear in the sidebar when editing content from these collections.
                </p>
                {collections.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {collections.map(collection => (
                      <div key={collection.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`collection-${collection.id}`}
                          checked={applicableCollections.includes(collection.id)}
                          onCheckedChange={(checked) => handleCollectionToggle(collection.id, !!checked)}
                          disabled={isLoading}
                        />
                        <Label
                          htmlFor={`collection-${collection.id}`}
                          className="text-sm font-normal cursor-pointer flex-1"
                        >
                          {collection.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground p-2 border rounded-md bg-muted/50">
                    No collections found. Create collections first to make this tag group applicable to them.
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>


        </Accordion>
      </div>
      <div className="p-4 border-t">
        <Separator className="mb-4" />
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="w-full">
              <Trash2 className="h-4 w-4 mr-2" />Delete Tag Group
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Tag Group</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{tagGroup.name}"? This will also delete all {tagCount} tags in this group and remove them from any content that uses them. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isLoading}>
                {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Deleting...</> : 'Delete Tag Group'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}