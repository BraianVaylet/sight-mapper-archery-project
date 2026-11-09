// Creates docs/adr/NNN-slug.md from the template and adds it to the index (`/adr "title"`).
// Usage: node scripts/new-adr.mjs "Decision title" [--date YYYY-MM-DD]
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** `Método de pago` -> `metodo-de-pago`: lowercase ASCII, words joined by single dashes. */
export function slugify(title) {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Next free number: one above the highest `NNN-*.md` already in the directory. */
export function nextNumber(fileNames) {
  const numbers = fileNames
    .map((name) => /^(\d{3})-.+\.md$/.exec(name))
    .filter((match) => match !== null)
    .map((match) => Number(match[1]));
  return (numbers.length === 0 ? -1 : Math.max(...numbers)) + 1;
}

export function renderAdr(template, { number, title, date }) {
  const id = String(number).padStart(3, '0');
  return template
    .replace('# ADR-NNN — <Titulo en forma de decision>', `# ADR-${id} — ${title}`)
    .replace(
      '- **Estado:** Propuesta | Aceptada | Reemplazada por ADR-xxx | Deprecada',
      '- **Estado:** Propuesta',
    )
    .replace('- **Fecha:** YYYY-MM-DD', `- **Fecha:** ${date}`);
}

/** Appends the ADR as the last row of the index table. */
export function addToIndex(readme, { number, slug, title, date }) {
  const id = String(number).padStart(3, '0');
  const row = `| [${id}](${id}-${slug}.md) | ${title} | Propuesta | ${date} |`;
  const lines = readme.split('\n');
  let last = -1;
  lines.forEach((line, i) => {
    if (/^\| \[\d{3}\]\(/.test(line)) last = i;
  });
  if (last === -1) throw new Error('ADR index table not found in docs/adr/README.md');
  lines.splice(last + 1, 0, row);
  return lines.join('\n');
}

export function createAdr({ root = ROOT, title, date }) {
  const trimmed = title.trim();
  const slug = slugify(trimmed);
  if (slug === '') throw new Error('The title needs at least one letter or number');

  const dir = join(root, 'docs', 'adr');
  const number = nextNumber(readdirSync(dir));
  const file = join(dir, `${String(number).padStart(3, '0')}-${slug}.md`);
  if (existsSync(file)) throw new Error(`${file} already exists`);

  const template = readFileSync(join(dir, 'TEMPLATE.md'), 'utf8');
  writeFileSync(file, renderAdr(template, { number, title: trimmed, date }));

  const readmePath = join(dir, 'README.md');
  writeFileSync(
    readmePath,
    addToIndex(readFileSync(readmePath, 'utf8'), { number, slug, title: trimmed, date }),
  );
  return file;
}

function main(argv) {
  const dateIndex = argv.indexOf('--date');
  const date =
    dateIndex === -1
      ? new Intl.DateTimeFormat('en-CA').format(Date.now())
      : (argv[dateIndex + 1] ?? '');
  const title = argv.filter((arg, i) => !arg.startsWith('--') && i !== dateIndex + 1).join(' ');
  if (title.trim() === '') {
    process.stderr.write('Usage: node scripts/new-adr.mjs "Decision title" [--date YYYY-MM-DD]\n');
    process.exit(1);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    process.stderr.write(`Invalid date: ${date}\n`);
    process.exit(1);
  }
  process.stdout.write(`${createAdr({ title, date })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main(process.argv.slice(2));
