import { getDB } from '../../config/db.js';
import {
  DEFAULT_LIMIT,
  escapeRegex,
  MAX_LIMIT,
  searchTeamsByName,
} from './teamSearchQuery.js';
import { searchUserLocationsByName } from './locationSearchQuery.js';
import { searchPlayersByName } from './playerSearchQuery.js';
import {
  REAL_MATCH_FULL_SEARCH_LIMIT,
  REAL_MATCH_LIST_PROJECTION,
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

function normalizeEvents(events) {
  if (!Array.isArray(events)) return [];
  return events
    .map((entry) => {
      if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) {
        return null;
      }
      const rawName = entry.player_name;
      const playerName =
        rawName != null && String(rawName).trim() !== ''
          ? String(rawName).trim()
          : null;
      const eventName = String(entry.event ?? '').trim().toLowerCase();
      if (!eventName) return null;
      return { playerName, eventName };
    })
    .filter((entry) => entry != null);
}

function normalizeLineupEventName(eventName) {
  const normalized = String(eventName ?? '').trim().toLowerCase();
  if (normalized === 'lineup') return 'lineup';
  if (normalized === 'startingxi' || normalized === 'starting_xi') {
    return 'startingxi';
  }
  if (normalized === 'bench' || normalized === 'substitutes') {
    return 'bench';
  }
  if (
    normalized === 'assist' ||
    normalized === 'assists' ||
    normalized === 'assit' ||
    normalized === 'assits'
  ) {
    return 'assist';
  }
  if (normalized === 'goal' || normalized === 'goals' || normalized === 'scored') {
    return 'goal';
  }
  if (
    normalized === 'own_goal' ||
    normalized === 'own goal' ||
    normalized === 'owngoal'
  ) {
    return 'own_goal';
  }
  if (
    normalized === 'missed_penalty' ||
    normalized === 'missed penalty' ||
    normalized === 'missedpenalty'
  ) {
    return 'missed_penalty';
  }
  if (
    normalized === 'penalty' ||
    normalized === 'penalty_goal' ||
    normalized === 'penalty scored' ||
    normalized === 'penalty_scored'
  ) {
    return 'penalty';
  }
  if (
    normalized === 'substitute' ||
    normalized === 'substituted' ||
    normalized === 'substitution' ||
    normalized === 'subst'
  ) {
    return 'substitute';
  }
  if (
    normalized === 'yellow_card' ||
    normalized === 'yellow card' ||
    normalized === 'yellow' ||
    normalized === 'yellowcard'
  ) {
    return 'yellow_card';
  }
  if (
    normalized === 'second_yellow' ||
    normalized === 'second yellow' ||
    normalized === 'secondyellow'
  ) {
    return 'second_yellow';
  }
  if (
    normalized === 'red_card' ||
    normalized === 'red card' ||
    normalized === 'red' ||
    normalized === 'redcard'
  ) {
    return 'red_card';
  }
  if (normalized === 'card' || normalized === 'cards') {
    return 'card';
  }
  if (normalized === 'var') {
    return 'var';
  }
  if (
    normalized === 'penalty_shootout_scored' ||
    normalized === 'penalty shootout scored' ||
    normalized === 'shootout_scored' ||
    normalized === 'shootout scored'
  ) {
    return 'penalty_shootout_scored';
  }
  if (
    normalized === 'penalty_shootout_missed' ||
    normalized === 'penalty shootout missed' ||
    normalized === 'shootout_missed' ||
    normalized === 'shootout missed'
  ) {
    return 'penalty_shootout_missed';
  }
  return null;
}

async function resolveLineupEventPlayerIds(events) {
  const normalized = normalizeEvents(events);
  if (normalized.length === 0) {
    return {
      ok: true,
      has_events_filter: false,
      event_filters: [],
      events_resolution_truncated: false,
      empty_reason: null,
    };
  }

  const filters = [];
  let eventsResolutionTruncated = false;

  for (const { playerName, eventName } of normalized) {
    const normalizedEvent = normalizeLineupEventName(eventName);
    if (normalizedEvent == null) {
      return {
        ok: false,
        has_events_filter: true,
        event_filters: [],
        events_resolution_truncated: false,
        empty_reason: 'unsupported_event_filter',
      };
    }

    if (playerName == null) {
      filters.push({
        type: normalizedEvent,
        player_ids: null,
      });
      continue;
    }

    const { players, truncated } = await searchPlayersByName({
      query: playerName,
      limit: MAX_LIMIT,
    });
    eventsResolutionTruncated =
      eventsResolutionTruncated || Boolean(truncated);

    const ids = players
      .map((p) => p.id)
      .filter((id) => id != null)
      .map(Number)
      .filter(Number.isFinite);

    if (ids.length === 0) {
      return {
        ok: false,
        has_events_filter: true,
        event_filters: [],
        events_resolution_truncated: eventsResolutionTruncated,
        empty_reason: 'no_players_for_event_player_name',
      };
    }

    filters.push({
      type: normalizedEvent,
      player_ids: ids,
    });
  }

  return {
    ok: true,
    has_events_filter: true,
    event_filters: filters,
    events_resolution_truncated: eventsResolutionTruncated,
    empty_reason: null,
  };
}

