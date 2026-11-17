import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { addToIndex, createAdr, nextNumber, renderAdr, slugify } from './new-adr.mjs';

const repoAdr = fileURLToPath(new URL('../docs/adr', import.meta.url));
const scratch = [];

/** A copy of the real docs/adr in a temp directory, so the test never touches the repo. */
function sandbox() {
  const root = mkdtempSync(join(tmpdir(), 'adr-'));
  scratch.push(root);
  cpSync(repoAdr, join(root, 'docs', 'adr'), { recursive: true });
  return root;
}

after(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

describe('slugify', () => {
  it('lowercases, strips accents and joins words with single dashes', () => {
    assert.equal(slugify('Método de pago: ¡Stripe o MP!'), 'metodo-de-pago-stripe-o-mp');
    assert.equal(slugify('  Offline   first  '), 'offline-first');
    assert.equal(slugify('ADR--weird__chars'), 'adr-weird-chars');
  });

  it('is empty when there is nothing usable', () => {
    assert.equal(slugify('¿¡?!'), '');
  });
});

describe('nextNumber', () => {
  it('is one above the highest existing ADR, ignoring other files', () => {
    assert.equal(nextNumber(['000-a.md', '011-b.md', 'README.md', 'TEMPLATE.md', '5-x.md']), 12);
  });

  it('starts at 000 in an empty directory', () => {
    assert.equal(nextNumber(['README.md']), 0);
  });
});

describe('renderAdr', () => {
  it('fills id, title, state and date and keeps the template sections', () => {
    const template = readFileSync(join(repoAdr, 'TEMPLATE.md'), 'utf8');
    const out = renderAdr(template, { number: 12, title: 'Usar X', date: '2026-10-31' });
    assert.match(out, /^# ADR-012 — Usar X$/m);
    assert.match(out, /^- \*\*Estado:\*\* Propuesta$/m);
    assert.match(out, /^- \*\*Fecha:\*\* 2026-10-31$/m);
    for (const section of [
      '## Contexto',
      '## Decision',
      '## Consecuencias',
      '## Como se hace cumplir',
    ]) {
      assert.ok(out.includes(section), section);
    }
    assert.ok(!out.includes('ADR-NNN'));
  });
});

describe('addToIndex', () => {
  it('adds the row after the last one', () => {
    const readme =
      '| ADR | T |\n| --- | --- |\n| [000](000-a.md) | A | Aceptada | d |\n| [001](001-b.md) | B | Aceptada | d |\n\nfin\n';
    const out = addToIndex(readme, { number: 2, slug: 'c', title: 'C', date: '2026-10-31' });
    const lines = out.split('\n');
    assert.equal(lines[4], '| [002](002-c.md) | C | Propuesta | 2026-10-31 |');
    assert.equal(lines[6], 'fin');
  });

  it('refuses an index it cannot find', () => {
    assert.throws(
      () => addToIndex('# nothing', { number: 1, slug: 'a', title: 'A', date: 'd' }),
      /index table/,
    );
  });
});

/**
 * The highest ADR number in the sandbox, which is a copy of the real `docs/adr`: the expected
 * numbers follow the repository instead of being written here, so a new ADR does not break them.
 */
function lastNumber(root) {
  const numbers = readdirSync(join(root, 'docs', 'adr'))
    .map((name) => /^(\d{3})-/.exec(name)?.[1])
    .filter((n) => n !== undefined)
    .map(Number);
  return Math.max(...numbers);
}
const pad = (n) => String(n).padStart(3, '0');

describe('createAdr', () => {
  it('creates docs/adr/NNN-title.md from the template and lists it in the index', () => {
    const root = sandbox();
    const last = lastNumber(root);
    const next = pad(last + 1);
    const before = readdirSync(join(root, 'docs', 'adr')).length;
    const file = createAdr({ root, title: 'Cola offline con IndexedDB', date: '2026-10-31' });

    assert.ok(file.endsWith(`${next}-cola-offline-con-indexeddb.md`), file);
    assert.equal(readdirSync(join(root, 'docs', 'adr')).length, before + 1);
    const body = readFileSync(file, 'utf8');
    assert.ok(body.includes(`# ADR-${next} — Cola offline con IndexedDB\n`));
    const index = readFileSync(join(root, 'docs', 'adr', 'README.md'), 'utf8');
    assert.ok(
      index.includes(
        `| [${next}](${next}-cola-offline-con-indexeddb.md) | Cola offline con IndexedDB | Propuesta | 2026-10-31 |`,
      ),
    );
    assert.ok(index.indexOf(`[${pad(last)}]`) < index.indexOf(`[${next}]`));
  });

  it('numbers consecutive ADRs one after the other', () => {
    const root = sandbox();
    const last = lastNumber(root);
    createAdr({ root, title: 'Uno', date: '2026-10-31' });
    const second = createAdr({ root, title: 'Dos', date: '2026-10-31' });
    assert.ok(second.endsWith(`${pad(last + 2)}-dos.md`), second);
  });

  it('rejects a title with no usable characters', () => {
    assert.throws(
      () => createAdr({ root: sandbox(), title: '¡¿?!', date: '2026-10-31' }),
      /at least one letter/,
    );
  });
});
