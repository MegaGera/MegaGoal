import { getDB } from '../config/db.js';
import {
  clampLimit,
  createIndexCache,
  rankItems,
  uniqueFoldedFields,
} from './nameSearch.js';

const cache = createIndexCache(buildLeagueIndex);

function mapLeagueItem(row) {
  const league = row.league || {};
  const country = row.country || {};
  return {
    id: league.id,
    name: league.name,
    ...(typeof league.type === 'string' && league.type !== ''
      ? { type: league.type }
      : {}),
    ...(typeof league.logo === 'string' && league.logo !== ''
      ? { logo: league.logo }
      : {}),
    ...(typeof country.name === 'string' && country.name !== ''
      ? { country: country.name }
      : {}),
    ...(typeof country.flag === 'string' && country.flag !== ''
      ? { country_flag: country.flag }
      : {}),
  };
}

/**
 * Same scope as GET /league/top: only competitions configured in league_settings.
 */
async function loadConfiguredLeagueIds(db) {
  const settings = await db
    .collection('league_settings')
    .find({}, { projection: { _id: 0, league_id: 1, position: 1 } })
    .toArray();

  /** @type {Map<number, number>} */
  const positionById = new Map();
  for (const row of settings) {
    const id = Number(row?.league_id);
    if (!Number.isFinite(id)) continue;
    const position = Number(row?.position);
    positionById.set(
      id,
      Number.isFinite(position) ? position : Number.MAX_SAFE_INTEGER
    );
  }
  return positionById;
}

async function buildLeagueIndex(db) {
  const positionById = await loadConfiguredLeagueIds(db);
  if (positionById.size === 0) return [];

  const leagueIds = [...positionById.keys()];
  const cursor = db.collection('leagues').find(
    { 'league.id': { $in: leagueIds } },
    {
      projection: {
        _id: 0,
        'league.id': 1,
        'league.name': 1,
        'league.type': 1,
        'league.logo': 1,
        'country.name': 1,
        'country.flag': 1,
        'country.code': 1,
      },
    }
  );

  const index = [];
  for await (const row of cursor) {
    const item = mapLeagueItem(row);
    if (!Number.isFinite(item.id) || typeof item.name !== 'string') continue;
    if (!positionById.has(item.id)) continue;

    const position = positionById.get(item.id) ?? Number.MAX_SAFE_INTEGER;
    // Prefer leagues higher in the app settings list when name scores tie.
    const popularity = Math.max(0, 40 - Math.min(position, 40));

    index.push({
      foldedFields: uniqueFoldedFields([
        item.name,
        item.country,
        row.country?.code,
      ]),
      popularity,
      item,
    });
  }
  return index;
}

/**
 * Accent-insensitive, token AND search on league name (and country).
 * Only competitions present in league_settings (app top leagues).
 * Results are ranked by relevance. Hard-capped at 20.
 */
export async function searchLeaguesByName({ query, limit } = {}) {
  const lim = clampLimit(limit);
  const trimmed = String(query ?? '').trim();
  if (!trimmed) {
    return { leagues: [], truncated: false, limit: lim };
  }

  const db = getDB();
  const index = await cache.getIndex(db);
  const { items, truncated } = rankItems(index, trimmed, lim);
  return { leagues: items, truncated, limit: lim };
}

export async function warmupLeagueSearch() {
  const db = getDB();
  if (!db) return;
  await cache.getIndex(db);
}

export { DEFAULT_LIMIT, MAX_LIMIT } from './nameSearch.js';
