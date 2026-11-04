import { cx } from '@sight-mapper/ui';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useI18n } from '../../app/i18n.js';
import { arrowSetHooks } from '../equipment/arrow-sets.js';
import { bowHooks } from '../equipment/bows.js';
import { LinkButtonClass } from '../equipment/link-button.js';
import { componentName } from '../equipment/names.js';
import { sightHooks } from '../equipment/sights.js';

/** Marker glyphs: not words, so they stay out of the catalogs. */
const GLYPH = { done: '✓', pending: '○' } as const;

type Step = {
  key: string;
  label: string;
  done: boolean;
  detail: string | undefined;
  action: ReactNode;
};

/**
 * The Home of an archer with no setup yet (FUNCIONAL §2.1): a checklist, not a wizard. Each step
 * opens its form and comes back here on saving; a step already done is crossed off with what was
 * loaded, so someone who already has equipment starts at the setup.
 */
export function FirstSetupGuide() {
  const { t } = useI18n();
  const bows = bowHooks.useList({ status: 'active', limit: 100 });
  const sights = sightHooks.useList({ status: 'active', limit: 100 });
  const arrows = arrowSetHooks.useList({ status: 'active', limit: 100 });

  const bow = bows.data?.items[0];
  const sight = sights.data?.items[0];
  const set = arrows.data?.items[0];
  const equipped = bow !== undefined && sight !== undefined && set !== undefined;
  // The first one that is not done is the one to do now: it gets the accent.
  const doneFlags = [bow !== undefined, sight !== undefined, set !== undefined, false];
  const current = doneFlags.indexOf(false);

  const steps: Step[] = [
    {
      key: 'bow',
      label: t('onboarding.bow'),
      done: bow !== undefined,
      detail: bow === undefined ? undefined : componentName(bow),
      action: (
        <Link to="/bows/new" search={{ next: 'home' }} className={LinkButtonClass}>
          {t('onboarding.addBow')}
        </Link>
      ),
    },
    {
      key: 'sight',
      label: t('onboarding.sight'),
      done: sight !== undefined,
      detail: sight === undefined ? undefined : componentName(sight),
      action: (
        <Link to="/sights/new" search={{ next: 'home' }} className={LinkButtonClass}>
          {t('onboarding.addSight')}
        </Link>
      ),
    },
    {
      key: 'arrows',
      label: t('onboarding.arrows'),
      done: set !== undefined,
      detail: set?.name,
      action: (
        <Link to="/arrows/new" search={{ next: 'home' }} className={LinkButtonClass}>
          {t('onboarding.addArrows')}
        </Link>
      ),
    },
    {
      key: 'setup',
      label: t('onboarding.setup'),
      done: false,
      detail: equipped ? t('onboarding.setupReady') : t('onboarding.setupWaiting'),
      action: equipped ? (
        <Link to="/setups/new" className={LinkButtonClass}>
          {t('onboarding.createSetup')}
        </Link>
      ) : null,
    },
  ];

  return (
    <section
      aria-labelledby="first-setup-title"
      className="flex flex-col gap-4 rounded-md border border-border bg-surface p-4"
    >
      <div className="flex flex-col gap-1">
        <p className="font-ui text-sm text-muted">{t('setups.home.emptyTitle')}</p>
        <h2 id="first-setup-title" className="font-display text-xl">
          {t('onboarding.title')}
        </h2>
        <p className="font-ui text-base text-muted">{t('setups.home.emptyBody')}</p>
      </div>

      <ol aria-label={t('onboarding.steps')} className="flex flex-col gap-3">
        {steps.map((step, index) => (
          <li
            key={step.key}
            data-step={step.key}
            data-state={step.done ? 'done' : index === current ? 'current' : 'later'}
            className={cx(
              'flex flex-wrap items-center justify-between gap-3 rounded-sm border px-3 py-2',
              index === current ? 'border-accent' : 'border-border',
            )}
          >
            <div className="flex min-w-0 items-start gap-3">
              <span aria-hidden="true" className="font-ui text-lg">
                {step.done ? GLYPH.done : GLYPH.pending}
              </span>
              <div className="flex min-w-0 flex-col">
                <span
                  className={cx('font-ui text-base', step.done ? 'text-muted' : 'font-semibold')}
                >
                  {step.label}
                </span>
                {step.detail === undefined ? null : (
                  <span className="font-ui text-sm text-muted">{step.detail}</span>
                )}
              </div>
            </div>
            {step.done ? (
              <span className="font-ui text-sm text-muted">{t('onboarding.done')}</span>
            ) : index === current || (step.key === 'setup' && equipped) ? (
              step.action
            ) : null}
          </li>
        ))}
      </ol>

      <p className="font-ui text-sm text-muted">{t('onboarding.afterwards')}</p>
    </section>
  );
}
