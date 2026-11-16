// Pre-commit: refuses a commit that adds a secret-shaped line, whatever tool wrote it.
// This is the boundary that matters. The editor hook in .claude/ is a convenience: a shell
// command, an IDE or a paste can all write a file without passing through it. Everything that
// is committed passes here, and again through gitleaks in CI.
//
// It reads `git diff --cached` (the added lines only, so an old line is not flagged again) and
// reports file and line, never the text, so the secret does not land in a terminal or a log.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { secretsIn } from '../.claude/hooks/guard-write.mjs';

/** Findings in a unified diff: `{ file, line, label }` for each added line with a secret. */
export function scanDiff(diff) {
  const findings = [];
  let file = '';
  let line = 0;
  for (const text of diff.split('\n')) {
    if (text.startsWith('+++ ')) {
      file = text.slice(4).replace(/^b\//, '');
    } else if (text.startsWith('@@')) {
      line = Number(/\+(\d+)/.exec(text)?.[1] ?? 0) - 1;
    } else if (text.startsWith('+')) {
      line += 1;
      for (const { label } of secretsIn(text.slice(1))) findings.push({ file, line, label });
    } else if (!text.startsWith('-') && !text.startsWith('\\')) {
      line += 1;
    }
  }
  return findings;
}

function main() {
  const diff = execFileSync(
    'git',
    ['diff', '--cached', '--no-color', '-U0', '--diff-filter=ACMR'],
    {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    },
  );
  const findings = scanDiff(diff);
  if (findings.length === 0) return;

  process.stderr.write('Commit blocked: staged changes contain what look like secrets.\n');
  for (const { file, line, label } of findings) {
    process.stderr.write(`  ${file}:${line}  ${label}\n`);
  }
  process.stderr.write(
    'Move the value to an environment variable (Railway / GitHub secrets) and, if it was ever pushed, rotate it.\n',
  );
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
