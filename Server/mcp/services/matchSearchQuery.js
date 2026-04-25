import { getDB } from '../../config/db.js';
import {
  DEFAULT_LIMIT,
  escapeRegex,
  MAX_LIMIT,
  searchTeamsByName,
} from './teamSearchQuery.js';
import {
  REAL_MATCH_LIST_PROJECTION,
  REAL_MATCH_SINGLE_SEARCH_LIMIT,
  WATCHED_MATCH_LIST_PROJECTION,
} from '../../config/matchProjection.js';

function clampMatchListLimit(limit) {
  const n = limit == null ? DEFAULT_LIMIT : Number(limit);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(n), 1), MAX_LIMIT);
}

function withUserFilter(username, docFilter) {
  return { $and: [{ 'user.username': username }, docFilter] };
}

/**
 * Resolve match-document filters from human-readable names (and optional seasons).
 * Name filters resolve against `teams` / `leagues` server-side; combine with
 * `user.username` when querying the watched `matches` collection.
 * Optional `team2Name` with `teamName` restricts to head-to-head (either team home).
 */
export async function buildWatchedMatchNameFilter({
  teamName,
  team2Name,
  leagueName,
  countryName,
  seasons,
  dateFrom,
  dateTo,
}) {
  const filters = [];
  const resolution = {
    team_resolution_truncated: false,
    team_2_resolution_truncated: false,
    league_name_resolution_truncated: false,
    country_name_resolution_truncated: false,
  };

  const tn =
    teamName != null && String(teamName).trim() !== ''
      ? String(teamName).trim()
      : '';
  const t2n =
    team2Name != null && String(team2Name).trim() !== ''
      ? String(team2Name).trim()
      : '';

  if (t2n && !tn) {
    return {
      filter: null,
      resolution,
      empty_reason: 'team_2_name_requires_team_name',
    };
  }
  const ln =
    leagueName != null && String(leagueName).trim() !== ''
      ? String(leagueName).trim()
      : '';
  const cn =
    countryName != null && String(countryName).trim() !== ''
      ? String(countryName).trim()
      : '';

  if (tn && t2n) {
    const [res1, res2] = await Promise.all([
      searchTeamsByName({ query: tn, limit: MAX_LIMIT }),
      searchTeamsByName({ query: t2n, limit: MAX_LIMIT }),
    ]);
    resolution.team_resolution_truncated = res1.truncated;
    resolution.team_2_resolution_truncated = res2.truncated;
    const idsA = res1.teams.map((t) => t.id).filter((id) => id != null);
    const idsB = res2.teams.map((t) => t.id).filter((id) => id != null);
    if (idsA.length === 0) {
      return { filter: null, resolution, empty_reason: 'no_teams_for_team_name' };
    }
    if (idsB.length === 0) {
      return { filter: null, resolution, empty_reason: 'no_teams_for_team_2_name' };
    }
    filters.push({
      $or: [
        {
          $and: [
            { 'teams.home.id': { $in: idsA } },
            { 'teams.away.id': { $in: idsB } },
          ],
        },
        {
          $and: [
            { 'teams.home.id': { $in: idsB } },
            { 'teams.away.id': { $in: idsA } },
          ],
        },
      ],
    });
  } else if (tn) {
    const { teams, truncated } = await searchTeamsByName({
      query: tn,
      limit: MAX_LIMIT,
    });
    resolution.team_resolution_truncated = truncated;
    const teamIds = teams.map((t) => t.id).filter((id) => id != null);
    if (teamIds.length === 0) {
      return { filter: null, resolution, empty_reason: 'no_teams_for_team_name' };
    }
    filters.push({
      $or: [
        { 'teams.home.id': { $in: teamIds } },
        { 'teams.away.id': { $in: teamIds } },
      ],
    });
  }

  const db = getDB();

  if (ln) {
    const cursor = db.collection('leagues').find(
      {
        'league.name': { $regex: escapeRegex(ln), $options: 'i' },
      },
      {
        projection: { _id: 0, 'league.id': 1 },
        limit: MAX_LIMIT + 1,
      },
    );
    const rows = await cursor.toArray();
    resolution.league_name_resolution_truncated = rows.length > MAX_LIMIT;
    const leagueIds = rows
      .slice(0, MAX_LIMIT)
      .map((r) => r.league?.id)
      .filter((id) => id != null)
      .map(Number);
    if (leagueIds.length === 0) {
      return { filter: null, resolution, empty_reason: 'no_leagues_for_league_name' };
    }
    filters.push({ 'league.id': { $in: leagueIds } });
  }

  if (cn) {
    const cursor = db.collection('leagues').find(
      {
        'country.name': { $regex: escapeRegex(cn), $options: 'i' },
      },
      {
        projection: { _id: 0, 'league.id': 1 },
        limit: MAX_LIMIT + 1,
      },
    );
    const rows = await cursor.toArray();
    resolution.country_name_resolution_truncated = rows.length > MAX_LIMIT;
    const leagueIds = rows
      .slice(0, MAX_LIMIT)
      .map((r) => r.league?.id)
      .filter((id) => id != null)
      .map(Number);
    if (leagueIds.length === 0) {
      return {
        filter: null,
        resolution,
        empty_reason: 'no_leagues_for_country_name',
      };
    }
    filters.push({ 'league.id': { $in: leagueIds } });
  }

  const parseDateBoundary = (value, boundary) => {
    if (value == null) return null;
    const raw = String(value).trim();
    if (!raw) return null;

    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
    if (isDateOnly) {
      const suffix =
        boundary === 'from' ? 'T00:00:00.000Z' : 'T23:59:59.999Z';
      return Date.parse(`${raw}${suffix}`) / 1000;
    }

    const parsedMs = Date.parse(raw);
    if (Number.isNaN(parsedMs)) {
      throw new Error(
        `Invalid ${boundary === 'from' ? 'date_from' : 'date_to'} value. Use ISO date/date-time, for example "2026-04-01" or "2026-04-01T10:30:00Z".`,
      );
    }
    return parsedMs / 1000;
  };

  const fromTs = parseDateBoundary(dateFrom, 'from');
  const toTs = parseDateBoundary(dateTo, 'to');
  const hasDateFilter = fromTs != null || toTs != null;
  if (fromTs != null || toTs != null) {
    if (fromTs != null && toTs != null && fromTs > toTs) {
      throw new Error('Invalid date range: date_from must be <= date_to.');
    }
    const tsFilter = {};
    if (fromTs != null) tsFilter.$gte = fromTs;
    if (toTs != null) tsFilter.$lte = toTs;
    filters.push({ 'fixture.timestamp': tsFilter });
  }

  // Date filters are more precise than season buckets. If either date boundary
  // is present, ignore seasons to avoid broadening/narrowing unexpectedly.
  if (!hasDateFilter) {
    const seasonList = Array.isArray(seasons)
      ? seasons.map((s) => Number(s)).filter((n) => Number.isFinite(n))
      : [];
    if (seasonList.length > 0) {
      filters.push({ 'league.season': { $in: seasonList } });
    }
  }

  if (filters.length === 0) {
    return { filter: null, resolution, empty_reason: 'no_filters' };
  }

  const filter = filters.length === 1 ? filters[0] : { $and: filters };
  return { filter, resolution };
}