function buildLineupRealMatchFilterFromEvents(eventFilters) {
  if (!Array.isArray(eventFilters) || eventFilters.length === 0) return null;

  const playerIdIn = (ids) => ({ $in: ids });

  const parts = eventFilters
    .map((eventFilter) => {
      const ids = Array.isArray(eventFilter.player_ids)
        ? eventFilter.player_ids
        : [];
      const matchWide = eventFilter.player_ids === null;
      const hasPlayers = !matchWide && ids.length > 0;
      if (!matchWide && !hasPlayers) return null;

      const pid = hasPlayers ? playerIdIn(ids) : null;

      if (eventFilter.type === 'lineup') {
        if (matchWide) {
          return {
            lineups: {
              $elemMatch: {
                $or: [
                  {
                    startXI: {
                      $elemMatch: { 'player.id': { $gt: 0 } },
                    },
                  },
                  {
                    substitutes: {
                      $elemMatch: { 'player.id': { $gt: 0 } },
                    },
                  },
                ],
              },
            },
          };
        }
        return {
          $or: [
            { 'lineups.startXI.player.id': pid },
            { 'lineups.substitutes.player.id': pid },
          ],
        };
      }
      if (eventFilter.type === 'startingxi') {
        if (matchWide) {
          return {
            lineups: {
              $elemMatch: {
                startXI: {
                  $elemMatch: { 'player.id': { $gt: 0 } },
                },
              },
            },
          };
        }
        return { 'lineups.startXI.player.id': pid };
      }
      if (eventFilter.type === 'bench') {
        if (matchWide) {
          return {
            lineups: {
              $elemMatch: {
                substitutes: {
                  $elemMatch: { 'player.id': { $gt: 0 } },
                },
              },
            },
          };
        }
        return { 'lineups.substitutes.player.id': pid };
      }
      if (eventFilter.type === 'goal') {
        return {
          events: {
            $elemMatch: {
              type: { $regex: '^goal$', $options: 'i' },
              ...(hasPlayers ? { 'player.id': pid } : {}),
              detail: {
                $not: {
                  $regex: '^(own goal|missed penalty)$',
                  $options: 'i',
                },
              },
            },
          },
        };
      }
      if (eventFilter.type === 'assist') {
        return {
          events: {
            $elemMatch: {
              type: { $regex: '^goal$', $options: 'i' },
              ...(hasPlayers
                ? { 'assist.id': pid }
                : { 'assist.id': { $gt: 0 } }),
            },
          },
        };
      }
      if (eventFilter.type === 'own_goal') {
        return {
          events: {
            $elemMatch: {
              type: { $regex: '^goal$', $options: 'i' },
              ...(hasPlayers ? { 'player.id': pid } : {}),
              detail: { $regex: '^own goal$', $options: 'i' },
            },
          },
        };
      }
      if (eventFilter.type === 'missed_penalty') {
        return {
          events: {
            $elemMatch: {
              type: { $regex: '^goal$', $options: 'i' },
              ...(hasPlayers ? { 'player.id': pid } : {}),
              detail: { $regex: '^missed penalty$', $options: 'i' },
            },
          },
        };
      }
      if (eventFilter.type === 'penalty') {
        return {
          events: {
            $elemMatch: {
              type: { $regex: '^goal$', $options: 'i' },
              ...(hasPlayers ? { 'player.id': pid } : {}),
              detail: { $regex: '^penalty$', $options: 'i' },
            },
          },
        };
      }
      if (eventFilter.type === 'substitute') {
        if (matchWide) {
          return {
            events: {
              $elemMatch: {
                type: { $regex: '^subst$', $options: 'i' },
              },
            },
          };
        }
        return {
          events: {
            $elemMatch: {
              type: { $regex: '^subst$', $options: 'i' },
              $or: [{ 'player.id': pid }, { 'assist.id': pid }],
            },
          },
        };
      }
      if (eventFilter.type === 'yellow_card') {
        return {
          events: {
            $elemMatch: {
              type: { $regex: '^card$', $options: 'i' },
              ...(hasPlayers ? { 'player.id': pid } : {}),
              detail: { $regex: 'yellow', $options: 'i' },
            },
          },
        };
      }
      if (eventFilter.type === 'second_yellow') {
        return {
          events: {
            $elemMatch: {
              type: { $regex: '^card$', $options: 'i' },
              ...(hasPlayers ? { 'player.id': pid } : {}),
              detail: { $regex: 'second yellow', $options: 'i' },
            },
          },
        };
      }
      if (eventFilter.type === 'red_card') {
        return {
          events: {
            $elemMatch: {
              type: { $regex: '^card$', $options: 'i' },
              ...(hasPlayers ? { 'player.id': pid } : {}),
              detail: { $regex: 'red', $options: 'i' },
            },
          },
        };
      }
      if (eventFilter.type === 'card') {
        return {
          events: {
            $elemMatch: {
              type: { $regex: '^card$', $options: 'i' },
              ...(hasPlayers ? { 'player.id': pid } : {}),
            },
          },
        };
      }
      if (eventFilter.type === 'var') {
        return {
          events: {
            $elemMatch: {
              type: { $regex: '^var$', $options: 'i' },
              ...(hasPlayers ? { 'player.id': pid } : {}),
            },
          },
        };
      }
      if (eventFilter.type === 'penalty_shootout_scored') {
        return {
          events: {
            $elemMatch: {
              type: { $regex: '^goal$', $options: 'i' },
              ...(hasPlayers ? { 'player.id': pid } : {}),
              detail: { $regex: 'penalty shootout', $options: 'i' },
              comments: {
                $not: { $regex: 'miss', $options: 'i' },
              },
            },
          },
        };
      }
      if (eventFilter.type === 'penalty_shootout_missed') {
        return {
          events: {
            $elemMatch: {
              type: { $regex: '^goal$', $options: 'i' },
              ...(hasPlayers ? { 'player.id': pid } : {}),
              detail: { $regex: 'penalty shootout', $options: 'i' },
              comments: { $regex: 'miss', $options: 'i' },
            },
          },
        };
      }
      return null;
    })
    .filter((part) => part != null);
  if (parts.length === 0) return null;
  return parts.length === 1 ? parts[0] : { $and: parts };
}

