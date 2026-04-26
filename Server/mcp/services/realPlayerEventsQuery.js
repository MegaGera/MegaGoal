import { getDB } from '../../config/db.js';
import { buildWatchedMatchNameFilter } from './matchSearchQuery.js';
import {
  buildByMatchRows,
  buildRanking,
  clampLimit,
  normalizeEventName,
  recordsFromRealMatch,
  resolvePlayerFilter,
  uniqueStrings,
} from './watchedPlayerEventsQuery.js';

export async function analyzeRealPlayerEvents({
  ids,
  teamName,
  team2Name,
  leagueName,
  countryName,
  seasons,
  dateFrom,
  dateTo,
  players,
  events,
  pairMode = 'paired',
  logic = 'or',
  responseEventScope = 'matched_only',
  groupBy = 'player',
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
    events: undefined,
  });
  if (built.filter == null) {
    return {
      players: [],
      matches: [],
      count_matches: 0,
      count_events: 0,
      limit: clampLimit(limit),
      resolution: built.resolution,
      empty_reason: built.empty_reason,
    };
  }

  const db = getDB();
  const realMatches = await db.collection('real_matches').find(built.filter, {
    projection: {
      _id: 0,
      fixture: 1,
      league: 1,
      teams: 1,
      goals: 1,
      lineups: 1,
      events: 1,
    },
    sort: { 'fixture.timestamp': -1 },
  }).toArray();

  if (realMatches.length === 0) {
    return {
      players: [],
      matches: [],
      count_matches: 0,
      count_events: 0,
      limit: clampLimit(limit),
      resolution: built.resolution,
      empty_reason: 'no_real_matches',
    };
  }

  const playerResolution = await resolvePlayerFilter(players);
  if (playerResolution.empty_reason) {
    return {
      players: [],
      matches: [],
      count_matches: 0,
      count_events: 0,
      limit: clampLimit(limit),
      resolution: {
        ...built.resolution,
        players_resolution_truncated: playerResolution.players_resolution_truncated,
      },
      empty_reason: playerResolution.empty_reason,
    };
  }

  const rawEvents = uniqueStrings(events);
  const normalizedEvents = uniqueStrings(
    rawEvents.map((event) => normalizeEventName(event)).filter((x) => x != null),
  );
  if (rawEvents.length > 0 && normalizedEvents.length === 0) {
    return {
      players: [],
      matches: [],
      count_matches: 0,
      count_events: 0,
      limit: clampLimit(limit),
      resolution: {
        ...built.resolution,
        players_resolution_truncated: playerResolution.players_resolution_truncated,
      },
      empty_reason: 'unsupported_event_filter',
    };
  }

  const selectedPlayersSet = new Set(playerResolution.player_ids);
  const selectedEventsSet = new Set(normalizedEvents);
  const hasPlayerFilter = selectedPlayersSet.size > 0;
  const hasEventFilter = selectedEventsSet.size > 0;
  const allOutputRecords = [];

  for (const realMatch of realMatches) {
    const records = recordsFromRealMatch(realMatch);
    if (records.length === 0) continue;

    const playerPredicate = (rec) => !hasPlayerFilter || selectedPlayersSet.has(rec.player_id);
    const eventPredicate = (rec) => !hasEventFilter || selectedEventsSet.has(rec.event_type);
    const pairedRecords = records.filter(
      (rec) => playerPredicate(rec) && eventPredicate(rec),
    );
    const playerOnlyRecords = records.filter((rec) => playerPredicate(rec));
    const eventOnlyRecords = records.filter((rec) => eventPredicate(rec));

    let includeMatch = false;
    if (pairMode === 'independent') {
      const playerOk = hasPlayerFilter ? playerOnlyRecords.length > 0 : true;
      const eventOk = hasEventFilter ? eventOnlyRecords.length > 0 : true;
      includeMatch = logic === 'and' ? playerOk && eventOk : playerOk || eventOk;
    } else if (logic === 'and') {
      const eventsOk =
        !hasEventFilter ||
        normalizedEvents.every((eventType) =>
          pairedRecords.some((rec) => rec.event_type === eventType),
        );
      const playersOk =
        !hasPlayerFilter ||
        playerResolution.player_ids.every((playerId) =>
          pairedRecords.some((rec) => rec.player_id === playerId),
        );
      includeMatch = eventsOk && playersOk;
    } else {
      includeMatch = pairedRecords.length > 0;
    }

    if (!includeMatch) continue;

    let outputRecords;
    if (responseEventScope === 'all_in_scope') {
      outputRecords = records;
    } else if (pairMode !== 'independent') {
      outputRecords = pairedRecords;
    } else if (hasPlayerFilter && hasEventFilter) {
      outputRecords = records.filter(
        (rec) => playerPredicate(rec) || eventPredicate(rec),
      );
    } else if (hasPlayerFilter) {
      outputRecords = playerOnlyRecords;
    } else if (hasEventFilter) {
      outputRecords = eventOnlyRecords;
    } else {
      outputRecords = records;
    }

    allOutputRecords.push(...outputRecords);
  }

  if (allOutputRecords.length === 0) {
    return {
      players: [],
      matches: [],
      count_matches: 0,
      count_events: 0,
      limit: clampLimit(limit),
      resolution: {
        ...built.resolution,
        players_resolution_truncated: playerResolution.players_resolution_truncated,
      },
      empty_reason: 'no_events_for_filters',
    };
  }

  const lim = clampLimit(limit);
  const fixtureIds = new Set(
    allOutputRecords.map((rec) => Number(rec.fixture_id)).filter(Number.isFinite),
  );
  const groupedMatches = new Map(
    realMatches
      .filter((match) => fixtureIds.has(Number(match.fixture?.id)))
      .map((match) => [Number(match.fixture?.id), match]),
  );

  const playersPayload = buildRanking(allOutputRecords, lim);
  const matchesPayload =
    groupBy === 'match' ? buildByMatchRows(groupedMatches, allOutputRecords, lim) : [];

  return {
    count_matches: groupedMatches.size,
    count_events: allOutputRecords.length,
    limit: lim,
    filters: {
      pair_mode: pairMode,
      logic,
      response_event_scope: responseEventScope,
      events: normalizedEvents,
      players: playerResolution.players,
    },
    resolution: {
      ...built.resolution,
      players_resolution_truncated: playerResolution.players_resolution_truncated,
    },
    players: playersPayload,
    matches: matchesPayload,
  };
}
