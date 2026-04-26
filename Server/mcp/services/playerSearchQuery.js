import { getDB } from '../../config/db.js';
import {
  DEFAULT_LIMIT,
  escapeRegex,
  MAX_LIMIT,
} from './teamSearchQuery.js';

function clampLimit(limit) {
  const n = limit == null ? DEFAULT_LIMIT : Number(limit);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(n), 1), MAX_LIMIT);
}

function mapPlayerRows(raw, lim) {
  const truncated = raw.length > lim;
  const players = raw.slice(0, lim).map((row) => {
    const p = row.player || {};
    return {
      id: p.id,
      name: p.name,
    };
  });
  return { players, truncated };
}

/**
 * Case-insensitive substring search on `player.name` with bounded results.
 */
export async function searchPlayersByName({ query, limit }) {
  const db = getDB();
  const lim = clampLimit(limit);
  const trimmed = String(query ?? '').trim();
  if (!trimmed) {
    return { players: [], truncated: false, limit: lim };
  }

  const cursor = db.collection('players').find(
    {
      'player.name': { $regex: escapeRegex(trimmed), $options: 'i' },
    },
    {
      projection: {
        _id: 0,
        'player.id': 1,
        'player.name': 1,
      },
      sort: { 'player.name': 1 },
      limit: lim + 1,
    },
  );

  const raw = await cursor.toArray();
  const { players, truncated } = mapPlayerRows(raw, lim);
  return { players, truncated, limit: lim };
}

export { MAX_LIMIT };
