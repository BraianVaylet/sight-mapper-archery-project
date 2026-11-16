import { describe, expect, it } from 'vitest';
import { createLogger } from './logger.js';

function capture(level = 'info') {
  const lines: Record<string, unknown>[] = [];
  const logger = createLogger(
    { level },
    { write: (l: string) => void lines.push(JSON.parse(l) as never) },
  );
  return { logger, lines };
}

describe('createLogger', () => {
  it('writes JSON lines tagged with the service', () => {
    const { logger, lines } = capture();
    logger.info({ a: 1 }, 'hello');
    expect(lines[0]).toMatchObject({ level: 30, msg: 'hello', a: 1, service: 'sight-mapper-api' });
  });

  it('respects the level', () => {
    const { logger, lines } = capture('warn');
    logger.info('quiet');
    logger.warn('loud');
    expect(lines.map((l) => l['msg'])).toEqual(['loud']);
  });

  it('redacts credentials wherever they appear', () => {
    const { logger, lines } = capture();
    logger.info(
      {
        password: 'p1',
        user: { password: 'p2', token: 't1', name: 'ana' },
        req: { headers: { authorization: 'Bearer abc', cookie: 'sid=1', accept: 'json' } },
        body: { newPassword: 'p3', apiKey: 'k1', secret: 's1' },
      },
      'login',
    );
    const text = JSON.stringify(lines[0]);
    for (const leaked of ['p1', 'p2', 'p3', 't1', 'k1', 's1', 'Bearer abc', 'sid=1']) {
      expect(text).not.toContain(`"${leaked}"`);
      expect(text).not.toContain(leaked === 'Bearer abc' ? leaked : `:"${leaked}`);
    }
    expect(text).toContain('[REDACTED]');
    expect(lines[0]).toMatchObject({ user: { name: 'ana' }, req: { headers: { accept: 'json' } } });
  });

  it('serialises an error with its stack', () => {
    const { logger, lines } = capture();
    logger.error({ err: new Error('boom') }, 'failed');
    expect(lines[0]).toMatchObject({ err: { type: 'Error', message: 'boom' } });
    expect(String((lines[0]?.['err'] as { stack: string }).stack)).toContain('boom');
  });
});
