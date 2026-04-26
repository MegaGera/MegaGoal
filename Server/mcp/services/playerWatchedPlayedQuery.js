import { getDB } from '../../config/db.js';
import { MAX_LIMIT, searchTeamsByName } from './teamSearchQuery.js';
import { searchPlayersByName } from './playerSearchQuery.js';

/**
 * Resolve a single player id from a name substring.
 * Returns ok:false with reason `ambiguous` or `no_match`.
 */
export async function resolveSinglePlayerFromName(playerName) {
  const trimmed = String(playerName ?? '').trim();
  if (!trimmed) {
    return {
      ok: false,
      reason: 'empty_name',
      player_id: null,
      display_name: null,
      candidates: [],
      resolution_truncated: false,
    };
  }

  const { players, truncated } = await searchPlayersByName({
    query: trimmed,
    limit: MAX_LIMIT,
  });

  if (players.length === 0) {
    return {
      ok: false,
      reason: 'no_match',
      player_id: null,
      display_name: null,
      candidates: [],
      resolution_truncated: truncated,
    };
  }

  if (players.length > 1) {
    return {
      ok: false,
      reason: 'ambiguous',
      player_id: null,
      display_name: null,
      candidates: players,
      resolution_truncated: truncated,
    };
  }

  const p = players[0];
  return {
    ok: true,
    reason: null,
    player_id: Number(p.id),
    display_name: p.name,
    candidates: players,
    resolution_truncated: truncated,
  };
}

export async function resolveTeamIdsFromOptionalName(teamName) {
  if (teamName == null || String(teamName).trim() === '') {
    return { team_ids: [], team_resolution_truncated: false };
  }
  const { teams, truncated } = await searchTeamsByName({
    query: String(teamName).trim(),
    limit: MAX_LIMIT,
  });
  const team_ids = teams
    .map((t) => t.id)
    .filter((id) => id != null)
    .map(Number);
  return { team_ids, team_resolution_truncated: truncated };
}

function buildWatchedMatchesFilter(username, teamIds, seasons) {
  const parts = [{ 'user.username': username }];
  if (teamIds?.length) {
    parts.push({
      $or: [
        { 'teams.home.id': { $in: teamIds } },
        { 'teams.away.id': { $in: teamIds } },
      ],
    });
  }
  if (seasons?.length) {
    const s = seasons.map(Number).filter(Number.isFinite);
    if (s.length > 0) {
      parts.push({ 'league.season': { $in: s } });
    }
  }
  return parts.length === 1 ? parts[0] : { $and: parts };
}

/** Same participation idea as Stats `PlayerGeneralStatsAPIView._find_player_team`. */
export function findPlayerTeam(realMatch, playerId) {
  const lineups = realMatch.lineups || [];

  for (const lineup of lineups) {
    const team = lineup.team || {};
    const teamId = team.id;
    for (const playerInfo of lineup.startXI || []) {
      const pid = playerInfo.player?.id;
      if (pid === playerId) {
        return { teamId, participated: true };
      }
    }
  }

  for (const event of realMatch.events || []) {
    const eventType = (event.type || '').toLowerCase();
    if (eventType === 'subst') {
      const assist = event.assist || {};
      if (assist.id === playerId) {
        const team = event.team || {};
        return { teamId: team.id, participated: true };
      }
    }
  }

  return { teamId: null, participated: false };
}

function countGoalsAssistsForPlayer(realMatch, playerId) {
  let goals = 0;
  let assists = 0;
  for (const event of realMatch.events || []) {
    const eventType = (event.type || '').toLowerCase();
    const detail = (event.detail || '').toLowerCase();
    if (
      eventType === 'goal' &&
      detail !== 'own goal' &&
      detail !== 'missed penalty'
    ) {
      if (event.player?.id === playerId) goals += 1;
      if (event.assist?.id === playerId) assists += 1;
    }
  }
  return { goals, assists };
}

function teamLabel(realMatch, teamId) {
  if (teamId == null) return null;
  const th = realMatch.teams?.home;
  const ta = realMatch.teams?.away;
  if (th?.id === teamId) return th.name ?? String(teamId);
  if (ta?.id === teamId) return ta.name ?? String(teamId);
  return String(teamId);
}

/** Pipeline aligned with `player_general_stats` real_matches fetch. */
function realMatchesPipeline(fixtureIds, playerId) {
  return [
    {
      $match: {
        'fixture.id': { $in: fixtureIds },
        $or: [
          { 'lineups.startXI.player.id': playerId },
          {
            'events.type': { $regex: 'subst', $options: 'i' },
            $or: [
              { 'events.player.id': playerId },
              { 'events.assist.id': playerId },
            ],
          },
          {
            'events.type': { $regex: 'goal', $options: 'i' },
            $or: [
              { 'events.player.id': playerId },
              { 'events.assist.id': playerId },
            ],
          },
        ],
      },
    },
    {
      $project: {
        'fixture.id': 1,
        lineups: 1,
        events: { $ifNull: ['$events', []] },
        teams: 1,
        league: 1,
        goals: 1,
      },
    },
  ];
}

