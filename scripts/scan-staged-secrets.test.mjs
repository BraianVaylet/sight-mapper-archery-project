import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scanDiff } from './scan-staged-secrets.mjs';

// Built at run time so the literal never exists in the repo.
const AWS = 'AKIA' + 'IOSFODNN7EXAMPLE';
const GITHUB = 'ghp_' + 'b'.repeat(36);

const diff = (file, hunks) =>
  [`diff --git a/${file} b/${file}`, `--- a/${file}`, `+++ b/${file}`, ...hunks].join('\n');

describe('scanDiff', () => {
  it('reports file, line and label for an added secret, without the text', () => {
    const findings = scanDiff(
      diff('src/a.ts', [
        '@@ -0,0 +1,3 @@',
        '+const a = 1;',
        `+const key = '${AWS}';`,
        '+const b = 2;',
      ]),
    );
    assert.deepEqual(findings, [{ file: 'src/a.ts', line: 2, label: 'AWS access key id' }]);
    assert.ok(!JSON.stringify(findings).includes(AWS));
  });

  it('numbers lines from the hunk header', () => {
    const findings = scanDiff(diff('b.ts', ['@@ -10,0 +41,2 @@', '+x', `+y = '${GITHUB}'`]));
    assert.deepEqual(findings, [{ file: 'b.ts', line: 42, label: 'GitHub token' }]);
  });

  it('ignores removed lines and context, so deleting a secret is allowed', () => {
    const removed = scanDiff(
      diff('c.ts', ['@@ -1,2 +1,1 @@', `-const key = '${AWS}';`, ' const keep = 1;']),
    );
    assert.deepEqual(removed, []);
  });

  it('keeps counting across context lines and several files', () => {
    const text = [
      diff('one.ts', ['@@ -1,2 +1,3 @@', ' context', `+const k = '${AWS}';`]),
      diff('two.ts', ['@@ -5 +7 @@', `+const g = '${GITHUB}';`]),
    ].join('\n');
    assert.deepEqual(scanDiff(text), [
      { file: 'one.ts', line: 2, label: 'AWS access key id' },
      { file: 'two.ts', line: 7, label: 'GitHub token' },
    ]);
  });

  it('is quiet for ordinary additions and an empty diff', () => {
    assert.deepEqual(scanDiff(''), []);
    assert.deepEqual(
      scanDiff(
        diff('d.ts', [
          '@@ -0,0 +1,2 @@',
          "+const url = process.env['MONGODB_URI'];",
          '+RESEND_API_KEY==',
        ]),
      ),
      [],
    );
  });

  it('does not mistake the +++ header for an added line', () => {
    assert.deepEqual(scanDiff(`--- a/x\n+++ b/${AWS}.ts\n@@ -0,0 +1 @@\n+ok`), []);
  });
});
