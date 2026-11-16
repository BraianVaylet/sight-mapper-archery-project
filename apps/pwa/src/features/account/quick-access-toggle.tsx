import { Button, InfoAlert } from '@sight-mapper/ui';
import { describeError } from '../../app/errors.js';
import { useI18n } from '../../app/i18n.js';
import { useQuickAccess, useSetQuickAccess } from './profile.js';

/** Marker glyph: not a word, so it stays out of the catalogs. */
const CHECK = '✓ ';

/**
 * "Always open here" (HU-STP-03, RN-STP-07): the app opens on this setup and arrow set. It is a
 * toggle, `aria-pressed`, and says it with a check as well as a colour. There is one per archer:
 * choosing here replaces wherever it pointed before; pressing again clears it.
 */
export function QuickAccessToggle({
  setupId,
  arrowSetId,
}: {
  setupId: string;
  arrowSetId: string | undefined;
}) {
  const { t, translate } = useI18n();
  const current = useQuickAccess();
  const set = useSetQuickAccess();

  if (arrowSetId === undefined) return null;
  const here = current?.setupId === setupId && current.arrowSetId === arrowSetId;

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="secondary"
        aria-pressed={here}
        disabled={current === undefined}
        className="self-start"
        onClick={() => set.mutate(here ? null : { setupId, arrowSetId })}
      >
        {here ? CHECK : ''}
        {t(here ? 'quickAccess.on' : 'quickAccess.off')}
      </Button>
      <p className="font-ui text-sm text-muted">
        {t(here ? 'quickAccess.hintOn' : 'quickAccess.hintOff')}
      </p>
      {set.isError ? (
        <InfoAlert variant="danger">
          {set.error === null ? t('quickAccess.error') : describeError(translate, set.error).text}
        </InfoAlert>
      ) : null}
    </div>
  );
}
