import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { contentOf, decide, findSecret } from './guard-write.mjs';
import { shouldFormat } from './format.mjs';

const guard = fileURLToPath(new URL('./guard-write.mjs', import.meta.url));

// Built at run time: the literal never exists in the repo, so neither this hook nor gitleaks trips.
const FAKE = {
  aws: 'AKIA' + 'IOSFODNN7EXAMPLE',
  github: 'ghp_' + 'a'.repeat(36),
  google: 'AIza' + 'Sy' + 'A'.repeat(33),
  stripe: 'sk_live_' + 'b'.repeat(24),
  resend: 're_' + 'c'.repeat(28),
  slack: 'xoxb-' + '1234567890-abcdefghij',
  pem: '-----BEGIN ' + 'RSA PRIVATE KEY-----',
  mongo: 'mongodb+srv://archer:' + 'hunter22pass' + '@cluster0.example.mongodb.net/db',
  assign: 'BETTER_AUTH_SECRET = "' + 'x'.repeat(32) + '"',
};

const write = (file_path, content) => ({ tool_name: 'Write', tool_input: { file_path, content } });
const runHook = (input) =>
  spawnSync(process.execPath, [guard], { input: JSON.stringify(input), encoding: 'utf8' });

describe('secrets are blocked (exit 2) and never echoed', () => {
  for (const [name, secret] of Object.entries(FAKE)) {
    it(name, () => {
      const result = runHook(write('apps/api/src/config.ts', `const x = '${secret}';`));
      assert.equal(result.status, 2, result.stdout + result.stderr);
      assert.match(result.stderr, /Blocked: this write would leave what looks like/);
      assert.ok(!result.stderr.includes(secret), 'the message must not repeat the secret');
      assert.ok(!result.stdout.includes(secret));
    });
  }

  it('also blocks it in tests, docs and .env.example: no exempt files', () => {
    for (const file of ['a.test.ts', 'docs/TECNICO.md', '.env.example']) {
      assert.equal(runHook(write(file, FAKE.aws)).status, 2, file);
    }
  });

  it('looks inside Edit and MultiEdit payloads', () => {
    assert.equal(
      runHook({ tool_input: { file_path: 'a.ts', old_string: 'x', new_string: FAKE.github } }).status,
      2,
    );
    assert.equal(
      runHook({ tool_input: { file_path: 'a.ts', edits: [{ new_string: 'ok' }, { new_string: FAKE.stripe }] } }).status,
      2,
    );
  });
});

describe('ordinary content passes', () => {
  const clean = [
    "const key = process.env['RESEND_API_KEY'];",
    'RESEND_API_KEY=',
    'MONGODB_URI=mongodb://localhost:27017/sight-mapper',
    'MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/db',
    'url: `mongodb://${user}:${password}@host/db`',
    "const secret = 'short';",
    'The token is created by Better Auth and stored in an httpOnly cookie.',
    '// AKIA is the prefix of an AWS access key id',
    'const id = "019a3c5f-7b1d-7e55-8f0e-0c4c1b9f2a77";',
    'export const re_run = true;',
  ];
  for (const text of clean) {
    it(JSON.stringify(text.slice(0, 50)), () => {
      const result = runHook(write('apps/api/src/x.ts', text));
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, '');
    });
  }
});

describe('sensitive paths ask the user (permissionDecision: ask)', () => {
  for (const file of ['docs/spec/SIGHT-MAPPER-SPEC.md', 'packages/domain/src/model/pchip.ts', 'packages\\domain\\src\\index.ts']) {
    it(file, () => {
      const result = runHook(write(file, 'harmless'));
      assert.equal(result.status, 0);
      const output = JSON.parse(result.stdout).hookSpecificOutput;
      assert.equal(output.hookEventName, 'PreToolUse');
      assert.equal(output.permissionDecision, 'ask');
      assert.ok(output.permissionDecisionReason.length > 10);
    });
  }

  it('does not ask for the domain tests, other packages or other docs', () => {
    for (const file of ['packages/domain/test/x.ts', 'packages/schemas/src/a.ts', 'docs/BITACORA.md', 'apps/api/src/a.ts']) {
      assert.equal(runHook(write(file, 'ok')).stdout, '', file);
    }
  });

  it('a secret in a sensitive file is blocked rather than asked', () => {
    assert.equal(runHook(write('packages/domain/src/a.ts', FAKE.aws)).status, 2);
  });
});

describe('robustness', () => {
  it('lets through a payload it cannot read: a broken hook must not lock the editor', () => {
    const result = spawnSync(process.execPath, [guard], { input: 'not json', encoding: 'utf8' });
    assert.equal(result.status, 0);
  });

  it('handles a payload with no tool_input', () => {
    assert.equal(runHook({}).status, 0);
  });

  it('contentOf and findSecret expose what the hook sees', () => {
    assert.equal(contentOf({ content: 'a', new_string: 'b', edits: [{ new_string: 'c' }, {}] }), 'a\nb\nc');
    assert.equal(findSecret(FAKE.aws), 'AWS access key id');
    assert.equal(findSecret('nothing here'), null);
    assert.deepEqual(decide({ tool_input: { file_path: 'x.ts', content: 'ok' } }), { decision: 'allow' });
  });
});

describe('format hook decides what to format', () => {
  it('formats source, config and data files', () => {
    for (const file of ['apps/api/src/a.ts', 'packages/ui/src/b.tsx', 'x.mjs', 'package.json', 'a/b.css', '.github/workflows/ci.yml']) {
      assert.equal(shouldFormat(file), true, file);
    }
  });

  it('leaves docs, generated, vendored and unknown files alone', () => {
    for (const file of [
      'docs/BITACORA.md',
      'README.md',
      'node_modules/x/index.js',
      'packages/types/src/errors.generated.ts',
      'pnpm-lock.yaml',
      '.claude/hooks/x.mjs',
      'apps/api/dist/main.js',
      'image.png',
      'C:\\repo\\node_modules\\x\\a.js',
    ]) {
      assert.equal(shouldFormat(file), false, file);
    }
  });
});
