import { getDB } from '../../config/db.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/** Escape user input for safe use inside a RegExp literal. */
export function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clampLimit(limit) {
  const n = limit == null ? DEFAULT_LIMIT : Number(limit);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(n), 1), MAX_LIMIT);
}

/**
 * Build filters aligned with GET /teams (league / season / country on `teams` collection).
 */
function buildLeagueCountryFilters({ country, league_id, season }) {
  const filters = [];

  if (country != null && String(country).trim() !== '') {
    filters.push({ 'team.country': String(country).trim() });
  }

  const lid = league_id;
  const sea = season;
  const hasLeague = lid != null && lid !== '';
  const hasSeason = sea != null && sea !== '';

  if (hasLeague && hasSeason) {
    filters.push({
      seasons: {
        $elemMatch: {
          league: String(lid),
          season: String(sea),
        },
      },
    });
  } else if (hasLeague) {
    filters.push({ 'seasons.league': String(lid) });
  }

  return filters;
}

function mapTeamRows(raw, lim) {
  const truncated = raw.length > lim;
  const teams = raw.slice(0, lim).map((row) => {
    const t = row.team || {};
    return {
      id: t.id,
      name: t.name,
      ...(t.country != null && t.country !== ''
        ? { country: t.country }
        : {}),
    };
  });
  return { teams, truncated };
}

/**
 * List teams by country and/or league (no name query). Same projection shape as name search.
 * Requires at least one of: non-empty country, or league_id.
 */
export async function listTeamsByLeagueOrCountry({
  limit,
  country,
  league_id,
  season,
}) {
  const db = getDB();
  const lim = clampLimit(limit);

  const filters = buildLeagueCountryFilters({ country, league_id, season });
  if (filters.length === 0) {
    return { teams: [], truncated: false, limit: lim };
  }

  const mongoFilter =
    filters.length === 1 ? filters[0] : { $and: filters };

  const cursor = db.collection('teams').find(mongoFilter, {
    projection: {
      _id: 0,
      'team.id': 1,
      'team.name': 1,
      'team.country': 1,
    },
    sort: { 'team.name': 1 },
    limit: lim + 1,
  });

  const raw = await cursor.toArray();
  const { teams, truncated } = mapTeamRows(raw, lim);
  return { teams, truncated, limit: lim };
}

/**
 * Case-insensitive substring search on `team.name` with bounded results.
 * Fetches at most `limit + 1` docs to set `truncated`.
 */
export async function searchTeamsByName({
  query,
  limit,
  country,
  league_id,
  season,
}) {
  const db = getDB();
  const lim = clampLimit(limit);
  const trimmed = String(query ?? '').trim();
  if (!trimmed) {
    return { teams: [], truncated: false, limit: lim };
  }

  const nameFilter = {
    'team.name': { $regex: escapeRegex(trimmed), $options: 'i' },
  };

  const optional = buildLeagueCountryFilters({ country, league_id, season });
  const mongoFilter =
    optional.length > 0 ? { $and: [nameFilter, ...optional] } : nameFilter;

  const cursor = db.collection('teams').find(mongoFilter, {
    projection: {
      _id: 0,
      'team.id': 1,
      'team.name': 1,
      'team.country': 1,
    },
    sort: { 'team.name': 1 },
    limit: lim + 1,
  });

  const raw = await cursor.toArray();
  const { teams, truncated } = mapTeamRows(raw, lim);

  return { teams, truncated, limit: lim };
}

export { DEFAULT_LIMIT, MAX_LIMIT };
