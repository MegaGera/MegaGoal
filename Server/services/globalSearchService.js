import { clampLimit, DEFAULT_LIMIT } from './nameSearch.js';
import { searchTeamsByName } from './teamSearchService.js';
import { searchPlayersByName } from './playerSearchService.js';
import { searchLeaguesByName } from './leagueSearchService.js';
import {
  enrichGlobalSearchItems,
  loadWatchedEntitiesForSearch,
} from './watchedEntitiesForSearch.js';

const EMPTY_CACHE_TTL_MS = 2 * 60 * 1000;

/** @type {Map<string, { at: number, items: object[] }>} */
const emptyQueryCache = new Map();

/**
 * Unified global search for the top-menu typeahead.
 *
 * - Empty q: top watched teams/players/leagues interleaved by count (limit 20).
 * - With q: watched hits first (by count), then catalog round-robin fill.
 * - Ignores home filters. One Mongo-backed path (no Stats hop).
 *
 * @param {{ username: string, query?: string, limit?: number }} params
 */
export async function searchGlobal({ username, query, limit } = {}) {
  const lim = clampLimit(limit ?? DEFAULT_LIMIT);
  const trimmed = String(query ?? '').trim();

  if (!username) {
    return { items: [], limit: lim };
  }

  if (!trimmed) {
    const cached = emptyQueryCache.get(username);
    if (cached && Date.now() - cached.at < EMPTY_CACHE_TTL_MS) {
      return { items: cached.items.slice(0, lim), limit: lim };
    }
  }

  const watchedPromise = loadWatchedEntitiesForSearch(username, {
    search: trimmed || null,
  });

  const catalogPromise = trimmed
    ? Promise.all([
        searchTeamsByName({ query: trimmed, limit: lim }),
        searchPlayersByName({ query: trimmed, limit: lim }),
        searchLeaguesByName({ query: trimmed, limit: lim }),
      ])
    : null;

  const [watched, catalog] = await Promise.all([
    watchedPromise,
    catalogPromise,
  ]);

  const watchedItems = [
    ...watched.teams.map(mapWatchedTeam),
    ...watched.players.map(mapWatchedPlayer),
    ...watched.leagues.map(mapWatchedLeague),
  ].sort(compareWatched);

  let items;
  if (!trimmed) {
    items = watchedItems.slice(0, lim);
  } else {
    const [teamCatalog, playerCatalog, leagueCatalog] = catalog;
    const watchedKeys = new Set(
      watchedItems.map((item) => entityKey(item.type, item.id))
    );

    const teamPool = (teamCatalog.teams || [])
      .filter((row) => !watchedKeys.has(entityKey('team', row.id)))
      .map(mapCatalogTeam);
    const playerPool = (playerCatalog.players || [])
      .filter((row) => !watchedKeys.has(entityKey('player', row.id)))
      .map(mapCatalogPlayer);
    const leaguePool = (leagueCatalog.leagues || [])
      .filter((row) => !watchedKeys.has(entityKey('league', row.id)))
      .map(mapCatalogLeague);

    const unseen = [];
    let ti = 0;
    let pi = 0;
    let li = 0;
    while (
      watchedItems.length + unseen.length < lim &&
      (ti < teamPool.length || pi < playerPool.length || li < leaguePool.length)
    ) {
      if (ti < teamPool.length) unseen.push(teamPool[ti++]);
      if (watchedItems.length + unseen.length >= lim) break;
      if (pi < playerPool.length) unseen.push(playerPool[pi++]);
      if (watchedItems.length + unseen.length >= lim) break;
      if (li < leaguePool.length) unseen.push(leaguePool[li++]);
    }

    items = [...watchedItems, ...unseen].slice(0, lim);
  }

  await enrichGlobalSearchItems(items);

  if (!trimmed) {
    emptyQueryCache.set(username, { at: Date.now(), items });
  }

  return { items, limit: lim };
}

function entityKey(type, id) {
  return `${type}:${id}`;
}

function compareWatched(a, b) {
  const ca = a.count ?? 0;
  const cb = b.count ?? 0;
  if (cb !== ca) return cb - ca;
  return String(a.name).localeCompare(String(b.name));
}

function mapWatchedTeam(row) {
  return {
    type: 'team',
    id: row.id,
    name: row.name,
    watched: true,
    count: row.count,
    goals: row.goals ?? null,
    assists: null,
    subtitle: null,
    flagUrl: null,
  };
}

function mapWatchedPlayer(row) {
  return {
    type: 'player',
    id: row.id,
    name: row.name,
    watched: true,
    count: row.count,
    goals: row.goals ?? null,
    assists: row.assists ?? null,
    subtitle: null,
    flagUrl: null,
  };
}

function mapWatchedLeague(row) {
  return {
    type: 'league',
    id: row.id,
    name: row.name,
    watched: true,
    count: row.count,
    goals: null,
    assists: null,
    subtitle: null,
    flagUrl: null,
  };
}

function mapCatalogTeam(row) {
  return {
    type: 'team',
    id: row.id,
    name: row.name,
    watched: false,
    count: null,
    goals: null,
    assists: null,
    subtitle: row.country ?? null,
    flagUrl: row.country_flag ?? null,
  };
}

function mapCatalogPlayer(row) {
  return {
    type: 'player',
    id: row.id,
    name: row.name,
    watched: false,
    count: null,
    goals: null,
    assists: null,
    subtitle: row.last_team || row.nationality || null,
    flagUrl: row.nationality_flag ?? null,
  };
}

function mapCatalogLeague(row) {
  return {
    type: 'league',
    id: row.id,
    name: row.name,
    watched: false,
    count: null,
    goals: null,
    assists: null,
    subtitle: row.country ?? null,
    flagUrl: row.country_flag ?? null,
  };
}

export function invalidateGlobalSearchEmptyCache(username) {
  if (username) emptyQueryCache.delete(username);
  else emptyQueryCache.clear();
}
