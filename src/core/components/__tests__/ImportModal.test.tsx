import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImportModal from '../ImportModal';

describe('ImportModal', () => {
  test('renders GitHub mode with branch input and submits branch value', async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <ImportModal
        open
        onOpenChange={vi.fn()}
        mode="github"
        onImport={onImport}
      />
    );

    await user.type(screen.getByLabelText('Repository URL'), 'https://github.com/openai/sparktype');
    await user.type(screen.getByLabelText('Branch (optional)'), 'main');
    await user.click(screen.getByRole('button', { name: 'Import Site' }));

    expect(screen.getByText(/look for the _site folder in the repository/i)).toBeInTheDocument();
    expect(onImport).toHaveBeenCalledWith('https://github.com/openai/sparktype', 'main');
  });

  test('renders URL mode without branch input and submits only the URL', async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <ImportModal
        open
        onOpenChange={vi.fn()}
        mode="url"
        onImport={onImport}
      />
    );

    expect(screen.queryByLabelText('Branch (optional)')).not.toBeInTheDocument();
    expect(screen.getByText(/fetch the bundled _site source files/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Site URL'), 'https://example.com/site/');
    await user.click(screen.getByRole('button', { name: 'Import Site' }));

    expect(onImport).toHaveBeenCalledWith('https://example.com/site/', undefined);
  });
});
