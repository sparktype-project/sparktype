import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ThemeImportReportDialog from '../ThemeImportReportDialog';

describe('ThemeImportReportDialog', () => {
  it('lists every blocking reason and the warnings', () => {
    render(
      <ThemeImportReportDialog
        report={{
          fileName: 'bad.zip',
          errors: ['Path traversal detected: ../evil.hbs', 'Blocked file type: run.sh'],
          warnings: ['File not referenced in manifest: notes.md'],
        }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Theme import blocked')).toBeInTheDocument();
    expect(screen.getByText('Path traversal detected: ../evil.hbs')).toBeInTheDocument();
    expect(screen.getByText('Blocked file type: run.sh')).toBeInTheDocument();
    expect(screen.getByText('File not referenced in manifest: notes.md')).toBeInTheDocument();
  });

  it('presents warnings alone as a successful import and closes on request', async () => {
    const onClose = vi.fn();
    render(<ThemeImportReportDialog report={{ fileName: 'ok.zip', errors: [], warnings: ['Heads up'] }} onClose={onClose} />);

    expect(screen.getByText('Theme imported with warnings')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when there is no report', () => {
    render(<ThemeImportReportDialog report={null} onClose={vi.fn()} />);
    expect(screen.queryByTestId('theme-import-report')).not.toBeInTheDocument();
  });
});
