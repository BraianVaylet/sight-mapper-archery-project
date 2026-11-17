import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SetupCard } from './setup-card.js';
import { TOUCH_TARGET_PX } from '../touch.js';

const card = (overrides: Partial<Parameters<typeof SetupCard>[0]> = {}) => (
  <SetupCard
    title="Caza"
    details={[
      { label: 'Arco', value: 'Hoyt Alpha', note: 'arco archivado' },
      { label: 'Mira', value: 'Ultraview · dual pin', tone: 'mark' },
      { label: 'Flechas', value: 'Hunter 400' },
    ]}
    favorite={{ pressed: false, label: 'Marcar como favorito', onToggle: () => {} }}
    meta="Marcas: 12 · Editado hoy"
    actions={<a href="/s">Abrir</a>}
    {...overrides}
  />
);

describe('SetupCard', () => {
  it('is a region named by the setup, with each piece labelled', () => {
    render(card());
    const region = within(screen.getByRole('region', { name: 'Caza' }));
    expect(region.getByRole('heading', { name: 'Caza', level: 2 })).toBeInTheDocument();
    expect(region.getByText('Mira').nextElementSibling).toHaveTextContent('Ultraview · dual pin');
    expect(region.getByText('Ultraview · dual pin')).toHaveClass('text-mark');
    expect(region.getByText('(arco archivado)')).toBeInTheDocument();
    expect(region.getByText('Marcas: 12 · Editado hoy')).toBeInTheDocument();
    expect(region.getByRole('link', { name: 'Abrir' })).toBeInTheDocument();
  });

  it('toggles the star, says whether it is on, and keeps the 48 px target', async () => {
    const onToggle = vi.fn();
    render(card({ favorite: { pressed: true, label: 'Quitar de favoritos', onToggle } }));
    const star = screen.getByRole('button', { name: 'Quitar de favoritos' });
    expect(star).toHaveAttribute('aria-pressed', 'true');
    expect(star).toHaveStyle({ minHeight: `${TOUCH_TARGET_PX}px` });
    await userEvent.setup().click(star);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows the quick-access badge only on the setup the app opens', () => {
    const { rerender } = render(card());
    expect(screen.queryByText('Acceso rápido')).toBeNull();
    rerender(card({ quickAccessLabel: 'Acceso rápido' }));
    expect(screen.getByText('Acceso rápido')).toBeInTheDocument();
  });
});
