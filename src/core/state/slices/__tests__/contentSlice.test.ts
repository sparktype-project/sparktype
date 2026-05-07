import { describe, expect, test, vi, beforeEach } from 'vitest';
import type { Manifest, ParsedMarkdownFile, StructureNode } from '@/core/types';
import * as localSiteFs from '@/core/services/localFileSystem.service';
import { findImagesInContentFile } from '@/core/services/images/imageReferenceFinder.service';
import { updateImageReferences } from '@/core/services/images/imageRegistry.service';
import { createContentSlice } from '../contentSlice';

vi.mock('@/core/services/localFileSystem.service', () => ({
  saveContentFile: vi.fn(),
}));

vi.mock('@/core/services/images/imageReferenceFinder.service', () => ({
  findImagesInContentFile: vi.fn(() => []),
}));

vi.mock('@/core/services/images/imageRegistry.service', () => ({
  updateImageReferences: vi.fn(),
}));

const mockSaveContentFile = vi.mocked(localSiteFs.saveContentFile);
const mockFindImagesInContentFile = vi.mocked(findImagesInContentFile);
const mockUpdateImageReferences = vi.mocked(updateImageReferences);

function createManifest(): Manifest {
  return {
    siteId: 'site-1',
    generatorVersion: '1.0.0',
    title: 'Test Site',
    description: 'Test',
    theme: { name: 'default', config: {} },
    structure: [
      {
        type: 'page',
        title: 'Home',
        path: 'content/home.md',
        slug: 'home',
        navOrder: 0,
        children: [],
      } satisfies StructureNode,
    ],
    collections: [],
    collectionItems: [],
  };
}

function createState() {
  let state: any = {
    sites: [
      {
        siteId: 'site-1',
        manifest: createManifest(),
        contentFiles: [
          {
            path: 'content/home.md',
            slug: 'home',
            frontmatter: { title: 'Home', layout: 'page' },
            content: 'Old body',
          } satisfies ParsedMarkdownFile,
        ],
      },
    ],
  };

  const updateManifest = vi.fn(async (siteId: string, manifest: Manifest) => {
    state = {
      ...state,
      sites: state.sites.map((site: { siteId: string; manifest: Manifest }) =>
        site.siteId === siteId ? { ...site, manifest } : site
      ),
    };
  });

  const set = (updater: any) => {
    if (typeof updater === 'function') {
      state = updater(get());
    } else {
      state = { ...state, ...updater };
    }
    return state;
  };

  const get = () => ({
    ...state,
    getSiteById: (siteId: string) => state.sites.find((site: { siteId: string }) => site.siteId === siteId),
    updateManifest,
  });
  const slice = createContentSlice(set as never, get as never, {} as never);

  return { getState: () => state, slice };
}

describe('contentSlice.updateContentFileOnly', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('keeps Zustand in sync with the parsed file returned from persistence', async () => {
    const { getState, slice } = createState();
    const incomingFile: ParsedMarkdownFile = {
      path: 'content/home.md',
      slug: 'home',
      frontmatter: { title: 'Home', layout: 'page' },
      content: 'Latest body\n',
    };
    const persistedFile: ParsedMarkdownFile = {
      ...incomingFile,
      content: 'Latest body',
    };

    mockSaveContentFile.mockResolvedValue(persistedFile);

    await slice.updateContentFileOnly('site-1', incomingFile);

    expect(mockSaveContentFile).toHaveBeenCalledOnce();
    expect(mockFindImagesInContentFile).toHaveBeenCalledWith(persistedFile);
    expect(mockUpdateImageReferences).toHaveBeenCalledWith('site-1', 'content/home.md', []);
    expect(getState().sites[0].contentFiles[0]).toEqual(persistedFile);
    expect(getState().sites[0].contentFiles[0].content).toBe('Latest body');
  });
});
