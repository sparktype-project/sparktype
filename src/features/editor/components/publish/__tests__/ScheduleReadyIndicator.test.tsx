import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ParsedMarkdownFile } from '@/core/types';
import type { PublishHistoryEntry } from '@/core/services/publishing/history/publishHistory.service';

const { storeState, readHistoryMock } = vi.hoisted(() => ({
  storeState: {} as Record<string, unknown>,
  readHistoryMock: vi.fn(),
}));

vi.mock('@/core/state/useAppStore', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) => selector(storeState),
}));
vi.mock('@/core/services/publishing/history/publishHistory.service', () => ({
  readPublishHistory: readHistoryMock,
}));

import ScheduleReadyIndicator from '../ScheduleReadyIndicator';

const file = (path: string, publishAt?: string): ParsedMarkdownFile => ({
  path, slug: path, content: '', frontmatter: { title: path, layout: 'page', ...(publishAt ? { publishAt } : {}) },
});
const published = (startedAt: string): PublishHistoryEntry => ({
  id: 'a', kind: 'publish', startedAt, finishedAt: startedAt, provider: 'zip', target: 'download',
  outcome: 'success', findings: { blocking: 0, warning: 0 }, log: [],
});

function setup(files: ParsedMarkdownFile[], history: PublishHistoryEntry[], clock: { value: number }, onPublish = vi.fn()) {
  storeState.getSiteById = () => ({ siteId: 's', contentFiles: files });
  readHistoryMock.mockResolvedValue(history);
  render(<ScheduleReadyIndicator siteId="s" onPublish={onPublish} now={() => clock.value} />);
  return onPublish;
}

describe('ScheduleReadyIndicator', () => {
  test('announces items that came due after the last publish and opens publishing on click', async () => {
    const clock = { value: Date.parse('2026-06-10T12:00:00Z') };
    const onPublish = setup(
      [file('a', '2026-06-08T00:00:00Z'), file('b', '2026-06-09T00:00:00Z'), file('later', '2026-07-01T00:00:00Z')],
      [published('2026-06-05T12:00:00Z')],
      clock,
    );

    const button = await screen.findByRole('button', { name: '2 scheduled items are ready: publish to release them' });
    await userEvent.click(button);
    expect(onPublish).toHaveBeenCalled();
  });

  test('uses the singular for one item', async () => {
    setup([file('a', '2026-06-08T00:00:00Z')], [published('2026-06-05T12:00:00Z')], { value: Date.parse('2026-06-10T12:00:00Z') });
    expect(await screen.findByRole('button', { name: '1 scheduled item is ready: publish to release it' })).toBeInTheDocument();
  });

  test('shows nothing when items were already published, are still in the future, or the site never published', async () => {
    const clock = { value: Date.parse('2026-06-10T12:00:00Z') };
    setup([file('live', '2026-06-01T00:00:00Z'), file('later', '2026-07-01T00:00:00Z')], [published('2026-06-05T12:00:00Z')], clock);
    await waitFor(() => expect(readHistoryMock).toHaveBeenCalled());
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('stays hidden before the first publish', async () => {
    setup([file('a', '2026-06-08T00:00:00Z')], [], { value: Date.parse('2026-06-10T12:00:00Z') });
    await waitFor(() => expect(readHistoryMock).toHaveBeenCalled());
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('appears once the clock passes a scheduled time', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const clock = { value: Date.parse('2026-06-10T11:59:00Z') };
      setup([file('a', '2026-06-10T12:00:00Z')], [published('2026-06-05T12:00:00Z')], clock);
      await waitFor(() => expect(readHistoryMock).toHaveBeenCalled());
      expect(screen.queryByRole('button')).not.toBeInTheDocument();

      clock.value = Date.parse('2026-06-10T12:00:30Z');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(await screen.findByRole('button', { name: /1 scheduled item is ready/ })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
