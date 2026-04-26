import { getDB } from '../../config/db.js';

function buildRealMatchesFilter(teamIds, seasons) {
  const parts = [];
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
  return parts.length === 0 ? {} : parts.length === 1 ? parts[0] : { $and: parts };
}

function findPlayerTeam(realMatch, playerId) {
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

export async function getPlayedRealMatchesBasic({
  playerId,
  displayName,
  teamIds,
  seasons,
}) {
  const db = getDB();
  const filter = buildRealMatchesFilter(teamIds, seasons);
  const realMatches = await db
    .collection('real_matches')
    .find(filter, {
      sort: { 'fixture.timestamp': -1 },
      projection: {
        _id: 0,
        fixture: 1,
        league: 1,
        teams: 1,
        goals: 1,
        lineups: 1,
        events: 1,
      },
    })
    .toArray();

  const matches = [];
  for (const row of realMatches) {
    const fid = row.fixture?.id;
    if (fid == null) continue;
    const { participated } = findPlayerTeam(row, playerId);
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

export async function getPlayedRealAggregateStats({
  playerId,
  displayName,
  teamIds,
  seasons,
}) {
  const db = getDB();
  const filter = buildRealMatchesFilter(teamIds, seasons);
  const realMatches = await db
    .collection('real_matches')
    .find(filter, {
      sort: { 'fixture.timestamp': -1 },
      projection: {
        _id: 0,
        fixture: 1,
        league: 1,
        teams: 1,
        lineups: 1,
        events: 1,
      },
    })
    .toArray();

  let totalGoals = 0;
  let totalAssists = 0;
  let totalMatches = 0;
  const byTeam = new Map();
  const bySeason = new Map();

  for (const row of realMatches) {
    const { teamId, participated } = findPlayerTeam(row, playerId);
    if (!participated) continue;

    const season =
      row?.league?.season != null ? Number(row.league.season) : null;
    const { goals: g, assists: a } = countGoalsAssistsForPlayer(row, playerId);
    totalGoals += g;
    totalAssists += a;
    totalMatches += 1;

    if (teamId != null) {
      const key = Number(teamId);
      const label = teamLabel(row, key) ?? String(key);
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
