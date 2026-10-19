import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PublishHistoryEntry } from '@/core/services/publishing/history/publishHistory.service';

const { readHistoryMock } = vi.hoisted(() => ({ readHistoryMock: vi.fn() }));
vi.mock('@/core/services/publishing/history/publishHistory.service', () => ({
  readPublishHistory: readHistoryMock,
}));

import DeployHistory from '../DeployHistory';

const success: PublishHistoryEntry = {
  id: 'ok',
  kind: 'publish',
  startedAt: '2025-03-01T12:00:00.000Z',
  finishedAt: '2025-03-01T12:00:04.000Z',
  provider: 'github',
  target: 'o/r#main',
  outcome: 'success',
  url: 'https://github.com/o/r',
  commitSHA: '0123456789abcdef0123456789abcdef01234567',
  fileCount: 12,
  findings: { blocking: 0, warning: 2 },
  log: [
    { at: '2025-03-01T12:00:00.000Z', step: 'build', status: 'started' },
    { at: '2025-03-01T12:00:02.000Z', step: 'build', status: 'completed' },
  ],
};
const failure: PublishHistoryEntry = {
  ...success,
  id: 'bad',
  outcome: 'failed',
  commitSHA: undefined,
  fileCount: undefined,
  url: undefined,
  error: 'Update is not a fast forward',
  log: [{ at: '2025-03-01T12:10:00.000Z', step: 'upload', status: 'failed', message: 'Update is not a fast forward' }],
};

describe('DeployHistory', () => {
  beforeEach(() => readHistoryMock.mockReset());

  test('shows an empty state', async () => {
    readHistoryMock.mockResolvedValue([]);
    render(<DeployHistory siteId="s1" />);
    expect(await screen.findByText('Nothing published yet.')).toBeInTheDocument();
  });

  test('lists each publish with its target, commit, file count and finding counts', async () => {
    readHistoryMock.mockResolvedValue([failure, success]);
    render(<DeployHistory siteId="s1" />);

    const items = await screen.findAllByRole('listitem');
    const ok = items.find((item) => within(item).queryByText('0123456'))!;
    expect(within(ok).getByText('Published')).toBeInTheDocument();
    expect(within(ok).getByText('o/r#main')).toBeInTheDocument();
    expect(within(ok).getByText('12 files')).toBeInTheDocument();
    expect(within(ok).getByText('2 warnings')).toBeInTheDocument();
    expect(within(ok).getByRole('link', { name: 'https://github.com/o/r' })).toBeInTheDocument();
  });

  test('a failed publish shows its error and expands to its step log', async () => {
    readHistoryMock.mockResolvedValue([failure]);
    render(<DeployHistory siteId="s1" />);

    expect(await screen.findByText('Failed')).toBeInTheDocument();
    expect(screen.getAllByText('Update is not a fast forward').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByText('Show log'));
    expect(screen.getByText(/upload — failed/)).toBeInTheDocument();
  });
});
