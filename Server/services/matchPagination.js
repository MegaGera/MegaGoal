export const DEFAULT_MATCH_LIMIT = 50;
export const MAX_MATCH_LIMIT = 100;

function clampLimit(limit) {
  const n = limit == null ? DEFAULT_MATCH_LIMIT : Number(limit);
  if (!Number.isFinite(n)) return DEFAULT_MATCH_LIMIT;
  return Math.min(Math.max(Math.trunc(n), 1), MAX_MATCH_LIMIT);
}

function clampOffset(offset) {
  const n = offset == null ? 0 : Number(offset);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.trunc(n);
}

export function parseMatchPagination(query) {
  return {
    limit: clampLimit(query.limit),
    offset: clampOffset(query.offset),
  };
}

export function buildMatchListResponse(matches, total, limit, offset) {
  return {
    matches,
    total,
    limit,
    offset,
    hasMore: offset + matches.length < total,
  };
}
