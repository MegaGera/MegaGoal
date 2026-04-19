import { getDB } from '../../config/db.js';
import { getTopLeaguesQuery } from '../../config/topLeagues.js';
import { DEFAULT_LIMIT, escapeRegex, MAX_LIMIT } from './teamSearchQuery.js';

function clampLeagueListLimit(limit) {
  const n = limit == null ? DEFAULT_LIMIT : Number(limit);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(n), 1), MAX_LIMIT);
}

function mapLeagueRows(raw, lim) {
  const truncated = raw.length > lim;
  const leagues = raw.slice(0, lim).map((row) => {
    const l = row.league || {};
    const c = row.country || {};
    return {
      id: l.id,
      name: l.name,
      ...(l.type != null && l.type !== '' ? { type: l.type } : {}),
      ...(l.logo != null && l.logo !== '' ? { logo: l.logo } : {}),
      country: {
        ...(c.name != null && c.name !== '' ? { name: c.name } : {}),
        ...(c.code != null && c.code !== '' ? { code: c.code } : {}),
      },
    };
  });
  return { leagues, truncated };
}

/**
 * List competitions from `leagues` with light fields (no seasons array).
 * Optional filters combine with $and. Empty filters return the first page sorted by name.
 */
export async function listLeagues({
  limit,
  query,
  country,
  league_id,
  top_only,
}) {
  const db = getDB();
  const lim = clampLeagueListLimit(limit);
  const filters = [];

  if (top_only) {
    filters.push(getTopLeaguesQuery());
  }
  if (league_id != null && league_id !== '') {
    filters.push({ 'league.id': Number(league_id) });
  }

  const q = query != null ? String(query).trim() : '';
  if (q) {
    filters.push({
      'league.name': { $regex: escapeRegex(q), $options: 'i' },
    });
  }

  const co = country != null ? String(country).trim() : '';
  if (co) {
    filters.push({
      'country.name': { $regex: escapeRegex(co), $options: 'i' },
    });
  }

  const mongoFilter =
    filters.length === 0 ? {} : filters.length === 1 ? filters[0] : { $and: filters };

  const cursor = db.collection('leagues').find(mongoFilter, {
    projection: {
      _id: 0,
      'league.id': 1,
      'league.name': 1,
      'league.type': 1,
      'league.logo': 1,
      'country.name': 1,
      'country.code': 1,
    },
    sort: { 'league.name': 1 },
    limit: lim + 1,
  });

  const raw = await cursor.toArray();
  const { leagues, truncated } = mapLeagueRows(raw, lim);
  return { leagues, truncated, limit: lim };
}
