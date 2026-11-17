import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * The version the app shows (RF-X-03): the `version` of the root `package.json`, plain in
 * production and with the short commit as semver build metadata everywhere else (`0.1.0+abc1234`),
 * so a staging or local build says exactly what it is.
 */
export function appVersion(input: {
  version: string;
  sha: string | undefined;
  production: boolean;
}): string {
  const short = input.sha?.trim().slice(0, 7).toLowerCase();
  if (input.production || short === undefined || !/^[0-9a-f]{7}$/.test(short)) {
    return input.version;
  }
  return `${input.version}+${short}`;
}

/** The commit being built: Railway and GitHub Actions say it; locally, git does. */
function commitSha(env: Record<string, string | undefined>): string | undefined {
  const fromCi = env['RAILWAY_GIT_COMMIT_SHA'] || env['GITHUB_SHA'];
  if (fromCi) return fromCi;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: 'pipe' });
  } catch {
    // No git (the Docker image builds without `.git`): the version goes alone.
    return undefined;
  }
}

/** Reads the inputs of `appVersion` for `vite.config.ts`. Production = Railway's `production` environment. */
export function buildAppVersion(
  rootPackageJson: URL,
  env: Record<string, string | undefined> = process.env,
): string {
  const { version } = JSON.parse(readFileSync(rootPackageJson, 'utf8')) as { version: string };
  return appVersion({
    version,
    sha: commitSha(env),
    production: env['RAILWAY_ENVIRONMENT_NAME'] === 'production',
  });
}
