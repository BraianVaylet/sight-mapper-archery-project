// PostToolUse hook for Write / Edit / MultiEdit: runs Prettier on the file that was just written,
// so what Claude leaves on disk is what `pnpm format:check` and the pre-commit hook expect.
// It never fails the tool: a formatting problem is reported by lint-staged at commit time.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const FORMATTED = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.css', '.yaml', '.yml']);

export function shouldFormat(file) {
  const normalised = file.replaceAll('\\', '/');
  if (!FORMATTED.has(extname(normalised))) return false;
  // Same ignores as .prettierignore, plus generated and vendored files.
  return !/(^|\/)(node_modules|dist|coverage|\.turbo|\.claude|docs)\//.test(normalised) &&
    !/(^|\/)(pnpm-lock\.yaml|errors\.generated\.ts)$/.test(normalised);
}

/** True when `file` resolves to a place inside `projectDir`: Prettier must not read configs elsewhere. */
export function isInsideProject(file, projectDir) {
  const rel = relative(resolve(projectDir), resolve(projectDir, file));
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

function main(input) {
  const file = input?.tool_input?.file_path;
  const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  if (typeof file !== 'string' || !isInsideProject(file, projectDir)) return;
  const target = resolve(projectDir, file);
  if (!shouldFormat(target) || !existsSync(target)) return;
  let prettier;
  try {
    prettier = createRequire(resolve(projectDir, 'package.json')).resolve('prettier/bin/prettier.cjs');
  } catch {
    return; // dependencies not installed yet
  }
  spawnSync(process.execPath, [prettier, '--write', '--log-level', 'silent', target], {
    cwd: projectDir,
    stdio: 'ignore',
  });
}

async function run() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try {
    main(JSON.parse(raw));
  } catch {
    // ignore: this hook is a convenience
  }
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await run();
