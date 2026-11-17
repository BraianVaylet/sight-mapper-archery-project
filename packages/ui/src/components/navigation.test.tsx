import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ICON_NAMES, Icon } from './icon.js';
import { LanguageSwitch } from './language-switch.js';
import { TOUCH_TARGET_PX } from '../touch.js';

const LANGUAGES = [
  { value: 'es', code: 'ES', name: 'Español' },
  { value: 'en', code: 'EN', name: 'English' },
] as const;

describe('LanguageSwitch', () => {
  it('names each option by its language, in that language, and says which one is on', () => {
    render(<LanguageSwitch label="Idioma" options={LANGUAGES} value="es" onChange={() => {}} />);
    const group = screen.getByRole('group', { name: 'Idioma' });
    expect(group).toBeInTheDocument();
    const english = screen.getByRole('button', { name: /English/ });
    expect(english).toHaveAttribute('lang', 'en');
    expect(english).toHaveAttribute('aria-pressed', 'false');
    expect(english).toHaveAccessibleName('EN English');
    expect(screen.getByRole('button', { name: /Español/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('asks for the language the archer taps', async () => {
    const onChange = vi.fn();
    render(<LanguageSwitch label="Idioma" options={LANGUAGES} value="es" onChange={onChange} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /English/ }));
    expect(onChange).toHaveBeenCalledWith('en');
  });

  it('keeps the 48 px target with gloves', () => {
    render(<LanguageSwitch label="Idioma" options={LANGUAGES} value="es" onChange={() => {}} />);
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveStyle({ minHeight: `${TOUCH_TARGET_PX}px` });
    }
  });
});

describe('Icon', () => {
  it.each(ICON_NAMES)('%s is decorative and drawn with the current colour', (name) => {
    const { container } = render(<Icon name={name} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
    expect(svg?.childElementCount).toBeGreaterThan(0);
  });

  it('shrinks to 16 px for badges', () => {
    const { container } = render(<Icon name="pin" size={16} />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '16');
  });
});
