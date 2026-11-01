import { isApiError } from '@sight-mapper/client';
import { resetPasswordForm } from '@sight-mapper/schemas';
import { Button, InfoAlert, PasswordField } from '@sight-mapper/ui';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { useClients } from '../../app/clients.js';
import { useI18n } from '../../app/i18n.js';
import { resetPassword } from './auth-api.js';
import { AuthCard, FormError, TextLink } from './auth-card.js';
import { fieldError, validateWith } from './form-utils.js';

type Props = { token: string | undefined; failed: boolean };

/** `token` arrives from the email link through the API; `failed` when the API said it is not valid. */
export function ResetScreen({ token, failed }: Props) {
  const { t, translate } = useI18n();
  const { authHttp } = useClients();

  const mutation = useMutation({
    mutationFn: (password: string) => resetPassword(authHttp, token ?? '', password),
  });

  const form = useForm({
    defaultValues: { password: '', confirmPassword: '' },
    validators: { onSubmit: ({ value }) => validateWith(resetPasswordForm, value) },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(resetPasswordForm.parse(value).password).catch(() => undefined);
    },
  });

  const linkIsDead =
    token === undefined ||
    failed ||
    (isApiError(mutation.error) && mutation.error.code === 'SM-AUTH-400-002');

  if (mutation.isSuccess) {
    return (
      <AuthCard title={t('screens.resetPassword')}>
        <InfoAlert variant="info">{t('auth.reset.done')}</InfoAlert>
        <TextLink to="/sign-in">{t('screens.signIn')}</TextLink>
      </AuthCard>
    );
  }

  if (linkIsDead) {
    return (
      <AuthCard title={t('screens.resetPassword')}>
        {/* HU-ACC-03: an expired or used link says so, and offers another. */}
        <InfoAlert variant="danger">{t('errors.auth.invalidOrExpiredToken')}</InfoAlert>
        <TextLink to="/forgot-password">{t('auth.reset.askAgain')}</TextLink>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('screens.resetPassword')}>
      <p className="font-ui text-base text-muted">{t('auth.reset.intro')}</p>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name="password">
          {(field) => (
            <PasswordField
              label={t('auth.password')}
              hint={t('auth.passwordHint')}
              showLabel={t('auth.showPassword')}
              hideLabel={t('auth.hidePassword')}
              autoComplete="new-password"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              error={fieldError(field.state.meta.errors, translate)}
            />
          )}
        </form.Field>
        <form.Field name="confirmPassword">
          {(field) => (
            <PasswordField
              label={t('auth.confirmPassword')}
              showLabel={t('auth.showPassword')}
              hideLabel={t('auth.hidePassword')}
              autoComplete="new-password"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              error={fieldError(field.state.meta.errors, translate)}
            />
          )}
        </form.Field>
        <FormError error={mutation.error} />
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <Button type="submit" disabled={submitting}>
              {submitting ? t('common.loading') : t('auth.reset.submit')}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </AuthCard>
  );
}
