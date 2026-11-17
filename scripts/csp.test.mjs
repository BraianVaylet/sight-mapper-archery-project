// The production CSP (apps/pwa/Caddyfile) allows the inline scripts of apps/pwa/index.html by hash.
// Edit one of those scripts without updating the hash and the theme stops applying in production,
// silently: this test fails first.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const pwa = join(fileURLToPath(new URL('..', import.meta.url)), 'apps', 'pwa');
const html = readFileSync(join(pwa, 'index.html'), 'utf8');
const caddyfile = readFileSync(join(pwa, 'Caddyfile'), 'utf8');

const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
  (match) => match[1] ?? '',
);
const csp = /Content-Security-Policy "([^"]+)"/.exec(caddyfile)?.[1] ?? '';
const scriptSrc = /script-src ([^;]+)/.exec(csp)?.[1] ?? '';

describe('the production CSP', () => {
  it('allows every inline script of index.html by its hash', () => {
    assert.ok(inlineScripts.length > 0, 'index.html has no inline script: drop the hash');
    for (const script of inlineScripts) {
      const hash = `'sha256-${createHash('sha256').update(script).digest('base64')}'`;
      assert.ok(scriptSrc.includes(hash), `script-src lacks ${hash}`);
    }
  });

  it('allows nothing else to run: no unsafe-inline, no unsafe-eval, no stale hash', () => {
    assert.ok(!/unsafe-inline|unsafe-eval/.test(scriptSrc));
    const hashes = scriptSrc.match(/'sha256-[^']+'/g) ?? [];
    assert.equal(hashes.length, inlineScripts.length, 'a hash for a script that no longer exists');
  });

  it('keeps the page from being framed or posting elsewhere', () => {
    for (const directive of ["frame-ancestors 'none'", "form-action 'self'", "object-src 'none'"]) {
      assert.ok(csp.includes(directive), directive);
    }
  });
});
