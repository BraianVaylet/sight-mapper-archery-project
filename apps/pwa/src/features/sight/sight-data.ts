import { useHttp } from '@sight-mapper/client';
import { decimalSeparator } from '@sight-mapper/i18n';
import type { SetupView } from '@sight-mapper/schemas';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useI18n } from '../../app/i18n.js';
import { profileQuery } from '../account/profile.js';
import { useMarks } from './marks.js';
import { analyse, toScale } from './sight.logic.js';

/**
 * What every screen about one (setup, arrow set) pair needs: the archer's unit and separator,
 * the arrow set that is on screen (the one in the URL, or the first), its marks and what the
 * model makes of them. The model runs again from the marks each time and is never stored (ADR-001).
 */
export function useSightData(setup: SetupView, arrowParam: string | undefined) {
  const { locale } = useI18n();
  const http = useHttp();
  const profile = useQuery(profileQuery(http));
  const system = profile.data?.unitSystem ?? 'metric';
  const separator = decimalSeparator(locale);

  const arrowId =
    setup.arrowSets.find((set) => set.id === arrowParam)?.id ?? setup.arrowSets[0]?.id;
  const marksQuery = useMarks(setup.id, arrowId);
  const marks = useMemo(() => marksQuery.data?.items ?? [], [marksQuery.data]);

  const scale = useMemo(() => toScale(setup.sight), [setup.sight]);
  const analysis = useMemo(() => analyse(marks, scale), [marks, scale]);

  return { system, separator, arrowId, marksQuery, marks, scale, analysis };
}
