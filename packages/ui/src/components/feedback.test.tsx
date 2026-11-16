import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EmptyState,
  ErrorState,
  InfoAlert,
  Skeleton,
  StatusBadge,
  Toast,
  TOAST_DURATION_MS,
  UpdatePrompt,
} from './feedback.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('Toast', () => {
  const base = { message: 'Mark saved', dismissLabel: 'Dismiss' };

  it('is a polite live region that announces the message', () => {
    render(<Toast {...base} onDismiss={() => undefined} />);
    expect(screen.getByRole('status')).toHaveTextContent('Mark saved');
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('runs the undo action and then goes away', async () => {
    const onAction = vi.fn();
    const onDismiss = vi.fn();
    render(<Toast {...base} actionLabel="Undo" onAction={onAction} onDismiss={onDismiss} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Undo' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('has no action button without both a label and a handler', () => {
    const { rerender } = render(<Toast {...base} actionLabel="Undo" onDismiss={() => undefined} />);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    rerender(<Toast {...base} onAction={() => undefined} onDismiss={() => undefined} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('can be dismissed by hand', async () => {
    const onDismiss = vi.fn();
    render(<Toast {...base} onDismiss={onDismiss} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses itself after 8 seconds, not before', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Toast {...base} onDismiss={onDismiss} />);
    expect(TOAST_DURATION_MS).toBe(8000);
    act(() => void vi.advanceTimersByTime(7999));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('honours a custom duration and stops its timer when unmounted', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const { unmount } = render(<Toast {...base} durationMs={1000} onDismiss={onDismiss} />);
    unmount();
    act(() => void vi.advanceTimersByTime(5000));
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe('InfoAlert', () => {
  it.each([
    ['info', 'status'],
    ['warning', 'status'],
    ['danger', 'alert'],
  ] as const)('%s uses the %s role', (variant, role) => {
    render(<InfoAlert variant={variant}>Calculation needs at least 2 marks</InfoAlert>);
    expect(screen.getByRole(role)).toHaveTextContent('Calculation needs at least 2 marks');
  });

  it('defaults to info and draws a different icon per variant', () => {
    const shapes = (['info', 'warning', 'danger'] as const).map((variant) => {
      const { container, unmount } = render(<InfoAlert variant={variant}>x</InfoAlert>);
      const shape = container.querySelector('path')?.getAttribute('d');
      unmount();
      return shape;
    });
    expect(new Set(shapes).size).toBe(3);
    render(<InfoAlert>x</InfoAlert>);
    expect(screen.getByRole('status')).toBeVisible();
  });
});

describe('StatusBadge', () => {
  it('shows its label with a decorative shape', () => {
    render(<StatusBadge kind="registered">Registered</StatusBadge>);
    const badge = screen.getByText('Registered');
    expect(badge).toBeVisible();
    expect(badge.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('draws a different shape for each kind: never colour alone (UX-UI §1.3)', () => {
    const kinds = ['registered', 'calculated', 'suspect', 'inconsistent'] as const;
    const drawn = kinds.map((kind) => {
      const { container, unmount } = render(<StatusBadge kind={kind}>{kind}</StatusBadge>);
      const svg = container.querySelector('svg');
      const markup = svg?.innerHTML ?? '';
      unmount();
      return markup;
    });
    expect(new Set(drawn).size).toBe(4);
  });
});

describe('EmptyState', () => {
  it('says what is empty and offers the next step', async () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="No setups yet"
        description="Create your first setup"
        action={
          <button type="button" onClick={onClick}>
            Create
          </button>
        }
      />,
    );
    expect(screen.getByRole('heading', { name: 'No setups yet' })).toBeVisible();
    expect(screen.getByText('Create your first setup')).toBeVisible();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Create' }));
    expect(onClick).toHaveBeenCalled();
  });

  it('works with only a title', () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByRole('heading')).toBeVisible();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('ErrorState', () => {
  it('is an alert with a retry and the request id to quote', async () => {
    const onRetry = vi.fn();
    render(
      <ErrorState
        title="Something went wrong"
        description="Try again"
        retryLabel="Retry"
        onRetry={onRetry}
        requestId="019a3c5e-0000-7000-8000-000000000000"
        requestIdLabel="Request id:"
      />,
    );
    expect(screen.getByRole('alert')).toBeVisible();
    expect(screen.getByText('019a3c5e-0000-7000-8000-000000000000')).toBeVisible();
    expect(screen.getByText(/Request id:/)).toBeVisible();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the request id without a label, and nothing without an id', () => {
    const { rerender } = render(
      <ErrorState title="Oops" retryLabel="Retry" onRetry={() => undefined} requestId="abc-123" />,
    );
    expect(screen.getByText('abc-123')).toBeVisible();
    rerender(<ErrorState title="Oops" retryLabel="Retry" onRetry={() => undefined} />);
    expect(screen.queryByText('abc-123')).toBeNull();
  });
});

describe('Skeleton', () => {
  it('is decorative and takes a size', () => {
    const { container } = render(<Skeleton className="h-10 w-20" />);
    const block = container.firstElementChild;
    expect(block).toHaveAttribute('aria-hidden', 'true');
    expect(block).toHaveClass('h-10', 'w-20');
  });

  it('has a default size', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstElementChild).toHaveClass('h-6', 'w-full');
  });
});

describe('UpdatePrompt', () => {
  it('offers to update or to wait', () => {
    const onUpdate = vi.fn();
    const onDismiss = vi.fn();
    render(
      <UpdatePrompt
        message="A new version is available"
        actionLabel="Update"
        onUpdate={onUpdate}
        dismissLabel="Later"
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('A new version is available');
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('every interactive primitive keeps the 44 px target', () => {
  it('buttons in feedback components', () => {
    render(
      <>
        <Toast
          message="m"
          actionLabel="Undo"
          onAction={() => undefined}
          dismissLabel="x"
          onDismiss={() => undefined}
        />
        <ErrorState title="t" retryLabel="Retry" onRetry={() => undefined} />
        <UpdatePrompt
          message="m"
          actionLabel="Update"
          onUpdate={() => undefined}
          dismissLabel="Later"
          onDismiss={() => undefined}
        />
      </>,
    );
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveStyle({ minHeight: '44px', minWidth: '44px' });
    }
  });
});
