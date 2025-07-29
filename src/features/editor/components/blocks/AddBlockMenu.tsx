// src/features/editor/components/blocks/AddBlockMenu.tsx

import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Blocks, Image, List, Columns } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/core/components/ui/dialog';
import { useAppStore } from '@/core/state/useAppStore';
import { getAvailableBlocks, loadBlockManifest } from '@/core/services/block.service';
import { type BlockInfo, type BlockManifest } from '@/core/types';
import { toast } from 'sonner';

interface AddBlockMenuProps {
  siteId: string;
  onBlockAdd: (manifest: BlockManifest) => void;
}

interface BlockCategory {
  name: string;
  blocks: BlockInfo[];
  icon: React.ComponentType<{ className?: string }>;
}

// Icon mapping for different block types
const getBlockIcon = (blockId: string) => {
  switch (blockId) {
    case 'core:rich_text':
      return Blocks;
    case 'core:image':
      return Image;
    case 'core:collection_view':
      return List;
    case 'core:container':
      return Columns;
    default:
      return Blocks;
  }
};

// Categorize blocks by type
const categorizeBlocks = (blocks: BlockInfo[]): BlockCategory[] => {
  const contentBlocks = blocks.filter(block => 
    ['core:rich_text', 'core:image', 'core:collection_view'].includes(block.id)
  );
  
  const layoutBlocks = blocks.filter(block => 
    ['core:container'].includes(block.id)
  );

  const categories: BlockCategory[] = [];
  
  if (contentBlocks.length > 0) {
    categories.push({
      name: 'Content',
      blocks: contentBlocks,
      icon: Blocks
    });
  }
  
  if (layoutBlocks.length > 0) {
    categories.push({
      name: 'Layout',
      blocks: layoutBlocks,
      icon: Columns
    });
  }

  return categories;
};

export default function AddBlockMenu({ siteId, onBlockAdd }: AddBlockMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [availableBlocks, setAvailableBlocks] = useState<BlockInfo[]>([]);

  const manifest = useAppStore(state => state.getSiteById(siteId)?.manifest);

  // Load available blocks when component mounts
  useEffect(() => {
    if (manifest) {
      const blocks = getAvailableBlocks(manifest);
      setAvailableBlocks(blocks);
    }
  }, [manifest]);

  // Filter blocks based on search term
  const filteredBlocks = useMemo(() => {
    if (!searchTerm.trim()) return availableBlocks;
    
    return availableBlocks.filter(block =>
      block.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      block.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [availableBlocks, searchTerm]);

  // Categorize filtered blocks
  const categories = useMemo(() => 
    categorizeBlocks(filteredBlocks), 
    [filteredBlocks]
  );

  // Handle block selection
  const handleBlockSelect = async (blockInfo: BlockInfo) => {
    setIsLoading(true);
    try {
      const manifest = await loadBlockManifest(blockInfo, siteId);
      if (manifest) {
        onBlockAdd(manifest);
        setIsOpen(false);
        setSearchTerm('');
        toast.success(`${blockInfo.name} block added`);
      } else {
        toast.error(`Failed to load ${blockInfo.name} manifest`);
      }
    } catch (error) {
      console.error('Error loading block manifest:', error);
      toast.error(`Failed to add ${blockInfo.name} block`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="w-full mt-4 border-dashed border-2 hover:border-solid transition-all"
          disabled={isLoading}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Block
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Add New Block</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col h-full">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search blocks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Block Categories */}
          <div className="flex-1 overflow-y-auto space-y-6">
            {categories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? 'No blocks match your search' : 'No blocks available'}
              </div>
            ) : (
              categories.map((category) => (
                <div key={category.name}>
                  <div className="flex items-center gap-2 mb-3">
                    <category.icon className="w-4 h-4" />
                    <h3 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">
                      {category.name}
                    </h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {category.blocks.map((block) => {
                      const IconComponent = getBlockIcon(block.id);
                      return (
                        <Button
                          key={block.id}
                          variant="outline"
                          className="h-auto p-4 flex flex-col items-start gap-2 hover:bg-muted/50 transition-colors"
                          onClick={() => handleBlockSelect(block)}
                          disabled={isLoading}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <IconComponent className="w-5 h-5 text-primary" />
                            <span className="font-medium text-left">{block.name}</span>
                          </div>
                          {block.description && (
                            <p className="text-xs text-muted-foreground text-left leading-relaxed">
                              {block.description}
                            </p>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}