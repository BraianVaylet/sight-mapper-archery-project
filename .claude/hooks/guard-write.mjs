// PreToolUse hook for Write / Edit / MultiEdit (docs/ACTION-PLAN.md F0-03, TECNICO §2).
//
// 1. Blocks a write whose content looks like a secret (exit 2: Claude sees the reason).
// 2. Asks for confirmation before touching the spec or the pure domain, the two places where a
//    careless edit changes what the product promises (`ask` hands the decision to the user).
//
// Input: the hook JSON on stdin. It never prints the matched text, so the secret does not end up
// in a log or in the conversation.
import { pathToFileURL } from 'node:url';

/** Each entry: a label for the message and a pattern that is specific enough to avoid noise. */
export const SECRET_PATTERNS = [
  { label: 'AWS access key id', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { label: 'private key block', pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/ },
  { label: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { label: 'GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { label: 'GitHub fine-grained token', pattern: /\bgithub_pat_[A-Za-z0-9_]{50,}\b/ },
  { label: 'Slack token', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  { label: 'Stripe live key', pattern: /\b[sr]k_live_[0-9A-Za-z]{20,}\b/ },
  { label: 'Resend API key', pattern: /\bre_[A-Za-z0-9]{24,}\b/ },
  {
    label: 'credentials inside a connection string',
    // user:password@host, but not placeholders like <password> or ${PASSWORD} or "user:pass@".
    pattern: /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis|amqp):\/\/[^\s:/@<>${}]+:(?![<${])[^\s@<>${}]{6,}@/,
  },
  {
    label: 'hard-coded secret assignment',
    pattern:
      /\b[A-Za-z_]*(?:SECRET|PASSWORD|API_?KEY|TOKEN|PRIVATE_?KEY)[A-Za-z_]*\s*[:=]\s*['"][A-Za-z0-9+/=_-]{24,}['"]/i,
  },
];

/** Paths that need a human to confirm the edit. */
const CONFIRM = [
  { pattern: /(^|\/)docs\/spec\//, reason: 'The spec is the source of truth: change it on purpose, not as a side effect.' },
  {
    pattern: /(^|\/)packages\/domain\/src\//,
    reason: '@sight-mapper/domain is the product’s core math: a change here changes what the app tells archers.',
  },
];

const normalise = (path) => path.replaceAll('\\', '/');

/** Everything the tool is about to write, as one string. */
export function contentOf(toolInput) {
  const parts = [];
  if (typeof toolInput.content === 'string') parts.push(toolInput.content);
  if (typeof toolInput.new_string === 'string') parts.push(toolInput.new_string);
  if (Array.isArray(toolInput.edits)) {
    for (const edit of toolInput.edits) if (typeof edit?.new_string === 'string') parts.push(edit.new_string);
  }
  return parts.join('\n');
}

export function findSecret(content) {
  for (const { label, pattern } of SECRET_PATTERNS) if (pattern.test(content)) return label;
  return null;
}

/** Returns `{ decision: 'block' | 'ask' | 'allow', message? }`. */
export function decide(input) {
  const toolInput = input?.tool_input ?? {};
  const file = normalise(String(toolInput.file_path ?? ''));

  // No exempt files: not even tests, docs or .env.example may hold a real-looking secret. Tests
  // that need one build it at run time ('AKIA' + '...') so the literal never exists.
  const label = findSecret(contentOf(toolInput));
  if (label !== null) {
    return {
      decision: 'block',
      message: `Blocked: this write contains what looks like a ${label}. Secrets live in Railway and GitHub secrets, never in the repo. Use an environment variable and add its name to .env.example.`,
    };
  }

  const confirm = CONFIRM.find(({ pattern }) => pattern.test(file));
  if (confirm !== undefined) return { decision: 'ask', message: confirm.reason };
  return { decision: 'allow' };
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
