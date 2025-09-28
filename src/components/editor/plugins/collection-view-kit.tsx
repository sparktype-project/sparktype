

import { createPlatePlugin } from 'platejs/react';
import { CollectionViewElement } from '@/components/ui/collection-view-node';

export function createCollectionViewKit(collections: Array<{ id: string; name: string }> = []) {
  const CollectionViewPlugin = createPlatePlugin({
    key: 'collection_view',
    node: {
      isElement: true,
      isVoid: true,
      type: 'collection_view',
      component: (props) => <CollectionViewElement {...props} collections={collections} />,
    },
  });

  return [CollectionViewPlugin];
}

// Export the default kit for backward compatibility
export const CollectionViewKit = createCollectionViewKit();