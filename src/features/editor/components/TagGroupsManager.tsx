// src/features/editor/components/TagGroupsManager.tsx

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/core/state/useAppStore';
import { getCollections } from '@/core/services/collections.service';
import { getTagGroups } from '@/core/services/tagGroups.service';
import { getTagsInGroup } from '@/core/services/tags.service';
import type { TagGroup, Collection } from '@/core/types';
import CreateTagGroupDialog from './CreateTagGroupDialog';
import EditTagGroupDialog from './EditTagGroupDialog';
import CreateTagDialog from './CreateTagDialog';

// UI Components
import { Button } from '@/core/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/core/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/core/components/ui/alert-dialog';

import { MoreHorizontal, Trash2, Edit, Tag as TagIcon, Plus, Tags } from 'lucide-react';

interface TagGroupsManagerProps {
  siteId: string;
}

export default function TagGroupsManager({ siteId }: TagGroupsManagerProps) {
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tagGroupToDelete, setTagGroupToDelete] = useState<TagGroup | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [tagGroupToEdit, setTagGroupToEdit] = useState<TagGroup | null>(null);
  const [createTagDialogOpen, setCreateTagDialogOpen] = useState(false);
  const [selectedTagGroupForTag, setSelectedTagGroupForTag] = useState<TagGroup | null>(null);

  const getSiteById = useAppStore(state => state.getSiteById);
  const deleteTagGroup = useAppStore(state => state.deleteTagGroup);
  const siteData = getSiteById(siteId);

  const tagGroups = useMemo(() => siteData ? getTagGroups(siteData.manifest) : [], [siteData]);
  const collections = useMemo(() => siteData ? getCollections(siteData.manifest) : [], [siteData]);

  const handleDeleteTagGroup = (tagGroup: TagGroup) => {
    setTagGroupToDelete(tagGroup);
    setDeleteDialogOpen(true);
  };

  const handleEditTagGroup = (tagGroup: TagGroup) => {
    setTagGroupToEdit(tagGroup);
    setEditDialogOpen(true);
  };

  const handleManageTags = (tagGroup: TagGroup) => {
    navigate(`/sites/${siteId}/taggroups/${tagGroup.id}`);
  };

  const handleAddTag = (tagGroup: TagGroup) => {
    setSelectedTagGroupForTag(tagGroup);
    setCreateTagDialogOpen(true);
  };

  const confirmDeleteTagGroup = async () => {
    if (!tagGroupToDelete || !siteData) return;
    
    try {
      await deleteTagGroup(siteId, tagGroupToDelete.id);
    } catch (error) {
      // Error handling is done in the store
    } finally {
      setDeleteDialogOpen(false);
      setTagGroupToDelete(null);
    }
  };

  if (!siteData) {
    return <div className="p-4 text-center text-muted-foreground"><p className="text-sm">Loading site data...</p></div>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {tagGroups.length === 0 ? (
          <div className="p-2">
            <div className="space-y-3">
              <div className="text-muted-foreground">
                <p className="text-xs">No tag groups yet. Click the plus button above to create one.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {tagGroups.map((tagGroup) => (
              <TagGroupItem
                key={tagGroup.id}
                tagGroup={tagGroup}
                siteData={siteData}
                siteId={siteId}
                collections={collections}
                onEdit={() => handleEditTagGroup(tagGroup)}
                onDelete={() => handleDeleteTagGroup(tagGroup)}
                onManageTags={() => handleManageTags(tagGroup)}
                onAddTag={() => handleAddTag(tagGroup)}
              />
            ))}
          </div>
        )}
      </div>
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{tagGroupToDelete?.name}"? This will also delete all tags in this group and remove them from any content that uses them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTagGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Tag Group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <CreateTagGroupDialog siteId={siteId} open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />
      <EditTagGroupDialog siteId={siteId} tagGroup={tagGroupToEdit} open={editDialogOpen} onOpenChange={setEditDialogOpen} />
      <CreateTagDialog 
        siteId={siteId} 
        tagGroup={selectedTagGroupForTag} 
        open={createTagDialogOpen} 
        onOpenChange={setCreateTagDialogOpen} 
      />
    </div>
  );
}

interface TagGroupItemProps {
  tagGroup: TagGroup;
  siteData: import('@/core/types').LocalSiteData;
  siteId: string;
  collections: Collection[];
  onEdit: () => void;
  onDelete: () => void;
  onManageTags: () => void;
  onAddTag: () => void;
}

function TagGroupItem({ tagGroup, siteData, onEdit, onDelete, onManageTags, onAddTag }: TagGroupItemProps) {
  const tagCount = useMemo(() => {
    return getTagsInGroup(siteData.manifest, tagGroup.id).length;
  }, [siteData.manifest, tagGroup.id]);

  return (
    <div className="group flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent">
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onManageTags} title="Click to manage tags">
        <div className="flex items-center gap-2">
          <Tags className='size-4' />
          <div className="text-sm truncate">{tagGroup.name}</div>
          <div className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {tagCount} tags
          </div>
        </div>
        
      </div>
      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onManageTags}>
              <TagIcon className="h-4 w-4 mr-2" />Manage Tags
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />Edit Group
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />Delete Group
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 w-6 p-0"
          title="Add new tag"
          onClick={onAddTag}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}