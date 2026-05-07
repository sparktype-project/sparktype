import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { WidgetProps } from '@rjsf/utils';
import type { ImageRef, ImageService } from '@/core/types';
import ImageUploadWidget from '../ImageUploadWidget';
import { useAppStore } from '@/core/state/useAppStore';
import { getActiveImageService } from '@/core/services/images/images.service';
import { useEditor } from '@/features/editor/contexts/useEditor';

vi.mock('@/core/state/useAppStore', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('@/core/services/images/images.service', () => ({
  getActiveImageService: vi.fn(),
}));

vi.mock('@/features/editor/contexts/useEditor', () => ({
  useEditor: vi.fn(),
}));

const mockUseAppStore = vi.mocked(useAppStore);
const mockGetActiveImageService = vi.mocked(getActiveImageService);
const mockUseEditor = vi.mocked(useEditor);
const beginProviderUpload = vi.fn();
const endProviderUpload = vi.fn();

const baseProps: WidgetProps = {
  id: 'hero-image',
  name: 'heroImage',
  label: 'Hero Image',
  onChange: vi.fn(),
  onBlur: vi.fn(),
  onFocus: vi.fn(),
  value: undefined,
  required: false,
  disabled: false,
  readonly: false,
  autofocus: false,
  options: {},
  schema: { type: 'object' },
  uiSchema: {},
  rawErrors: [],
  registry: {} as WidgetProps['registry'],
  formContext: {
    siteId: 'site-1',
  },
};

const site = {
  siteId: 'site-1',
  manifest: {
    siteId: 'site-1',
    generatorVersion: '1.0.0',
    title: 'Test Site',
    description: 'Test description',
    theme: { name: 'default', config: {} },
    structure: [],
  },
  secrets: {},
};

function createImageService(overrides: Partial<ImageService> = {}): ImageService {
  return {
    id: 'local',
    name: 'Store in Site Bundle',
    capabilities: {
      upload: true,
      uploadInteraction: 'file-input',
      transforms: true,
      exportMode: 'bundle',
      importMode: 'full',
      videoUpload: false,
    },
    upload: vi.fn(),
    getDisplayUrl: vi.fn(),
    getExportableAssets: vi.fn(),
    ...overrides,
  };
}

describe('ImageUploadWidget', () => {
  beforeEach(() => {
    mockUseAppStore.mockImplementation((selector) => selector({
      getSiteById: () => site,
    } as never));
    mockUseEditor.mockReturnValue({
      beginProviderUpload,
      endProviderUpload,
    } as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('renders a file input for file-input services', () => {
    mockGetActiveImageService.mockReturnValue(createImageService());

    const { container } = render(<ImageUploadWidget {...baseProps} />);

    expect(container.querySelector('input[type="file"]')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upload via/i })).not.toBeInTheDocument();
  });

  test('renders a provider button and skips the file input for provider-widget services', async () => {
    const uploadedRef: ImageRef = {
      serviceId: 'cloudinary',
      src: 'images/hero',
      alt: 'Hero image',
      width: 1200,
      height: 630,
    };
    const startUpload = vi.fn().mockResolvedValue(uploadedRef);
    const onChange = vi.fn();

    mockGetActiveImageService.mockReturnValue(createImageService({
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
      startUpload,
    }));

    const { container } = render(<ImageUploadWidget {...baseProps} onChange={onChange} />);

    expect(container.querySelector('input[type="file"]')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /upload via upload to cloudinary/i }));

    await waitFor(() => {
      expect(startUpload).toHaveBeenCalledWith('site-1', expect.objectContaining({
        manifest: site.manifest,
        secrets: site.secrets,
      }));
      expect(onChange).toHaveBeenCalledWith(uploadedRef);
    });
    expect(beginProviderUpload).toHaveBeenCalledTimes(1);
    expect(endProviderUpload).toHaveBeenCalledTimes(1);
  });

  test('renders a preview thumbnail for remote providers using the service display URL', async () => {
    const getDisplayUrl = vi.fn().mockResolvedValue('https://res.cloudinary.com/demo/image/upload/c_fit,w_960,h_540/images/hero.jpg');

    mockGetActiveImageService.mockReturnValue(createImageService({
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
      getDisplayUrl,
    }));

    render(<ImageUploadWidget
      {...baseProps}
      value={{
        serviceId: 'cloudinary',
        src: 'images/hero',
        alt: 'Hero image',
        providerData: {
          secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/images/hero.jpg',
        },
      }}
    />);

    const preview = await screen.findByAltText('Hero Image preview');
    expect(preview).toHaveAttribute('src', 'https://res.cloudinary.com/demo/image/upload/c_fit,w_960,h_540/images/hero.jpg');
    expect(getDisplayUrl).toHaveBeenCalledWith(
      site.manifest,
      expect.objectContaining({ src: 'images/hero' }),
      { width: 960, height: 540, crop: 'fit' },
      false,
      false,
      true
    );
  });
});
