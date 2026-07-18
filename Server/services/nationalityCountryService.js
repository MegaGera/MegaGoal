/**
 * In-memory map: normalized country name → { name, code, flag }
 * Sourced from the `countries` collection (API-Football /countries sync).
 */

const CACHE_TTL_MS = 10 * 60 * 1000;

/** @type {Map<string, { name: string, code: string | null, flag: string | null }> | null} */
let nationalityCountryMap = null;
let loadedAtMs = 0;

/**
 * @param {unknown} name
 * @returns {string}
 */
export function normalizeCountryKey(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase();
}

/**
 * @param {import('mongodb').Db} db
 * @param {{ force?: boolean }} [opts]
 */
export async function loadNationalityCountryMap(db, opts = {}) {
  const force = opts.force === true;
  const fresh =
    nationalityCountryMap != null && Date.now() - loadedAtMs < CACHE_TTL_MS;
  if (!force && fresh) {
    return nationalityCountryMap;
  }

  const docs = await db
    .collection('countries')
    .find({}, { projection: { _id: 0, name: 1, code: 1, flag: 1 } })
    .toArray();

  /** @type {Map<string, { name: string, code: string | null, flag: string | null }>} */
  const next = new Map();
  for (const doc of docs) {
    const name = typeof doc?.name === 'string' ? doc.name.trim() : '';
    if (!name) continue;
    next.set(normalizeCountryKey(name), {
      name,
      code: doc.code != null && String(doc.code).trim() ? String(doc.code).trim() : null,
      flag: doc.flag != null && String(doc.flag).trim() ? String(doc.flag).trim() : null
    });
  }

  nationalityCountryMap = next;
  loadedAtMs = Date.now();
  return nationalityCountryMap;
}

export function invalidateNationalityCountryMap() {
  nationalityCountryMap = null;
  loadedAtMs = 0;
}

/**
 * Resolve player.nationality string to a countries collection row.
 * @param {import('mongodb').Db} db
 * @param {string | null | undefined} nationality
 * @returns {Promise<{ name: string, code: string | null, flag: string | null } | null>}
 */
export async function resolveNationalityCountry(db, nationality) {
  const raw = typeof nationality === 'string' ? nationality.trim() : '';
  if (!raw) return null;

  let map = await loadNationalityCountryMap(db);
  const key = normalizeCountryKey(raw);
  let hit = map.get(key) ?? null;

  // Empty cache (e.g. Server started before first countries sync) → force reload once
  if (!hit && map.size === 0) {
    map = await loadNationalityCountryMap(db, { force: true });
    hit = map.get(key) ?? null;
  }

  return hit;
}
