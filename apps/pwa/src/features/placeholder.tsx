import { useI18n } from '../app/i18n.js';

export type ScreenKey =
  | 'signIn'
  | 'signUp'
  | 'forgotPassword'
  | 'resetPassword'
  | 'verifyEmail'
  | 'home'
  | 'newSetup'
  | 'sight'
  | 'distances'
  | 'doctor'
  | 'print'
  | 'editSetup'
  | 'trash'
  | 'bows'
  | 'sights'
  | 'arrows'
  | 'appearance'
  | 'profile';

/** A screen that lands in a later phase: its route, title and guard exist now. */
export function Placeholder({ screen }: { screen: ScreenKey }) {
  const { t } = useI18n();
  return (
    <section>
      <h1 className="font-display text-2xl">{t(`screens.${screen}`)}</h1>
      <p className="mt-2 font-ui text-base text-muted">{t('app.placeholder')}</p>
    </section>
  );
}
