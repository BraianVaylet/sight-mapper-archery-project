import { emailForm } from '@sight-mapper/schemas';
import { Button, Field, InfoAlert } from '@sight-mapper/ui';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { useClients } from '../../app/clients.js';
import { useI18n } from '../../app/i18n.js';
import { requestPasswordReset } from './auth-api.js';
import { AuthCard, FormError, TextLink } from './auth-card.js';
import { fieldError, validateWith } from './form-utils.js';

export function ForgotScreen() {
  const { t, translate } = useI18n();
  const { authHttp } = useClients();

  const mutation = useMutation({
    mutationFn: (email: string) => requestPasswordReset(authHttp, email, window.location.origin),
  });

  const form = useForm({
    defaultValues: { email: '' },
    validators: { onSubmit: ({ value }) => validateWith(emailForm, value) },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(emailForm.parse(value).email).catch(() => undefined);
    },
  });

  return (
    <AuthCard title={t('screens.forgotPassword')}>
      {mutation.isSuccess ? (
        // The same answer whether the email exists or not (HU-ACC-03).
        <InfoAlert variant="info">{t('auth.forgot.sent')}</InfoAlert>
      ) : (
        <>
          <p className="font-ui text-base text-muted">{t('auth.forgot.intro')}</p>
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
                  {submitting ? t('common.loading') : t('auth.forgot.submit')}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </>
      )}
      <TextLink to="/sign-in">{t('auth.forgot.back')}</TextLink>
    </AuthCard>
  );
}