export async function getPlayedWatchedMatchesBasic({
  username,
  playerId,
  displayName,
  teamIds,
  seasons,
}) {
  const db = getDB();
  const filter = buildWatchedMatchesFilter(username, teamIds, seasons);
  const userMatches = await db
    .collection('matches')
    .find(filter, {
      sort: { 'fixture.timestamp': -1 },
      projection: {
        _id: 0,
        fixture: 1,
        league: 1,
        teams: 1,
        goals: 1,
      },
    })
    .toArray();

  const fixtureIds = userMatches
    .map((m) => m.fixture?.id)
    .filter((id) => id != null)
    .map(Number);

  if (fixtureIds.length === 0) {
    return {
      player: { id: playerId, name: displayName },
      matches: [],
      count: 0,
    };
  }

  const pipe = realMatchesPipeline(fixtureIds, playerId);
  const realDict = {};
  const cursor = db.collection('real_matches').aggregate(pipe);
  for await (const rm of cursor) {
    const fid = rm.fixture?.id;
    if (fid != null) realDict[fid] = rm;
  }

  const matches = [];
  for (const row of userMatches) {
    const fid = row.fixture?.id;
    if (fid == null) continue;
    const rm = realDict[fid];
    if (!rm) continue;
    const { participated } = findPlayerTeam(rm, playerId);
    if (!participated) continue;

    matches.push({
      fixture_id: fid,
      timestamp: row.fixture?.timestamp ?? null,
      date: row.fixture?.date ?? null,
      league: {
        id: row.league?.id ?? null,
        name: row.league?.name ?? null,
        season: row.league?.season ?? null,
      },
      teams: {
        home: {
          id: row.teams?.home?.id ?? null,
          name: row.teams?.home?.name ?? null,
        },
        away: {
          id: row.teams?.away?.id ?? null,
          name: row.teams?.away?.name ?? null,
        },
      },
      goals: {
        home: row.goals?.home ?? null,
        away: row.goals?.away ?? null,
      },
    });
  }

  return {
    player: { id: playerId, name: displayName },
    matches,
    count: matches.length,
  };
}

export async function getPlayedWatchedAggregateStats({
  username,
  playerId,
  displayName,
  teamIds,
  seasons,
}) {
  const db = getDB();
  const filter = buildWatchedMatchesFilter(username, teamIds, seasons);
  const userMatches = await db
    .collection('matches')
    .find(filter, {
      sort: { 'fixture.timestamp': -1 },
      projection: {
        _id: 0,
        fixture: 1,
        league: 1,
      },
    })
    .toArray();

  const fixtureIds = userMatches
    .map((m) => m.fixture?.id)
    .filter((id) => id != null)
    .map(Number);

  if (fixtureIds.length === 0) {
    return {
      player: { id: playerId, name: displayName },
      totals: { matches: 0, goals: 0, assists: 0 },
      by_team: [],
      by_season: [],
    };
  }

  const pipe = realMatchesPipeline(fixtureIds, playerId);
  const realDict = {};
  const cursor = db.collection('real_matches').aggregate(pipe);
  for await (const rm of cursor) {
    const fid = rm.fixture?.id;
    if (fid != null) realDict[fid] = rm;
  }

  let totalGoals = 0;
  let totalAssists = 0;
  let totalMatches = 0;
  const byTeam = new Map();
  const bySeason = new Map();

  const userMatchByFixture = new Map(
    userMatches.map((m) => [m.fixture?.id, m]),
  );

  for (const fid of fixtureIds) {
    const rm = realDict[fid];
    if (!rm) continue;
    const { teamId, participated } = findPlayerTeam(rm, playerId);
    if (!participated) continue;

    const um = userMatchByFixture.get(fid);
    const season =
      um?.league?.season != null ? Number(um.league.season) : null;

    const { goals: g, assists: a } = countGoalsAssistsForPlayer(rm, playerId);
    totalGoals += g;
    totalAssists += a;
    totalMatches += 1;

    if (teamId != null) {
      const key = Number(teamId);
      const label = teamLabel(rm, key) ?? String(key);
      const prev = byTeam.get(key) ?? {
        team_id: key,
        team_name: label,
        matches: 0,
        goals: 0,
        assists: 0,
      };
      prev.matches += 1;
      prev.goals += g;
      prev.assists += a;
      prev.team_name = label;
      byTeam.set(key, prev);
    }

    if (season != null && Number.isFinite(season)) {
      const prevS = bySeason.get(season) ?? {
        season,
        matches: 0,
        goals: 0,
        assists: 0,
      };
      prevS.matches += 1;
      prevS.goals += g;
      prevS.assists += a;
      bySeason.set(season, prevS);
    }
  }

  const by_team = Array.from(byTeam.values()).sort(
    (x, y) => y.matches - x.matches,
  );
  const by_season = Array.from(bySeason.values()).sort(
    (x, y) => y.season - x.season,
  );

  return {
    player: { id: playerId, name: displayName },
    totals: {
      matches: totalMatches,
      goals: totalGoals,
      assists: totalAssists,
    },
    by_team,
    by_season,
  };
}