export async function searchWatchedMatchesByNames({
  username,
  teamName,
  team2Name,
  leagueName,
  countryName,
  seasons,
  dateFrom,
  dateTo,
  limit,
}) {
  const built = await buildWatchedMatchNameFilter({
    teamName,
    team2Name,
    leagueName,
    countryName,
    seasons,
    dateFrom,
    dateTo,
  });
  if (built.filter == null) {
    return {
      matches: [],
      truncated: false,
      limit: clampMatchListLimit(limit),
      resolution: built.resolution,
      empty_reason: built.empty_reason,
    };
  }

  const lim = clampMatchListLimit(limit);
  const db = getDB();
  const mongoFilter = withUserFilter(username, built.filter);
  const cursor = db
    .collection('matches')
    .find(mongoFilter, {
      projection: WATCHED_MATCH_LIST_PROJECTION,
      sort: { 'fixture.timestamp': -1 },
      limit: lim + 1,
    });

  const raw = await cursor.toArray();
  const truncated = raw.length > lim;
  const matches = raw.slice(0, lim);

  return {
    matches,
    truncated,
    limit: lim,
    resolution: built.resolution,
  };
}

export async function countWatchedMatchesByNames({
  username,
  teamName,
  team2Name,
  leagueName,
  countryName,
  seasons,
  dateFrom,
  dateTo,
}) {
  const built = await buildWatchedMatchNameFilter({
    teamName,
    team2Name,
    leagueName,
    countryName,
    seasons,
    dateFrom,
    dateTo,
  });
  if (built.filter == null) {
    return {
      count: 0,
      resolution: built.resolution,
      empty_reason: built.empty_reason,
    };
  }

  const db = getDB();
  const mongoFilter = withUserFilter(username, built.filter);
  const count = await db.collection('matches').countDocuments(mongoFilter);
  return { count, resolution: built.resolution };
}

