import { getDB } from '../../config/db.js';
import { WATCHED_MATCH_LIST_PROJECTION } from '../../config/matchProjection.js';

/**
 * Builds the MongoDB filter for watched matches (`matches` collection).
 * Same semantics as GET /match filters.
 */
export function buildWatchedMatchesQuery({
  username,
  team_id,
  season,
  league_id,
  location,
  fixture_id,
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

  return filters.length > 0 ? { $and: filters } : {};
}

export async function getWatchedMatchesForUser(args) {
  const db = getDB();
  const query = buildWatchedMatchesQuery(args);
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
