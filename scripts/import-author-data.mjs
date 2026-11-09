#!/usr/bin/env node
// Imports an archer's equipment, setups and marks through the public API (F1-21): every rule of
// the product applies (ownership from the session, validation, idempotency, one mark per
// distance), because this is just another client. One-off, for the author's real data.
//
//   SM_SESSION_COOKIE='better-auth.session_token=…' \
//     node scripts/import-author-data.mjs --file scripts/data/author.json --api https://… [--apply]
//
// Without --apply it only reads and prints what it would do. The cookie is the archer's own,
// copied from their browser after signing in: this script never asks for, stores or prints a
// password or a token.

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const requireFromApi = createRequire(join(root, 'apps', 'api', 'package.json'));

/** The domain does the units, exactly as the app does (ADR-005): nothing converted by hand here. */
async function loadDomain() {
  return import(pathToFileURL(requireFromApi.resolve('@sight-mapper/domain')).href);
}

const KINDS = ['mm', 'cm', 'in', 'click', 'custom'];

/** Checks the data file and returns the problems, one line each (empty when it is fine). */
export function validate(data) {
  const problems = [];
  const need = (cond, message) => {
    if (!cond) problems.push(message);
  };
  need(data !== null && typeof data === 'object', 'the file must be a JSON object');
  if (problems.length > 0) return problems;
  need(['m', 'yd'].includes(data.distanceUnit), 'distanceUnit must be "m" or "yd"');
  for (const list of ['bows', 'sights', 'arrowSets', 'setups']) {
    need(Array.isArray(data[list]) && data[list].length > 0, `${list} must be a non-empty list`);
  }
  if (problems.length > 0) return problems;

  // The example ships with blanks to fill in: importing them would create a bow called COMPLETAR.
  if (JSON.stringify(data).includes('COMPLETAR'))
    problems.push('there are fields still marked COMPLETAR: fill them in');

  const keys = (list) => new Set(list.map((item) => item.key));
  const bowKeys = keys(data.bows);
  const sightKeys = keys(data.sights);
  const arrowKeys = keys(data.arrowSets);
  for (const [list, set] of [
    ['bows', bowKeys],
    ['sights', sightKeys],
    ['arrowSets', arrowKeys],
  ]) {
    need(set.size === data[list].length, `every item of ${list} needs its own "key"`);
  }
  for (const bow of data.bows)
    need(Boolean(bow.model || bow.manufacturer), `bow ${bow.key}: model or manufacturer`);
  for (const sight of data.sights) {
    const s = sight.scale ?? {};
    need(Boolean(sight.model || sight.manufacturer), `sight ${sight.key}: model or manufacturer`);
    need(
      KINDS.includes(s.unit),
      `sight ${sight.key}: scale.unit must be one of ${KINDS.join(', ')}`,
    );
    need(
      typeof s.min === 'number' && typeof s.max === 'number' && s.max > s.min,
      `sight ${sight.key}: scale min < max`,
    );
    need(
      typeof s.resolution === 'number' && s.resolution > 0,
      `sight ${sight.key}: scale.resolution > 0`,
    );
    need(
      ['down', 'up'].includes(s.direction),
      `sight ${sight.key}: scale.direction "down" or "up"`,
    );
  }
  for (const arrows of data.arrowSets) need(Boolean(arrows.name), `arrow set ${arrows.key}: name`);
  for (const setup of data.setups) {
    const label = setup.name ?? `${setup.bow}+${setup.sight}`;
    need(bowKeys.has(setup.bow), `setup ${label}: unknown bow "${setup.bow}"`);
    need(sightKeys.has(setup.sight), `setup ${label}: unknown sight "${setup.sight}"`);
    need(
      Array.isArray(setup.arrowSets) && setup.arrowSets.length > 0,
      `setup ${label}: at least one arrow set`,
    );
    for (const key of setup.arrowSets ?? [])
      need(arrowKeys.has(key), `setup ${label}: unknown arrow set "${key}"`);
    for (const [key, marks] of Object.entries(setup.marks ?? {})) {
      need(
        (setup.arrowSets ?? []).includes(key),
        `setup ${label}: marks for "${key}", which is not in the setup`,
      );
      const distances = new Set();
      for (const mark of marks) {
        const ok =
          Array.isArray(mark) && mark.length === 2 && mark.every((v) => typeof v === 'number');
        need(ok, `setup ${label}, ${key}: each mark is [distance, reading]`);
        if (!ok) continue;
        need(mark[0] > 0, `setup ${label}, ${key}: distance ${mark[0]} must be above 0`);
        need(!distances.has(mark[0]), `setup ${label}, ${key}: distance ${mark[0]} appears twice`);
        distances.add(mark[0]);
      }
    }
  }
  return problems;
}

