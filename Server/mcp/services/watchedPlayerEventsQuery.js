import { getDB } from '../../config/db.js';
import { buildWatchedMatchNameFilter } from './matchSearchQuery.js';
import { MAX_LIMIT } from './teamSearchQuery.js';
import { searchPlayersByName } from './playerSearchQuery.js';

const DEFAULT_OUTPUT_LIMIT = 20;
const MAX_OUTPUT_LIMIT = 100;

export function clampLimit(limit) {
  const n = limit == null ? DEFAULT_OUTPUT_LIMIT : Number(limit);
  if (!Number.isFinite(n)) return DEFAULT_OUTPUT_LIMIT;
  return Math.min(Math.max(Math.trunc(n), 1), MAX_OUTPUT_LIMIT);
}

export function normalizeEventName(event) {
  const normalized = String(event ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (
    normalized === 'calledup' ||
    normalized === 'called_up' ||
    normalized === 'called up'
  ) {
    return 'called_up';
  }
  if (normalized === 'lineup') return 'lineup';
  if (normalized === 'startingxi' || normalized === 'starting_xi') {
    return 'startingXI';
  }
  if (normalized === 'bench' || normalized === 'substitutes') return 'bench';
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
  if (normalized === 'card' || normalized === 'cards') return 'card';
  if (normalized === 'var') return 'var';
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

function teamNameFromMatch(match, teamId) {
  if (teamId == null) return null;
  const home = match.teams?.home;
  const away = match.teams?.away;
  if (home?.id === teamId) return home.name ?? String(teamId);
  if (away?.id === teamId) return away.name ?? String(teamId);
  return String(teamId);
}

function pushRecord(records, {
  fixtureId,
  timestamp,
  playerId,
  playerName,
  teamId,
  teamName,
  eventType,
  minute,
}) {
  if (!Number.isFinite(Number(playerId))) return;
  records.push({
    fixture_id: fixtureId,
    timestamp: timestamp ?? null,
    player_id: Number(playerId),
    player_name: playerName != null ? String(playerName) : null,
    team_id: teamId != null ? Number(teamId) : null,
    team_name: teamName != null ? String(teamName) : null,
    event_type: eventType,
    minute: Number.isFinite(Number(minute)) ? Number(minute) : null,
  });
}

export function recordsFromRealMatch(realMatch) {
  const records = [];
  const fixtureId = realMatch.fixture?.id;
  const timestamp = realMatch.fixture?.timestamp ?? null;
  const incomingSubstituteIds = new Set();

  for (const event of realMatch.events || []) {
    const rawType = String(event.type ?? '').trim().toLowerCase();
    if (rawType !== 'subst') continue;
    const incomingId = Number(event.assist?.id);
    if (Number.isFinite(incomingId)) incomingSubstituteIds.add(incomingId);
  }

  for (const lineup of realMatch.lineups || []) {
    const teamId = lineup.team?.id;
    const tName = lineup.team?.name;
    for (const row of lineup.startXI || []) {
      pushRecord(records, {
        fixtureId,
        timestamp,
        playerId: row.player?.id,
        playerName: row.player?.name,
        teamId,
        teamName: tName,
        eventType: 'startingXI',
      });
      pushRecord(records, {
        fixtureId,
        timestamp,
        playerId: row.player?.id,
        playerName: row.player?.name,
        teamId,
        teamName: tName,
        eventType: 'called_up',
      });
      pushRecord(records, {
        fixtureId,
        timestamp,
        playerId: row.player?.id,
        playerName: row.player?.name,
        teamId,
        teamName: tName,
        eventType: 'lineup',
      });
    }
    for (const row of lineup.substitutes || []) {
      pushRecord(records, {
        fixtureId,
        timestamp,
        playerId: row.player?.id,
        playerName: row.player?.name,
        teamId,
        teamName: tName,
        eventType: 'bench',
      });
      pushRecord(records, {
        fixtureId,
        timestamp,
        playerId: row.player?.id,
        playerName: row.player?.name,
        teamId,
        teamName: tName,
        eventType: 'called_up',
      });
    }
  }

  for (const event of realMatch.events || []) {
    const rawType = String(event.type ?? '').trim().toLowerCase();
    const detail = String(event.detail ?? '').trim().toLowerCase();
    const comments = String(event.comments ?? '').trim().toLowerCase();
    const minute = event.time?.elapsed ?? null;
    const teamId = event.team?.id ?? null;
    const tName = teamNameFromMatch(realMatch, teamId);
    const player = event.player || {};
    const assist = event.assist || {};

    if (rawType === 'subst') {
      pushRecord(records, {
        fixtureId,
        timestamp,
        playerId: player.id,
        playerName: player.name,
        teamId,
        teamName: tName,
        eventType: 'substitute',
        minute,
      });
      pushRecord(records, {
        fixtureId,
        timestamp,
        playerId: assist.id,
        playerName: assist.name,
        teamId,
        teamName: tName,
        eventType: 'substitute',
        minute,
      });
      if (incomingSubstituteIds.has(Number(assist.id))) {
        pushRecord(records, {
          fixtureId,
          timestamp,
          playerId: assist.id,
          playerName: assist.name,
          teamId,
          teamName: tName,
          eventType: 'lineup',
          minute,
        });
      }
      continue;
    }

    if (rawType === 'card') {
      let type = 'card';
      if (detail.includes('second yellow')) type = 'second_yellow';
      else if (detail.includes('yellow')) type = 'yellow_card';
      else if (detail.includes('red')) type = 'red_card';
      pushRecord(records, {
        fixtureId,
        timestamp,
        playerId: player.id,
        playerName: player.name,
        teamId,
        teamName: tName,
        eventType: type,
        minute,
      });
      // Keep generic card to allow broad card queries.
      pushRecord(records, {
        fixtureId,
        timestamp,
        playerId: player.id,
        playerName: player.name,
        teamId,
        teamName: tName,
        eventType: 'card',
        minute,
      });
      continue;
    }

    if (rawType === 'var') {
      pushRecord(records, {
        fixtureId,
        timestamp,
        playerId: player.id,
        playerName: player.name,
        teamId,
        teamName: tName,
        eventType: 'var',
        minute,
      });
      continue;
    }

    if (rawType !== 'goal') continue;

    let scorerType = 'goal';
    if (detail === 'own goal') scorerType = 'own_goal';
    else if (detail === 'missed penalty') scorerType = 'missed_penalty';
    else if (detail === 'penalty') scorerType = 'penalty';
    else if (detail.includes('penalty shootout')) {
      scorerType = comments.includes('miss')
        ? 'penalty_shootout_missed'
        : 'penalty_shootout_scored';
    }

    pushRecord(records, {
      fixtureId,
      timestamp,
      playerId: player.id,
      playerName: player.name,
      teamId,
      teamName: tName,
      eventType: scorerType,
      minute,
    });
    // goal remains a generic scorer metric, excluding own-goal/missed penalty
    if (scorerType === 'penalty' || scorerType === 'goal') {
      pushRecord(records, {
        fixtureId,
        timestamp,
        playerId: player.id,
        playerName: player.name,
        teamId,
        teamName: tName,
        eventType: 'goal',
        minute,
      });
    }

    pushRecord(records, {
      fixtureId,
      timestamp,
      playerId: assist.id,
      playerName: assist.name,
      teamId,
      teamName: tName,
      eventType: 'assist',
      minute,
    });
  }

  return records;
}

export async function resolvePlayerFilter(names) {
  const list = Array.isArray(names)
    ? names
      .map((n) => String(n ?? '').trim())
      .filter((n) => n.length > 0)
    : [];
  if (list.length === 0) {
    return {
      player_ids: [],
      players: [],
      players_resolution_truncated: false,
      empty_reason: null,
    };
  }

  const resolved = [];
  const ids = new Set();
  let anyTruncated = false;

  for (const playerName of list) {
    const { players, truncated } = await searchPlayersByName({
      query: playerName,
      limit: MAX_LIMIT,
    });
    anyTruncated = anyTruncated || Boolean(truncated);
    if (players.length === 0) {
      return {
        player_ids: [],
        players: [],
        players_resolution_truncated: anyTruncated,
        empty_reason: 'no_players_for_players_filter',
      };
    }
    for (const p of players) {
      const id = Number(p.id);
      if (!Number.isFinite(id)) continue;
      ids.add(id);
      resolved.push({ id, name: p.name, query: playerName });
    }
  }

  return {
    player_ids: Array.from(ids),
    players: resolved,
    players_resolution_truncated: anyTruncated,
    empty_reason: null,
  };
}

export function uniqueStrings(values) {
  const seen = new Set();
  const out = [];
  for (const v of values || []) {
    const s = String(v ?? '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export function buildRanking(records, limit) {
  const buckets = new Map();
  for (const rec of records) {
    const key = rec.player_id;
    const prev = buckets.get(key) ?? {
      player_id: rec.player_id,
      player_name: rec.player_name,
      team_id: rec.team_id,
      team_name: rec.team_name,
      total_events: 0,
      events: {},
      fixture_ids: new Set(),
      last_timestamp: null,
    };
    prev.total_events += 1;
    prev.events[rec.event_type] = (prev.events[rec.event_type] ?? 0) + 1;
    prev.fixture_ids.add(rec.fixture_id);
    if (
      rec.timestamp != null &&
      (prev.last_timestamp == null || Number(rec.timestamp) > Number(prev.last_timestamp))
    ) {
      prev.last_timestamp = rec.timestamp;
    }
    if (prev.player_name == null && rec.player_name != null) {
      prev.player_name = rec.player_name;
    }
    if (prev.team_name == null && rec.team_name != null) {
      prev.team_name = rec.team_name;
      prev.team_id = rec.team_id;
    }
    buckets.set(key, prev);
  }

  return Array.from(buckets.values())
    .map((row) => ({
      player_id: row.player_id,
      player_name: row.player_name,
      team_id: row.team_id,
      team_name: row.team_name,
      total_events: row.total_events,
      matches: row.fixture_ids.size,
      last_timestamp: row.last_timestamp,
      events: row.events,
    }))
    .sort((a, b) => b.total_events - a.total_events || b.matches - a.matches)
    .slice(0, limit);
}

export function buildByMatchRows(matchesByFixture, records, limit) {
  const rows = Array.from(matchesByFixture.values())
    .sort((a, b) => Number(b.fixture.timestamp ?? 0) - Number(a.fixture.timestamp ?? 0))
    .map((match) => ({
      fixture_id: match.fixture.id ?? null,
      timestamp: match.fixture.timestamp ?? null,
      date: match.fixture.date ?? null,
      league: match.league ?? null,
      teams: match.teams ?? null,
      goals: match.goals ?? null,
      events: records
        .filter((r) => r.fixture_id === match.fixture.id)
        .map((r) => ({
          player_id: r.player_id,
          player_name: r.player_name,
          team_id: r.team_id,
          team_name: r.team_name,
          event_type: r.event_type,
          minute: r.minute,
        })),
    }));
  return rows.slice(0, limit);
}

export async function analyzeWatchedPlayerEvents({
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
    locationName,
    locationsScopeUsername: username,
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
  const watchedFilter = {
    $and: [{ 'user.username': username }, built.filter],
  };
  const watchedMatches = await db.collection('matches').find(watchedFilter, {
    projection: {
      _id: 0,
      fixture: 1,
      league: 1,
      teams: 1,
      goals: 1,
    },
    sort: { 'fixture.timestamp': -1 },
  }).toArray();

  if (watchedMatches.length === 0) {
    return {
      players: [],
      matches: [],
      count_matches: 0,
      count_events: 0,
      limit: clampLimit(limit),
      resolution: built.resolution,
      empty_reason: 'no_watched_matches',
    };
  }

  const fixtureIds = watchedMatches
    .map((row) => Number(row.fixture?.id))
    .filter(Number.isFinite);
  if (fixtureIds.length === 0) {
    return {
      players: [],
      matches: [],
      count_matches: 0,
      count_events: 0,
      limit: clampLimit(limit),
      resolution: built.resolution,
      empty_reason: 'no_fixture_ids',
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

  const realMatches = await db.collection('real_matches').find({
    'fixture.id': { $in: fixtureIds },
  }, {
    projection: {
      _id: 0,
      fixture: 1,
      teams: 1,
      lineups: 1,
      events: 1,
    },
  }).toArray();

  const byFixture = new Map(watchedMatches.map((row) => [Number(row.fixture?.id), row]));
  const selectedPlayersSet = new Set(playerResolution.player_ids);
  const selectedEventsSet = new Set(normalizedEvents);
  const hasPlayerFilter = selectedPlayersSet.size > 0;
  const hasEventFilter = selectedEventsSet.size > 0;
  const allOutputRecords = [];

  for (const realMatch of realMatches) {
    const fixtureId = Number(realMatch.fixture?.id);
    const watched = byFixture.get(fixtureId);
    if (!watched) continue;
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
      if (logic === 'and') {
        outputRecords = records.filter(
          (rec) => playerPredicate(rec) || eventPredicate(rec),
        );
      } else {
        outputRecords = records.filter(
          (rec) => playerPredicate(rec) || eventPredicate(rec),
        );
      }
    } else if (hasPlayerFilter) {
      outputRecords = playerOnlyRecords;
    } else if (hasEventFilter) {
      outputRecords = eventOnlyRecords;
    } else {
      outputRecords = records;
    }

    for (const rec of outputRecords) {
      allOutputRecords.push({
        ...rec,
        fixture_id: watched.fixture?.id ?? rec.fixture_id,
        timestamp: watched.fixture?.timestamp ?? rec.timestamp,
      });
    }
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
  const matchIds = new Set(allOutputRecords.map((rec) => Number(rec.fixture_id)));
  const groupedMatches = new Map(
    watchedMatches
      .filter((match) => matchIds.has(Number(match.fixture?.id)))
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
