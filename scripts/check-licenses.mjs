// Fails when a production dependency has a license outside the allowlist (TECNICO §11).
// Permissive licenses only: copyleft in a closed, monetised product needs a decision, not an accident.
import { execSync } from 'node:child_process';

const ALLOWED = new Set(
  (process.env.LICENSE_ALLOW ?? '')
    .split(',')
    .map((license) => license.trim())
    .filter((license) => license !== '')
    .concat([
      'MIT',
      'MIT-0',
      'ISC',
      'BSD-2-Clause',
      'BSD-3-Clause',
      'Apache-2.0',
      '0BSD',
      'BlueOak-1.0.0',
      'CC0-1.0',
      'Unlicense',
    ]),
);

// Packages that `pnpm licenses --prod` lists but that never run in production, each with the
// reason. A name matches itself and its platform builds (`lightningcss-linux-x64-gnu`).
const EXEMPT = {
  // MPL-2.0. Vite's CSS minifier. It only reaches the production tree because better-auth declares
  // vitest as an optional peer and pnpm links the workspace's vitest: no server code loads it.
  lightningcss: 'build tool reached through an optional test peer of better-auth',
};
const exempt = (name) =>
  Object.keys(EXEMPT).some((base) => name === base || name.startsWith(`${base}-`));

// A fixed command line: no user input reaches the shell.
const output = execSync('pnpm licenses list --prod --json', {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});

const byLicense = JSON.parse(output);
const rejected = Object.entries(byLicense)
  .filter(([license]) => !ALLOWED.has(license))
  .map(([license, packages]) => [license, packages.filter((p) => !exempt(p.name))])
  .filter(([, packages]) => packages.length > 0);

if (rejected.length > 0) {
  for (const [license, packages] of rejected) {
    const names = packages.map((p) => `${p.name}@${p.versions.join(',')}`).join(', ');
    process.stderr.write(`License not allowed: ${license}\n  ${names}\n`);
  }
  process.exit(1);
}

const total = Object.values(byLicense).reduce((sum, packages) => sum + packages.length, 0);
process.stdout.write(`${total} production dependencies, all under allowed licenses\n`);
