import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vitest';
import { resetIndexedDbForTests } from '@/test/support/storage';
import { recordBackup } from '@/core/services/backup/backupTracking.service';
import LastBackedUp from '../LastBackedUp';

const NOW = new Date(2026, 5, 10, 12, 0).getTime();

describe('LastBackedUp', () => {
  beforeEach(async () => {
    await resetIndexedDbForTests();
  });

  test('says a site was never backed up', async () => {
    render(<LastBackedUp siteId="a" now={() => NOW} />);
    expect(await screen.findByText('Never backed up')).toBeInTheDocument();
  });

  test('describes the last backup relative to the injected clock, per site', async () => {
    await recordBackup('a', new Date(2026, 5, 5, 9, 0));
    render(
      <>
        <LastBackedUp siteId="a" now={() => NOW} />
        <LastBackedUp siteId="b" now={() => NOW} />
      </>,
    );
    expect(await screen.findByText('Last backed up 5 days ago')).toBeInTheDocument();
    expect(await screen.findByText('Never backed up')).toBeInTheDocument();
  });

  test('updates as soon as a backup is recorded', async () => {
    render(<LastBackedUp siteId="a" now={() => NOW} />);
    expect(await screen.findByText('Never backed up')).toBeInTheDocument();

    await act(async () => {
      await recordBackup('a', new Date(NOW));
    });

    expect(await screen.findByText('Last backed up today')).toBeInTheDocument();
  });
});
