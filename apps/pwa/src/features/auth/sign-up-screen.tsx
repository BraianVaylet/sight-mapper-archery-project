import { signUpForm } from '@sight-mapper/schemas';
import { Button, Field, InfoAlert, PasswordField } from '@sight-mapper/ui';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { useClients } from '../../app/clients.js';
import { describeError } from '../../app/errors.js';
import { useI18n } from '../../app/i18n.js';
import { signUp } from './auth-api.js';
import { AuthCard, FormError, TextLink } from './auth-card.js';
import { fieldError, fieldOfError, validateWith } from './form-utils.js';

export function SignUpScreen() {
  const { t, translate } = useI18n();
  const { authHttp } = useClients();

  const mutation = useMutation({
    mutationFn: (value: Parameters<typeof signUp>[1]) =>
      signUp(authHttp, value, window.location.origin),
  });

  const form = useForm({
    defaultValues: { email: '', username: '', password: '', confirmPassword: '' },
    validators: { onSubmit: ({ value }) => validateWith(signUpForm, value) },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(signUpForm.parse(value)).catch(() => undefined);
    },
  });

  const serverField = fieldOfError(mutation.error);
  /** A field shows its own validation first, then the server's verdict about it (HU-ACC-01). */
  const messageFor = (name: string, errors: readonly unknown[]) =>
    fieldError(errors, translate) ??
    (serverField === name && mutation.error !== null
      ? describeError(translate, mutation.error).text
      : undefined);

  if (mutation.isSuccess) {
    return (
      <AuthCard title={t('auth.signUp.checkEmailTitle')}>
        <InfoAlert variant="info">
          {t('auth.signUp.checkEmailBody', { email: form.state.values.email.trim() })}
        </InfoAlert>
        <TextLink to="/verify-email">{t('auth.verify.resend')}</TextLink>
        <TextLink to="/sign-in">{t('screens.signIn')}</TextLink>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('screens.signUp')}>
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
              error={messageFor('email', field.state.meta.errors)}
            />
          )}
        </form.Field>
        <form.Field name="username">
          {(field) => (
            <Field
              label={t('auth.username')}
              hint={t('auth.usernameHint')}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              error={messageFor('username', field.state.meta.errors)}
            />
          )}
        </form.Field>
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
              error={messageFor('password', field.state.meta.errors)}
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

        {serverField === undefined ? <FormError error={mutation.error} /> : null}

        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <Button type="submit" disabled={submitting}>
              {submitting ? t('common.loading') : t('auth.signUp.submit')}
            </Button>
          )}
        </form.Subscribe>
      </form>

      <p className="font-ui text-base text-muted">
        {t('auth.signUp.haveAccount')} <TextLink to="/sign-in">{t('screens.signIn')}</TextLink>
      </p>
    </AuthCard>
  );
}
