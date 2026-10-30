import { describe, expect, it } from 'vitest';
import { EnvError, parseEnv } from './env.js';

const minimal = { MONGODB_URI: 'mongodb://localhost/sm' };

describe('parseEnv', () => {
  it('applies defaults for everything optional', () => {
    expect(parseEnv(minimal)).toEqual({
      NODE_ENV: 'development',
      APP_ENV: 'local',
      PORT: 3000,
      MONGODB_URI: 'mongodb://localhost/sm',
      CORS_ORIGINS: [],
      LOG_LEVEL: 'info',
    });
  });

  it('reads the port from a string and splits the origins', () => {
    const env = parseEnv({
      ...minimal,
      PORT: '8080',
      CORS_ORIGINS: 'http://localhost:5173, https://app.example.com ,',
      APP_ENV: 'staging',
      NODE_ENV: 'production',
      LOG_LEVEL: 'warn',
    });
    expect(env.PORT).toBe(8080);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173', 'https://app.example.com']);
    expect(env.APP_ENV).toBe('staging');
  });

  it('does not start without MONGODB_URI, naming the variable', () => {
    expect(() => parseEnv({})).toThrow(EnvError);
    expect(() => parseEnv({})).toThrow(/MONGODB_URI/);
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
});
