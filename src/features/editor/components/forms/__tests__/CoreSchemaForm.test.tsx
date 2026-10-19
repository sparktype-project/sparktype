import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { MarkdownFrontmatter } from '@/core/types';
import type { WidgetProps } from '@rjsf/utils';
import { editorWidgets } from '@/features/editor/components/widgets';
import CoreSchemaForm from '../CoreSchemaForm';

// @rjsf/shadcn cannot be loaded under vitest (its lodash imports lack extensions), so the form
// shell is replaced by one that renders the widget the real schema assigns to `publishAt`. The
// Playwright journey covers the genuine RJSF path.
vi.mock('@/core/components/SchemaDrivenForm', () => ({
  default: ({ schema, uiSchema, formData, widgets, onFormChange }: {
    schema: { properties: Record<string, unknown> };
    uiSchema: Record<string, { 'ui:widget'?: string }>;
    formData: Record<string, unknown>;
    widgets: Record<string, React.ComponentType<WidgetProps>>;
    onFormChange: (data: object) => void;
  }) => {
    expect(schema.properties.publishAt).toBeDefined();
    const Widget = { ...editorWidgets, ...widgets }[uiSchema.publishAt['ui:widget']!];
    const props = {
      id: 'root_publishAt', value: formData.publishAt, schema: { type: 'string' }, options: {},
      onChange: (value: unknown) => onFormChange({ ...formData, publishAt: value }),
    } as unknown as WidgetProps;
    return <Widget {...props} />;
  },
}));

function Harness({ initial, onChange }: { initial: MarkdownFrontmatter; onChange: (fm: MarkdownFrontmatter) => void }) {
  const [frontmatter, setFrontmatter] = useState(initial);
  return (
    <CoreSchemaForm
      siteId="site"
      frontmatter={frontmatter}
      onFrontmatterChange={(update) => {
        const next = { ...frontmatter, ...update };
        setFrontmatter(next);
        onChange(next);
      }}
    />
  );
}

const base: MarkdownFrontmatter = { title: 'Page', layout: 'page' };

describe('CoreSchemaForm schedule control', () => {
  test('sets publishAt from the date-time control and clears it again', () => {
    const onChange = vi.fn();
    render(<Harness initial={base} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Schedule'), { target: { value: '2026-06-01T09:30' } });
    expect((onChange.mock.lastCall![0] as MarkdownFrontmatter).publishAt).toMatch(/^2026-06-01T09:30:00[+-]\d{2}:\d{2}$/);

    fireEvent.click(screen.getByRole('button', { name: /clear schedule/i }));
    expect((onChange.mock.lastCall![0] as MarkdownFrontmatter).publishAt).toBeUndefined();
    expect(screen.queryByRole('button', { name: /clear schedule/i })).not.toBeInTheDocument();
  });

  test('warns about an invalid stored value instead of hiding it', () => {
    render(<Harness initial={{ ...base, publishAt: 'whenever' }} onChange={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/whenever/);
  });
});
