import type { ImageRef, ImageService, LocalSiteData } from '@/core/types';
import { imagePreprocessor } from '../imagePreprocessor.service';
import { getActiveImageService } from '../images.service';

vi.mock('../images.service', () => ({
  getActiveImageService: vi.fn(),
}));

const mockGetActiveImageService = vi.mocked(getActiveImageService);

function createSiteData(imageRef: ImageRef): LocalSiteData {
  return {
    siteId: 'site-1',
    manifest: {
      siteId: 'site-1',
      generatorVersion: '1.0.0',
      title: 'Test Site',
      description: 'Test description',
      theme: { name: 'default', config: {} },
      structure: [],
    },
    contentFiles: [
      {
        path: 'content/post.md',
        slug: 'post',
        frontmatter: {
          title: 'Post',
          layout: 'page',
          featured_image: imageRef,
        },
        content: 'Hello world',
      },
    ],
    layoutFiles: [],
    themeFiles: [],
  };
}

function createImageService(): ImageService {
  return {
    id: 'cloudinary',
    name: 'Upload to Cloudinary',
    capabilities: {
      upload: true,
      uploadInteraction: 'provider-widget',
      transforms: true,
      exportMode: 'metadata-only',
      importMode: 'metadata-only',
      videoUpload: true,
    },
    upload: vi.fn(),
    getDisplayUrl: vi.fn(async (_manifest, ref, options) => `preview:${ref.src}:${options.width ?? 'auto'}x${options.height ?? 'auto'}`),
    getExportableAssets: vi.fn(),
  };
}

describe('imagePreprocessor', () => {
  beforeEach(() => {
    imagePreprocessor.getProcessedImages().clear();
    mockGetActiveImageService.mockReturnValue(createImageService());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('refreshes cached presets when an image field changes to a different source', async () => {
    await imagePreprocessor.preprocessImages(
      createSiteData({
        serviceId: 'cloudinary',
        src: 'images/first',
        providerData: {
          secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/images/first.jpg',
          version: 1,
        },
      }),
      false
    );

    expect(
      imagePreprocessor.getProcessedImageUrl('site-1', 'content/post.md', 'featured_image', 'thumbnail')
    ).toContain('images/first');

    await imagePreprocessor.preprocessImages(
      createSiteData({
        serviceId: 'cloudinary',
        src: 'images/second',
        providerData: {
          secureUrl: 'https://res.cloudinary.com/demo/image/upload/v2/images/second.jpg',
          version: 2,
        },
      }),
      false
    );

    expect(
      imagePreprocessor.getProcessedImageUrl('site-1', 'content/post.md', 'featured_image', 'thumbnail')
    ).toContain('images/second');
  });
});
