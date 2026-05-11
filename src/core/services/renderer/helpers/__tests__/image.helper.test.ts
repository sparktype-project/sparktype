import Handlebars from 'handlebars';
import { imageHelper } from '../image.helper';
import type { LocalSiteData } from '@/core/types';

const { getProcessedImageUrlMock } = vi.hoisted(() => ({
  getProcessedImageUrlMock: vi.fn(),
}));

vi.mock('@/core/services/images/imagePreprocessor.service', () => ({
  imagePreprocessor: {
    getProcessedImageUrl: getProcessedImageUrlMock,
    getProcessedImages: vi.fn(() => new Map()),
  },
}));

function createSiteData(): LocalSiteData {
  return {
    siteId: 'test-site',
    manifest: {
      siteId: 'test-site',
      generatorVersion: '1.0.0',
      title: 'Test Site',
      description: 'Test description',
      structure: [],
      theme: {
        name: 'editorial',
        config: {},
      },
    },
    contentFiles: [
      {
        path: 'content/blog/mk.md',
        slug: 'mk',
        frontmatter: {
          title: 'MK',
          layout: 'page',
          featured_image: {
            serviceId: 'cloudinary',
            src: 'mk',
            alt: 'Uploaded image',
          },
        },
        content: '',
      },
    ],
    dataFiles: {},
  };
}

describe('imageHelper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('preserves absolute preprocessed image URLs during export', () => {
    const siteData = createSiteData();
    getProcessedImageUrlMock.mockReturnValue(
      'https://res.cloudinary.com/dhcgic4ld/image/upload/c_fill,g_xy_center,h_256,w_256/f_auto/q_auto/mk'
    );

    const helper = imageHelper(siteData).image;
    const result = helper.call(
      {},
      {
        hash: {
          fieldname: 'featured_image',
          preset: 'thumbnail',
        },
        data: {
          root: {
            contentFile: siteData.contentFiles![0],
            options: {
              isExport: true,
            },
          },
        },
      } as Handlebars.HelperOptions
    );

    expect(result).toBeInstanceOf(Handlebars.SafeString);
    expect(result.toString()).toContain(
      'src="https://res.cloudinary.com/dhcgic4ld/image/upload/c_fill,g_xy_center,h_256,w_256/f_auto/q_auto/mk"'
    );
    expect(result.toString()).not.toContain('/https://res.cloudinary.com/');
  });
});
