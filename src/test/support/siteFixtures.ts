import type {
  Collection,
  CollectionItemRef,
  ImageRef,
  LocalSiteData,
  Manifest,
  ParsedMarkdownFile,
  RawFile,
  StructureNode,
} from '@/core/types';

type SiteFixtureName =
  | 'basicSite'
  | 'nestedPagesSite'
  | 'collectionSite'
  | 'customThemeSite'
  | 'imageHeavySite'
  | 'unsafeHtmlSite';

interface SiteFixtureOptions {
  siteId?: string;
  title?: string;
}

function createImageRef(src: string, alt = ''): ImageRef {
  return {
    serviceId: 'local',
    src,
    alt,
    width: 1200,
    height: 800,
  };
}

function createManifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    siteId: overrides.siteId ?? 'site-fixture',
    generatorVersion: '1.0.0',
    title: overrides.title ?? 'Fixture Site',
    description: overrides.description ?? 'Fixture description',
    theme: overrides.theme ?? { name: 'starter', config: {} },
    structure: overrides.structure ?? [],
    collections: overrides.collections,
    collectionItems: overrides.collectionItems,
    logo: overrides.logo,
    favicon: overrides.favicon,
    publishingConfig: overrides.publishingConfig,
    settings: overrides.settings,
    imagePresets: overrides.imagePresets,
    dataFiles: overrides.dataFiles,
    auth: overrides.auth,
    themes: overrides.themes,
    layouts: overrides.layouts,
    tagGroups: overrides.tagGroups,
    tags: overrides.tags,
    author: overrides.author,
    baseUrl: overrides.baseUrl,
  };
}

function createPageNode(path: string, slug: string, title: string, children?: StructureNode[]): StructureNode {
  return {
    type: 'page',
    path,
    slug,
    title,
    children,
  };
}

function createContentFile(
  path: string,
  slug: string,
  title: string,
  layout: string,
  content: string,
  frontmatterOverrides: Record<string, unknown> = {}
): ParsedMarkdownFile {
  return {
    path,
    slug,
    frontmatter: {
      title,
      layout,
      ...frontmatterOverrides,
    },
    content,
  };
}

function createThemeFiles(themeName: string): RawFile[] {
  return [
    {
      path: `themes/${themeName}/theme.json`,
      content: JSON.stringify({
        layouts: ['page', 'listing', 'post'],
      }),
    },
    {
      path: `themes/${themeName}/base.hbs`,
      content: `<html><head><title>{{pageTitle}}</title></head><body class="theme-{{theme.name}}">{{{body}}}</body></html>`,
    },
    {
      path: `themes/${themeName}/layouts/page/index.hbs`,
      content: `<main data-layout="page"><h1>{{pageTitle}}</h1>{{{content}}}</main>`,
    },
    {
      path: `themes/${themeName}/layouts/listing/index.hbs`,
      content: `<section data-layout="listing"><h1>{{pageTitle}}</h1>{{{content}}}</section>`,
    },
    {
      path: `themes/${themeName}/layouts/post/index.hbs`,
      content: `<article data-layout="post"><h1>{{pageTitle}}</h1>{{{content}}}</article>`,
    },
  ];
}

function createCollection(collectionId = 'posts'): Collection {
  return {
    id: collectionId,
    name: 'Posts',
    contentPath: `content/${collectionId}`,
    layout: 'listing',
    defaultItemLayout: 'post',
    schema: {
      title: 'Post',
      type: 'object',
      properties: {},
    },
  };
}

function buildBasicSite(options: SiteFixtureOptions = {}): LocalSiteData {
  const siteId = options.siteId ?? 'basic-site';
  const homePath = 'content/home.md';
  const structure = [createPageNode(homePath, 'home', 'Home')];
  const contentFiles = [
    createContentFile(homePath, 'home', 'Home', 'page', 'Welcome to **Sparktype**.', { homepage: true }),
  ];

  return {
    siteId,
    manifest: createManifest({
      siteId,
      title: options.title ?? 'Basic Site',
      structure,
      theme: { name: 'starter', config: { accent: 'teal' } },
    }),
    contentFiles,
    themeFiles: createThemeFiles('starter'),
    layoutFiles: [],
    dataFiles: {},
  };
}

function buildNestedPagesSite(options: SiteFixtureOptions = {}): LocalSiteData {
  const siteId = options.siteId ?? 'nested-pages-site';
  const homePath = 'content/home.md';
  const aboutPath = 'content/about.md';
  const childPath = 'content/about/team.md';
  const structure = [
    createPageNode(homePath, 'home', 'Home'),
    createPageNode(aboutPath, 'about', 'About', [
      createPageNode(childPath, 'about/team', 'Team'),
    ]),
  ];

  const contentFiles = [
    createContentFile(homePath, 'home', 'Home', 'page', 'Home page', { homepage: true }),
    createContentFile(aboutPath, 'about', 'About', 'page', 'About page'),
    createContentFile(childPath, 'about/team', 'Team', 'page', 'Meet the team'),
  ];

  return {
    siteId,
    manifest: createManifest({
      siteId,
      title: options.title ?? 'Nested Pages Site',
      structure,
      theme: { name: 'starter', config: { accent: 'orange' } },
    }),
    contentFiles,
    themeFiles: createThemeFiles('starter'),
    layoutFiles: [],
    dataFiles: {},
  };
}

