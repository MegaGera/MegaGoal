import { getDB } from '../config/db.js';
import { matchesNameQuery } from './nameSearch.js';
import {
  loadNationalityCountryMap,
  normalizeCountryKey,
} from './nationalityCountryService.js';

/**
 * Watched team / player / league aggregates for global search (no home filters).
 * Enrichment (country / nationality / flags) is done later on the final candidates only.
 */

function finishedWatchedMatchFilter(username) {
  return {
    $and: [
      { 'user.username': username },
      { 'goals.home': { $exists: true, $ne: null } },
      { 'goals.away': { $exists: true, $ne: null } },
    ],
  };
}

/** League ids configured in the app (same source as GET /league/top). */
async function loadConfiguredLeagueIdSet(db) {
  const settings = await db
    .collection('league_settings')
    .find({}, { projection: { _id: 0, league_id: 1 } })
    .toArray();
  const ids = new Set();
  for (const row of settings) {
    const id = Number(row?.league_id);
    if (Number.isFinite(id)) ids.add(id);
  }
  return ids;
}

/**
 * @param {string} username
 * @param {{ search?: string | null }} [options]
 */
export async function loadWatchedEntitiesForSearch(username, options = {}) {
  const search =
    typeof options.search === 'string' ? options.search.trim() : '';
  const db = getDB();
  if (!db || !username) {
    return { teams: [], players: [], leagues: [] };
  }

  const matches = await db
    .collection('matches')
    .find(finishedWatchedMatchFilter(username), {
      projection: {
        _id: 0,
        'fixture.id': 1,
        'teams.home.id': 1,
        'teams.home.name': 1,
        'teams.away.id': 1,
        'teams.away.name': 1,
        'goals.home': 1,
        'goals.away': 1,
        'league.id': 1,
        'league.name': 1,
      },
    })
    .toArray();

  if (!matches.length) {
    return { teams: [], players: [], leagues: [] };
  }

  const teamStats = aggregateTeams(matches);
  const leagueStats = aggregateLeagues(matches);
  const fixtureIds = [];
  for (const match of matches) {
    const id = match?.fixture?.id;
    if (Number.isFinite(id)) fixtureIds.push(id);
  }

  let teams = [...teamStats.values()];
  let players = await rankPlayersByAppearances(db, fixtureIds);
  let leagues = [...leagueStats.values()];

  const configuredLeagueIds = await loadConfiguredLeagueIdSet(db);
  if (configuredLeagueIds.size > 0) {
    leagues = leagues.filter((row) => configuredLeagueIds.has(row.id));
  } else {
    leagues = [];
  }

  if (search) {
    teams = teams.filter((row) => matchesNameQuery(row.name, search));
    players = players.filter((row) => matchesNameQuery(row.name, search));
    leagues = leagues.filter((row) => matchesNameQuery(row.name, search));
  }

  teams.sort(
    (a, b) => b.count - a.count || b.goals - a.goals || a.name.localeCompare(b.name)
  );
  players.sort(
    (a, b) =>
      b.count - a.count ||
      b.startXI - a.startXI ||
      a.name.localeCompare(b.name)
  );
  leagues.sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name)
  );

  return { teams, players, leagues };
}

/**
 * Attach country / nationality / flags to unified search items (mutates in place).
 * @param {Array<{ type: string, id: number, subtitle?: string | null, flagUrl?: string | null }>} items
 */
