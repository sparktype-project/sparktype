import type { RJSFSchema } from '@rjsf/utils';

const { getJsonAssetMock } = vi.hoisted(() => ({
  getJsonAssetMock: vi.fn(),
}));

vi.mock('../configHelpers.service', () => ({
  getJsonAsset: getJsonAssetMock,
}));

import { getMergedThemeDataForForm } from '../theme.service';

describe('theme.service', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    getJsonAssetMock.mockResolvedValue(null);
  });

  test('maps enumNames to oneOf titles for appearance schema fields', async () => {
    const appearanceSchema = {
      type: 'object',
      properties: {
        headingFont: {
          type: 'string',
          default: 'var(--font-family-inter)',
          enum: ['var(--font-family-inter)', 'var(--font-family-playfair-display)'],
          enumNames: ['Inter', 'Playfair Display'],
        },
      },
    } as unknown as RJSFSchema;

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ appearanceSchema }),
    });

    const result = await getMergedThemeDataForForm('sparksite', {
      headingFont: 'var(--font-family-playfair-display)',
    });

    expect(result.initialConfig).toEqual({
      headingFont: 'var(--font-family-playfair-display)',
    });
    expect(result.schema?.properties?.headingFont).toEqual(
      expect.objectContaining({
        type: 'string',
        default: 'var(--font-family-inter)',
        oneOf: [
          { const: 'var(--font-family-inter)', title: 'Inter' },
          { const: 'var(--font-family-playfair-display)', title: 'Playfair Display' },
        ],
      })
    );
    expect(result.schema?.properties?.headingFont).not.toHaveProperty('enum');
    expect(result.schema?.properties?.headingFont).not.toHaveProperty('enumNames');
  });
});
