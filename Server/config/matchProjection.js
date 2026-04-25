/** MongoDB list projections for MCP match queries. */

/** Watched `matches` list payloads: omit heavy aggregates only (see matchEntity). */
export const WATCHED_MATCH_LIST_PROJECTION = {
  statistics: 0,
  player_stats: 0,
};

/** Global `real_matches` list payloads: omit large nested blobs. */
export const REAL_MATCH_LIST_PROJECTION = {
  statistics: 0,
  lineups: 0,
  events: 0,
};

/** Hard cap for MCP `get_real_matches_full`: full `real_matches` documents retrieval. */
export const REAL_MATCH_FULL_SEARCH_LIMIT = 20;