/**
 * Resolve match-document filters from human-readable names (and optional seasons).
 * Name filters resolve against `teams` / `leagues` server-side; combine with
 * `user.username` when querying the watched `matches` collection.
 * Optional `team2Name` with `teamName` restricts to head-to-head (either team home).
 * Optional `locationName` with `locationsScopeUsername` adds `matches.location` in
 * (`locations.id` for that user); omit or leave empty for real_matches-only tools.
 */
export async function buildWatchedMatchNameFilter({
  ids,
  teamName,
  team2Name,
  leagueName,
  countryName,
  locationName,
  locationsScopeUsername,
  seasons,
  dateFrom,
  dateTo,
  events,
}) {
  const filters = [];
  const resolution = {
    team_resolution_truncated: false,
    team_2_resolution_truncated: false,
    league_name_resolution_truncated: false,
    country_name_resolution_truncated: false,
    location_name_resolution_truncated: false,
    events_resolution_truncated: false,
  };

  const fixtureIds = Array.isArray(ids)
    ? ids
      .map((id) => Number(id))
      .filter(Number.isFinite)
      .map((id) => Math.trunc(id))
    : [];
  if (fixtureIds.length > 0) {
    return {
      filter: { 'fixture.id': { $in: fixtureIds } },
      realMatchEventsFilter: null,
      resolution,
    };
  }

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

  const locN =
    locationName != null && String(locationName).trim() !== ''
      ? String(locationName).trim()
      : '';
  if (locN) {
    if (!locationsScopeUsername) {
      return {
        filter: null,
        realMatchEventsFilter: null,
        resolution,
        empty_reason: 'location_name_requires_user_scope',
      };
    }
    const { location_ids: locationIds, truncated: locTrunc } =
      await searchUserLocationsByName({
        username: locationsScopeUsername,
        query: locN,
        limit: MAX_LIMIT,
      });
    resolution.location_name_resolution_truncated = locTrunc;
    if (locationIds.length === 0) {
      return {
        filter: null,
        realMatchEventsFilter: null,
        resolution,
        empty_reason: 'no_locations_for_location_name',
      };
    }
    filters.push({ location: { $in: locationIds } });
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
    const eventsResolved = await resolveLineupEventPlayerIds(events);
    resolution.events_resolution_truncated =
      eventsResolved.events_resolution_truncated;
    if (!eventsResolved.ok) {
      return {
        filter: null,
        realMatchEventsFilter: null,
        resolution,
        empty_reason: eventsResolved.empty_reason,
      };
    }
    if (!eventsResolved.has_events_filter) {
      return { filter: null, realMatchEventsFilter: null, resolution, empty_reason: 'no_filters' };
    }
    return {
      filter: {},
      realMatchEventsFilter: buildLineupRealMatchFilterFromEvents(
        eventsResolved.event_filters,
      ),
      resolution,
    };
  }

  const filter = filters.length === 1 ? filters[0] : { $and: filters };
  const eventsResolved = await resolveLineupEventPlayerIds(events);
  resolution.events_resolution_truncated =
    eventsResolved.events_resolution_truncated;
  if (!eventsResolved.ok) {
    return {
      filter: null,
      realMatchEventsFilter: null,
      resolution,
      empty_reason: eventsResolved.empty_reason,
    };
  }

  return {
    filter,
    realMatchEventsFilter: buildLineupRealMatchFilterFromEvents(
      eventsResolved.event_filters,
    ),
    resolution,
  };
}

