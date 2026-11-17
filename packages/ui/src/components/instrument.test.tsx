import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActionBar, ActionToolUnavailable, ReadingHud } from './instrument.js';

describe('ReadingHud', () => {
  it('shows the distance and the reading in a polite live region', () => {
    render(
      <ReadingHud
        distance={{ label: 'Distancia', value: '50', unit: 'm' }}
        reading={{ label: 'Lectura a 50 m', value: '4,5', tone: 'measured' }}
      />,
    );
    const hud = screen.getByText('Lectura a 50 m').closest('[aria-live]');
    expect(hud).toHaveAttribute('aria-live', 'polite');
    expect(hud).toHaveTextContent('Distancia50m');
    expect(screen.getByText('4,5')).toHaveClass('text-mark', 'sm-glow');
  });

  it('draws an estimate in the calculated ink, never as measured', () => {
    render(
      <ReadingHud
        distance={{ label: 'Distancia', value: '35', unit: 'm' }}
        reading={{ label: 'Lectura a 35 m', value: '≈ 2,75', tone: 'estimated' }}
      />,
    );
    const value = screen.getByText('≈ 2,75');
    expect(value).toHaveClass('text-info');
    expect(value).not.toHaveClass('sm-glow');
  });

  it('asks to pick a distance when there is none', () => {
    render(
      <ReadingHud
        placeholder="Elegí una distancia en la tabla."
        distance={{ label: 'Distancia', value: '' }}
        reading={{ label: 'Lectura', value: '' }}
      />,
    );
    expect(screen.getByText('Elegí una distancia en la tabla.')).toBeInTheDocument();
    expect(screen.queryByText('Distancia')).toBeNull();
  });
});

describe('ActionBar', () => {
  it('groups the tools, holds the primary action and hides the strip from assistive technology', () => {
    render(
      <ActionBar
        toolsLabel="Herramientas"
        tools={<ActionToolUnavailable icon={null} label="Doctor" badge="3/5" />}
        primary={<button type="button">+ Agregar marca</button>}
        strip={{ left: 'Setup · Mira', right: '50 m · 4,5' }}
      />,
    );
    const tools = within(screen.getByRole('group', { name: 'Herramientas' }));
    const doctor = tools.getByRole('button', { name: /Doctor/ });
    expect(doctor).toHaveAttribute('aria-disabled', 'true');
    expect(doctor).toHaveTextContent('3/5');
    expect(screen.getByRole('button', { name: '+ Agregar marca' })).toBeInTheDocument();
    expect(screen.getByText('50 m · 4,5').closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
