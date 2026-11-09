import { isApiError } from '@sight-mapper/client';
import { Button, Field, PasswordField } from '@sight-mapper/ui';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useClients } from '../../app/clients.js';
import { useI18n } from '../../app/i18n.js';
import { signIn } from './auth-api.js';
import { AuthCard, FormError, TextLink } from './auth-card.js';
import { fieldError, formSchemas, validateWith } from './form-utils.js';
import { safeRedirect } from './redirect.js';
import { forgetSession } from './session.js';

export function SignInScreen({ redirect }: { redirect: string | undefined }) {
  const { t, translate } = useI18n();
  const { authHttp } = useClients();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: (value: { identifier: string; password: string }) => signIn(authHttp, value),
    onSuccess: async () => {
      forgetSession(queryClient);
      await navigate({ to: safeRedirect(redirect), replace: true });
    },
  });

  const form = useForm({
    defaultValues: { identifier: '', password: '' },
    validators: {
      onSubmitAsync: async ({ value }) => validateWith((await formSchemas()).signInForm, value),
    },
    onSubmit: async ({ value }) => {
      // The error is shown from `mutation.error`; nothing to do with it here.
      await mutation.mutateAsync(value).catch(() => undefined);
    },
  });

  const unverified = isApiError(mutation.error) && mutation.error.code === 'SM-AUTH-403-001';

  return (
    <AuthCard title={t('screens.signIn')}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name="identifier">
          {(field) => (
            <Field
              label={t('auth.identifier')}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              error={fieldError(field.state.meta.errors, translate)}
            />
          )}
        </form.Field>
        <form.Field name="password">
          {(field) => (
            <PasswordField
              label={t('auth.password')}
              showLabel={t('auth.showPassword')}
              hideLabel={t('auth.hidePassword')}
              autoComplete="current-password"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              error={fieldError(field.state.meta.errors, translate)}
            />
          )}
        </form.Field>

        <FormError error={mutation.error} />
        {unverified ? <TextLink to="/verify-email">{t('auth.signIn.resend')}</TextLink> : null}

        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <Button type="submit" disabled={submitting}>
              {submitting ? t('common.loading') : t('auth.signIn.submit')}
            </Button>
          )}
        </form.Subscribe>
      </form>

      <TextLink to="/forgot-password">{t('auth.signIn.forgot')}</TextLink>
      <p className="font-ui text-base text-muted">
        {t('auth.signIn.noAccount')} <TextLink to="/sign-up">{t('screens.signUp')}</TextLink>
      </p>
    </AuthCard>
  );
}
