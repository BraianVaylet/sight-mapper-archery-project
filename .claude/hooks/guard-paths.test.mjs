import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { isInsideProject } from './format.mjs';
import { afterState, decide, projectRelative } from './guard-write.mjs';

// Built at run time so the literal never exists in the repo.
const AWS = 'AKIA' + 'IOSFODNN7EXAMPLE';
const GITHUB = 'ghp_' + 'a'.repeat(36);

const scratch = [];
after(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

/** A throw-away project directory, so the tests can write real files. */
function project(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'guard-'));
  scratch.push(dir);
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  return dir;
}

const edit = (file_path, old_string, new_string, extra = {}) => ({
  tool_input: { file_path, old_string, new_string, ...extra },
});

describe('the file as it will be, not just the fragment (split secrets)', () => {
  it('blocks a secret completed by an edit, though no fragment holds it whole', () => {
    const dir = project({ 'src/a.ts': "const key = 'AKIA';\n" });
    const harmless = edit('src/a.ts', "'AKIA'", "'AKIA' + 'IOSFODNN7EXAMPLE'");
    assert.equal(decide(harmless, dir).decision, 'allow');

    const joined = edit('src/a.ts', "const key = 'AKIA';", `const key = '${AWS}';`);
    assert.equal(decide(joined, dir).decision, 'block');
  });

  it('blocks an edit that finishes what the file already half holds', () => {
    const dir = project({ 'src/a.ts': "const key = 'AKIAIOSFODNN7';\n" });
    assert.equal(
      decide(edit('src/a.ts', "AKIAIOSFODNN7'", `${AWS}'`), dir).decision,
      'block',
    );
  });

  it('blocks MultiEdit fragments that only make a secret together', () => {
    const dir = project({ 'src/a.ts': '// placeholder\n' });
    const multi = {
      tool_input: {
        file_path: 'src/a.ts',
        edits: [
          { old_string: '// placeholder', new_string: 'AKIA' },
          { old_string: 'AKIA', new_string: AWS },
        ],
      },
    };
    assert.equal(decide(multi, dir).decision, 'block');
  });

  it('applies replace_all, a first match only, and a missing match', () => {
    assert.equal(afterState({ old_string: 'x', new_string: 'y', replace_all: true }, 'xax'), 'yay');
    assert.equal(afterState({ old_string: 'x', new_string: 'y' }, 'xax'), 'yax');
    assert.equal(afterState({ old_string: 'absent', new_string: 'y' }, 'xax'), 'xax');
    assert.equal(afterState({ content: 'whole' }, 'old'), 'whole');
  });

  it('does not block an unrelated edit of a file that already holds a secret', () => {
    const dir = project({ 'src/a.ts': `const key = '${AWS}';\nconst n = 1;\n` });
    assert.equal(decide(edit('src/a.ts', 'const n = 1;', 'const n = 2;'), dir).decision, 'allow');
  });

  it('still blocks a new secret added next to an old one', () => {
    const dir = project({ 'src/a.ts': `const key = '${AWS}';\n` });
    const added = edit('src/a.ts', 'const key', `const other = '${GITHUB}';\nconst key`);
    assert.equal(decide(added, dir).decision, 'block');
  });
});

describe('paths are resolved before they are compared', () => {
  const dir = project();
  const ask = (file) => decide({ tool_input: { file_path: file, content: 'x' } }, dir).decision;

  it('asks whatever the case (Windows paths are case-insensitive)', () => {
    for (const file of ['Docs/Spec/X.md', 'DOCS/SPEC/x.md', 'Packages/Domain/SRC/a.ts']) {
      assert.equal(ask(file), 'ask', file);
    }
  });

  it('asks through .. segments, ./, doubled and back slashes', () => {
    for (const file of [
      'packages/domain/src/../src/a.ts',
      'docs/other/../spec/x.md',
      './docs/spec/x.md',
      'docs\\spec\\x.md',
      'packages//domain//src//a.ts',
    ]) {
      assert.equal(ask(file), 'ask', file);
    }
  });

  it('asks for an absolute path inside the project', () => {
    assert.equal(ask(join(dir, 'docs', 'spec', 'x.md')), 'ask');
  });

  it('does not ask for look-alikes or for paths that leave the project', () => {
    for (const file of [
      'docs/specs/x.md',
      'docs/spec-notes.md',
      'xdocs/spec/x.md',
      '../docs/spec/x.md',
      'packages/domain/srcx/a.ts',
    ]) {
      assert.equal(ask(file), 'allow', file);
    }
  });

  it('projectRelative gives lowercase project-relative paths, or null outside', () => {
    assert.equal(projectRelative('A/b/../C.ts', dir), 'a/c.ts');
    assert.equal(projectRelative('../x', dir), null);
    assert.equal(projectRelative('.', dir), null);
  });
});

describe('the formatter only touches files inside the project', () => {
  const dir = project();

  it('accepts files under the project and refuses anything outside', () => {
    assert.equal(isInsideProject('src/a.ts', dir), true);
    assert.equal(isInsideProject(join(dir, 'src', 'a.ts'), dir), true);
    assert.equal(isInsideProject('../outside.ts', dir), false);
    assert.equal(isInsideProject('src/../../outside.ts', dir), false);
    assert.equal(isInsideProject(join(tmpdir(), 'elsewhere.ts'), dir), false);
    assert.equal(isInsideProject('.', dir), false);
  });
});
