import { Button, Field, InfoAlert } from '@sight-mapper/ui';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useClients } from '../../app/clients.js';
import { useI18n } from '../../app/i18n.js';
import { resendVerification } from './auth-api.js';
import { AuthCard, FormError, TextLink } from './auth-card.js';
import { fieldError, formSchemas, validateWith } from './form-utils.js';
import { sessionQuery } from './session.js';

/**
 * Where the verification link lands. The API verifies the token and signs the archer in, then
 * sends them here: with a session the account is active; with `?error=` the link failed; with
 * neither, the archer is still waiting for the email (and may ask for another).
 */
export function VerifyScreen({ failed }: { failed: boolean }) {
  const { t, translate } = useI18n();
  const { authHttp } = useClients();
  const session = useQuery({ ...sessionQuery(authHttp), enabled: !failed });

  const mutation = useMutation({
    mutationFn: (email: string) => resendVerification(authHttp, email, window.location.origin),
  });
  const form = useForm({
    defaultValues: { email: '' },
    validators: {
      onSubmitAsync: async ({ value }) => validateWith((await formSchemas()).emailForm, value),
    },
    onSubmit: async ({ value }) => {
      await mutation
        .mutateAsync((await formSchemas()).emailForm.parse(value).email)
        .catch(() => undefined);
    },
  });

  if (!failed && session.data?.user.emailVerified === true) {
    return (
      <AuthCard title={t('auth.verify.doneTitle')}>
        <InfoAlert variant="info">{t('auth.verify.doneBody')}</InfoAlert>
        <TextLink to="/">{t('auth.verify.goHome')}</TextLink>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('screens.verifyEmail')}>
      {failed ? (
        <InfoAlert variant="danger">{t('errors.auth.invalidOrExpiredToken')}</InfoAlert>
      ) : (
        <p className="font-ui text-base text-muted">{t('auth.verify.pendingBody')}</p>
      )}

      {mutation.isSuccess ? (
        // Same answer whether the email exists or not: nothing about who is registered leaks.
        <InfoAlert variant="info">{t('auth.verify.resent')}</InfoAlert>
      ) : (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="email">
            {(field) => (
              <Field
                label={t('auth.email')}
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
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
                {submitting ? t('common.loading') : t('auth.verify.resend')}
              </Button>
            )}
          </form.Subscribe>
        </form>
      )}
      <TextLink to="/sign-in">{t('screens.signIn')}</TextLink>
    </AuthCard>
  );
}
