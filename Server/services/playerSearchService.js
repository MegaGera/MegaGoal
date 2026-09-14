import { getDB } from '../config/db.js';
import { loadNationalityCountryMap } from './nationalityCountryService.js';
import {
  clampLimit,
  createIndexCache,
  popularityFromYears,
  rankItems,
  uniqueFoldedFields,
} from './nameSearch.js';

const cache = createIndexCache(buildPlayerIndex);

/** Short TTL for league→team id resolution. */
const SCOPE_TTL_MS = 5 * 60 * 1000;
let scopeCacheKey = '';
let scopeCacheIds = null;
let scopeCacheAt = 0;

function collectCareerEntries(teams) {
  const entries = [];
  const seen = new Set();
  for (const entry of teams || []) {
    const id = entry?.team?.id;
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);
    const seasons = (entry.seasons || [])
      .map(Number)
      .filter(Number.isFinite);
    entries.push({ teamId: id, seasons });
  }
  return entries;
}

function getLastClub(teams, nationalIds) {
  if (!Array.isArray(teams) || teams.length === 0) return undefined;

  let best;
  let bestSeason = -Infinity;

  for (const entry of teams) {
    const id = entry?.team?.id;
    if (nationalIds?.has(id)) continue;
    if (!Number.isFinite(id)) continue;

    const name = entry?.team?.name;
    if (typeof name !== 'string' || !name.trim()) continue;

    const seasons = Array.isArray(entry.seasons) ? entry.seasons : [];
    const maxSeason = seasons.length
      ? Math.max(...seasons.map(Number).filter(Number.isFinite))
      : -Infinity;

    if (maxSeason > bestSeason) {
      bestSeason = maxSeason;
      best = { id, name: name.trim() };
    } else if (best == null) {
      best = { id, name: name.trim() };
    }
  }

  return best;
}

function playerYears(teams) {
  const years = [];
  for (const entry of teams || []) {
    for (const season of entry.seasons || []) {
      const n = Number(season);
      if (Number.isFinite(n)) years.push(n);
    }
  }
  return years;
}

function mapPlayerItem(row, nationalIds) {
  const p = row.player || {};
  const lastClub = getLastClub(row.teams, nationalIds);
  return {
    id: p.id,
    name: p.name,
    ...(p.photo != null && p.photo !== '' ? { photo: p.photo } : {}),
    ...(p.position != null && p.position !== '' ? { position: p.position } : {}),
    ...(p.nationality != null && p.nationality !== ''
      ? { nationality: p.nationality }
      : {}),
    ...(lastClub
      ? { last_team: lastClub.name, last_team_id: lastClub.id }
      : {}),
  };
}

async function loadNationalTeamIds(db) {
  const rows = await db
    .collection('teams')
    .find(
      { 'team.national': true },
      { projection: { _id: 0, 'team.id': 1 } }
    )
    .toArray();

  const next = new Set();
  for (const row of rows) {
    const id = row?.team?.id;
    if (Number.isFinite(id)) next.add(id);
  }
  return next;
}

async function buildPlayerIndex(db) {
  const nationalIds = await loadNationalTeamIds(db);
  const cursor = db.collection('players').find(
    {},
    {
      projection: {
        _id: 0,
        'player.id': 1,
        'player.name': 1,
        'player.firstname': 1,
        'player.lastname': 1,
        'player.photo': 1,
        'player.position': 1,
        'player.nationality': 1,
        'teams.team.id': 1,
        'teams.team.name': 1,
        'teams.seasons': 1,
      },
    }
  );

  const index = [];
  for await (const row of cursor) {
    const item = mapPlayerItem(row, nationalIds);
    if (!Number.isFinite(item.id) || typeof item.name !== 'string') continue;

    const firstname = row.player?.firstname;
    const lastname = row.player?.lastname;
    const fullName =
      typeof firstname === 'string' && typeof lastname === 'string'
        ? `${firstname} ${lastname}`
        : '';

    const career = collectCareerEntries(row.teams);
    const teamIds = career.map((entry) => entry.teamId);
    const hasNational = teamIds.some((id) => nationalIds.has(id));
    const hasClub = teamIds.some((id) => !nationalIds.has(id));

    index.push({
      foldedFields: uniqueFoldedFields([
        item.name,
        firstname,
        lastname,
        fullName,
      ]),
      popularity: popularityFromYears(playerYears(row.teams)),
      teamIds,
      career,
      hasNational,
      hasClub,
      item,
    });
  }
  return index;
}

function parseIdList(value) {
  if (value == null || value === '') return [];
  const raw = Array.isArray(value) ? value : String(value).split(',');
  const ids = [];
  const seen = new Set();
  for (const part of raw) {
    const n = Number(String(part).trim());
    if (!Number.isFinite(n) || seen.has(n)) continue;
    seen.add(n);
    ids.push(n);
  }
  return ids;
}

