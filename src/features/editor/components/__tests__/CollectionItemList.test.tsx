import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CollectionItemList from '../CollectionItemList';
import { createSiteFixture } from '@/test/support/siteFixtures';

const { storeState } = vi.hoisted(() => ({ storeState: {} as Record<string, unknown> }));

vi.mock('@/core/state/useAppStore', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) => selector(storeState),
}));

function renderList(extra: Record<string, unknown>) {
  const site = createSiteFixture('collectionSite');
  const post = site.contentFiles!.find((file) => file.path === 'content/posts/launch-day.md')!;
  Object.assign(post.frontmatter, extra);
  storeState.getSiteById = () => site;
  storeState.updateContentFileOnly = vi.fn();
  storeState.deleteContentFileAndState = vi.fn();
  render(
    <MemoryRouter>
      <CollectionItemList siteId={site.siteId} collectionId="posts" />
    </MemoryRouter>,
  );
}

describe('CollectionItemList status badge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  test('shows Scheduled for <date> while the item is held back', () => {
    renderList({ publishAt: '2026-06-10T09:00:00Z' });
    expect(screen.getByText(/^Scheduled for /)).toBeInTheDocument();
    expect(screen.queryByText('Published')).not.toBeInTheDocument();
  });

  test('shows Published once the time has passed or the stored value is invalid', () => {
    renderList({ publishAt: 'soon' });
    expect(screen.getByText('Published')).toBeInTheDocument();
  });

  test('a draft stays a draft whatever its schedule says', () => {
    renderList({ publishAt: '2026-06-10T09:00:00Z', published: false });
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });
});
