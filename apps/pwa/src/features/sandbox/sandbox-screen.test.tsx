import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../../app/i18n.js';
import { usePreferences } from '../../app/preferences.js';
import { SandboxScreen } from './sandbox-screen.js';

const show = () =>
  render(
    <I18nProvider>
      <SandboxScreen />
    </I18nProvider>,
  );

describe('SandboxScreen', () => {
  it('shows the ruler, a row per distance and the Doctor verdict', () => {
    show();
    expect(screen.getByRole('img', { name: /Regla de la mira/ })).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(14);
    expect(within(table).getByRole('row', { name: /^20 m/ })).toHaveTextContent('0,3');
    expect(screen.getByText('Coherente')).toBeInTheDocument();
  });

  it('writes numbers with the decimal separator of the language', async () => {
    usePreferences.setState({ locale: 'en' });
    show();
    expect(within(screen.getByRole('table')).getByRole('row', { name: /^20 m/ })).toHaveTextContent(
      '0.3',
    );
  });

  it('switches to the doubtful set', async () => {
    show();
    await userEvent.click(screen.getByRole('radio', { name: 'Pierce 400 (dudoso)' }));
    expect(within(screen.getByRole('table')).getByRole('row', { name: /^20 m/ })).toHaveTextContent(
      '0,4',
    );
  });

  it('shows the password field in the catalogue and lets it be revealed', async () => {
    show();
    const password = screen.getByLabelText('Contraseña');
    expect(password).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar' }));
    expect(password).toHaveAttribute('type', 'text');
  });

  it('opens and closes the overlays of the catalogue', async () => {
    show();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir hoja' }));
    expect(screen.getByRole('dialog', { name: 'Nueva marca' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
    expect(screen.getByRole('dialog', { name: 'Menú' })).toBeInTheDocument();
  });
});
