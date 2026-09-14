import { getDB } from '../config/db.js';
import { loadNationalityCountryMap } from './nationalityCountryService.js';
import {
  clampLimit,
  createIndexCache,
  popularityFromYears,
  rankItems,
  uniqueFoldedFields,
} from './nameSearch.js';

const cache = createIndexCache(buildTeamIndex);

function mapTeamItem(row) {
  const t = row.team || {};
  return {
    id: t.id,
    name: t.name,
    ...(t.country != null && t.country !== '' ? { country: t.country } : {}),
    ...(t.logo != null && t.logo !== '' ? { logo: t.logo } : {}),
    ...(typeof t.national === 'boolean' ? { national: t.national } : {}),
  };
}

function teamYears(seasons) {
  if (!Array.isArray(seasons)) return [];
  return seasons.map((entry) => Number(entry?.season)).filter(Number.isFinite);
}

function normalizeSeasonEntries(seasons) {
  if (!Array.isArray(seasons)) return [];
  return seasons
    .map((entry) => ({
      league: entry?.league != null ? String(entry.league) : '',
      season: entry?.season != null ? String(entry.season) : '',
    }))
    .filter((entry) => entry.league || entry.season);
}

async function buildTeamIndex(db) {
  const cursor = db.collection('teams').find(
    {},
    {
      projection: {
        _id: 0,
        'team.id': 1,
        'team.name': 1,
        'team.code': 1,
        'team.country': 1,
        'team.logo': 1,
        'team.national': 1,
        seasons: 1,
        previous: 1,
      },
    }
  );

  const index = [];
  for await (const row of cursor) {
    const item = mapTeamItem(row);
    if (!Number.isFinite(item.id) || typeof item.name !== 'string') continue;

    const previous = Array.isArray(row.previous) ? row.previous : [];
    index.push({
      foldedFields: uniqueFoldedFields([
        item.name,
        row.team?.code,
        ...previous,
      ]),
      popularity: popularityFromYears(teamYears(row.seasons)),
      national: row.team?.national === true,
      seasons: normalizeSeasonEntries(row.seasons),
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
  return Number.isFinite(n) && n > 0 ? String(n) : null;
}

function parseTeamSelection(value) {
  const n = Number(value);
  if (n === 1 || n === 2) return n;
  return 0;
}

function teamMatchesFilters(row, { leagueIds, season, teamSelection }) {
  if (teamSelection === 1 && row.national) return false;
  if (teamSelection === 2 && !row.national) return false;

  const seasons = row.seasons || [];
  if (leagueIds.length && season != null) {
    const leagueSet = new Set(leagueIds.map(String));
    return seasons.some(
      (entry) => leagueSet.has(entry.league) && entry.season === season
    );
  }
  if (leagueIds.length) {
    const leagueSet = new Set(leagueIds.map(String));
    return seasons.some((entry) => leagueSet.has(entry.league));
  }
  if (season != null) {
    return seasons.some((entry) => entry.season === season);
  }
  return true;
}

function attachCountryFlag(item, countryMap) {
  const country =
    typeof item?.country === 'string' ? item.country.trim() : '';
  if (!country || !countryMap) return item;
  const hit = countryMap.get(country.toLowerCase());
  const flag =
    hit?.flag != null && String(hit.flag).trim()
      ? String(hit.flag).trim()
      : null;
  if (!flag) return item;
  return { ...item, country_flag: flag };
}

/**
 * Accent-insensitive, token AND search on team name/code (and previous names).
 * Optional filters: league_ids, season, team_selection (0|1|2).
 * Results are ranked by relevance. Hard-capped at 20.
 */
export async function searchTeamsByName({
  query,
  limit,
  leagueIds,
  season,
  teamSelection,
} = {}) {
  const lim = clampLimit(limit);
  const trimmed = String(query ?? '').trim();
  if (!trimmed) {
    return { teams: [], truncated: false, limit: lim };
  }

  const leagueIdsList = parseIdList(leagueIds);
  const seasonYear = parseSeason(season);
  const chip = parseTeamSelection(teamSelection);

  const db = getDB();
  const [index, countryMap] = await Promise.all([
    cache.getIndex(db),
    loadNationalityCountryMap(db),
  ]);

  const rows = index.filter((row) =>
    teamMatchesFilters(row, {
      leagueIds: leagueIdsList,
      season: seasonYear,
      teamSelection: chip,
    })
  );

  const { items, truncated } = rankItems(rows, trimmed, lim);
  const teams = items.map((item) => attachCountryFlag(item, countryMap));
  return { teams, truncated, limit: lim };
}

export async function warmupTeamSearch() {
  const db = getDB();
  if (!db) return;
  await cache.getIndex(db);
}

export { DEFAULT_LIMIT, MAX_LIMIT } from './nameSearch.js';
