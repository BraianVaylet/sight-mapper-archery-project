#!/usr/bin/env node
// The MVP metrics of the spec (§2), aggregated from the database (F1-22): counts and rates only,
// never an id, an email or a mark. No third-party tracking: what the product already stores is
// enough. Read-only.
//
//   MONGODB_URI='mongodb+srv://…' node scripts/metrics.mjs [--since 2026-11-01] [--json]

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVATION_DAYS = 7;
const DOCTOR_MARKS = 5;

const rate = (part, whole) => (whole === 0 ? null : Math.round((part / whole) * 1000) / 10);

/**
 * The metrics from plain rows (`Date` instants). Pure, so it is tested without a database.
 *
 * - **Activation** (meta ≥ 50%): archers who, within 7 days of signing up, have a setup and 2
 *   measured marks. Only archers who signed up at least 7 days ago count: the others have not had
 *   their 7 days yet.
 * - **Doctor reach** (meta ≥ 30%): live setups where some arrow set has 5 live measured marks.
 * - **Re-measured marks** (no target): live measured marks whose reading was changed after they
 *   were first saved. What the Doctor pointed at is never stored (ADR-001), so this is the closest
 *   the database can tell: a correction, whatever prompted it.
 */
export function computeMetrics({ profiles, setups, marks, now, since }) {
  const cohort = profiles.filter(
    (p) =>
      now.getTime() - p.createdAt.getTime() >= ACTIVATION_DAYS * DAY_MS &&
      (since === undefined || p.createdAt.getTime() >= since.getTime()),
  );
  const within = (row, profile) =>
    row.createdAt.getTime() - profile.createdAt.getTime() <= ACTIVATION_DAYS * DAY_MS;
  const byUser = (rows) => {
    const map = new Map();
    for (const row of rows) map.set(row.userId, [...(map.get(row.userId) ?? []), row]);
    return map;
  };
  const measured = marks.filter((m) => m.origin === 'measured');
  const setupsOf = byUser(setups);
  const marksOf = byUser(measured);
  const activated = cohort.filter((p) => {
    const hasSetup = (setupsOf.get(p.userId) ?? []).some((s) => within(s, p));
    const early = (marksOf.get(p.userId) ?? []).filter((m) => within(m, p));
    return hasSetup && early.length >= 2;
  });

  const liveSetups = setups.filter((s) => s.deletedAt === null);
  const liveMarks = measured.filter((m) => m.deletedAt === null);
  const counts = new Map();
  for (const m of liveMarks) {
    const key = `${m.setupId}|${m.arrowSetId}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const doctorReady = liveSetups.filter((s) =>
    [...counts.entries()].some(([key, n]) => key.startsWith(`${s.id}|`) && n >= DOCTOR_MARKS),
  );
  const corrected = liveMarks.filter((m) => m.version > 1);

  return {
    generatedAt: now.toISOString(),
    since: since === undefined ? null : since.toISOString(),
    activation: {
      cohort: cohort.length,
      activated: activated.length,
      ratePct: rate(activated.length, cohort.length),
      targetPct: 50,
    },
    doctorReach: {
      setups: liveSetups.length,
      withFiveMarks: doctorReady.length,
      ratePct: rate(doctorReady.length, liveSetups.length),
      targetPct: 30,
    },
    remeasured: {
      marks: liveMarks.length,
      corrected: corrected.length,
      ratePct: rate(corrected.length, liveMarks.length),
    },
  };
}

/** Reads only the fields the metrics need, from every archer (it is a cross-archer report). */
export async function readRows(uri) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const { MongoClient } = createRequire(join(root, 'apps', 'api', 'package.json'))('mongodb');
  const client = new MongoClient(uri, { readPreference: 'secondaryPreferred' });
  await client.connect();
  try {
    const db = client.db();
    const rows = (name, projection) => db.collection(name).find({}, { projection }).toArray();
    const [profiles, setups, marks] = await Promise.all([
      rows('profiles', { _id: 0, userId: 1, createdAt: 1 }),
      rows('setups', { _id: 1, userId: 1, createdAt: 1, deletedAt: 1 }),
      rows('marks', {
        _id: 0,
        userId: 1,
        setupId: 1,
        arrowSetId: 1,
        origin: 1,
        version: 1,
        createdAt: 1,
        deletedAt: 1,
      }),
    ]);
    return {
      profiles,
      setups: setups.map(({ _id, ...rest }) => ({
        id: _id,
        ...rest,
        deletedAt: rest.deletedAt ?? null,
      })),
      marks: marks.map((m) => ({ ...m, deletedAt: m.deletedAt ?? null })),
    };
  } finally {
    await client.close();
  }
}

function summary(m) {
  const pct = (value) => (value === null ? '—' : `${String(value).replace('.', ',')} %`);
  return [
    `Metricas del MVP (spec §2) — ${m.generatedAt}${m.since ? `, altas desde ${m.since.slice(0, 10)}` : ''}`,
    `- Activacion a 7 dias (setup + 2 marcas): ${m.activation.activated}/${m.activation.cohort} = ${pct(m.activation.ratePct)} (meta ≥ ${m.activation.targetPct} %)`,
    `- Setups con 5 marcas (Doctor): ${m.doctorReach.withFiveMarks}/${m.doctorReach.setups} = ${pct(m.doctorReach.ratePct)} (meta ≥ ${m.doctorReach.targetPct} %)`,
    `- Marcas re-medidas (aproximacion): ${m.remeasured.corrected}/${m.remeasured.marks} = ${pct(m.remeasured.ratePct)} (sin meta)`,
    '- Tiempo de abrir a ver la marca (< 3 s en 4G): se mide en el campo, no sale de la base.',
  ].join('\n');
}

async function main(argv) {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    process.stderr.write(
      'usage: MONGODB_URI=… node scripts/metrics.mjs [--since YYYY-MM-DD] [--json]\n',
    );
    return 2;
  }
  const at = argv.indexOf('--since');
  const since = at === -1 ? undefined : new Date(`${argv[at + 1]}T00:00:00Z`);
  if (since !== undefined && Number.isNaN(since.getTime())) {
    process.stderr.write('--since takes a date: YYYY-MM-DD\n');
    return 2;
  }
  const metrics = computeMetrics({ ...(await readRows(uri)), now: new Date(), since });
  process.stdout.write(
    `${argv.includes('--json') ? JSON.stringify(metrics, null, 2) : summary(metrics)}\n`,
  );
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  // exitCode, not exit(): on Windows, exiting while the driver closes its sockets crashes Node.
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    },
  );
}
