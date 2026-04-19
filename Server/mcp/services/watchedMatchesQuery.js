import { getDB } from '../../config/db.js';

/**
 * Watched matches for a user (`matches` collection). Same semantics as GET /match filters.
 */
export async function getWatchedMatchesForUser({
  username,
  team_id,
  season,
  location,
  fixture_id,
}) {
  const db = getDB();
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
  if (username) {
    filters.push({ 'user.username': username });
  }
  if (location != null && location !== '') {
    filters.push({ location });
  }
  if (fixture_id != null && fixture_id !== '') {
    filters.push({ 'fixture.id': Number(fixture_id) });
  }

  const query = filters.length > 0 ? { $and: filters } : {};
  return db.collection('matches').find(query).toArray();
}