export async function searchWatchedMatchesByNames({
  username,
  ids,
  teamName,
  team2Name,
  leagueName,
  countryName,
  locationName,
  seasons,
  dateFrom,
  dateTo,
  events,
  limit,
}) {
  const built = await buildWatchedMatchNameFilter({
    ids,
    teamName,
    team2Name,
    leagueName,
    countryName,
    locationName,
    locationsScopeUsername: username,
    seasons,
    dateFrom,
    dateTo,
    events,
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
  const watchedFilterParts = [built.filter];

  if (built.realMatchEventsFilter) {
    const realMatchFilter = {
      $and: [built.filter, built.realMatchEventsFilter],
    };
    const fixtureRows = await db.collection('real_matches').find(realMatchFilter, {
      projection: { _id: 0, 'fixture.id': 1 },
    }).toArray();
    const fixtureIds = fixtureRows
      .map((row) => row.fixture?.id)
      .filter((id) => id != null)
      .map(Number)
      .filter(Number.isFinite);
    if (fixtureIds.length === 0) {
      return {
        matches: [],
        truncated: false,
        limit: lim,
        resolution: built.resolution,
        empty_reason: 'no_matches_for_events',
      };
    }
    watchedFilterParts.push({ 'fixture.id': { $in: fixtureIds } });
  }

  const combinedWatchedFilter =
    watchedFilterParts.length === 1
      ? watchedFilterParts[0]
      : { $and: watchedFilterParts };
  const mongoFilter = withUserFilter(username, combinedWatchedFilter);
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
  ids,
  teamName,
  team2Name,
  leagueName,
  countryName,
  locationName,
  seasons,
  dateFrom,
  dateTo,
  events,
}) {
  const built = await buildWatchedMatchNameFilter({
    ids,
    teamName,
    team2Name,
    leagueName,
    countryName,
    locationName,
    locationsScopeUsername: username,
    seasons,
    dateFrom,
    dateTo,
    events,
  });
  if (built.filter == null) {
    return {
      count: 0,
      resolution: built.resolution,
      empty_reason: built.empty_reason,
    };
  }

  const db = getDB();
  const watchedFilterParts = [built.filter];
  if (built.realMatchEventsFilter) {
    const realMatchFilter = {
      $and: [built.filter, built.realMatchEventsFilter],
    };
    const fixtureRows = await db.collection('real_matches').find(realMatchFilter, {
      projection: { _id: 0, 'fixture.id': 1 },
    }).toArray();
    const fixtureIds = fixtureRows
      .map((row) => row.fixture?.id)
      .filter((id) => id != null)
      .map(Number)
      .filter(Number.isFinite);
    if (fixtureIds.length === 0) {
      return {
        count: 0,
        resolution: built.resolution,
        empty_reason: 'no_matches_for_events',
      };
    }
    watchedFilterParts.push({ 'fixture.id': { $in: fixtureIds } });
  }
  const combinedWatchedFilter =
    watchedFilterParts.length === 1
      ? watchedFilterParts[0]
      : { $and: watchedFilterParts };
  const mongoFilter = withUserFilter(username, combinedWatchedFilter);
  const count = await db.collection('matches').countDocuments(mongoFilter);
  return { count, resolution: built.resolution };
}

/**
 * Same name/season/date filter semantics as watched matches, but queries the
 * global `real_matches` collection (no `user.username` scope).
 * Projection excludes `statistics`, `lineups`, and `events`.
 */
export async function searchRealMatchesByNames({
  ids,
  teamName,
  team2Name,
  leagueName,
  countryName,
  seasons,
  dateFrom,
  dateTo,
  events,
  limit,
}) {
  const built = await buildWatchedMatchNameFilter({
    ids,
    teamName,
    team2Name,
    leagueName,
    countryName,
    seasons,
    dateFrom,
    dateTo,
    events,
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
  const realFilterParts = [built.filter];
  if (built.realMatchEventsFilter) {
    realFilterParts.push(built.realMatchEventsFilter);
  }
  const combinedRealFilter =
    realFilterParts.length === 1 ? realFilterParts[0] : { $and: realFilterParts };
  const cursor = db.collection('real_matches').find(combinedRealFilter, {
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
  ids,
  teamName,
  team2Name,
  leagueName,
  countryName,
  seasons,
  dateFrom,
  dateTo,
  events,
}) {
  const built = await buildWatchedMatchNameFilter({
    ids,
    teamName,
    team2Name,
    leagueName,
    countryName,
    seasons,
    dateFrom,
    dateTo,
    events,
  });
  if (built.filter == null) {
    return {
      count: 0,
      resolution: built.resolution,
      empty_reason: built.empty_reason,
    };
  }

  const db = getDB();
  const realFilterParts = [built.filter];
  if (built.realMatchEventsFilter) {
    realFilterParts.push(built.realMatchEventsFilter);
  }
  const combinedRealFilter =
    realFilterParts.length === 1 ? realFilterParts[0] : { $and: realFilterParts };
  const count = await db.collection('real_matches').countDocuments(combinedRealFilter);
  return { count, resolution: built.resolution };
}

/**
 * Same name/season/date filters as `searchRealMatchesByNames`, but returns at most
 * {@link REAL_MATCH_FULL_SEARCH_LIMIT} full `real_matches` documents (no list projection).
 */
export async function getRealMatchesFullByNames({
  ids,
  teamName,
  team2Name,
  leagueName,
  countryName,
  seasons,
  dateFrom,
  dateTo,
  events,
  includeStatistics = true,
  includeLineups = true,
  includeEvents = true,
}) {
  const built = await buildWatchedMatchNameFilter({
    ids,
    teamName,
    team2Name,
    leagueName,
    countryName,
    seasons,
    dateFrom,
    dateTo,
    events,
  });
  if (built.filter == null) {
    return {
      matches: [],
      count: 0,
      max_documents: REAL_MATCH_FULL_SEARCH_LIMIT,
      resolution: built.resolution,
      empty_reason: built.empty_reason,
    };
  }

  const db = getDB();
  const projection = {};
  if (!includeStatistics) projection.statistics = 0;
  if (!includeLineups) projection.lineups = 0;
  if (!includeEvents) projection.events = 0;

  const findOptions = {
    sort: { 'fixture.timestamp': -1 },
    limit: REAL_MATCH_FULL_SEARCH_LIMIT,
  };
  if (Object.keys(projection).length > 0) {
    findOptions.projection = projection;
  }

  const realFilterParts = [built.filter];
  if (built.realMatchEventsFilter) {
    realFilterParts.push(built.realMatchEventsFilter);
  }
  const combinedRealFilter =
    realFilterParts.length === 1 ? realFilterParts[0] : { $and: realFilterParts };
  const matches = await db
    .collection('real_matches')
    .find(combinedRealFilter, findOptions)
    .toArray();

  return {
    matches,
    count: matches.length,
    max_documents: REAL_MATCH_FULL_SEARCH_LIMIT,
    resolution: built.resolution,
  };
}
