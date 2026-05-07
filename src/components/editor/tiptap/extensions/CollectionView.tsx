import { useMemo, useState } from 'react';
import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { Settings2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import {
  Dialog,
  DialogContent,
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
}

function CollectionViewNode(props: ReactNodeViewProps<HTMLDivElement>) {
  const { node, updateAttributes, selected, extension } = props;
  const collections = (extension.options.collections as CollectionDefinition[] | undefined) ?? [];
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState({
    collection: (node.attrs.collection as string) || DEFAULT_COLLECTION_VIEW_ATTRS.collection,
    layout: (node.attrs.layout as string) || DEFAULT_COLLECTION_VIEW_ATTRS.layout,
    displayType: (node.attrs.displayType as string) || DEFAULT_COLLECTION_VIEW_ATTRS.displayType,
    maxItems: Number(node.attrs.maxItems) || DEFAULT_COLLECTION_VIEW_ATTRS.maxItems,
    sortBy: (node.attrs.sortBy as string) || DEFAULT_COLLECTION_VIEW_ATTRS.sortBy,
    sortOrder: (node.attrs.sortOrder as string) || DEFAULT_COLLECTION_VIEW_ATTRS.sortOrder,
    tagFilters: Array.isArray(node.attrs.tagFilters)
      ? (node.attrs.tagFilters as string[]).join(', ')
      : '',
  });

  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.id === node.attrs.collection),
    [collections, node.attrs.collection],
  );

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
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <span className="text-sm font-medium">Collection</span>
              <Select value={draft.collection} onValueChange={(value) => setDraft((current) => ({ ...current, collection: value }))}>
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
              <Input value={draft.layout} onChange={(event) => setDraft((current) => ({ ...current, layout: event.target.value }))} />
            </div>

            <div className="grid gap-2">
              <span className="text-sm font-medium">Display type</span>
              <Input value={draft.displayType} onChange={(event) => setDraft((current) => ({ ...current, displayType: event.target.value }))} />
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
                <Input value={draft.tagFilters} onChange={(event) => setDraft((current) => ({ ...current, tagFilters: event.target.value }))} />
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
                  displayType: draft.displayType,
                  maxItems: draft.maxItems,
                  sortBy: draft.sortBy,
                  sortOrder: draft.sortOrder,
                  tagFilters: draft.tagFilters
                    .split(',')
                    .map((value) => value.trim())
                    .filter(Boolean),
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
