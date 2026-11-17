// F1-37 (RF-ACC-04): the single `unitSystem` of a profile becomes one system per section. The old
// value was about distances, so it goes to `units.marks`; the other three take the defaults of a new
// archer (DICCIONARIO §3.6). Only profiles without `units` are touched, so running it again does
// nothing. Same rule as the other migrations: never edit an applied one, add a new file.

const DEFAULTS = { bow: 'imperial', arrows: 'imperial', sight: 'metric' };

/** @param {import('mongodb').Db} db */
export async function up(db) {
  await db.collection('profiles').updateMany({ units: { $exists: false } }, [
    {
      $set: {
        units: {
          marks: { $ifNull: ['$unitSystem', 'metric'] },
          bow: DEFAULTS.bow,
          arrows: DEFAULTS.arrows,
          sight: DEFAULTS.sight,
        },
      },
    },
    { $unset: 'unitSystem' },
  ]);
}

/** Back to one system: the one of the distances, which is what `unitSystem` meant. */
/** @param {import('mongodb').Db} db */
export async function down(db) {
  await db
    .collection('profiles')
    .updateMany({ units: { $exists: true } }, [
      { $set: { unitSystem: '$units.marks' } },
      { $unset: 'units' },
    ]);
}
