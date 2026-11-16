import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { toCanonicalPlan, validate } from './import-author-data.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const requireFromApi = createRequire(join(root, 'apps', 'api', 'package.json'));
const domain = await import(pathToFileURL(requireFromApi.resolve('@sight-mapper/domain')).href);

const example = JSON.parse(
  readFileSync(join(root, 'scripts', 'data', 'author-sets.example.json'), 'utf8'),
);
/** The example with its blanks filled in, as the author would. */
const filled = () => {
  const data = structuredClone(example);
  data.bows[0].manufacturer = 'PSE';
  data.bows[0].model = 'Evo NXT 35';
  return data;
};

describe('the data file of the import (F1-21)', () => {
  it('accepts the example once its blanks are filled in', () => {
    assert.deepEqual(validate(filled()), []);
  });

  it('refuses the example as it ships: the bow is still to fill in', () => {
    assert.match(validate(example).join('\n'), /COMPLETAR/);
  });

  it('names what is wrong: unknown keys, a repeated distance, a bad scale', () => {
    const data = filled();
    data.setups[0].arrowSets.push('nope');
    data.setups[0].marks.hunter.push([30, 0.9]);
    data.sights[0].scale.max = -1;
    const problems = validate(data).join('\n');
    assert.match(problems, /unknown arrow set "nope"/);
    assert.match(problems, /distance 30 appears twice/);
    assert.match(problems, /scale min < max/);
  });

  it('refuses marks for an arrow set that is not in the setup', () => {
    const data = filled();
    data.setups[0].arrowSets = ['hunter'];
    assert.match(validate(data).join('\n'), /marks for "pierce", which is not in the setup/);
  });
});

describe('canonical units for the API (ADR-005)', () => {
  it('sends metres and millimetres: 1.6 cm on the sight is a position of 16 mm', () => {
    const [plan] = toCanonicalPlan(filled(), domain);
    const hunter = plan.marks.find((m) => m.arrowKey === 'hunter');
    assert.deepEqual(
      hunter.marks.map((m) => [m.distanceM, m.scaleValueMm]),
      [
        [20, 3],
        [30, 8],
        [40, 16],
        [50, 26],
        [60, 36],
      ],
    );
  });

  it('turns yards into metres, rounded to the millimetre: 50 yd is 45.72 m', () => {
    const data = filled();
    data.distanceUnit = 'yd';
    const [plan] = toCanonicalPlan(data, domain);
    assert.equal(plan.marks[0].marks[3].distanceM, 45.72);
  });
});
