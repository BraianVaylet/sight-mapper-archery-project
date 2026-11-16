import { ERROR_CATALOG } from '@sight-mapper/types';
import { decimalSeparator, formatNumber } from '@sight-mapper/i18n';
import { formatReading } from '@sight-mapper/domain';
import { SectionCard, Segmented, StatusBadge } from '@sight-mapper/ui';
import { useMemo, useState } from 'react';
import { useI18n } from '../../app/i18n.js';
import { Ruler, type RulerMark } from '../sight/ruler.js';
import { Catalog } from './catalog.js';
import { SANDBOX_SCALE, SANDBOX_SETS, type SandboxSet } from './real-sets.js';
import { analyse, type DisplayRow } from './sandbox.logic.js';

const BADGE = {
  ok: 'registered',
  suspect: 'suspect',
  inconsistent: 'inconsistent',
  insufficient: 'calculated',
} as const;

/** The author's two real sets through the domain, drawn, plus the catalogue of components. */
export function SandboxScreen() {
  const { t, locale, translate } = useI18n();
  const [setId, setSetId] = useState<SandboxSet['id']>('good');
  const set = SANDBOX_SETS.find((candidate) => candidate.id === setId) ?? SANDBOX_SETS[0];
  const analysis = useMemo(() => (set === undefined ? undefined : analyse(set)), [set]);
  if (set === undefined || analysis === undefined) return null;

  const separator = decimalSeparator(locale);
  const reading = (value: number) => formatReading(value, SANDBOX_SCALE, separator);
  const meters = (value: number) =>
    t('sandbox.table.meters', { value: formatNumber(value, locale, 0) });
  const mm = (value: number) => formatNumber(value, locale, 1);

  const marks: RulerMark[] = analysis.rows.flatMap((row) =>
    row.ok
      ? [
          {
            id: String(row.distanceM),
            reading: row.reading,
            measured: row.kind === 'measured',
            label: row.kind === 'measured' ? meters(row.distanceM) : `≈ ${meters(row.distanceM)}`,
          },
        ]
      : [],
  );

  const kindOf = (row: DisplayRow) =>
    row.ok && row.kind === 'measured' ? t('sandbox.table.measured') : t('sandbox.table.estimated');

  const { doctor } = analysis;
  const first = doctor.monotonicity[0];
  const doctorText = (() => {
    if (doctor.suspect !== undefined) {
      return t('sandbox.doctor.suspect', {
        distance: meters(Number(doctor.suspect.markId)),
        residual: mm(Math.abs(doctor.suspect.residualMm)),
      });
    }
    if (doctor.status === 'inconsistent' && first !== undefined) {
      return t('sandbox.doctor.inconsistent', {
        from: meters(Number(first.markIds[0])),
        to: meters(Number(first.markIds[1])),
      });
    }
    return doctor.status === 'insufficient'
      ? t('sandbox.doctor.insufficient')
      : t('sandbox.doctor.ok');
  })();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl">{t('screens.sandbox')}</h1>
        <p className="font-ui text-base text-muted">{t('sandbox.intro')}</p>
      </header>

      <Segmented
        label={t('sandbox.setLabel')}
        value={setId}
        onChange={setSetId}
        options={SANDBOX_SETS.map((candidate) => ({
          value: candidate.id,
          label: t(`sandbox.sets.${candidate.id}`),
        }))}
      />

      <div className="flex flex-wrap items-start gap-6">
        <SectionCard title={t('sandbox.ruler.title')} className="min-w-0 flex-none">
          <Ruler
            scale={SANDBOX_SCALE}
            marks={marks}
            label={t('sandbox.ruler.label')}
            formatValue={reading}
          />
        </SectionCard>

        <SectionCard title={t('sandbox.table.title')} className="min-w-72 flex-1">
          <table className="w-full border-collapse font-ui text-base">
            <thead>
              <tr className="text-left text-sm text-muted">
                <th scope="col" className="py-1 font-medium">
                  {t('sandbox.table.distance')}
                </th>
                <th scope="col" className="py-1 font-medium">
                  {t('sandbox.table.reading')}
                </th>
                <th scope="col" className="py-1 font-medium">
                  {t('sandbox.table.kind')}
                </th>
              </tr>
            </thead>
            <tbody>
              {analysis.rows.map((row) => (
                <tr key={row.distanceM} className="border-t border-border">
                  <th scope="row" className="py-1 text-left font-medium tabular-nums">
                    {meters(row.distanceM)}
                  </th>
                  {row.ok ? (
                    <>
                      <td className="py-1 tabular-nums">
                        {row.kind === 'measured' ? '' : '≈ '}
                        {reading(row.reading)}
                      </td>
                      <td className="py-1">
                        <StatusBadge kind={row.kind === 'measured' ? 'registered' : 'calculated'}>
                          {kindOf(row)}
                        </StatusBadge>{' '}
                        {row.lowConfidence ? (
                          <span className="text-sm text-muted">
                            {t('sandbox.table.lowConfidence')}
                          </span>
                        ) : null}
                        {row.outOfScale ? (
                          <span className="text-sm text-warning">
                            {t('sandbox.table.outOfScale')}
                          </span>
                        ) : null}
                      </td>
                    </>
                  ) : (
                    <td colSpan={2} className="py-1 text-sm text-muted">
                      {translate(
                        ERROR_CATALOG[row.code].messageKey,
                        Object.fromEntries(
                          Object.entries(row.params).map(([name, value]) => [name, mm(value)]),
                        ),
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>

      <SectionCard title={t('sandbox.doctor.title')}>
        <p className="flex flex-wrap items-center gap-2 font-ui text-base">
          <StatusBadge kind={BADGE[doctor.status]}>
            {t(`sandbox.doctor.status.${doctor.status}`)}
          </StatusBadge>
          {doctorText}
        </p>
        {doctor.residuals.length > 0 ? (
          <div>
            <h3 className="font-ui text-sm text-muted">{t('sandbox.doctor.residuals')}</h3>
            <ul className="mt-1 flex flex-wrap gap-4 font-ui text-base tabular-nums">
              {doctor.residuals.map((residual) => (
                <li key={residual.markId}>
                  {meters(Number(residual.markId))}: {mm(residual.residualMm)} /{' '}
                  {mm(residual.thresholdMm)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </SectionCard>

      <Catalog />
    </div>
  );
}
