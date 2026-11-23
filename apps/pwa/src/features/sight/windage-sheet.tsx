import type { SightScale } from '@sight-mapper/domain';
import { decimalSeparator } from '@sight-mapper/i18n';
import { BottomSheet, Button, InfoAlert, NumberField } from '@sight-mapper/ui';
import { useState } from 'react';
import { useI18n } from '../../app/i18n.js';
import type { FieldError } from './mark-form.logic.js';
import { readWindage, showWindage } from './windage.logic.js';

export type WindageSheetProps = {
  /** The base windage of the setup now, in mm. */
  windageMm: number | null;
  windageScale: SightScale;
  /** Why the last attempt failed, already translated. */
  error: string | undefined;
  onSubmit: (windageMm: number | null) => void;
  onClose: () => void;
};

/**
 * The base windage of the setup (F1-42, RN-STP-08): one value on the horizontal scale that holds
 * for every distance and arrow set. Empty clears it.
 */
export function WindageSheet(props: WindageSheetProps) {
  const { t, locale, translate } = useI18n();
  const separator = decimalSeparator(locale);
  const [text, setText] = useState(() =>
    showWindage(props.windageMm, props.windageScale, separator),
  );
  const [error, setError] = useState<FieldError | undefined>(undefined);

  const submit = () => {
    const result = readWindage(text, props.windageScale, separator);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(undefined);
    props.onSubmit(result.windageMm);
  };

  return (
    <BottomSheet
      open
      onClose={props.onClose}
      title={t('sight.windageEdit')}
      closeLabel={t('common.close')}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {props.error === undefined ? null : <InfoAlert variant="danger">{props.error}</InfoAlert>}
        <NumberField
          label={t('sight.windageField')}
          hint={t('sight.windageHint')}
          value={text}
          onChange={(event) => setText(event.target.value)}
          error={error === undefined ? undefined : translate(error.messageKey, error.params)}
          autoFocus
        />
        <Button type="submit">{t('common.save')}</Button>
      </form>
    </BottomSheet>
  );
}
