import { createTranslator } from '@sight-mapper/i18n';
import type { Locale } from '@sight-mapper/types';
import type { Logger } from '../logger/logger.js';

export type Email = {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
};

/** How mail leaves the system. Tests capture it; production sends it through Resend. */
export type EmailSender = { send(email: Email): Promise<void> };

export type AuthEmailKind = 'verify' | 'reset';

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * The text of a verification or reset email in the archer's language (ADR-004). Names and links
 * are HTML-escaped: a display name is user input.
 */
export function renderAuthEmail(
  kind: AuthEmailKind,
  locale: Locale,
  data: { readonly name: string; readonly url: string; readonly to: string },
): Email {
  const t = createTranslator(locale);
  const m =
    kind === 'verify'
      ? {
          subject: t('email.verify.subject'),
          heading: t('email.verify.heading'),
          body: t('email.verify.body', { name: data.name }),
          cta: t('email.verify.cta'),
          fallback: t('email.verify.fallback'),
          ignore: t('email.verify.ignore'),
        }
      : {
          subject: t('email.reset.subject'),
          heading: t('email.reset.heading'),
          body: t('email.reset.body', { name: data.name }),
          cta: t('email.reset.cta'),
          fallback: t('email.reset.fallback'),
          ignore: t('email.reset.ignore'),
        };

  const url = escapeHtml(data.url);
  return {
    to: data.to,
    subject: m.subject,
    text: [m.heading, '', m.body, '', data.url, '', m.ignore].join('\n'),
    html: [
      `<div lang="${locale}">`,
      `<h1 style="font-family:sans-serif">${escapeHtml(m.heading)}</h1>`,
      `<p style="font-family:sans-serif">${escapeHtml(m.body)}</p>`,
      `<p><a href="${url}" style="display:inline-block;padding:12px 20px;background:#ffcc00;color:#10286b;font-family:sans-serif;font-weight:600;text-decoration:none">${escapeHtml(m.cta)}</a></p>`,
      `<p style="font-family:sans-serif;font-size:13px">${escapeHtml(m.fallback)}<br>${url}</p>`,
      `<p style="font-family:sans-serif;font-size:13px;color:#555">${escapeHtml(m.ignore)}</p>`,
      '</div>',
    ].join('\n'),
  };
}

export type ResendOptions = {
  readonly apiKey: string;
  /** `Sight Mapper <no-reply@example.com>` */
  readonly from: string;
  readonly fetch?: typeof fetch;
};

/** Sends through Resend's HTTP API. A rejected send throws: the caller must not hide it. */
export function createResendSender(options: ResendOptions): EmailSender {
  const fetchImpl = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  return {
    async send(email) {
      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: options.from,
          to: [email.to],
          subject: email.subject,
          text: email.text,
          html: email.html,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        // Status only: the body can echo the address and the key must never be logged.
        throw new Error(`Resend rejected the email (HTTP ${response.status})`);
      }
    },
  };
}

/**
 * Local development without a mail account: the email is not sent, its text is logged so the
 * link can be opened by hand. Never wired outside `APP_ENV=local` (the links are credentials).
 */
export function createLogEmailSender(logger: Logger): EmailSender {
  return {
    send(email) {
      logger.info({ to: email.to, subject: email.subject, text: email.text }, 'email (not sent)');
      return Promise.resolve();
    },
  };
}