export async function enrichGlobalSearchItems(items) {
  if (!items?.length) return items;
  const db = getDB();
  if (!db) return items;

  const countryMap = await loadNationalityCountryMap(db);
  const teamIds = [];
  const playerIds = [];
  const leagueIds = [];
  for (const item of items) {
    if (item.type === 'team') teamIds.push(item.id);
    else if (item.type === 'player') playerIds.push(item.id);
    else if (item.type === 'league') leagueIds.push(item.id);
  }

  const [teamDocs, playerDocs, leagueDocs] = await Promise.all([
    teamIds.length
      ? db
          .collection('teams')
          .find(
            { 'team.id': { $in: [...new Set(teamIds)] } },
            { projection: { _id: 0, 'team.id': 1, 'team.country': 1 } }
          )
          .toArray()
      : [],
    playerIds.length
      ? db
          .collection('players')
          .find(
            { 'player.id': { $in: [...new Set(playerIds)] } },
            { projection: { _id: 0, 'player.id': 1, 'player.nationality': 1 } }
          )
          .toArray()
      : [],
    leagueIds.length
      ? db
          .collection('leagues')
          .find(
            { 'league.id': { $in: [...new Set(leagueIds)] } },
            {
              projection: {
                _id: 0,
                'league.id': 1,
                'country.name': 1,
                'country.flag': 1,
              },
            }
          )
          .toArray()
      : [],
  ]);

  /** @type {Map<number, { country: string | null, flag: string | null }>} */
  const teamMeta = new Map();
  for (const doc of teamDocs) {
    const id = doc?.team?.id;
    if (!Number.isFinite(id)) continue;
    const country =
      typeof doc?.team?.country === 'string' ? doc.team.country.trim() : null;
    const hit = country ? countryMap.get(normalizeCountryKey(country)) : null;
    teamMeta.set(id, { country: country || null, flag: hit?.flag ?? null });
  }

  /** @type {Map<number, { nationality: string | null, flag: string | null }>} */
  const playerMeta = new Map();
  for (const doc of playerDocs) {
    const id = doc?.player?.id;
    if (!Number.isFinite(id)) continue;
    const nationality =
      typeof doc?.player?.nationality === 'string'
        ? doc.player.nationality.trim()
        : null;
    const hit = nationality
      ? countryMap.get(normalizeCountryKey(nationality))
      : null;
    playerMeta.set(id, {
      nationality: nationality || null,
      flag: hit?.flag ?? null,
    });
  }

  /** @type {Map<number, { country: string | null, flag: string | null }>} */
  const leagueMeta = new Map();
  for (const doc of leagueDocs) {
    const id = doc?.league?.id;
    if (!Number.isFinite(id)) continue;
    const country =
      typeof doc?.country?.name === 'string' ? doc.country.name.trim() : null;
    const flag =
      typeof doc?.country?.flag === 'string' ? doc.country.flag.trim() : null;
    leagueMeta.set(id, { country: country || null, flag: flag || null });
  }

  for (const item of items) {
    if (item.type === 'team') {
      const meta = teamMeta.get(item.id);
      if (!item.subtitle) item.subtitle = meta?.country ?? null;
      if (!item.flagUrl) item.flagUrl = meta?.flag ?? null;
    } else if (item.type === 'player') {
      const meta = playerMeta.get(item.id);
      if (!item.subtitle) item.subtitle = meta?.nationality ?? null;
      if (!item.flagUrl) item.flagUrl = meta?.flag ?? null;
    } else if (item.type === 'league') {
      const meta = leagueMeta.get(item.id);
      if (!item.subtitle) item.subtitle = meta?.country ?? null;
      if (!item.flagUrl) item.flagUrl = meta?.flag ?? null;
    }
  }

  return items;
}

function aggregateTeams(matches) {
  /** @type {Map<number, { id: number, name: string, count: number, goals: number }>} */
  const map = new Map();
  for (const match of matches) {
    const homeGoals = Number(match?.goals?.home);
    const awayGoals = Number(match?.goals?.away);
    bumpTeam(map, match?.teams?.home, Number.isFinite(homeGoals) ? homeGoals : 0);
    bumpTeam(map, match?.teams?.away, Number.isFinite(awayGoals) ? awayGoals : 0);
  }
  return map;
}

function bumpTeam(map, team, goals) {
  const id = team?.id;
  const name = typeof team?.name === 'string' ? team.name : null;
  if (!Number.isFinite(id) || !name) return;
  const prev = map.get(id);
  if (!prev) {
    map.set(id, { id, name, count: 1, goals });
    return;
  }
  prev.count += 1;
  prev.goals += goals;
}

