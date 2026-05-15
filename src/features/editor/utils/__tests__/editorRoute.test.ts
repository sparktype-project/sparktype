import { describe, expect, test } from 'vitest';
import type { CollectionContext } from '@/core/services/collectionContext.service';
import { shouldUseCollectionDisplayEditor } from '../editorRoute';

const pageContext: CollectionContext = {
  isCollectionItem: false,
  contextType: 'page',
  displayName: 'Page',
  isNewFile: false,
};

describe('editorRoute', () => {
  test('uses the collection display editor when the toggle is enabled', () => {
    expect(
      shouldUseCollectionDisplayEditor(
        {
          title: 'Blog',
          layout: 'default-page',
          displayCollection: true,
        },
        pageContext,
      ),
    ).toBe(true);
  });

  test('does not use the collection display editor when the toggle is disabled', () => {
    expect(
      shouldUseCollectionDisplayEditor(
        {
          title: 'About',
          layout: 'blog-list',
          displayCollection: false,
        },
        pageContext,
      ),
    ).toBe(false);
  });

  test('does not use the collection display editor for collection items', () => {
    expect(
      shouldUseCollectionDisplayEditor(
        {
          title: 'Hello world',
          layout: 'blog-list',
          displayCollection: true,
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

  test('defaults missing toggle values to standalone content pages', () => {
    expect(
      shouldUseCollectionDisplayEditor(
        {
          title: 'Legacy blog',
          layout: 'blog-list',
        },
        pageContext,
      ),
    ).toBe(false);
  });
});
