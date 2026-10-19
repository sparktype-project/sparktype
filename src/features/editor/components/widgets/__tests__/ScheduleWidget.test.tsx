import { fireEvent, render, screen } from '@testing-library/react';
import type { WidgetProps } from '@rjsf/utils';
import { parsePublishAt } from '@/core/services/builder/schedule';
import ScheduleWidget from '../ScheduleWidget';

function renderWidget(value: string | undefined, onChange = vi.fn()) {
  const props = {
    id: 'schedule', name: 'publishAt', label: 'Schedule', value, onChange, onBlur: vi.fn(), onFocus: vi.fn(),
    required: false, disabled: false, readonly: false, autofocus: false, options: {}, schema: { type: 'string' },
    registry: {}, rawErrors: [],
  } as unknown as WidgetProps;
  render(<ScheduleWidget {...props} />);
  return onChange;
}

describe('ScheduleWidget', () => {
  test('explains when a scheduled item goes live', () => {
    renderWidget(undefined);
    expect(screen.getByText('Goes live the next time you publish after this time.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clear schedule/i })).not.toBeInTheDocument();
  });

  test('stores the chosen local time as ISO with an offset', () => {
    const onChange = renderWidget(undefined);
    fireEvent.change(screen.getByLabelText('Schedule'), { target: { value: '2026-06-01T09:30' } });
    const stored = onChange.mock.lastCall![0] as string;
    expect(stored).toMatch(/^2026-06-01T09:30:00[+-]\d{2}:\d{2}$/);
    expect(parsePublishAt(stored)).not.toBeNull();
  });

  test('shows a stored value in local time and clears it', () => {
    const onChange = renderWidget('2026-06-01T12:00:00Z');
    const input = screen.getByLabelText('Schedule') as HTMLInputElement;
    expect(new Date(input.value).getTime()).toBe(Date.parse('2026-06-01T12:00:00Z'));
    fireEvent.click(screen.getByRole('button', { name: /clear schedule/i }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  test('flags an invalid stored value, shows an empty input and still offers to clear it', () => {
    const onChange = renderWidget('next tuesday');
    expect((screen.getByLabelText('Schedule') as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('alert')).toHaveTextContent(/next tuesday.*not a valid date/i);
    fireEvent.click(screen.getByRole('button', { name: /clear schedule/i }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
