import { useEffect, useMemo, useState } from 'react';
import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { Settings2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import { Input } from '@/core/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { useAppStore } from '@/core/state/useAppStore';
import { getCollectionContent, getCollections } from '@/core/services/collections.service';
import { getLayoutManifest } from '@/core/services/config/configHelpers.service';
import { getAppliedTagsForCollection } from '@/core/services/tags.service';
import { SimpleMultiSelect, type SimpleMultiSelectOption } from '@/features/editor/components/SimpleMultiSelect';
import {
  DEFAULT_COLLECTION_VIEW_ATTRS,
  parseCollectionViewAttrs,
  renderCollectionViewDirective,
} from '../helpers';
import { NODE_NAMES } from '../constants';

interface CollectionDefinition {
  id: string;
  name: string;
}

interface CollectionViewOptions {
  collections?: CollectionDefinition[];
  siteId?: string;
}

const COLLECTION_VIEW_LAYOUT_OPTIONS = [
  { value: 'list-view', label: 'List' },
  { value: 'grid-view', label: 'Grid' },
];

export function CollectionViewNode(props: ReactNodeViewProps<HTMLDivElement>) {
  const { node, updateAttributes, selected, extension } = props;
  const siteId = extension.options.siteId as string | undefined;
  const siteData = useAppStore((state) => (siteId ? state.getSiteById(siteId) : undefined));
  const collections = useMemo(() => {
    if (siteData?.manifest) {
      return getCollections(siteData.manifest).map((collection) => ({
        id: collection.id,
        name: collection.name,
      }));
    }

    return (extension.options.collections as CollectionDefinition[] | undefined) ?? [];
  }, [extension.options.collections, siteData]);
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState({
    collection: (node.attrs.collection as string) || DEFAULT_COLLECTION_VIEW_ATTRS.collection,
    layout: (node.attrs.layout as string) || DEFAULT_COLLECTION_VIEW_ATTRS.layout,
    displayType: (node.attrs.displayType as string) || DEFAULT_COLLECTION_VIEW_ATTRS.displayType,
    maxItems: Number(node.attrs.maxItems) || DEFAULT_COLLECTION_VIEW_ATTRS.maxItems,
    sortBy: (node.attrs.sortBy as string) || DEFAULT_COLLECTION_VIEW_ATTRS.sortBy,
    sortOrder: (node.attrs.sortOrder as string) || DEFAULT_COLLECTION_VIEW_ATTRS.sortOrder,
    tagFilters: Array.isArray(node.attrs.tagFilters)
      ? (node.attrs.tagFilters as string[])
      : DEFAULT_COLLECTION_VIEW_ATTRS.tagFilters,
  });
  const [availableDisplayTypes, setAvailableDisplayTypes] = useState<Array<{
    value: string;
    label: string;
    description?: string;
    isDefault?: boolean;
  }>>([]);

  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.id === draft.collection),
    [collections, draft.collection],
  );

  const collectionTagFilters = useMemo(() => {
    if (!siteData || !selectedCollection) {
      return [];
    }

    const collectionItems = getCollectionContent(siteData, selectedCollection.id);
    return getAppliedTagsForCollection(siteData, selectedCollection.id, collectionItems);
  }, [siteData, selectedCollection]);

  const availableTagOptions = useMemo(() => {
    return collectionTagFilters.flatMap(({ tagGroup, tags }) =>
      tags.map((tag) => ({
        groupId: tagGroup.id,
        groupName: tagGroup.name,
        label: tag.name,
        value: tag.id,
      })),
    );
  }, [collectionTagFilters]);

  useEffect(() => {
    setDraft({
      collection: (node.attrs.collection as string) || DEFAULT_COLLECTION_VIEW_ATTRS.collection,
      layout: (node.attrs.layout as string) || DEFAULT_COLLECTION_VIEW_ATTRS.layout,
      displayType: (node.attrs.displayType as string) || DEFAULT_COLLECTION_VIEW_ATTRS.displayType,
      maxItems: Number(node.attrs.maxItems) || DEFAULT_COLLECTION_VIEW_ATTRS.maxItems,
      sortBy: (node.attrs.sortBy as string) || DEFAULT_COLLECTION_VIEW_ATTRS.sortBy,
      sortOrder: (node.attrs.sortOrder as string) || DEFAULT_COLLECTION_VIEW_ATTRS.sortOrder,
      tagFilters: Array.isArray(node.attrs.tagFilters)
        ? (node.attrs.tagFilters as string[])
        : DEFAULT_COLLECTION_VIEW_ATTRS.tagFilters,
    });
  }, [node.attrs]);

  useEffect(() => {
    async function loadDisplayTypes() {
      if (!siteData || !selectedCollection) {
        setAvailableDisplayTypes([]);
        return;
      }

      const collection = getCollections(siteData.manifest).find((item) => item.id === selectedCollection.id);
      const itemLayoutId = collection?.defaultItemLayout;
      if (!itemLayoutId) {
        setAvailableDisplayTypes([]);
        return;
      }

      try {
        const itemLayoutManifest = await getLayoutManifest(siteData, itemLayoutId);
        if (!itemLayoutManifest?.partials) {
          setAvailableDisplayTypes([]);
          return;
        }

        setAvailableDisplayTypes(itemLayoutManifest.partials.map((partial) => {
          const pathParts = partial.path.split('/');
          const filename = pathParts[pathParts.length - 1]?.replace('.hbs', '') || '';
          return {
            value: filename,
            label: partial.name,
            description: partial.description,
            isDefault: partial.isDefault,
          };
        }));
      } catch (error) {
        console.error('[CollectionView] Failed to load display types:', error);
        setAvailableDisplayTypes([]);
      }
    }

    void loadDisplayTypes();
  }, [siteData, selectedCollection]);

  const defaultDisplayType = useMemo(() => {
    const defaultPartial = availableDisplayTypes.find((type) => type.isDefault);
    return defaultPartial?.value || availableDisplayTypes[0]?.value || '';
  }, [availableDisplayTypes]);

  return (
    <NodeViewWrapper className="my-4" contentEditable={false}>
      <div className={`rounded-md border border-dashed border-border bg-muted/20 p-4 ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Collection View</div>
            <div className="mt-2 text-sm text-muted-foreground">
              {selectedCollection?.name || (node.attrs.collection as string) || 'No collection selected'}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              layout: {(node.attrs.layout as string) || DEFAULT_COLLECTION_VIEW_ATTRS.layout} | maxItems: {String(node.attrs.maxItems ?? DEFAULT_COLLECTION_VIEW_ATTRS.maxItems)} | sort: {(node.attrs.sortBy as string) || DEFAULT_COLLECTION_VIEW_ATTRS.sortBy} {(node.attrs.sortOrder as string) || DEFAULT_COLLECTION_VIEW_ATTRS.sortOrder}
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(true)}>
            <Settings2 className="mr-2 h-4 w-4" />
            Configure
          </Button>
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit collection view</DialogTitle>
            <DialogDescription>Choose how this collection is rendered in the page body.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <span className="text-sm font-medium">Collection</span>
              <Select
                value={draft.collection}
                onValueChange={(value) => setDraft((current) => ({
                  ...current,
                  collection: value,
                  displayType: '',
                  tagFilters: [],
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a collection" />
                </SelectTrigger>
                <SelectContent>
                  {collections.map((collection) => (
                    <SelectItem key={collection.id} value={collection.id}>
                      {collection.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <span className="text-sm font-medium">Layout</span>
              <Select value={draft.layout} onValueChange={(value) => setDraft((current) => ({ ...current, layout: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLLECTION_VIEW_LAYOUT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <span className="text-sm font-medium">Display type</span>
              <Select
                value={draft.displayType || defaultDisplayType}
                onValueChange={(value) => setDraft((current) => ({ ...current, displayType: value }))}
                disabled={availableDisplayTypes.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select display type" />
                </SelectTrigger>
                <SelectContent>
                  {availableDisplayTypes.map((displayType) => (
                    <SelectItem key={displayType.value} value={displayType.value}>
                      {displayType.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <span className="text-sm font-medium">Max items</span>
                <Input
                  type="number"
                  min={1}
                  value={draft.maxItems}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      maxItems: Number(event.target.value) || DEFAULT_COLLECTION_VIEW_ATTRS.maxItems,
                    }))
                  }
                />
              </div>

              <div className="grid gap-2">
                <span className="text-sm font-medium">Tag filters</span>
                <SimpleMultiSelect
                  options={availableTagOptions as SimpleMultiSelectOption[]}
                  selected={draft.tagFilters}
                  onChange={(selected) => setDraft((current) => ({ ...current, tagFilters: selected }))}
                  placeholder={availableTagOptions.length > 0 ? 'Select tags...' : 'No tags available'}
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <span className="text-sm font-medium">Sort by</span>
                <Select value={draft.sortBy} onValueChange={(value) => setDraft((current) => ({ ...current, sortBy: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">date</SelectItem>
                    <SelectItem value="title">title</SelectItem>
                    <SelectItem value="order">order</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <span className="text-sm font-medium">Sort order</span>
                <Select value={draft.sortOrder} onValueChange={(value) => setDraft((current) => ({ ...current, sortOrder: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">asc</SelectItem>
                    <SelectItem value="desc">desc</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                updateAttributes({
                  collection: draft.collection,
                  layout: draft.layout,
                  displayType: draft.displayType || defaultDisplayType,
                  maxItems: draft.maxItems,
                  sortBy: draft.sortBy,
                  sortOrder: draft.sortOrder,
                  tagFilters: draft.tagFilters,
                });
                setIsOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </NodeViewWrapper>
  );
}

export const CollectionView = Node.create<CollectionViewOptions>({
  name: NODE_NAMES.collectionView,
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return {
      collections: [],
      siteId: undefined,
    };
  },

  addAttributes() {
    return {
      collection: {
        default: DEFAULT_COLLECTION_VIEW_ATTRS.collection,
      },
      layout: {
        default: DEFAULT_COLLECTION_VIEW_ATTRS.layout,
      },
      displayType: {
        default: DEFAULT_COLLECTION_VIEW_ATTRS.displayType,
      },
      maxItems: {
        default: DEFAULT_COLLECTION_VIEW_ATTRS.maxItems,
      },
      sortBy: {
        default: DEFAULT_COLLECTION_VIEW_ATTRS.sortBy,
      },
      sortOrder: {
        default: DEFAULT_COLLECTION_VIEW_ATTRS.sortOrder,
      },
      tagFilters: {
        default: DEFAULT_COLLECTION_VIEW_ATTRS.tagFilters,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-collection-view]',
        getAttrs: (element) => ({
          collection: element.getAttribute('data-collection') ?? DEFAULT_COLLECTION_VIEW_ATTRS.collection,
          layout: element.getAttribute('data-layout') ?? DEFAULT_COLLECTION_VIEW_ATTRS.layout,
          displayType: element.getAttribute('data-display-type') ?? DEFAULT_COLLECTION_VIEW_ATTRS.displayType,
          maxItems: Number(element.getAttribute('data-max-items')) || DEFAULT_COLLECTION_VIEW_ATTRS.maxItems,
          sortBy: element.getAttribute('data-sort-by') ?? DEFAULT_COLLECTION_VIEW_ATTRS.sortBy,
          sortOrder: element.getAttribute('data-sort-order') ?? DEFAULT_COLLECTION_VIEW_ATTRS.sortOrder,
          tagFilters: (element.getAttribute('data-tag-filters') || '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const tagFilters = Array.isArray(HTMLAttributes.tagFilters)
      ? (HTMLAttributes.tagFilters as string[]).join(',')
      : '';

    return [
      'div',
      {
        'data-collection-view': 'true',
        'data-collection': HTMLAttributes.collection,
        'data-layout': HTMLAttributes.layout,
        'data-display-type': HTMLAttributes.displayType,
        'data-max-items': String(HTMLAttributes.maxItems ?? DEFAULT_COLLECTION_VIEW_ATTRS.maxItems),
        'data-sort-by': HTMLAttributes.sortBy,
        'data-sort-order': HTMLAttributes.sortOrder,
        'data-tag-filters': tagFilters,
      },
    ];
  },

  markdownTokenName: 'collection_view',

  markdownTokenizer: {
    name: 'collection_view',
    level: 'block',
    start(src: string) {
      const match = src.match(/:::?collection_view\{/);
      return match?.index ?? -1;
    },
    tokenize(src: string) {
      const match = /^(::collection_view|:::collection_view)\{([^}\n]*)\}(?:\n:::\s*)?(?:\n{0,2})?/.exec(src);

      if (!match) {
        return undefined;
      }

      return {
        type: 'collection_view',
        raw: match[0],
        attributes: match[2] ?? '',
      };
    },
  },

  parseMarkdown: (token, helpers) => {
    const attrs = parseCollectionViewAttrs(String(token.attributes || ''));
    return helpers.createNode(NODE_NAMES.collectionView, attrs);
  },

  renderMarkdown: (node) => renderCollectionViewDirective(node.attrs ?? {}),
  addNodeView() {
    return ReactNodeViewRenderer(CollectionViewNode);
  },
});
