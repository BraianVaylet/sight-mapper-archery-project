import { describe, expect, it } from 'vitest';
import { EnvError, parseEnv } from './env.js';

const SECRET = 'a'.repeat(32);
const minimal = {
  MONGODB_URI: 'mongodb://localhost/sm',
  BETTER_AUTH_SECRET: SECRET,
  BETTER_AUTH_URL: 'http://localhost:3000',
};
const hosted = {
  ...minimal,
  APP_ENV: 'staging',
  RESEND_API_KEY: 'key',
  EMAIL_FROM: 'Sight Mapper <a@b.c>',
};

describe('parseEnv', () => {
  it('applies defaults for everything optional', () => {
    expect(parseEnv(minimal)).toEqual({
      NODE_ENV: 'development',
      APP_ENV: 'local',
      PORT: 3000,
      MONGODB_URI: 'mongodb://localhost/sm',
      BETTER_AUTH_SECRET: SECRET,
      BETTER_AUTH_URL: 'http://localhost:3000',
      GOOGLE_CLIENT_ID: undefined,
      GOOGLE_CLIENT_SECRET: undefined,
      RESEND_API_KEY: undefined,
      EMAIL_FROM: undefined,
      CORS_ORIGINS: [],
      LOG_LEVEL: 'info',
    });
  });

  it('reads the port from a string and splits the origins', () => {
    const env = parseEnv({
      ...hosted,
      PORT: '8080',
      CORS_ORIGINS: 'http://localhost:5173, https://app.example.com ,',
      NODE_ENV: 'production',
      LOG_LEVEL: 'warn',
    });
    expect(env.PORT).toBe(8080);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173', 'https://app.example.com']);
    expect(env.APP_ENV).toBe('staging');
  });

  it('does not start without MONGODB_URI or the auth secret, naming the variable', () => {
    expect(() => parseEnv({})).toThrow(EnvError);
    expect(() => parseEnv({})).toThrow(/MONGODB_URI/);
    expect(() => parseEnv({})).toThrow(/BETTER_AUTH_SECRET/);
    expect(() => parseEnv({})).toThrow(/BETTER_AUTH_URL/);
  });

  it('asks for a secret of at least 32 characters and a real URL, and never echoes them', () => {
    try {
      parseEnv({
        ...minimal,
        BETTER_AUTH_SECRET: 'tooshort-secret-value',
        BETTER_AUTH_URL: 'not a url',
      });
      expect.unreachable();
    } catch (error) {
      const problems = (error as EnvError).problems.join('\n');
      expect(problems).toContain('BETTER_AUTH_SECRET');
      expect(problems).toContain('BETTER_AUTH_URL');
      expect(problems).not.toContain('tooshort-secret-value');
    }
  });

  it('reports every problem at once and never echoes a value', () => {
    try {
      parseEnv({ MONGODB_URI: '', PORT: '99999', APP_ENV: 'moon', LOG_LEVEL: 'shout' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(EnvError);
      const problems = (error as EnvError).problems.join('\n');
      for (const name of ['MONGODB_URI', 'PORT', 'APP_ENV', 'LOG_LEVEL']) {
        expect(problems).toContain(name);
      }
      expect(problems).not.toContain('moon');
    }
  });

  it('rejects a CORS wildcard', () => {
    expect(() => parseEnv({ ...minimal, CORS_ORIGINS: 'https://a.com,*' })).toThrow(/wildcard/);
  });

  it('treats empty optional variables, as copied from .env.example, as not set', () => {
    const env = parseEnv({
      ...minimal,
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '  ',
      RESEND_API_KEY: '',
    });
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(env.GOOGLE_CLIENT_SECRET).toBeUndefined();
    expect(env.RESEND_API_KEY).toBeUndefined();
  });

  it('wants both Google variables or neither', () => {
    expect(() => parseEnv({ ...minimal, GOOGLE_CLIENT_ID: 'id' })).toThrow(/go together/);
    expect(() => parseEnv({ ...minimal, GOOGLE_CLIENT_SECRET: 'secret' })).toThrow(/go together/);
    expect(
      parseEnv({ ...minimal, GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' })
        .GOOGLE_CLIENT_ID,
    ).toBe('id');
  });

  it('requires real email outside local, and lets local run without it', () => {
    expect(() => parseEnv({ ...minimal, APP_ENV: 'staging' })).toThrow(
      /RESEND_API_KEY is required/,
    );
    expect(() => parseEnv({ ...minimal, APP_ENV: 'prod', RESEND_API_KEY: 'k' })).toThrow(
      /EMAIL_FROM is required/,
    );
    expect(parseEnv(hosted).APP_ENV).toBe('staging');
    expect(parseEnv(minimal).APP_ENV).toBe('local');
  });
});
