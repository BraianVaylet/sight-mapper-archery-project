import { newId } from '@sight-mapper/client';
import { BottomSheet, Button, Field, InfoAlert, NumberField } from '@sight-mapper/ui';
import type { SightScale } from '@sight-mapper/domain';
import type { CreateMark, Mark } from '@sight-mapper/schemas';
import type { UnitSystem } from '@sight-mapper/types';
import { useState, type ReactNode } from 'react';
import { decimalSeparator } from '@sight-mapper/i18n';
import { useI18n } from '../../app/i18n.js';
import {
  stepDistance,
  stepReading,
  toFormValues,
  toMarkInput,
  type FieldError,
  type MarkFormContext,
  type MarkFormErrors,
  type MarkFormValues,
} from './mark-form.logic.js';

export type MarkSheetProps = {
  mode: 'new' | 'edit';
  /** The mark being edited. */
  mark: Mark | undefined;
  /** What the fields start with: empty, the saved mark, or what the archer had typed when a save failed. */
  initial: MarkFormValues | undefined;
  /** Why the last attempt failed, already translated. */
  error: string | undefined;
  ids: { setupId: string; arrowSetId: string };
  scale: SightScale;
  system: UnitSystem;
  onSubmit: (input: CreateMark, values: MarkFormValues) => void;
  onDelete: (() => void) | undefined;
  onClose: () => void;
};

/** A stepper button: big enough for a thumb (44 px), with a real name for a screen reader. */
function Step({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button variant="secondary" aria-label={label} onClick={onClick}>
      {children}
    </Button>
  );
}

/**
 * New or edit mark (HU-MRK-01, HU-MRK-03): the distance in the archer's unit, the reading on the
 * scale of the sight, steppers by one quantum, the numeric keypad, a note and a date. Saving does not
 * wait for the server: the sheet closes and the mark is already on the ruler.
 */
export function MarkSheet(props: MarkSheetProps) {
  const { t, locale, translate } = useI18n();
  const { mode, mark, scale, system, ids } = props;
  const separator = decimalSeparator(locale);
  const context: MarkFormContext = {
    system,
    scale,
    separator,
    distanceUnit: t(
      system === 'metric' ? 'sight.distanceUnitMetric' : 'sight.distanceUnitImperial',
    ),
  };
  const [values, setValues] = useState<MarkFormValues>(
    () => props.initial ?? toFormValues(mark, context),
  );
  const [errors, setErrors] = useState<MarkFormErrors>({});
  const set = (name: keyof MarkFormValues) => (value: string) =>
    setValues((current) => ({ ...current, [name]: value }));
  const say = (error: FieldError | undefined) =>
    error === undefined ? undefined : translate(error.messageKey, error.params);

  const submit = () => {
    const result = toMarkInput(
      values,
      { id: mark?.id ?? newId(), setupId: ids.setupId, arrowSetId: ids.arrowSetId },
      context,
    );
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    props.onSubmit(result.input, values);
  };

  const title = t(mode === 'new' ? 'mark.newTitle' : 'mark.editTitle');
  return (
    <BottomSheet open onClose={props.onClose} title={title} closeLabel={t('common.close')}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {props.error === undefined ? null : <InfoAlert variant="danger">{props.error}</InfoAlert>}

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <NumberField
              label={t('mark.distance')}
              unit={context.distanceUnit}
              value={values.distance}
              onChange={(event) => set('distance')(event.target.value)}
              error={say(errors.distance)}
              autoFocus
            />
          </div>
          <Step
            label={t('mark.distanceDown')}
            onClick={() => set('distance')(stepDistance(values.distance, -1, context))}
          >
            −
          </Step>
          <Step
            label={t('mark.distanceUp')}
            onClick={() => set('distance')(stepDistance(values.distance, 1, context))}
          >
            +
          </Step>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <NumberField
              label={t('mark.reading')}
              value={values.reading}
              onChange={(event) => set('reading')(event.target.value)}
              error={say(errors.reading)}
            />
          </div>
          <Step
            label={t('mark.readingDown')}
            onClick={() => set('reading')(stepReading(values.reading, -1, context))}
          >
            −
          </Step>
          <Step
            label={t('mark.readingUp')}
            onClick={() => set('reading')(stepReading(values.reading, 1, context))}
          >
            +
          </Step>
        </div>

        <Field
          label={t('mark.note')}
          value={values.note}
          onChange={(event) => set('note')(event.target.value)}
          error={say(errors.note)}
        />
        <Field
          label={t('mark.date')}
          type="datetime-local"
          value={values.measuredAt}
          onChange={(event) => set('measuredAt')(event.target.value)}
        />

        <div className="flex flex-wrap gap-3">
          <Button type="submit">{t('common.save')}</Button>
          {props.onDelete === undefined ? null : (
            <Button variant="secondary" onClick={props.onDelete}>
              {t('mark.delete')}
            </Button>
          )}
        </div>
      </form>
    </BottomSheet>
  );
}
