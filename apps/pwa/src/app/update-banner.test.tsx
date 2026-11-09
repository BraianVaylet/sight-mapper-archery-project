import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from './i18n.js';
import { usePreferences } from './preferences.js';
import { UpdateBanner } from './update-banner.js';

const show = (props: Partial<Parameters<typeof UpdateBanner>[0]> = {}) => {
  const onUpdate = vi.fn();
  const onDismiss = vi.fn();
  render(
    <I18nProvider>
      <UpdateBanner
        needRefresh={false}
        offlineReady={false}
        onUpdate={onUpdate}
        onDismiss={onDismiss}
        {...props}
      />
    </I18nProvider>,
  );
  return { onUpdate, onDismiss };
};

describe('UpdateBanner', () => {
  it('renders nothing while there is nothing to say', () => {
    show();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('offers the new version: the archer picks the moment', async () => {
    const { onUpdate, onDismiss } = show({ needRefresh: true });
    expect(screen.getByText('Hay una versión nueva')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(onUpdate).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Después' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('speaks English when the archer chose it', () => {
    usePreferences.setState({ locale: 'en' });
    show({ needRefresh: true });
    expect(screen.getByText('A new version is available')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument();
  });

  it('tells the archer the app works offline', () => {
    show({ offlineReady: true });
    expect(screen.getByText('Lista para usar sin conexión.')).toBeInTheDocument();
  });
});
