import { getDB } from '../../config/db.js';
import { escapeRegex, MAX_LIMIT } from './teamSearchQuery.js';

/**
 * Find the authenticated user's locations by case-insensitive substring on `name`.
 * Returns UUID `id` values (same strings stored on `matches.location`).
 */
export async function searchUserLocationsByName({
  username,
  query,
  limit = MAX_LIMIT,
}) {
  const q = query != null ? String(query).trim() : '';
  if (!q || !username) {
    return { location_ids: [], truncated: false, limit };
  }

  const lim = Math.min(Math.max(Number(limit) || MAX_LIMIT, 1), MAX_LIMIT);
  const db = getDB();
  const cursor = db.collection('locations').find(
    {
      'user.username': username,
      name: { $regex: escapeRegex(q), $options: 'i' },
    },
    {
      projection: { _id: 0, id: 1, name: 1 },
      sort: { name: 1 },
      limit: lim + 1,
    },
  );
  const rows = await cursor.toArray();
  const truncated = rows.length > lim;
  const slice = rows.slice(0, lim);
  const location_ids = slice
    .map((r) => r.id)
    .filter((id) => id != null && String(id).trim() !== '');

  return { location_ids, truncated, limit: lim };
}
