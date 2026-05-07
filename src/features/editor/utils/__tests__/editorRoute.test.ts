import { describe, expect, test } from 'vitest';
import type { CollectionContext } from '@/core/services/collectionContext.service';
import { shouldDisplayCollectionList } from '../editorRoute';

const pageContext: CollectionContext = {
  isCollectionItem: false,
  contextType: 'page',
  displayName: 'Page',
  isNewFile: false,
};

describe('editorRoute', () => {
  test('shows the collection list for collection pages', () => {
    expect(
      shouldDisplayCollectionList(
        {
          title: 'Blog',
          layout: 'blog-list',
          layoutConfig: {
            collectionId: 'blog',
            layout: 'teaser',
          },
        },
        pageContext,
      ),
    ).toBe(true);
  });

  test('does not show the collection list for collection items', () => {
    expect(
      shouldDisplayCollectionList(
        {
          title: 'Hello world',
          layout: 'blog-post',
          layoutConfig: {
            collectionId: 'blog',
            layout: 'teaser',
          },
        },
        {
          ...pageContext,
          isCollectionItem: true,
          contextType: 'collection-item',
          displayName: 'Blog',
        },
      ),
    ).toBe(false);
  });

  test('does not show the collection list without a collection config', () => {
    expect(
      shouldDisplayCollectionList(
        {
          title: 'About',
          layout: 'default-page',
        },
        pageContext,
      ),
    ).toBe(false);
  });
});
