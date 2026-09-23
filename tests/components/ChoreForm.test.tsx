import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ChoreForm } from '@/components/ChoreForm';
import type { Child } from '@/types/domain';

const childOptions: Child[] = [
  { id: 'child-1', name: 'Emma' },
  { id: 'child-2', name: 'Lucas' },
];

async function press(label: string, byRole: 'text' | 'label' = 'text') {
  await act(async () => {
    fireEvent.press(byRole === 'text' ? screen.getByText(label) : screen.getByLabelText(label));
  });
}

async function changeText(label: string, value: string) {
  await act(async () => {
    fireEvent.changeText(screen.getByLabelText(label), value);
  });
}

// Covers master spec section 59: important UI behaviour needs automated
// tests even though visual styling doesn't. The behaviour that matters
// here is that bad input never reaches onSubmit — validation happens
// client-side before anything hits the network. Each interaction gets its
// own act() (rather than batching several in one) — this RNTL version's
// fireEvent already wraps itself in act, so batching produces "overlapping
// act()" warnings even though the tests still pass.
describe('ChoreForm', () => {
  it('rejects an invalid amount without calling onSubmit', async () => {
    const onSubmit = jest.fn();
    await render(
      <ChoreForm childOptions={childOptions} submitLabel="Add chore" onSubmit={onSubmit} />,
    );

    await changeText('Chore name', 'Room tidy');
    await changeText('Amount per completion (€)', 'abc');
    await press('Weekly');
    await press('Saturday', 'label');
    await press('Add chore');

    expect(screen.getByText('Enter a valid amount, up to €1,000.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a once_weekly chore with no day selected', async () => {
    const onSubmit = jest.fn();
    await render(
      <ChoreForm childOptions={childOptions} submitLabel="Add chore" onSubmit={onSubmit} />,
    );

    await changeText('Chore name', 'Room tidy');
    await changeText('Amount per completion (€)', '2.50');
    // 'Weekly' (once_weekly) is already the default; no day picked.
    await press('Add chore');

    expect(screen.getByText('Choose one day.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits correctly parsed values once the form is valid', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await render(
      <ChoreForm childOptions={childOptions} submitLabel="Add chore" onSubmit={onSubmit} />,
    );

    await changeText('Chore name', 'Room tidy');
    await press('Lucas');
    await changeText('Amount per completion (€)', '2.50');
    await press('Saturday', 'label');
    await press('Add chore');

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Room tidy',
      childId: 'child-2',
      amountCents: 250,
      recurrenceType: 'once_weekly',
      scheduleDays: [6],
    });
  });
});
