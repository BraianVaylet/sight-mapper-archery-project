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

describe('Ruler, horizontal (windage, F1-42)', () => {
  const windage = {
    unit: 'mm',
    unitSizeMm: null,
    min: -10,
    max: 10,
    resolution: 0.5,
    direction: 'down',
  } as const;
  const one: RulerMark[] = [{ id: 'w', reading: -10, measured: true, label: '20 m' }];
  const draw = (direction: 'down' | 'up', onSelect?: (id: string) => void) =>
    render(
      <Ruler
        orientation="horizontal"
        scale={{ ...windage, direction }}
        marks={one}
        label="Deriva"
        formatValue={(v) => v.toFixed(0)}
        lengthPx={300}
        onSelect={onSelect}
      />,
    );
  /** The guide line of a mark, in the frame of the axis (the padding is a transform): both ends share x. */
  const guideX = (container: HTMLElement) => {
    const line = container.querySelector('[data-mark="measured"] line');
    expect(line?.getAttribute('x1')).toBe(line?.getAttribute('x2'));
    return Number(line?.getAttribute('x1'));
  };

  it('is one named image, wider than tall', () => {
    const { container } = draw('down');
    expect(screen.getByRole('img', { name: 'Deriva' })).toBeInTheDocument();
    const svg = container.querySelector('svg');
    expect(Number(svg?.getAttribute('width'))).toBeGreaterThan(Number(svg?.getAttribute('height')));
  });

  it('puts the minimum at the left end when the numbers grow right', () => {
    const { container } = draw('down');
    expect(guideX(container)).toBe(0);
  });

  it('puts the minimum at the right end when the numbers grow left', () => {
    const { container } = draw('up');
    expect(guideX(container)).toBe(300);
  });

  it('joins a label pushed aside to its real spot, so equal windages are not misread', () => {
    const { container } = render(
      <Ruler
        orientation="horizontal"
        scale={windage}
        marks={[
          { id: 'a', reading: 2.5, measured: true, label: '18 m' },
          { id: 'b', reading: 2.5, measured: true, label: '30 m' },
        ]}
        label="Deriva"
        formatValue={(v) => v.toFixed(0)}
        lengthPx={300}
      />,
    );
    const lines = [...container.querySelectorAll('[data-mark="measured"]')].map(
      (g) => g.querySelectorAll('line').length,
    );
    // One guide line each, plus a leader on the label that had to move.
    expect(lines.reduce((sum, n) => sum + n, 0)).toBe(3);
  });

  it('picks a mark when it is tapped', () => {
    const picked: string[] = [];
    const { container } = draw('down', (id) => picked.push(id));
    container
      .querySelector<SVGGElement>('[data-mark="measured"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(picked).toEqual(['w']);
  });
});
