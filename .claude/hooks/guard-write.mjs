// PreToolUse hook for Write / Edit / MultiEdit (docs/ACTION-PLAN.md F0-03, TECNICO §2).
//
// 1. Blocks a write that would leave a secret-shaped string in the file (exit 2: Claude sees why).
// 2. Asks for confirmation before touching the spec or the pure domain, the two places where a
//    careless edit changes what the product promises (`ask` hands the decision to the user).
//
// This is a convenience for the editor tools, not the security boundary: a shell command can
// write a file without passing here. The boundary is `scripts/scan-staged-secrets.mjs` in the
// pre-commit hook and gitleaks in CI, which see what is actually committed.
//
// Input: the hook JSON on stdin. It never prints the matched text, so a secret does not end up
// in a log or in the conversation.
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Each entry: a label for the message and a pattern that is specific enough to avoid noise. */
export const SECRET_PATTERNS = [
  { label: 'AWS access key id', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  {
    label: 'private key block',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/g,
  },
  { label: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { label: 'GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { label: 'GitHub fine-grained token', pattern: /\bgithub_pat_[A-Za-z0-9_]{50,}\b/g },
  { label: 'Slack token', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g },
  { label: 'Stripe live key', pattern: /\b[sr]k_live_[0-9A-Za-z]{20,}\b/g },
  { label: 'Resend API key', pattern: /\bre_[A-Za-z0-9]{24,}\b/g },
  {
    label: 'credentials inside a connection string',
    // user:password@host, but not placeholders like <password> or ${PASSWORD} or "user:pass@".
    pattern:
      /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis|amqp):\/\/[^\s:/@<>${}]+:(?![<${])[^\s@<>${}]{6,}@/g,
  },
  {
    label: 'hard-coded secret assignment',
    pattern:
      /\b[A-Za-z_]*(?:SECRET|PASSWORD|API_?KEY|TOKEN|PRIVATE_?KEY)[A-Za-z_]*\s*[:=]\s*['"][A-Za-z0-9+/=_-]{24,}['"]/gi,
  },
];

/** Paths that need a human to confirm the edit, as lowercase project-relative prefixes. */
const CONFIRM = [
  {
    prefix: 'docs/spec/',
    reason: 'The spec is the source of truth: change it on purpose, not as a side effect.',
  },
  {
    prefix: 'packages/domain/src/',
    reason:
      '@sight-mapper/domain is the product’s core math: a change here changes what the app tells archers.',
  },
];

/** Every secret-shaped match in `content`: `{ label, text }`. `text` is for comparing, never for printing. */
export function secretsIn(content) {
  const found = [];
  for (const { label, pattern } of SECRET_PATTERNS) {
    for (const match of content.matchAll(new RegExp(pattern.source, pattern.flags))) {
      found.push({ label, text: match[0] });
    }
  }
  return found;
}

export function findSecret(content) {
  return secretsIn(content)[0]?.label ?? null;
}

/** Everything the tool is about to write, fragment by fragment. */
export function fragmentsOf(toolInput) {
  const parts = [];
  if (typeof toolInput.content === 'string') parts.push(toolInput.content);
  if (typeof toolInput.new_string === 'string') parts.push(toolInput.new_string);
  if (Array.isArray(toolInput.edits)) {
    for (const edit of toolInput.edits) {
      if (typeof edit?.new_string === 'string') parts.push(edit.new_string);
    }
  }
  return parts;
}

export function contentOf(toolInput) {
  return fragmentsOf(toolInput).join('\n');
}

function applyEdit(text, edit) {
  if (typeof edit?.old_string !== 'string' || typeof edit?.new_string !== 'string') return text;
  if (edit.replace_all === true) return text.split(edit.old_string).join(edit.new_string);
  const at = text.indexOf(edit.old_string);
  return at === -1
    ? text
    : text.slice(0, at) + edit.new_string + text.slice(at + edit.old_string.length);
}

/**
 * The file as it will be after the tool runs. A secret split across two edits (`AKIA` now, the
 * rest next) only exists in this state, never in a single fragment.
 */
export function afterState(toolInput, before) {
  if (typeof toolInput.content === 'string') return toolInput.content;
  if (Array.isArray(toolInput.edits)) return toolInput.edits.reduce(applyEdit, before);
  return applyEdit(before, toolInput);
}

/**
 * `file` resolved against the project, as lowercase `/`-separated, or `null` when it is outside
 * the project. Handles `..`, absolute paths, backslashes and case (Windows is case-insensitive).
 */
export function projectRelative(file, projectDir) {
  const rel = relative(resolve(projectDir), resolve(projectDir, file));
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return null;
  return rel.split(sep).join('/').toLowerCase();
}

/** Returns `{ decision: 'block' | 'ask' | 'allow', message? }`. */
export function decide(input, projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()) {
  const toolInput = input?.tool_input ?? {};
  const file = String(toolInput.file_path ?? '');

  // No exempt files: not even tests, docs or .env.example may hold a real-looking secret. Tests
  // that need one build it at run time ('AKIA' + '...') so the literal never exists.
  const absolute = file === '' ? '' : resolve(projectDir, file);
  const before = absolute !== '' && existsSync(absolute) ? safeRead(absolute) : '';
  const known = new Set(secretsIn(before).map((s) => s.text));
  const added = [
    ...secretsIn(afterState(toolInput, before)),
    // Fragments alone, and glued end to end: a secret can be cut across two of them.
    ...secretsIn(fragmentsOf(toolInput).join('\n')),
    ...secretsIn(fragmentsOf(toolInput).join('')),
  ].find((s) => !known.has(s.text));
  if (added !== undefined) {
    return {
      decision: 'block',
      message: `Blocked: this write would leave what looks like a ${added.label} in the file. Secrets live in Railway and GitHub secrets, never in the repo. Use an environment variable and add its name to .env.example.`,
    };
  }

  const relativePath = file === '' ? null : projectRelative(file, projectDir);
  const confirm = CONFIRM.find(({ prefix }) => relativePath?.startsWith(prefix));
  if (confirm !== undefined) return { decision: 'ask', message: confirm.reason };
  return { decision: 'allow' };
}

function safeRead(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0); // not our input: never block on a hook that cannot read its own payload
  }

  const result = decide(input);
  if (result.decision === 'block') {
    process.stderr.write(`${result.message}\n`);
    process.exit(2);
  }
  if (result.decision === 'ask') {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason: result.message,
        },
      }),
    );
  }
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
