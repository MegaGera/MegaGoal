import { getDB } from '../../config/db.js';
import { WATCHED_MATCH_LIST_PROJECTION } from '../../config/matchProjection.js';

/**
 * UTC instant for a date-range bound.
 * Date-only values (`YYYY-MM-DD`) use the start of that UTC day for `from`
 * and the end of that UTC day for `to`. Date-times are parsed as given.
 */
export function parseWatchedMatchDateBoundary(value, boundary) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const label = boundary === 'from' ? 'date_from' : 'date_to';
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const ms = isDateOnly
    ? Date.parse(`${raw}${boundary === 'from' ? 'T00:00:00.000Z' : 'T23:59:59.999Z'}`)
    : Date.parse(raw);
  if (Number.isNaN(ms)) {
    throw new Error(
      `Invalid ${label} value. Use ISO date/date-time, for example "2026-04-01" or "2026-04-01T10:30:00Z".`,
    );
  }
  return ms / 1000;
}

/**
 * Builds the MongoDB filter for watched matches (`matches` collection).
 * Same semantics as GET /match filters.
 * `date_from` / `date_to` filter `fixture.timestamp` (UTC).
 */
export function buildWatchedMatchesQuery({
  username,
  team_id,
  season,
  league_id,
  location,
  fixture_id,
  date_from,
  date_to,
}) {
  const filters = [];

  if (team_id != null && team_id !== '') {
    const id = Number(team_id);
    filters.push({
      $or: [{ 'teams.home.id': id }, { 'teams.away.id': id }],
    });
  }
  if (season != null && season !== '') {
    filters.push({ 'league.season': Number(season) });
  }
  if (league_id != null && league_id !== '') {
    filters.push({ 'league.id': Number(league_id) });
  }
  if (username) {
    filters.push({ 'user.username': username });
  }
  if (location != null && location !== '') {
    filters.push({ location });
  }
  if (fixture_id != null && fixture_id !== '') {
    filters.push({ 'fixture.id': Number(fixture_id) });
  }

  const fromTs = parseWatchedMatchDateBoundary(date_from, 'from');
  const toTs = parseWatchedMatchDateBoundary(date_to, 'to');
  if (fromTs != null || toTs != null) {
    if (fromTs != null && toTs != null && fromTs > toTs) {
      throw new Error('Invalid date range: date_from must be <= date_to.');
    }
    const tsFilter = {};
    if (fromTs != null) tsFilter.$gte = fromTs;
    if (toTs != null) tsFilter.$lte = toTs;
    filters.push({ 'fixture.timestamp': tsFilter });
  }

  return filters.length > 0 ? { $and: filters } : {};
}

const WATCHED_MATCH_LIGHT_PROJECTION = {
  _id: 0,
  'fixture.id': 1,
  location: 1,
};

function toWatchedMatchLightRow(row) {
  const fixtureId = Number(row?.fixture?.id);
  if (!Number.isFinite(fixtureId)) {
    return null;
  }
  return {
    fixture_id: fixtureId,
    location: typeof row.location === 'string' ? row.location : null,
  };
}

export async function getWatchedMatchesForUser(args) {
  const db = getDB();
  const query = buildWatchedMatchesQuery(args);
  const light = args?.light === true || args?.light === 'true' || args?.light === '1';
  if (light) {
    const rows = await db
      .collection('matches')
      .find(query, { projection: WATCHED_MATCH_LIGHT_PROJECTION })
      .toArray();
    return rows.map(toWatchedMatchLightRow).filter((row) => row != null);
  }
  return db
    .collection('matches')
    .find(query, {
      projection: WATCHED_MATCH_LIST_PROJECTION,
    })
    .toArray();
}

/**
 * Count of documents matching {@link getWatchedMatchesForUser} (no document load).
 */
export async function countWatchedMatchesForUser(args) {
  const db = getDB();
  const query = buildWatchedMatchesQuery(args);
  return db.collection('matches').countDocuments(query);
}
