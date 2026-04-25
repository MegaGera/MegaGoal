# MegaGoal MCP Server Tools

This document describes the MCP tools exposed by the MegaGoal server and how to use them.

The tools are organized in these sections:
- Watched matches by names
- Watched matches by ids
- Player watched matches
- Reference lookup

> Current product direction: prefer name-based workflows in clients (no id management in UI/app logic).  
> ID-based tools remain available for learning, debugging, and parity testing.

## Watched matches by names

These are the primary tools for client-facing flows where you want to avoid id handling.
They resolve human-readable names server-side and keep the client contract clean.

### `search_watched_matches_by_names` (recommended default)

- Purpose: returns watched match rows using human-readable filters.
- Filters:
  - `team_name` (optional)
  - `league_name` (optional)
  - `country_name` (optional)
  - `seasons` (optional array of numbers)
  - `date_from` (optional, ISO date/date-time)
  - `date_to` (optional, ISO date/date-time)
  - `limit` (optional)
- Constraint: provide at least one of `team_name`, `league_name`, `country_name`, `seasons`, `date_from`, `date_to`.
- Returns: `{ count, matches[], truncated, limit, resolution, empty_reason? }`.
- Notes:
  - Name filters are combined with AND semantics.
  - Team name resolves via `teams`; league/country names resolve via `leagues`.
  - Date range filters apply on `fixture.timestamp`.
  - If `date_from` or `date_to` is provided, date filtering takes precedence and `seasons` is ignored.
  - `resolution.*_truncated` indicates lookup caps were hit; refine query when needed.

### `count_watched_matches_by_names`

- Purpose: same name-based filtering as `search_watched_matches_by_names`, but count-only.
- Filters:
  - `team_name` (optional)
  - `league_name` (optional)
  - `country_name` (optional)
  - `seasons` (optional array of numbers)
  - `date_from` (optional, ISO date/date-time)
  - `date_to` (optional, ISO date/date-time)
- Constraint: provide at least one of `team_name`, `league_name`, `country_name`, `seasons`, `date_from`, `date_to`.
- Returns: `{ count, resolution, empty_reason? }`.
- Use when: you only need totals for name-based filters.

### Name-first client strategy

If your goal is to avoid ids in the client:
1. Use `search_watched_matches_by_names` for list/detail views.
2. Use `count_watched_matches_by_names` for counters, badges, and pagination totals.
3. Use reference lookup tools only to refine ambiguous names (not to persist ids in client state).

---

## Watched matches by ids

These tools query watched matches directly with numeric filters. They are useful for internal checks and migration/testing scenarios.

### `get_watched_matches`

- Purpose: returns watched match rows for the authenticated user.
- Filters (all optional): `team_id`, `season`, `league_id`, `location`, `fixture_id`.
- Returns: `{ count, matches[] }`.
- Use when: you need full watched-match documents and already have ids.

### `count_watched_matches`

- Purpose: returns only how many watched matches match the same id-based filters.
- Filters (all optional): `team_id`, `season`, `league_id`, `location`, `fixture_id`.
- Returns: `{ count }`.
- Use when: you only need totals (faster/lighter than fetching match rows).

---

## Player watched matches

These tools focus on a named player and return only watched fixtures where that player actually participated.

### `player_played_watched_matches`

- Purpose: returns basic watched-match rows where the resolved player played.
- Required: `player_name`.
- Optional: `team_name`, `seasons`.
- Returns:
  - Success: `{ ok: true, player, matches[], count, team_resolution_truncated }`
  - Ambiguous/no match: `{ ok: false, reason, candidates, resolution_truncated }`
  - Team filter no result: `{ ok: false, empty_reason: "no_teams_for_team_name", ... }`
- Use when: you need fixture-level rows for a player's watched games.

### `player_played_watched_stats`

- Purpose: same player/filter contract as above, but returns aggregates instead of match rows.
- Required: `player_name`.
- Optional: `team_name`, `seasons`.
- Returns:
  - Success: `{ ok: true, player, totals, by_team, by_season, team_resolution_truncated }`
  - Same error/ambiguity patterns as `player_played_watched_matches`.
- Use when: you need goals/assists/matches totals and splits for watched games.

---

## Reference lookup

These tools help discover team/league data and disambiguate user input.

### `search_teams`

- Purpose: find teams by case-insensitive name substring.
- Required: `query`.
- Optional: `limit`, `country`, `league_id`, `season`.
- Returns: `{ count, teams[], truncated, limit }`.
- Use when: a team name is ambiguous and you need candidate teams.

### `list_teams_by_league_or_country`

- Purpose: list teams by scope without a name query.
- Optional inputs: `country`, `league_id`, `season`, `limit`.
- Constraint: at least one of `country` or `league_id` is required; `season` requires `league_id`.
- Returns: `{ count, teams[], truncated, limit }`.
- Use when: you need a scoped catalog of teams.

### `list_leagues`

- Purpose: list competitions with basic metadata.
- Optional filters: `query`, `country`, `league_id`, `top_only`, `limit`.
- Returns: `{ count, leagues[], truncated, limit }`.
- Use when: you need to find valid competitions or narrow league context by name/country.

---

## Authentication and scope

- All tools are scoped to the authenticated MCP user session.
- If `MCP_API_KEY` is set, send:
  - `Authorization: Bearer <MCP_API_KEY>`
  - `X-MegaGoal-Username: <username>`
- In non-production local usage (without `MCP_API_KEY`), the server uses `WEB_USERNAME` or `test`.

