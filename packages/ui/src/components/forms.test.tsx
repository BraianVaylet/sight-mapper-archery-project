import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './button.js';
import { Field, NumberField, PasswordField, Select } from './fields.js';
import { Segmented } from './segmented.js';

describe('Button', () => {
  it('is a plain button by default, so a form never submits by accident', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
  });

  it('can still submit when asked', () => {
    render(<Button type="submit">Send</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('calls onClick, and does not when disabled', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<Button onClick={onClick}>Go</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(
      <Button onClick={onClick} disabled>
        Go
      </Button>,
    );
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it.each(['primary', 'secondary', 'link'] as const)(
    'the %s variant keeps the 44 px target',
    (variant) => {
      render(<Button variant={variant}>x</Button>);
      expect(screen.getByRole('button')).toHaveStyle({ minHeight: '44px', minWidth: '44px' });
    },
  );

  it('lets the caller add to the style without losing the target size', () => {
    render(<Button style={{ color: 'red' }}>x</Button>);
    expect(screen.getByRole('button')).toHaveStyle({ minHeight: '44px', color: 'rgb(255, 0, 0)' });
  });
});

describe('Field', () => {
  it('ties the label to the input', async () => {
    render(<Field label="Nickname" />);
    await userEvent.setup().type(screen.getByLabelText('Nickname'), 'Archie');
    expect(screen.getByLabelText('Nickname')).toHaveValue('Archie');
  });

  it('describes the input with its hint and its error', () => {
    render(<Field label="Brace height" hint="Between 100 and 260 mm" error="Too high" />);
    const input = screen.getByLabelText('Brace height');
    expect(input).toHaveAccessibleDescription('Between 100 and 260 mm Too high');
    expect(input).toBeInvalid();
    expect(screen.getByRole('alert')).toHaveTextContent('Too high');
  });

  it('is valid and has no description without hint or error', () => {
    render(<Field label="Rest" />);
    const input = screen.getByLabelText('Rest');
    expect(input).toBeValid();
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a unit suffix', () => {
    render(<Field label="Draw weight" suffix="lb" />);
    expect(screen.getByText('lb')).toBeVisible();
  });

  it('keeps an id given by the caller', () => {
    render(<Field label="X" id="custom-id" />);
    expect(screen.getByLabelText('X')).toHaveAttribute('id', 'custom-id');
  });

  it('keeps the 44 px target', () => {
    render(<Field label="X" />);
    expect(screen.getByLabelText('X')).toHaveStyle({ minHeight: '44px' });
  });
});

describe('NumberField', () => {
  it('asks for the numeric keypad but stays a text input', () => {
    render(<NumberField label="Length" />);
    const input = screen.getByLabelText('Length');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputmode', 'decimal');
    expect(input).toHaveAttribute('autocomplete', 'off');
  });

  it('accepts a decimal comma and an imperial fraction as typed', async () => {
    render(<NumberField label="Length" unit="in" />);
    const input = screen.getByLabelText('Length');
    const user = userEvent.setup();
    await user.type(input, '6,25');
    expect(input).toHaveValue('6,25');
    await user.clear(input);
    await user.type(input, '6 1/4');
    expect(input).toHaveValue('6 1/4');
    expect(screen.getByText('in')).toBeVisible();
  });
});

describe('PasswordField', () => {
  it('hides the password until asked, and says whether it is shown', async () => {
    render(<PasswordField label="Password" showLabel="Show" hideLabel="Hide" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Show' }));
    expect(input).toHaveAttribute('type', 'text');
    const hide = screen.getByRole('button', { name: 'Hide' });
    expect(hide).toHaveAttribute('aria-pressed', 'true');
    await user.click(hide);
    expect(input).toHaveAttribute('type', 'password');
  });

  it('shows its error', () => {
    render(<PasswordField label="Password" showLabel="Show" hideLabel="Hide" error="Too short" />);
    expect(screen.getByLabelText('Password')).toBeInvalid();
    expect(screen.getByRole('alert')).toHaveTextContent('Too short');
  });

  it('keeps both targets at 44 px', () => {
    render(<PasswordField label="Password" showLabel="Show" hideLabel="Hide" />);
    expect(screen.getByLabelText('Password')).toHaveStyle({ minHeight: '44px' });
    expect(screen.getByRole('button')).toHaveStyle({ minHeight: '44px' });
  });
});

describe('Select', () => {
  const options = [
    { value: 'a', label: 'Easton X10' },
    { value: 'b', label: 'Gold Tip', disabled: true },
  ];

  it('lists the options and reports the choice', async () => {
    const onChange = vi.fn();
    render(
      <Select
        label="Arrow set"
        options={options}
        defaultValue=""
        placeholder="Choose"
        onChange={onChange}
      />,
    );
    const select = screen.getByLabelText('Arrow set');
    expect(screen.getByRole('option', { name: 'Choose' })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Gold Tip' })).toBeDisabled();
    await userEvent.setup().selectOptions(select, 'a');
    expect(select).toHaveValue('a');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('has no placeholder option unless asked, and shows an error', () => {
    render(<Select label="Arrow set" options={options} error="Pick one" />);
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(screen.getByLabelText('Arrow set')).toBeInvalid();
    expect(screen.getByRole('alert')).toHaveTextContent('Pick one');
  });

  it('keeps the 44 px target', () => {
    render(<Select label="Arrow set" options={options} />);
    expect(screen.getByLabelText('Arrow set')).toHaveStyle({ minHeight: '44px' });
  });
});

describe('Segmented', () => {
  type Cam = 'single' | 'hybrid' | 'binary';
  const options = [
    { value: 'single' as const, label: 'Single' },
    { value: 'hybrid' as const, label: 'Hybrid', disabled: true },
    { value: 'binary' as const, label: 'Binary' },
  ];

  function Harness({ initial = 'single' as Cam, error }: { initial?: Cam; error?: string }) {
    const [value, setValue] = useState<Cam>(initial);
    return (
      <Segmented
        label="Cam type"
        options={options}
        value={value}
        onChange={setValue}
        error={error}
      />
    );
  }

  it('is a radio group with one selected option', () => {
    render(<Harness />);
    expect(screen.getByRole('radiogroup', { name: 'Cam type' })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Single' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Binary' })).not.toBeChecked();
  });

  it('selects on click', async () => {
    render(<Harness />);
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Binary' }));
    expect(screen.getByRole('radio', { name: 'Binary' })).toBeChecked();
  });

  it('has a single tab stop: the selected option', () => {
    render(<Harness />);
    expect(screen.getByRole('radio', { name: 'Single' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Binary' })).toHaveAttribute('tabindex', '-1');
  });

  it('moves with the arrow keys, skips disabled options and wraps around', async () => {
    render(<Harness />);
    const user = userEvent.setup();
    screen.getByRole('radio', { name: 'Single' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Binary' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Binary' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'Single' })).toBeChecked();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Binary' })).toBeChecked();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('radio', { name: 'Single' })).toBeChecked();
  });

  it('ignores other keys', async () => {
    render(<Harness />);
    screen.getByRole('radio', { name: 'Single' }).focus();
    await userEvent.setup().keyboard('a');
    expect(screen.getByRole('radio', { name: 'Single' })).toBeChecked();
  });

  it('marks the selection with a shape as well as a colour', () => {
    render(<Harness />);
    expect(screen.getByRole('radio', { name: 'Single' }).querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('radio', { name: 'Binary' }).querySelector('svg')).toBeNull();
  });

  it('keeps every option at 44 px and shows an error', () => {
    render(<Harness error="Required" />);
    for (const radio of screen.getAllByRole('radio'))
      expect(radio).toHaveStyle({ minHeight: '44px' });
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });
});
