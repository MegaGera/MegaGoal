import { getDB } from '../config/db.js';

/**
 * Global count of users who marked a fixture as watched (`matches` collection rows per fixture.id).
 */
export async function getWatchedCountsByFixtureIds(fixtureIds) {
  if (!fixtureIds?.length) {
    return new Map();
  }
  const unique = [
    ...new Set(
      fixtureIds
        .map((id) => (id != null ? Number(id) : NaN))
        .filter((n) => Number.isFinite(n))
    ),
  ];
  if (unique.length === 0) {
    return new Map();
  }
  const db = getDB();
  const rows = await db
    .collection('matches')
    .aggregate([
      { $match: { 'fixture.id': { $in: unique } } },
      { $group: { _id: '$fixture.id', watched_count: { $sum: 1 } } },
    ])
    .toArray();
  const map = new Map();
  for (const row of rows) {
    map.set(row._id, row.watched_count);
  }
  return map;
}

export function mergeWatchedCountIntoDocuments(documents, countMap) {
  return documents.map((doc) => {
    const fid = doc.fixture?.id;
    const n = fid != null ? countMap.get(fid) : undefined;
    const watched_count = n ?? 0;
    return { ...doc, watched_count };
  });
}