/**
 * Same name/season/date filter semantics as watched matches, but queries the
 * global `real_matches` collection (no `user.username` scope).
 * Projection excludes `statistics`, `lineups`, and `events`.
 */
export async function searchRealMatchesByNames({
  teamName,
  team2Name,
  leagueName,
  countryName,
  seasons,
  dateFrom,
  dateTo,
  limit,
}) {
  const built = await buildWatchedMatchNameFilter({
    teamName,
    team2Name,
    leagueName,
    countryName,
    seasons,
    dateFrom,
    dateTo,
  });
  if (built.filter == null) {
    return {
      matches: [],
      truncated: false,
      limit: clampMatchListLimit(limit),
      resolution: built.resolution,
      empty_reason: built.empty_reason,
    };
  }

  const lim = clampMatchListLimit(limit);
  const db = getDB();
  const cursor = db.collection('real_matches').find(built.filter, {
    projection: REAL_MATCH_LIST_PROJECTION,
    sort: { 'fixture.timestamp': -1 },
    limit: lim + 1,
  });

  const raw = await cursor.toArray();
  const truncated = raw.length > lim;
  const matches = raw.slice(0, lim);

  return {
    matches,
    truncated,
    limit: lim,
    resolution: built.resolution,
  };
}

export async function countRealMatchesByNames({
  teamName,
  team2Name,
  leagueName,
  countryName,
  seasons,
  dateFrom,
  dateTo,
}) {
  const built = await buildWatchedMatchNameFilter({
    teamName,
    team2Name,
    leagueName,
    countryName,
    seasons,
    dateFrom,
    dateTo,
  });
  if (built.filter == null) {
    return {
      count: 0,
      resolution: built.resolution,
      empty_reason: built.empty_reason,
    };
  }

  const db = getDB();
  const count = await db.collection('real_matches').countDocuments(built.filter);
  return { count, resolution: built.resolution };
}

/**
 * Same name/season/date filters as `searchRealMatchesByNames`, but returns at most
 * {@link REAL_MATCH_SINGLE_SEARCH_LIMIT} full `real_matches` documents (no list projection).
 */
export async function searchRealMatchByNameFilters({
  teamName,
  team2Name,
  leagueName,
  countryName,
  seasons,
  dateFrom,
  dateTo,
}) {
  const built = await buildWatchedMatchNameFilter({
    teamName,
    team2Name,
    leagueName,
    countryName,
    seasons,
    dateFrom,
    dateTo,
  });
  if (built.filter == null) {
    return {
      matches: [],
      count: 0,
      max_documents: REAL_MATCH_SINGLE_SEARCH_LIMIT,
      resolution: built.resolution,
      empty_reason: built.empty_reason,
    };
  }

  const db = getDB();
  const matches = await db
    .collection('real_matches')
    .find(built.filter, {
      sort: { 'fixture.timestamp': -1 },
      limit: REAL_MATCH_SINGLE_SEARCH_LIMIT,
    })
    .toArray();

  return {
    matches,
    count: matches.length,
    max_documents: REAL_MATCH_SINGLE_SEARCH_LIMIT,
    resolution: built.resolution,
  };
}