/**
 * The file in canonical units, as the API takes them: distances in metres, readings as positions
 * on the scale in millimetres. `domain` is `@sight-mapper/domain`.
 */
export function toCanonicalPlan(data, domain) {
  const scaleOf = (sight) => ({ unitSizeMm: null, ...sight.scale });
  const sights = new Map(data.sights.map((s) => [s.key, s]));
  return data.setups.map((setup) => {
    const scale = scaleOf(sights.get(setup.sight));
    const marks = Object.entries(setup.marks ?? {}).map(([arrowKey, list]) => ({
      arrowKey,
      marks: list.map(([distance, reading]) => ({
        distanceM: domain.roundDistanceM(
          data.distanceUnit === 'm' ? distance : domain.toCanonical('distance', distance, 'yd'),
        ),
        scaleValueMm: domain.readingToMm(reading, scale),
        reading,
      })),
    }));
    return { setup, marks };
  });
}

// --- talking to the API ---------------------------------------------------------------------

function client(api, cookie, uuid) {
  const call = async (method, path, body, headers = {}) => {
    const response = await fetch(`${api}/api/v1${path}`, {
      method,
      headers: {
        accept: 'application/json',
        cookie,
        // Same origin as the app, as the browser would send it.
        origin: api,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(method === 'POST' ? { 'idempotency-key': uuid() } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    const json = text === '' ? null : JSON.parse(text);
    return { status: response.status, json };
  };
  const all = async (path) => {
    const items = [];
    let cursor;
    for (;;) {
      const query = new URLSearchParams({ limit: '100', ...(cursor ? { cursor } : {}) });
      const page = await call('GET', `${path}?${query}`);
      if (page.status !== 200)
        throw new Error(`GET ${path}: ${page.status} ${page.json?.error?.code ?? ''}`);
      items.push(...page.json.items);
      if (!page.json.nextCursor) return items;
      cursor = page.json.nextCursor;
    }
  };
  return { call, all };
}

/** What the API takes: the item without the `key` the file uses to link things together. */
const withoutKey = (item) =>
  Object.fromEntries(Object.entries(item).filter(([name]) => name !== 'key'));

const same = (a, b) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

/** Runs the import. Returns what it did, or would do with `apply: false`. */
export async function runImport({
  data,
  api,
  cookie,
  apply,
  replace = false,
  log = () => undefined,
}) {
  const domain = await loadDomain();
  const { v7: uuid } = requireFromApi('uuid');
  const { call, all } = client(api.replace(/\/$/, ''), cookie, uuid);
  const report = { created: [], reused: [], skipped: [], conflicts: [] };
  const write = async (what, method, path, body, headers) => {
    if (!apply) {
      report.created.push(`${what} (dry run)`);
      return { status: 201, json: { id: `dry-${report.created.length}`, ...body } };
    }
    const answer = await call(method, path, body, headers);
    if (answer.status >= 400) {
      throw new Error(
        `${method} ${path} for ${what}: ${answer.status} ${answer.json?.error?.code ?? ''}`,
      );
    }
    report.created.push(what);
    return answer;
  };

  const me = await call('GET', '/me');
  if (me.status !== 200)
    throw new Error(
      `the session is not valid here (${me.status}): sign in and copy the cookie again`,
    );
  log(`signed in; units of the profile: ${me.json.unitSystem}`);

  const [bows, sights, arrowSets, setups] = await Promise.all([
    all('/bows'),
    all('/sights'),
    all('/arrow-sets'),
    all('/setups'),
  ]);

  const ids = { bow: new Map(), sight: new Map(), arrows: new Map() };
  for (const bow of data.bows) {
    const found = bows.find(
      (b) => same(b.manufacturer, bow.manufacturer) && same(b.model, bow.model),
    );
    if (found) {
      ids.bow.set(bow.key, found.id);
      report.reused.push(`bow ${bow.manufacturer ?? ''} ${bow.model ?? ''}`.trim());
      continue;
    }
    const id = uuid();
    const body = withoutKey(bow);
    await write(`bow ${bow.model ?? bow.manufacturer}`, 'POST', '/bows', {
      id,
      bowType: 'compound',
      ...body,
    });
    ids.bow.set(bow.key, id);
  }
  for (const sight of data.sights) {
    const found = sights.find(
      (s) => same(s.manufacturer, sight.manufacturer) && same(s.model, sight.model),
    );
    if (found) {
      ids.sight.set(sight.key, found.id);
      report.reused.push(`sight ${sight.model ?? sight.manufacturer}`);
      continue;
    }
    const id = uuid();
    const body = withoutKey(sight);
    await write(`sight ${sight.model ?? sight.manufacturer}`, 'POST', '/sights', { id, ...body });
    ids.sight.set(sight.key, id);
  }
  for (const arrows of data.arrowSets) {
    const found = arrowSets.find((a) => same(a.name, arrows.name));
    if (found) {
      ids.arrows.set(arrows.key, found.id);
      report.reused.push(`arrow set ${arrows.name}`);
      continue;
    }
    const id = uuid();
    const body = withoutKey(arrows);
    await write(`arrow set ${arrows.name}`, 'POST', '/arrow-sets', { id, ...body });
    ids.arrows.set(arrows.key, id);
  }

  for (const { setup, marks } of toCanonicalPlan(data, domain)) {
    const bowId = ids.bow.get(setup.bow);
    const sightId = ids.sight.get(setup.sight);
    const wanted = setup.arrowSets.map((key) => ids.arrows.get(key));
    let current = setups.find((s) => s.bowId === bowId && s.sightId === sightId);
    let setupId;
    if (current) {
      setupId = current.id;
      report.reused.push(`setup ${current.name ?? setup.name ?? ''}`.trim());
      const missing = wanted.filter((id) => !current.arrowSetIds.includes(id));
      if (missing.length > 0) {
        await write(
          `arrow sets added to setup ${setup.name ?? ''}`.trim(),
          'PATCH',
          `/setups/${setupId}`,
          { arrowSetIds: [...current.arrowSetIds, ...missing] },
          { 'if-match': `"${current.version}"` },
        );
      }
    } else {
      setupId = uuid();
      await write(`setup ${setup.name ?? ''}`.trim(), 'POST', '/setups', {
        id: setupId,
        bowId,
        sightId,
        arrowSetIds: wanted,
        isFavorite: false,
        ...(setup.name ? { name: setup.name } : {}),
      });
    }

    for (const { arrowKey, marks: list } of marks) {
      const arrowSetId = ids.arrows.get(arrowKey);
      const existing =
        apply || current
          ? ((await call('GET', `/setups/${setupId}/marks?arrowSetId=${arrowSetId}`)).json?.items ??
            [])
          : [];
      for (const mark of list) {
        const there = existing.find((m) => Math.abs(m.distanceM - mark.distanceM) < 0.001);
        const label = `${mark.distanceM} m → ${mark.reading} (${arrowKey})`;
        if (there && Math.abs(there.scaleValueMm - mark.scaleValueMm) < 1e-6) {
          report.skipped.push(`${label}: already there`);
          continue;
        }
        if (there && !replace) {
          report.conflicts.push(
            `${label}: the app has a different reading there; --replace to overwrite`,
          );
          continue;
        }
        await write(`mark ${label}`, 'POST', '/marks', {
          id: uuid(),
          setupId,
          arrowSetId,
          distanceM: mark.distanceM,
          scaleValueMm: mark.scaleValueMm,
          replace: Boolean(there),
          ...(setup.note ? { note: setup.note } : {}),
        });
      }
    }
  }
  return report;
}

// --- command line -----------------------------------------------------------------------------

async function main(argv) {
  const arg = (name) => {
    const at = argv.indexOf(name);
    return at === -1 ? undefined : argv[at + 1];
  };
  const file = arg('--file');
  const api = arg('--api');
  const cookie = process.env.SM_SESSION_COOKIE;
  if (!file || !api || !cookie) {
    process.stderr.write(
      'usage: SM_SESSION_COOKIE=… node scripts/import-author-data.mjs --file <data.json> --api <url> [--apply] [--replace]\n',
    );
    return 2;
  }
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const problems = validate(data);
  if (problems.length > 0) {
    process.stderr.write(`the data file has problems:\n- ${problems.join('\n- ')}\n`);
    return 1;
  }
  const apply = argv.includes('--apply');
  const report = await runImport({
    data,
    api,
    cookie,
    apply,
    replace: argv.includes('--replace'),
    log: (line) => process.stdout.write(`${line}\n`),
  });
  const section = (title, list) =>
    list.length === 0 ? '' : `${title} (${list.length}):\n  ${list.join('\n  ')}\n`;
  process.stdout.write(
    `${apply ? 'Done.' : 'Dry run: nothing was written. Add --apply to do it.'}\n` +
      section('created', report.created) +
      section('already there', [...report.reused, ...report.skipped]) +
      section('conflicts, left as they are', report.conflicts),
  );
  return report.conflicts.length > 0 ? 3 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  // exitCode, not exit(): on Windows, exiting while fetch is still closing its sockets crashes Node.
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
