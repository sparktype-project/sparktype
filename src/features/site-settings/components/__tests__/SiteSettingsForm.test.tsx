import { fireEvent, render, screen } from '@testing-library/react';
import SiteSettingsForm from '../SiteSettingsForm';

vi.mock('../SiteAssetsUploader', () => ({ default: () => <div /> }));
// The rjsf shadcn bundle cannot be resolved under vitest and the theme schema form is not under test.
vi.mock('@/core/components/SchemaDrivenForm', () => ({ default: () => <div /> }));

const formData = {
  title: 'Site',
  description: 'Desc',
  author: '',
  baseUrl: '',
  discourageSearchEngines: false,
  logo: undefined,
  favicon: undefined,
};

describe('SiteSettingsForm search engine toggle', () => {
  test('reflects the stored value and writes changes back to the form data', () => {
    const onFormChange = vi.fn();
    render(<SiteSettingsForm siteId="s" formData={formData} onFormChange={onFormChange} />);

    const toggle = screen.getByRole('switch', { name: /discourage search engines/i });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(toggle);
    expect(onFormChange).toHaveBeenCalledWith({ ...formData, discourageSearchEngines: true });
  });
});
