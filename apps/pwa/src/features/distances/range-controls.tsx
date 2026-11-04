import { parseDecimal } from '@sight-mapper/domain';
import type { Mark } from '@sight-mapper/schemas';
import { NumberField, Segmented } from '@sight-mapper/ui';
import type { UnitSystem } from '@sight-mapper/types';
import { useState } from 'react';
import { useI18n } from '../../app/i18n.js';
import {
  DEFAULT_STEP,
  defaultRange,
  isStep,
  STEPS,
  type Range,
  type Step,
} from './distances.logic.js';

type RangeArgs = {
  marks: readonly Mark[];
  system: UnitSystem;
  /** From the URL: what is there, or nothing. */
  step: number | undefined;
  from: number | undefined;
  to: number | undefined;
  /** Writes a change of the view to the URL. */
  go: (search: Record<string, unknown>) => void;
};

/**
 * The range and step of a table of distances: the URL, with what the marks suggest where it says
 * nothing. What the archer types is used at once and goes to the URL when they leave the field; a
 * value that is not a number is dropped there, and shown as an error by the grid meanwhile.
 */
export function useRange({ marks, system, step: stepParam, from, to, go }: RangeArgs) {
  const step: Step = stepParam !== undefined && isStep(stepParam) ? stepParam : DEFAULT_STEP;
  const base = defaultRange(marks, system, step);
  const [typed, setTyped] = useState<{ from?: string; to?: string }>({});

  const valueOf = (name: 'from' | 'to'): number => {
    const text = typed[name];
    if (text !== undefined) return parseDecimal(text) ?? Number.NaN;
    return (name === 'from' ? from : to) ?? base[name];
  };
  const range: Range = { from: valueOf('from'), to: valueOf('to'), step };

  /** The typed value becomes the URL's once the archer leaves the field; a bad one is dropped. */
  const commit = (name: 'from' | 'to') => {
    const parsed = typed[name] === undefined ? undefined : parseDecimal(typed[name]);
    setTyped((current) => ({ ...current, [name]: undefined }));
    if (parsed !== undefined && parsed !== null && parsed > 0) go({ [name]: parsed });
  };

  return { range, typed, setTyped, commit, go };
}

export type RangeState = ReturnType<typeof useRange>;

/** Desde, hasta and the step, in the archer's unit (UX-UI §4.3). */
export function RangeFields({ state, unit }: { state: RangeState; unit: string }) {
  const { t } = useI18n();
  const { range, typed, setTyped, commit, go } = state;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label={t('distances.from')}
          unit={unit}
          value={typed.from ?? String(range.from)}
          onChange={(event) => setTyped((c) => ({ ...c, from: event.target.value }))}
          onBlur={() => commit('from')}
        />
        <NumberField
          label={t('distances.to')}
          unit={unit}
          value={typed.to ?? String(range.to)}
          onChange={(event) => setTyped((c) => ({ ...c, to: event.target.value }))}
          onBlur={() => commit('to')}
        />
      </div>
      <Segmented
        label={`${t('distances.step')} (${unit})`}
        options={STEPS.map((s) => ({ value: String(s), label: String(s) }))}
        value={String(range.step)}
        onChange={(value) => go({ step: Number(value) })}
      />
    </>
  );
}