function buildCollectionSite(options: SiteFixtureOptions = {}): LocalSiteData {
  const siteId = options.siteId ?? 'collection-site';
  const collection = createCollection('posts');
  const listingPath = 'content/posts.md';
  const itemPath = 'content/posts/launch-day.md';
  const structure = [
    createPageNode('content/home.md', 'home', 'Home'),
    createPageNode(listingPath, 'posts', 'Posts'),
  ];

  const contentFiles = [
    createContentFile('content/home.md', 'home', 'Home', 'page', 'Home page', { homepage: true }),
    createContentFile(listingPath, 'posts', 'Posts', 'listing', 'Listing page', {
      collection: 'posts',
      layoutConfig: { collectionId: 'posts', layout: 'post', sortBy: 'date', sortOrder: 'desc' },
    }),
    createContentFile(itemPath, 'posts/launch-day', 'Launch Day', 'post', 'Collection item body', {
      date: '2025-01-10',
    }),
  ];

  const collectionItems: CollectionItemRef[] = [
    {
      collectionId: 'posts',
      slug: 'launch-day',
      path: itemPath,
      title: 'Launch Day',
      url: '',
    },
  ];

  return {
    siteId,
    manifest: createManifest({
      siteId,
      title: options.title ?? 'Collection Site',
      structure,
      collections: [collection],
      collectionItems,
      theme: { name: 'starter', config: { accent: 'blue' } },
    }),
    contentFiles,
    themeFiles: createThemeFiles('starter'),
    layoutFiles: [],
    dataFiles: {},
  };
}

function buildCustomThemeSite(options: SiteFixtureOptions = {}): LocalSiteData {
  const site = buildBasicSite({ ...options, siteId: options.siteId ?? 'custom-theme-site' });

  site.manifest.theme = {
    name: 'editorial',
    config: {
      accent: '#0f766e',
      brandMessage: 'Custom brand',
    },
  };

  site.themeFiles = [
    {
      path: 'themes/editorial/theme.json',
      content: JSON.stringify({ layouts: ['page'] }),
    },
    {
      path: 'themes/editorial/base.hbs',
      content: `<html><body data-accent="{{theme.config.accent}}">{{{body}}}<footer>{{theme.config.brandMessage}}</footer></body></html>`,
    },
    {
      path: 'themes/editorial/layouts/page/index.hbs',
      content: `<main class="editorial-page">{{{content}}}</main>`,
    },
  ];

  return site;
}

function buildImageHeavySite(options: SiteFixtureOptions = {}): LocalSiteData {
  const site = buildBasicSite({ ...options, siteId: options.siteId ?? 'image-heavy-site' });
  site.manifest.logo = createImageRef('assets/originals/logo.png', 'Logo');
  site.manifest.favicon = createImageRef('assets/originals/favicon.png', 'Favicon');
  site.contentFiles = [
    createContentFile('content/home.md', 'home', 'Home', 'page', '![Hero](assets/originals/hero.jpg)', {
      homepage: true,
      featured_image: createImageRef('assets/originals/hero.jpg', 'Hero'),
    }),
  ];
  return site;
}

function buildUnsafeHtmlSite(options: SiteFixtureOptions = {}): LocalSiteData {
  const site = buildBasicSite({ ...options, siteId: options.siteId ?? 'unsafe-html-site' });
  site.contentFiles = [
    createContentFile(
      'content/home.md',
      'home',
      'Home',
      'page',
      `<div onclick="alert('xss')">Unsafe</div>
<script>alert('nope')</script>
<script src="https://trusted.example/app.js"></script>
<iframe src="http://insecure.example/embed"></iframe>
<iframe src="https://trusted.example/embed"></iframe>`,
      { homepage: true }
    ),
  ];
  return site;
}

export function createSiteFixture(name: SiteFixtureName, options: SiteFixtureOptions = {}): LocalSiteData {
  switch (name) {
    case 'basicSite':
      return buildBasicSite(options);
    case 'nestedPagesSite':
      return buildNestedPagesSite(options);
    case 'collectionSite':
      return buildCollectionSite(options);
    case 'customThemeSite':
      return buildCustomThemeSite(options);
    case 'imageHeavySite':
      return buildImageHeavySite(options);
    case 'unsafeHtmlSite':
      return buildUnsafeHtmlSite(options);
  }
}
