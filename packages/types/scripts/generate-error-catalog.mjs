import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseErrorsMarkdown, renderCatalog } from './error-catalog.mjs';

const source = fileURLToPath(new URL('../../../docs/errors.md', import.meta.url));
const target = fileURLToPath(new URL('../src/errors.generated.ts', import.meta.url));

const entries = parseErrorsMarkdown(readFileSync(source, 'utf8'));
writeFileSync(target, renderCatalog(entries));
process.stdout.write(`Wrote ${entries.length} error codes to src/errors.generated.ts\n`);
