import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AppHeader, SectionCard } from './layout.js';
import { BottomSheet, NavDrawer, NavItem } from './overlays.js';

function DrawerHarness({ sheet = false }: { sheet?: boolean }) {
  const [open, setOpen] = useState(false);
  const Overlay = sheet ? BottomSheet : NavDrawer;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Overlay open={open} onClose={() => setOpen(false)} title="Menu" closeLabel="Close">
        <button type="button">First</button>
        <button type="button">Last</button>
      </Overlay>
    </>
  );
}

describe.each([
  ['NavDrawer', false],
  ['BottomSheet', true],
] as const)('%s', (_name, sheet) => {
  it('renders nothing while closed', () => {
    render(<DrawerHarness sheet={sheet} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens as a named modal dialog and moves focus inside', async () => {
    render(<DrawerHarness sheet={sheet} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Open' }));
    const dialog = screen.getByRole('dialog', { name: 'Menu' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('closes on Escape and returns focus to what opened it', async () => {
    render(<DrawerHarness sheet={sheet} />);
    const user = userEvent.setup();
    const opener = screen.getByRole('button', { name: 'Open' });
    await user.click(opener);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('closes on its close button and on the scrim', async () => {
    render(<DrawerHarness sheet={sheet} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const closers = screen.getAllByRole('button', { name: 'Close', hidden: true });
    expect(closers).toHaveLength(2);
    await user.click(closers[1] as HTMLElement);
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(
      screen.getAllByRole('button', { name: 'Close', hidden: true })[0] as HTMLElement,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('traps Tab and Shift+Tab inside the dialog', async () => {
    render(<DrawerHarness sheet={sheet} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = screen.getByRole('dialog');
    const inside = () => dialog.contains(document.activeElement);

    for (let i = 0; i < 6; i++) {
      await user.tab();
      expect(inside()).toBe(true);
    }
    for (let i = 0; i < 6; i++) {
      await user.tab({ shift: true });
      expect(inside()).toBe(true);
    }
  });
});

describe('NavItem', () => {
  it('shows its count and calls onSelect', async () => {
    const onSelect = vi.fn();
    render(<NavItem label="Bows" count={3} onSelect={onSelect} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /Bows/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.getByText('3')).toBeVisible();
  });

  it('shows a zero count', () => {
    render(<NavItem label="Sights" count={0} />);
    expect(screen.getByText('0')).toBeVisible();
  });

  it('a badged item is announced as disabled and never navigates (RF-X-07)', async () => {
    const onSelect = vi.fn();
    render(<NavItem label="Statistics" badge="Coming soon" onSelect={onSelect} count={9} />);
    const item = screen.getByRole('button', { name: /Statistics/ });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Coming soon')).toBeVisible();
    expect(screen.queryByText('9')).toBeNull();
    await userEvent.setup().click(item);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('marks the current page and keeps the 44 px target', () => {
    render(<NavItem label="Home" current />);
    const item = screen.getByRole('button', { name: 'Home' });
    expect(item).toHaveAttribute('aria-current', 'page');
    expect(item).toHaveStyle({ minHeight: '44px' });
  });
});

describe('SectionCard', () => {
  it('is a labelled region with a heading and a counter', () => {
    render(
      <SectionCard title="Bow identity" count={2}>
        <p>fields</p>
      </SectionCard>,
    );
    expect(screen.getByRole('region', { name: 'Bow identity' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'Bow identity' })).toBeVisible();
    expect(screen.getByText('2')).toBeVisible();
  });

  it('shows a zero counter, takes another heading level and has no counter by default', () => {
    const { rerender } = render(
      <SectionCard title="Extra" count={0} as="h3">
        x
      </SectionCard>,
    );
    expect(screen.getByRole('heading', { level: 3 })).toBeVisible();
    expect(screen.getByText('0')).toBeVisible();
    rerender(<SectionCard title="Extra">x</SectionCard>);
    expect(screen.queryByText('0')).toBeNull();
  });
});

describe('AppHeader', () => {
  it('shows title, subtitle, logo and actions', () => {
    render(
      <AppHeader
        title="Sight Mapper"
        subtitle="Your setups"
        logo={<svg data-testid="logo" />}
        actions={<button type="button">Menu</button>}
      />,
    );
    expect(screen.getByRole('banner')).toBeVisible();
    expect(screen.getByText('Sight Mapper')).toBeVisible();
    expect(screen.getByText('Your setups')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Menu' })).toBeVisible();
    expect(screen.getByTestId('logo').parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('works with only a title', () => {
    render(<AppHeader title="Home" />);
    expect(screen.getByText('Home')).toBeVisible();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
