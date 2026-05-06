import { localImageService } from '../localImage.service';

const {
  saveImageAssetMock,
  getImageAssetMock,
  getCachedDerivativeMock,
  setCachedDerivativeMock,
  getAllCacheKeysMock,
  slugifyMock,
  addImageToRegistryMock,
  addDerivativeToRegistryMock,
  isTauriAppMock,
  getImageDimensionsMock,
  cropAndResizeImageMock,
} = vi.hoisted(() => ({
  saveImageAssetMock: vi.fn(),
  getImageAssetMock: vi.fn(),
  getCachedDerivativeMock: vi.fn(),
  setCachedDerivativeMock: vi.fn(),
  getAllCacheKeysMock: vi.fn(),
  slugifyMock: vi.fn(),
  addImageToRegistryMock: vi.fn(),
  addDerivativeToRegistryMock: vi.fn(),
  isTauriAppMock: vi.fn(),
  getImageDimensionsMock: vi.fn(),
  cropAndResizeImageMock: vi.fn(),
}));

vi.mock('@/core/services/localFileSystem.service', () => ({
  saveImageAsset: saveImageAssetMock,
  getImageAsset: getImageAssetMock,
}));

vi.mock('../derivativeCache.service', () => ({
  getCachedDerivative: getCachedDerivativeMock,
  setCachedDerivative: setCachedDerivativeMock,
  getAllCacheKeys: getAllCacheKeysMock,
}));

vi.mock('@/core/libraries/utils', () => ({
  slugify: slugifyMock,
}));

vi.mock('../imageRegistry.service', () => ({
  addImageToRegistry: addImageToRegistryMock,
  addDerivativeToRegistry: addDerivativeToRegistryMock,
}));

vi.mock('../imageManipulation.service', () => ({
  getImageDimensions: getImageDimensionsMock,
  cropAndResizeImage: cropAndResizeImageMock,
}));

vi.mock('@/core/utils/platform', () => ({
  isTauriApp: isTauriAppMock,
}));

vi.mock('browser-image-compression', () => ({
  default: vi.fn(async (blob: Blob) => blob),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe('localImage.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    slugifyMock.mockImplementation((value: string) => value.toLowerCase().replace(/\s+/g, '-'));
    getImageDimensionsMock.mockResolvedValue({ width: 640, height: 480 });
    cropAndResizeImageMock.mockResolvedValue(new Blob(['processed'], { type: 'image/jpeg' }));
    getCachedDerivativeMock.mockResolvedValue(null);
    getImageAssetMock.mockResolvedValue(new Blob(['source'], { type: 'image/jpeg' }));
    isTauriAppMock.mockReturnValue(false);
    URL.createObjectURL = vi.fn(() => 'blob:preview');
  });

  test('uploads local images into assets/originals and records registry metadata', async () => {
    const file = new File(['image'], 'Hero Banner.jpg', { type: 'image/jpeg' });

    const ref = await localImageService.upload(file, 'site-1');

    expect(ref).toEqual({
      serviceId: 'local',
      src: 'assets/originals/1700000000000-hero-banner.jpg',
      alt: 'Hero Banner.jpg',
      width: 640,
      height: 480,
    });
    expect(saveImageAssetMock).toHaveBeenCalledWith(
      'site-1',
      'assets/originals/1700000000000-hero-banner.jpg',
      expect.any(Blob)
    );
    expect(addImageToRegistryMock).toHaveBeenCalledWith(
      'site-1',
      'assets/originals/1700000000000-hero-banner.jpg',
      expect.objectContaining({
        sizeBytes: file.size,
        width: 640,
        height: 480,
      })
    );
  });

  test('returns export paths for originals and derivatives', async () => {
    const manifest = {
      siteId: 'site-1',
      structure: [],
      theme: { name: 'starter', config: {} },
    } as any;

    await expect(
      localImageService.getDisplayUrl(manifest, { serviceId: 'local', src: 'assets/originals/icon.svg' }, {}, true)
    ).resolves.toBe('/_site/assets/originals/icon.svg');

    await expect(
      localImageService.getDisplayUrl(
        manifest,
        { serviceId: 'local', src: 'assets/originals/photo.jpg' },
        { width: 300, height: 200, crop: 'fill', gravity: 'north' },
        true
      )
    ).resolves.toBe('/_site/assets/derivatives/photo_w300_h200_c-fill_g-north.jpg');
  });

  test('returns preview blob urls for original and cached derivative images', async () => {
    const manifest = {
      siteId: 'site-1',
      structure: [],
      theme: { name: 'starter', config: {} },
    } as any;
    getCachedDerivativeMock.mockResolvedValueOnce(new Blob(['cached'], { type: 'image/jpeg' }));

    await expect(
      localImageService.getDisplayUrl(
        manifest,
        { serviceId: 'local', src: 'assets/originals/photo.jpg' },
        {},
        false,
        false,
        true
      )
    ).resolves.toBe('blob:preview');

    await expect(
      localImageService.getDisplayUrl(
        manifest,
        { serviceId: 'local', src: 'assets/originals/photo.jpg' },
        { width: 300, height: 200 },
        false
      )
    ).resolves.toBe('blob:preview');
  });

  test('exports originals under _site/assets/originals and cached derivatives under _site/assets/derivatives', async () => {
    getAllCacheKeysMock.mockResolvedValue([
      'site-1/assets/derivatives/photo_w300_h200_c-scale_g-center.jpg',
    ]);
    getCachedDerivativeMock.mockResolvedValue(new Blob(['derivative'], { type: 'image/jpeg' }));

    const assets = await localImageService.getExportableAssets('site-1', [
      { serviceId: 'local', src: 'assets/originals/photo.jpg' },
    ]);

    expect(assets).toEqual([
      { path: '_site/assets/originals/photo.jpg', data: expect.any(Blob) },
      { path: '_site/assets/derivatives/photo_w300_h200_c-scale_g-center.jpg', data: expect.any(Blob) },
    ]);
  });
});
