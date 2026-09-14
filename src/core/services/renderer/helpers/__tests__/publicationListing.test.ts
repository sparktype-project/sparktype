import Handlebars from 'handlebars';
import { afterEach, describe, expect, test } from 'vitest';
import type { LayoutManifest, LocalSiteData, ParsedMarkdownFile } from '@/core/types';
import { createPublicSiteSnapshot } from '@/core/services/builder/publication';
import { queryHelper } from '../query.helper';
import { renderCollectionHelper } from '../renderCollection.helper';

/**
 * The publication rule for listings, asserted on both listing paths:
 *
 * - Preview renders the caller's live site data, so drafts are visible everywhere: a writer
 *   must be able to preview the page they are still writing.
 * - Export renders the public snapshot, where drafts are already gone, so neither helper
 *   filters on `published`. Publication filtering lives in `builder/publication.ts` only.
 */

const LISTING_PATH = 'content/posts.md';

function createPost(path: string, title: string, date: string, published?: boolean): ParsedMarkdownFile {
  return {
    path,
    slug: path.replace(/^content\//, '').replace(/\.md$/, ''),
    frontmatter: {
      title,
      layout: 'post',
      date,
      ...(published === undefined ? {} : { published }),
    },
    content: `${title} body`,
  };
}

function createListingSite(): LocalSiteData {
  const listingFile: ParsedMarkdownFile = {
    path: LISTING_PATH,
    slug: 'posts',
    frontmatter: {
      title: 'Posts',
      layout: 'listing',
      layoutConfig: { collectionId: 'posts', layout: 'post', sortBy: 'date', sortOrder: 'desc' },
    },
    content: 'Listing page',
  };
  const published = createPost('content/posts/published.md', 'Published Post', '2025-01-01');
  const draft = createPost('content/posts/draft.md', 'Draft Post', '2025-02-01', false);

  return {
    siteId: 'listing-site',
    manifest: {
      siteId: 'listing-site',
      generatorVersion: '1.0.0',
      title: 'Listing Site',
      description: 'Listing site',
      baseUrl: 'https://example.com',
      theme: { name: 'starter', config: {} },
      structure: [
        { type: 'page', title: 'Home', slug: 'home', path: 'content/home.md' },
        {
          type: 'page',
          title: 'Posts',
          slug: 'posts',
          path: LISTING_PATH,
          children: [
            { type: 'page', title: 'Published Post', slug: 'posts/published', path: published.path },
            { type: 'page', title: 'Draft Post', slug: 'posts/draft', path: draft.path },
          ],
        },
      ],
      collections: [
        { id: 'posts', name: 'Posts', contentPath: 'content/posts', defaultItemLayout: 'post' },
      ],
      collectionItems: [
        { collectionId: 'posts', slug: 'published', path: published.path, title: 'Published Post', url: '' },
        { collectionId: 'posts', slug: 'draft', path: draft.path, title: 'Draft Post', url: '' },
      ],
    },
    contentFiles: [
      { path: 'content/home.md', slug: 'home', frontmatter: { title: 'Home', layout: 'page', homepage: true }, content: 'Home' },
      listingFile,
      published,
      draft,
    ],
  };
}

function renderQueryListing(siteData: LocalSiteData): string[] {
  Handlebars.registerHelper(queryHelper(siteData));
  // The helper's block-param form (`as |posts|`) is pre-existing broken: it sets the value on
  // `data` instead of passing `blockParams`, which the compiled program dereferences. This
  // asserts the selection the helper hands to its block, which is what publication affects.
  const template = Handlebars.compile(
    '{{#query source_collection="posts" sort_by="date" sort_order="desc"}}{{#each this}}{{frontmatter.title}}|{{/each}}{{/query}}',
  );
  const output = template({});
  Handlebars.unregisterHelper('query');
  return output.split('|').filter(Boolean);
}

function renderCollectionListing(siteData: LocalSiteData): string[] {
  Handlebars.registerPartial('post/index.hbs', '{{#each collectionItems}}{{frontmatter.title}}|{{/each}}');
  Handlebars.registerHelper(renderCollectionHelper(siteData));
  const template = Handlebars.compile('{{{render_collection layoutConfig}}}');
  const layoutManifest = { id: 'post', name: 'Post', layoutType: 'item' } as LayoutManifest;
  const output = template({
    siteData,
    layoutManifest,
    contentFile: siteData.contentFiles![1],
    layoutConfig: { collectionId: 'posts', layout: 'post', sortBy: 'date', sortOrder: 'desc' },
  });
  Handlebars.unregisterHelper('render_collection');
  Handlebars.unregisterPartial('post/index.hbs');
  return output.split('|').filter(Boolean);
}

afterEach(() => {
  Handlebars.unregisterHelper('query');
  Handlebars.unregisterHelper('render_collection');
  Handlebars.unregisterPartial('post/index.hbs');
});

describe('listing paths agree about drafts', () => {
  test('preview shows drafts in both the query helper and render_collection', () => {
    const site = createListingSite();

    const fromQuery = renderQueryListing(site);
    const fromRenderCollection = renderCollectionListing(site);

    expect(fromQuery).toContain('Draft Post');
    expect(fromQuery).toContain('Published Post');
    expect(fromRenderCollection).toContain('Draft Post');
    expect(fromRenderCollection).toContain('Published Post');
  });

  test('the public snapshot removes drafts from both listing paths', () => {
    const snapshot = createPublicSiteSnapshot(createListingSite());

    const fromQuery = renderQueryListing(snapshot);
    const fromRenderCollection = renderCollectionListing(snapshot);

    expect(fromQuery).toEqual(['Published Post']);
    expect(fromRenderCollection).toEqual(['Published Post']);
  });
});
