import { describe, expect, it } from 'vitest';
import { globalLimit, sensitiveLimit } from './auth.js';

describe('the rate limit of the sensitive auth endpoints', () => {
  it('is 5 attempts per 15 minutes in every hosted environment', () => {
    for (const APP_ENV of ['staging', 'prod'] as const) {
      expect(sensitiveLimit({ APP_ENV, NODE_ENV: 'production' })).toEqual({ window: 900, max: 5 });
    }
  });

  it('is lifted only on a laptop that is not running tests, for the E2E suite', () => {
    expect(sensitiveLimit({ APP_ENV: 'local', NODE_ENV: 'production' }).max).toBeGreaterThan(5);
    expect(sensitiveLimit({ APP_ENV: 'local', NODE_ENV: 'development' }).max).toBeGreaterThan(5);
  });

  it('stays real under test, so the suite keeps proving it', () => {
    expect(sensitiveLimit({ APP_ENV: 'local', NODE_ENV: 'test' })).toEqual({ window: 900, max: 5 });
  });
});

describe('the rate limit of every auth endpoint, per minute', () => {
  it('is 100 in every hosted environment and under test', () => {
    for (const APP_ENV of ['staging', 'prod'] as const) {
      expect(globalLimit({ APP_ENV, NODE_ENV: 'production' })).toEqual({ window: 60, max: 100 });
    }
    expect(globalLimit({ APP_ENV: 'local', NODE_ENV: 'test' })).toEqual({ window: 60, max: 100 });
  });

  it('is lifted only on a laptop that is not running tests', () => {
    expect(globalLimit({ APP_ENV: 'local', NODE_ENV: 'production' }).max).toBeGreaterThan(100);
  });
});
