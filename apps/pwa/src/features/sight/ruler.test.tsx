import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SANDBOX_SCALE } from '../sandbox/real-sets.js';
import { Ruler, type RulerMark } from './ruler.js';

const marks: RulerMark[] = [
  { id: 'a', reading: 0.3, measured: true, label: '20 m' },
  { id: 'b', reading: 0.35, measured: false, label: '≈ 21 m' },
  { id: 'c', reading: 3.6, measured: true, label: '60 m' },
];

const show = (list: readonly RulerMark[] = marks) =>
  render(
    <Ruler scale={SANDBOX_SCALE} marks={list} label="Regla" formatValue={(v) => v.toFixed(1)} />,
  );

describe('Ruler', () => {
  it('is one named image: the numbers live in the table beside it', () => {
    show();
    expect(screen.getByRole('img', { name: 'Regla' })).toBeInTheDocument();
  });

  it('labels the whole units of the scale with the given formatter', () => {
    show();
    expect(screen.getByText('0.0')).toBeInTheDocument();
    expect(screen.getByText('10.0')).toBeInTheDocument();
  });

  it('tells measured from estimated by shape, not only by colour', () => {
    const { container } = show();
    const measured = container.querySelectorAll('[data-mark="measured"]');
    const estimated = container.querySelectorAll('[data-mark="estimated"]');
    expect(measured).toHaveLength(2);
    expect(estimated).toHaveLength(1);
    expect(measured[0]?.querySelector('circle')).not.toBeNull();
    expect(estimated[0]?.querySelector('path')).not.toBeNull();
    expect(estimated[0]?.querySelector('line')?.getAttribute('stroke-dasharray')).toBe('3 3');
  });

  it('pushes apart the labels of marks that are too close and keeps a leader to the real spot', () => {
    const { container } = show();
    const labelY = (text: string) => Number(screen.getByText(text).getAttribute('y'));
    expect(Math.abs(labelY('≈ 21 m') - labelY('20 m'))).toBeGreaterThan(15.99);
    expect(container.querySelectorAll('[data-mark="estimated"] line')).toHaveLength(2);
  });

  it('draws no marks for an empty list', () => {
    const { container } = show([]);
    expect(container.querySelectorAll('[data-mark]')).toHaveLength(0);
  });
});
