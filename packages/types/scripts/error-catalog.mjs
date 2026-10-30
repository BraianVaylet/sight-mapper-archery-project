// Parses docs/errors.md into the typed error catalog (errors.md §4, ADR-010).
// Plain .mjs with a .d.mts so both the CLI and the drift test can import it.

const ROW = /^\|\s*`(SM-[A-Z]+-\d{3}-\d{3})`/;
const CODE = /^SM-([A-Z]+)-(\d{3})-(\d{3})$/;

/** @param {string} cell */
const strip = (cell) => cell.replace(/`/g, '').trim();

/** @param {string} line */
const cellsOf = (line) =>
  line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());

/**
 * @param {string} markdown
 * @returns {{ code: string, module: string, status: number, messageKey: string, params: string[] }[]}
 */
export function parseErrorsMarkdown(markdown) {
  const entries = [];
  const seen = new Set();
  let header = [];

  for (const line of markdown.split(/\r?\n/)) {
    if (!line.startsWith('|')) continue;
    const row = ROW.exec(line);
    if (row === null) {
      const cells = cellsOf(line).map((c) => c.toLowerCase());
      if (cells.length > 0 && !cells.every((c) => /^:?-+:?$/.test(c))) header = cells;
      continue;
    }

    const cells = cellsOf(line);
    const code = strip(cells[0] ?? '');
    const parts = CODE.exec(code);
    if (parts === null) throw new Error(`Malformed error code: ${code}`);
    if (seen.has(code)) throw new Error(`Duplicate error code: ${code}`);
    seen.add(code);

    const status = Number(parts[2]);
    const httpIndex = header.indexOf('http');
    if (httpIndex !== -1 && Number(strip(cells[httpIndex] ?? '')) !== status) {
      throw new Error(`${code}: HTTP column does not match the code`);
    }

    const keyIndex = cells.findIndex((c) => /^`errors\.[\w.]+`$/.test(c));
    if (keyIndex === -1) throw new Error(`${code}: missing messageKey`);

    const paramsIndex = header.indexOf('params');
    const paramsCell = paramsIndex === -1 ? '' : (cells[paramsIndex] ?? '');
    const params = [];
    for (const match of paramsCell.matchAll(/`([A-Za-z]\w*)(?:\[\])?(?::[^`]*)?`/g)) {
      const name = match[1];
      if (name !== undefined && !params.includes(name)) params.push(name);
    }

    entries.push({
      code,
      module: parts[1] ?? '',
      status,
      messageKey: strip(cells[keyIndex] ?? ''),
      params,
    });
  }

  if (entries.length === 0) throw new Error('No error codes found');
  return entries;
}

/** @param {ReturnType<typeof parseErrorsMarkdown>} entries */
export function renderCatalog(entries) {
  const lines = entries.map((e) => {
    const params = e.params.map((p) => `'${p}'`).join(', ');
    return [
      `  '${e.code}': {`,
      `    module: '${e.module}',`,
      `    status: ${e.status},`,
      `    messageKey: '${e.messageKey}',`,
      `    params: [${params}],`,
      '  },',
    ].join('\n');
  });

  return [
    '// Generated from docs/errors.md by scripts/generate-error-catalog.mjs. Do not edit by hand:',
    '// declare the code in errors.md and run `pnpm --filter @sight-mapper/types generate`.',
    '',
    'export const ERROR_CATALOG = {',
    ...lines,
    '} as const;',
    '',
  ].join('\n');
}
