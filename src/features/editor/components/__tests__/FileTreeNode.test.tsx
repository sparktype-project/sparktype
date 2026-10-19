import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import type { FlattenedNode } from '@/core/services/fileTree.service';
import FileTreeNode from '../FileTreeNode';

function renderNode(frontmatter: FlattenedNode['frontmatter']) {
  const item: FlattenedNode = {
    type: 'page', title: 'About', slug: 'about', path: 'content/about.md', navOrder: 1,
    parentId: null, depth: 0, index: 0, frontmatter,
  };
  render(
    <MemoryRouter>
      <DndContext>
        <SortableContext items={[item.path]}>
          <ul>
            <FileTreeNode item={item} activeId={null} projected={null} baseEditPath="/sites/s/edit" activePath={undefined} homepagePath={undefined} onCollapse={vi.fn()} />
          </ul>
        </SortableContext>
      </DndContext>
    </MemoryRouter>,
  );
}

describe('FileTreeNode scheduled badge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  test('marks a page that is held back until a future time', () => {
    renderNode({ title: 'About', layout: 'page', publishAt: '2026-06-10T09:00:00Z' });
    expect(screen.getByRole('img', { name: /^Scheduled for / })).toBeInTheDocument();
  });

  test.each([
    ['a past time', { publishAt: '2026-05-01T09:00:00Z' }],
    ['an invalid value', { publishAt: 'soon' }],
    ['a draft', { publishAt: '2026-06-10T09:00:00Z', published: false }],
    ['no schedule', {}],
  ])('shows no badge for %s', (_name, extra) => {
    renderNode({ title: 'About', layout: 'page', ...extra });
    expect(screen.queryByRole('img', { name: /Scheduled for/ })).not.toBeInTheDocument();
  });
});
