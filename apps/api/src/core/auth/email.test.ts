import { describe, expect, it, vi } from 'vitest';
import { createLogger } from '../logger/logger.js';
import { createLogEmailSender, createResendSender, renderAuthEmail } from './email.js';

const data = {
  name: 'Ana',
  url: 'http://localhost:3000/api/auth/verify-email?token=abc&callbackURL=%2F',
  to: 'ana@example.com',
};

describe('renderAuthEmail', () => {
  it('writes the verification email in Spanish or English', () => {
    const es = renderAuthEmail('verify', 'es', data);
    const en = renderAuthEmail('verify', 'en', data);
    expect(es.subject).toBe('Verificá tu email en Sight Mapper');
    expect(en.subject).toBe('Verify your email for Sight Mapper');
    expect(es.text).toContain('Hola Ana');
    expect(en.text).toContain('Hi Ana');
    for (const mail of [es, en]) {
      expect(mail.to).toBe('ana@example.com');
      expect(mail.text).toContain(data.url);
    }
  });

  it('writes the reset email in both languages with its own subject', () => {
    expect(renderAuthEmail('reset', 'es', data).subject).toBe(
      'Restablecé tu contraseña de Sight Mapper',
    );
    expect(renderAuthEmail('reset', 'en', data).subject).toBe('Reset your Sight Mapper password');
    expect(renderAuthEmail('reset', 'en', data).text).toContain('works once');
  });

  it('marks the language of the HTML, for screen readers and spell checkers', () => {
    expect(renderAuthEmail('verify', 'en', data).html).toContain('<div lang="en">');
    expect(renderAuthEmail('reset', 'es', data).html).toContain('<div lang="es">');
    expect(renderAuthEmail('reset', 'es', data).html.endsWith('</div>')).toBe(true);
  });

  it('escapes the name and the link in the HTML: a display name is user input', () => {
    const mail = renderAuthEmail('verify', 'en', {
      ...data,
      name: '<script>alert("x")</script>',
      url: 'http://x/?a=1&b="2"',
    });
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&#60;script&#62;');
    expect(mail.html).toContain('a=1&#38;b=&#34;2&#34;');
    // the plain-text part is not HTML: it keeps what the link really is
    expect(mail.text).toContain('http://x/?a=1&b="2"');
  });

  it('links with a button and prints the link too, for clients that block buttons', () => {
    const mail = renderAuthEmail('verify', 'es', data);
    expect(mail.html).toContain('<a href="');
    expect(mail.html).toContain('copiá este enlace');
  });
});

describe('createResendSender', () => {
  const email = renderAuthEmail('verify', 'en', data);

  it('posts to Resend with the key, the sender and the message', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    await createResendSender({
      apiKey: 'k_test',
      from: 'Sight Mapper <a@b.c>',
      fetch: fetchMock,
    }).send(email);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer k_test');
    expect(JSON.parse(init.body as string)).toMatchObject({
      from: 'Sight Mapper <a@b.c>',
      to: ['ana@example.com'],
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
  });

  it('throws on a rejection, naming the status and never the key or the address', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{"to":"ana@example.com"}', { status: 422 }));
    const error = await createResendSender({ apiKey: 'k_secret', from: 'x', fetch: fetchMock })
      .send(email)
      .then(
        () => undefined,
        (e: unknown) => e as Error,
      );
    expect(error?.message).toBe('Resend rejected the email (HTTP 422)');
    expect(error?.message).not.toContain('k_secret');
    expect(error?.message).not.toContain('ana@example.com');
  });

  it('lets a network failure through', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    await expect(
      createResendSender({ apiKey: 'k', from: 'x', fetch: fetchMock }).send(email),
    ).rejects.toThrow('fetch failed');
  });
});

describe('createLogEmailSender (local only)', () => {
  it('logs the email instead of sending it', async () => {
    const lines: Record<string, unknown>[] = [];
    const logger = createLogger(
      { level: 'info' },
      { write: (l: string) => void lines.push(JSON.parse(l) as never) },
    );
    await createLogEmailSender(logger).send(renderAuthEmail('verify', 'es', data));
    expect(lines[0]).toMatchObject({ msg: 'email (not sent)', to: 'ana@example.com' });
    expect(String(lines[0]?.['text'])).toContain('token=abc');
  });
});
