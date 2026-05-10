import Handlebars from 'handlebars';
import { markdownHelper } from '../markdown.helper';
import type { LocalSiteData } from '@/core/types';

describe('markdownHelper', () => {
  test('renders uploaded cloudinary videos with the hosted iframe player', () => {
    const siteData: LocalSiteData = {
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
        settings: {
          cloudinary: {
            cloudName: 'demo-cloud',
          },
        },
      },
      dataFiles: {},
    };

    const helper = markdownHelper(siteData).markdown;
    const result = helper.call(
      {},
      '<video src="https://res.cloudinary.com/demo-cloud/video/upload/v3/videos/demo.mp4" controls preload="metadata" data-sparktype-upload="true" data-sparktype-service-id="cloudinary" data-sparktype-video-src="videos/demo" data-sparktype-width="1920" data-sparktype-height="1080"></video>',
    );

    expect(result).toBeInstanceOf(Handlebars.SafeString);
    expect(result.toString()).toContain('data-sparktype-cloudinary-player="true"');
    expect(result.toString()).toContain(
      'src="https://player.cloudinary.com/embed/?cloud_name=demo-cloud&amp;public_id=videos%2Fdemo&amp;source%5Bsource_types%5D%5B0%5D=mp4"',
    );
    expect(result.toString()).not.toContain('<video');
  });
});
