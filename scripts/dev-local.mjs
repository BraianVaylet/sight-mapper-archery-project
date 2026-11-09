// Try the whole product on your machine: `pnpm dev:local`.
//
// Starts a throwaway MongoDB replica set (the mongod already cached for the tests: nothing is
// downloaded), applies the migrations, runs the API on :3000 and the PWA on :5173. Emails are not
// sent: the verification and reset links are printed here, because that is where you need them.
// Everything, data included, disappears when you stop it with Ctrl+C.
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const API_PORT = 3000;
const PWA_PORT = 5173;
const DB_NAME = 'sightmapper_dev';

const say = (message) => process.stdout.write(`${message}\n`);

function build() {
  say('Building the packages the apps need...');
  const result = spawnSync(
    'pnpm turbo run build --filter=@sight-mapper/api... --filter=@sight-mapper/pwa^... --output-logs=errors-only',
    { cwd: root, stdio: 'inherit', shell: true },
  );
  if (result.status !== 0) {
    say('The build failed: fix it first.');
    process.exit(result.status ?? 1);
  }
}

/** The mongod of the tests: a one-node replica set, like Atlas (transactions need it). */
async function startMongo() {
  const requireFromApi = createRequire(join(root, 'apps', 'api', 'package.json'));
  const { MongoMemoryReplSet } = requireFromApi('mongodb-memory-server');
  say('Starting a temporary MongoDB...');
  return MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    binary: { version: process.env.MONGOMS_VERSION ?? '7.0.24' },
  });
}

/** Prints what the archer needs from the API log: the emails' links, problems, and readiness. */
function relay(line) {
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    if (line.trim() !== '') say(`[api] ${line}`);
    return;
  }
  if (entry.msg === 'email (not sent)') {
    const link = /https?:\/\/\S+/.exec(String(entry.text ?? ''))?.[0];
    // The end-to-end tests read the link from here instead of from the console.
    const mailFile = process.env.SM_DEV_MAIL_FILE;
    if (mailFile !== undefined && mailFile !== '') {
      mkdirSync(dirname(mailFile), { recursive: true });
      appendFileSync(
        mailFile,
        `${JSON.stringify({ to: entry.to, subject: entry.subject, link })}\n`,
      );
    }
    say(`\n  email to ${entry.to}: ${entry.subject}\n  open this link: ${link ?? '(no link)'}\n`);
  } else if (entry.msg === 'api listening') {
    say(`[api] listening on http://localhost:${entry.port}`);
  } else if (entry.level >= 40) {
    say(`[api] ${entry.msg}`);
  }
}

function forwardLines(stream, onLine) {
  let pending = '';
  stream.on('data', (chunk) => {
    pending += chunk.toString();
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';
    lines.forEach(onLine);
  });
}

/** `kill()` alone leaves grandchildren running on Windows: take the whole tree down. */
function killTree(child) {
  if (child.pid === undefined) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill();
  }
}

async function main() {
  build();
  const mongo = await startMongo();
  const env = {
    ...process.env,
    NODE_ENV: 'production', // plain JSON logs: the relay reads them
    APP_ENV: 'local',
    PORT: String(API_PORT),
    MONGODB_URI: mongo.getUri(DB_NAME),
    // Fresh and never printed or stored: sessions from a previous run are gone with the data.
    BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
    BETTER_AUTH_URL: `http://localhost:${API_PORT}`,
    CORS_ORIGINS: `http://localhost:${PWA_PORT}`,
    LOG_LEVEL: 'info',
  };

  say('Applying migrations...');
  // Not spawnSync: the mongod is a child of this process and logs into a pipe that only this event
  // loop drains. Blocked, the pipe fills (64 KB on Linux), mongod stalls and so do the migrations.
  const migrated = await new Promise((resolve) => {
    const migrate = spawn('pnpm --filter @sight-mapper/api migrate', {
      cwd: root,
      env,
      stdio: 'inherit',
      shell: true,
    });
    migrate.on('exit', (code) => resolve(code ?? 1));
    migrate.on('error', () => resolve(1));
  });
  if (migrated !== 0) {
    await mongo.stop();
    process.exit(migrated);
  }

  const children = [];
  const api = spawn(process.execPath, [join(root, 'apps', 'api', 'dist', 'main.js')], {
    cwd: join(root, 'apps', 'api'),
    env,
  });
  forwardLines(api.stdout, relay);
  forwardLines(api.stderr, (line) => line.trim() !== '' && say(`[api] ${line}`));
  children.push(api);

  const requireFromPwa = createRequire(join(root, 'apps', 'pwa', 'package.json'));
  const viteBin = join(dirname(requireFromPwa.resolve('vite/package.json')), 'bin', 'vite.js');
  const pwa = spawn(process.execPath, [viteBin, '--port', String(PWA_PORT), '--strictPort'], {
    cwd: join(root, 'apps', 'pwa'),
    // Vite reads NODE_ENV: production would hide dev-only screens and minify.
    env: { ...env, NODE_ENV: 'development', VITE_API_URL: `http://localhost:${API_PORT}` },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  children.push(pwa);

  say(`\nOpen http://localhost:${PWA_PORT}  (Ctrl+C stops everything and drops the data)\n`);

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    say('\nStopping...');
    for (const child of children) killTree(child);
    await mongo.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  // If either app dies the session is useless: say so and clean up.
  for (const child of children) child.on('exit', (code) => code !== null && code !== 0 && stop());
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