function parseSeason(value) {
  if (value == null || value === '' || value === '0') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseTeamSelection(value) {
  const n = Number(value);
  if (n === 1 || n === 2) return n;
  return 0;
}

/**
 * Resolve league / clubs-nations chip to a set of team ids from `teams`.
 * Returns null when those filters do not constrain the catalog.
 */
async function resolveScopeTeamIds(db, { leagueIds, season, teamSelection }) {
  const needsLeague = leagueIds.length > 0;
  const needsChip = teamSelection === 1 || teamSelection === 2;
  if (!needsLeague && !needsChip) return null;

  const key = JSON.stringify({
    leagueIds,
    season: season ?? 0,
    teamSelection,
  });
  if (
    scopeCacheIds != null &&
    scopeCacheKey === key &&
    Date.now() - scopeCacheAt < SCOPE_TTL_MS
  ) {
    return scopeCacheIds;
  }

  const filters = [];
  if (needsLeague && season != null) {
    filters.push({
      seasons: {
        $elemMatch: {
          league: { $in: leagueIds.map(String) },
          season: String(season),
        },
      },
    });
  } else if (needsLeague) {
    filters.push({ 'seasons.league': { $in: leagueIds.map(String) } });
  } else if (season != null) {
    filters.push({ 'seasons.season': String(season) });
  }

  if (teamSelection === 1) {
    filters.push({ 'team.national': { $ne: true } });
  } else if (teamSelection === 2) {
    filters.push({ 'team.national': true });
  }

  const query = filters.length ? { $and: filters } : {};
  const rows = await db
    .collection('teams')
    .find(query, { projection: { _id: 0, 'team.id': 1 } })
    .toArray();

  const ids = new Set();
  for (const row of rows) {
    const id = row?.team?.id;
    if (Number.isFinite(id)) ids.add(id);
  }

  scopeCacheKey = key;
  scopeCacheIds = ids;
  scopeCacheAt = Date.now();
  return ids;
}

function careerMatchesFilters(row, { selectedTeamIds, scopeTeamIds, season }) {
  const career = row.career || [];

  if (selectedTeamIds?.size) {
    return career.some((entry) => {
      if (!selectedTeamIds.has(entry.teamId)) return false;
      if (season != null && !entry.seasons.includes(season)) return false;
      return true;
    });
  }

  if (scopeTeamIds != null) {
    if (scopeTeamIds.size === 0) return false;
    return career.some((entry) => {
      if (!scopeTeamIds.has(entry.teamId)) return false;
      if (season != null && !entry.seasons.includes(season)) return false;
      return true;
    });
  }

  if (season != null) {
    return career.some((entry) => entry.seasons.includes(season));
  }

  return true;
}

function attachNationalityFlag(item, countryMap) {
  const nationality =
    typeof item?.nationality === 'string' ? item.nationality.trim() : '';
  if (!nationality || !countryMap) return item;
  const country = countryMap.get(nationality.toLowerCase());
  const flag =
    country?.flag != null && String(country.flag).trim()
      ? String(country.flag).trim()
      : null;
  if (!flag) return item;
  return { ...item, nationality_flag: flag };
}

/**
 * Accent-insensitive, token AND search on player name / first name / last name.
 * Optional career filters: team_ids, league_ids, season, team_selection (0|1|2).
 * Results are ranked by relevance. Hard-capped at 20.
 */
export async function searchPlayersByName({
  query,
  limit,
  teamIds,
  leagueIds,
  season,
  teamSelection,
} = {}) {
  const lim = clampLimit(limit);
  const trimmed = String(query ?? '').trim();
  if (!trimmed) {
    return { players: [], truncated: false, limit: lim };
  }

  const selectedTeamIdsList = parseIdList(teamIds);
  const leagueIdsList = parseIdList(leagueIds);
  const seasonYear = parseSeason(season);
  const chip = parseTeamSelection(teamSelection);

  const db = getDB();
  const [index, countryMap, scopeTeamIds] = await Promise.all([
    cache.getIndex(db),
    loadNationalityCountryMap(db),
    resolveScopeTeamIds(db, {
      leagueIds: leagueIdsList,
      // When explicit teams are selected, league scope is not needed for id set;
      // season still applies on player career below.
      season: selectedTeamIdsList.length ? null : seasonYear,
      teamSelection: selectedTeamIdsList.length ? 0 : chip,
    }),
  ]);

  const selectedTeamIds =
    selectedTeamIdsList.length > 0 ? new Set(selectedTeamIdsList) : null;

  // Clubs/nations chip without league/team: use career national flags on the index.
  let rows = index;
  if (!selectedTeamIds && scopeTeamIds == null && (chip === 1 || chip === 2)) {
    rows = rows.filter((row) => (chip === 1 ? row.hasClub : row.hasNational));
  }

  rows = rows.filter((row) =>
    careerMatchesFilters(row, {
      selectedTeamIds,
      scopeTeamIds: selectedTeamIds ? null : scopeTeamIds,
      season: seasonYear,
    })
  );

  if (selectedTeamIds && chip === 1) {
    rows = rows.filter((row) => row.hasClub);
  } else if (selectedTeamIds && chip === 2) {
    rows = rows.filter((row) => row.hasNational);
  }

  const { items, truncated } = rankItems(rows, trimmed, lim);
  const players = items.map((item) => attachNationalityFlag(item, countryMap));
  return { players, truncated, limit: lim };
}

export async function warmupPlayerSearch() {
  const db = getDB();
  if (!db) return;
  await cache.getIndex(db);
}

export { DEFAULT_LIMIT, MAX_LIMIT } from './nameSearch.js';
