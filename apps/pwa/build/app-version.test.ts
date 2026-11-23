import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { appVersion, buildAppVersion } from './app-version.js';

// From the working directory of the PWA tests: under jsdom `import.meta.url` is not a file URL.
const ROOT = pathToFileURL(resolve(process.cwd(), '../../package.json'));
const SHA = '4D5DB01E3B0F2C9A7E1B6C3D2A1F0E9D8C7B6A59';

describe('appVersion (RF-X-03)', () => {
  it('is the plain semver in production', () => {
    expect(appVersion({ version: '0.1.0', sha: SHA, production: true })).toBe('0.1.0');
  });

  it('adds the short commit as build metadata anywhere else', () => {
    expect(appVersion({ version: '0.1.0', sha: SHA, production: false })).toBe('0.1.0+4d5db01');
  });

  it('goes alone when there is no commit, or what came is not one', () => {
    expect(appVersion({ version: '0.1.0', sha: undefined, production: false })).toBe('0.1.0');
    expect(appVersion({ version: '0.1.0', sha: 'main', production: false })).toBe('0.1.0');
  });
});

describe('buildAppVersion', () => {
  const root = JSON.parse(readFileSync(ROOT, 'utf8')) as { version: string };

  it('reads the version of the root package.json', () => {
    expect(root.version).toBe('0.2.0');
    expect(buildAppVersion(ROOT, { RAILWAY_ENVIRONMENT_NAME: 'production', GITHUB_SHA: SHA })).toBe(
      '0.2.0',
    );
  });

  it('takes the commit Railway or GitHub reports before asking git', () => {
    expect(buildAppVersion(ROOT, { RAILWAY_GIT_COMMIT_SHA: SHA })).toBe('0.2.0+4d5db01');
    expect(buildAppVersion(ROOT, { GITHUB_SHA: SHA })).toBe('0.2.0+4d5db01');
  });

  it('falls back to the local git commit outside CI', () => {
    expect(buildAppVersion(ROOT, {})).toMatch(/^0\.2\.0(\+[0-9a-f]{7})?$/);
  });
});