function aggregateLeagues(matches) {
  /** @type {Map<number, { id: number, name: string, count: number }>} */
  const map = new Map();
  for (const match of matches) {
    const id = match?.league?.id;
    const name =
      typeof match?.league?.name === 'string' ? match.league.name : null;
    if (!Number.isFinite(id) || !name) continue;
    const prev = map.get(id);
    if (!prev) map.set(id, { id, name, count: 1 });
    else prev.count += 1;
  }
  return map;
}

async function rankPlayersByAppearances(db, fixtureIds) {
  if (!fixtureIds.length) return [];

  const cursor = db.collection('real_matches').aggregate([
    { $match: { 'fixture.id': { $in: fixtureIds } } },
    {
      $project: {
        'fixture.id': 1,
        lineups: 1,
        events: {
          $filter: {
            input: { $ifNull: ['$events', []] },
            as: 'event',
            cond: {
              $or: [
                { $eq: [{ $toLower: '$$event.type' }, 'subst'] },
                { $eq: [{ $toLower: '$$event.type' }, 'goal'] },
              ],
            },
          },
        },
      },
    },
  ]);

  /** @type {Map<number, {
   *   id: number, name: string, count: number, startXI: number, goals: number, assists: number
   * }>} */
  const playerMatches = new Map();

  for await (const realMatch of cursor) {
    /** @type {Set<number>} */
    const appearance = new Set();
    /** @type {Map<number, boolean>} */
    const started = new Map();

    for (const lineup of realMatch.lineups || []) {
      for (const playerInfo of lineup.startXI || []) {
        const player = playerInfo?.player || {};
        const playerId = player.id;
        const playerName = player.name;
        if (!Number.isFinite(playerId) || typeof playerName !== 'string') continue;
        ensurePlayer(playerMatches, playerId, playerName);
        appearance.add(playerId);
        started.set(playerId, true);
      }
    }

    for (const event of realMatch.events || []) {
      if (String(event?.type || '').toLowerCase() !== 'subst') continue;
      const assist = event.assist || {};
      const playerId = assist.id;
      const playerName = assist.name;
      if (!Number.isFinite(playerId) || typeof playerName !== 'string') continue;
      if (!appearance.has(playerId)) {
        ensurePlayer(playerMatches, playerId, playerName);
        appearance.add(playerId);
        started.set(playerId, false);
      }
    }

    for (const playerId of appearance) {
      const entry = playerMatches.get(playerId);
      if (!entry) continue;
      entry.count += 1;
      if (started.get(playerId)) entry.startXI += 1;
    }

    for (const event of realMatch.events || []) {
      if (String(event?.type || '').toLowerCase() !== 'goal') continue;
      const detail = String(event?.detail || '').toLowerCase();
      const scorer = event.player || {};
      const scorerId = scorer.id;
      if (
        Number.isFinite(scorerId) &&
        appearance.has(scorerId) &&
        detail !== 'own goal' &&
        detail !== 'missed penalty'
      ) {
        ensurePlayer(
          playerMatches,
          scorerId,
          typeof scorer.name === 'string' ? scorer.name : `Player ${scorerId}`
        ).goals += 1;
      }

      const assist = event.assist || {};
      const assistId = assist.id;
      if (Number.isFinite(assistId) && appearance.has(assistId)) {
        ensurePlayer(
          playerMatches,
          assistId,
          typeof assist.name === 'string' ? assist.name : `Player ${assistId}`
        ).assists += 1;
      }
    }
  }

  return [...playerMatches.values()].filter((row) => row.count > 0);
}

function ensurePlayer(map, playerId, playerName) {
  let entry = map.get(playerId);
  if (!entry) {
    entry = {
      id: playerId,
      name: playerName,
      count: 0,
      startXI: 0,
      goals: 0,
      assists: 0,
    };
    map.set(playerId, entry);
  } else if (playerName && entry.name.startsWith('Player ')) {
    entry.name = playerName;
  }
  return entry;
}
