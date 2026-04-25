# MegaGoal MCP Server Tools

This document describes the MCP tools exposed by the MegaGoal server and how to use them.

The tools are organized in these sections:
- Watched matches vs real matches (which tool to use)
- Real matches (global fixture catalog: by names, today / live)
- Watched matches by names
- Watched matches by ids
- Player watched matches
- Reference lookup

> Current product direction: prefer name-based workflows in clients (no id management in UI/app logic).  
> ID-based tools remain available for learning, debugging, and parity testing.

## Watched matches vs real matches

| Concept | MongoDB collection | Meaning |
|--------|---------------------|---------|
| **Watched matches** | `matches` | Rows the **authenticated user** marked as watched. Every watched tool filters by MCP user (`user.username`). |
| **Real matches** | `real_matches` | **Global** fixture data MegaGoal syncs from the football API (schedule and results for leagues you support). The same fixture may or may not appear in a user’s watched list. |

**Choosing a tool**

- The user asks what they **watched**, saved, or “my games” → watched tools (`search_watched_matches_by_names`, `count_watched_matches_by_names`, `get_watched_matches`, player tools, etc.).
- The user asks about **fixtures in general** (a date, a season, a league’s results, “who played on …”) without tying to their watched list → **`get_real_matches`** / **`count_real_matches_by_names`**.
- The user asks about **today’s schedule**, **live games**, or whether kickoff **has passed** vs **full-time** for fixtures in the catalog → **`getLiveMatches`** (`real_matches`, UTC day; see that section).

MCP still requires authentication for all tools; real-match tools do **not** narrow rows by username.

---

## Real matches (global fixture catalog)

### By names

These query the **`real_matches`** collection with the same human-readable filters as watched name search (team / optional second team for head-to-head, league/country names, seasons, date range). They are **not** scoped to the user’s watched list.

### `get_real_matches`

- Purpose: list real (synced) fixtures matching name and/or date filters.
- Filters: same as `search_watched_matches_by_names` — optional `team_name`, optional `team_2_name` (with `team_name`: only fixtures between those two clubs, home/away either way), `league_name`, `country_name`, `seasons`, `date_from`, `date_to`, `limit`.
- Constraint: provide at least one of `team_name`, `league_name`, `country_name`, `seasons`, `date_from`, `date_to`. If `team_2_name` is set, `team_name` must be non-empty (Zod).
- Returns: `{ count, matches[], truncated, limit, resolution, empty_reason? }` (same shape as watched name search).
- Notes: date filters use `fixture.timestamp`; if `date_from` or `date_to` is set, `seasons` is ignored. Rows omit `statistics`, `lineups`, and `events`.

### `count_real_matches_by_names`

- Purpose: count-only variant of `get_real_matches` with the same filter contract.
- Returns: `{ count, resolution, empty_reason? }`.

### `getLiveMatches`

- Purpose: all **`real_matches`** whose kickoff (`fixture.timestamp`) falls on the **current UTC calendar day** (not the watched list).
- Parameters: none.
- Returns: `utc_date`, `day_start_unix`, `day_end_unix`, `now_unix`, `status_legend` (same short codes as `WebApp/src/app/config/matchStatus.ts`: not started `NS`, `TBD`; finished `FT`, `AET`, `PEN`, `PST`, `CANC`), `count`, and `matches[]`. Each match omits `statistics`, `lineups`, and `events`, and includes a **`live`** object: `kickoff_passed`, `status_finished`, `status_not_started`, `kickoff_passed_and_not_finished`, `status_short`, `fixture_timestamp`.
- Sort: kickoff ascending.

---

## Watched matches by names

These are the primary tools for client-facing flows where you want to avoid id handling.
They resolve human-readable names server-side and keep the client contract clean.

### `search_watched_matches_by_names` (recommended default)

- Purpose: returns watched match rows using human-readable filters.
- Filters:
  - `team_name` (optional)
  - `team_2_name` (optional; head-to-head with `team_name` — requires non-empty `team_name`)
  - `league_name` (optional)
  - `country_name` (optional)
  - `seasons` (optional array of numbers)
  - `date_from` (optional, ISO date/date-time)
  - `date_to` (optional, ISO date/date-time)
  - `limit` (optional)
- Constraint: provide at least one of `team_name`, `league_name`, `country_name`, `seasons`, `date_from`, `date_to`. `team_2_name` alone is invalid; it must accompany `team_name`.
- Returns: `{ count, matches[], truncated, limit, resolution, empty_reason? }`.
- Notes:
  - Name filters are combined with AND semantics.
  - Team names resolve via `teams`; with both `team_name` and `team_2_name`, only matches where those two resolved club sets face each other are returned. `resolution.team_2_resolution_truncated` mirrors the second name lookup cap.
  - Date range filters apply on `fixture.timestamp`.
  - If `date_from` or `date_to` is provided, date filtering takes precedence and `seasons` is ignored.
  - `resolution.*_truncated` indicates lookup caps were hit; refine query when needed.
  - Each match row omits `statistics` and `player_stats` (same as `get_watched_matches`); other stored fields (e.g. lineups, events) are included when present.

### `count_watched_matches_by_names`

- Purpose: same name-based filtering as `search_watched_matches_by_names`, but count-only.
- Filters:
  - `team_name` (optional)
  - `team_2_name` (optional; same rules as search)
  - `league_name` (optional)
  - `country_name` (optional)
  - `seasons` (optional array of numbers)
  - `date_from` (optional, ISO date/date-time)
  - `date_to` (optional, ISO date/date-time)
- Constraint: provide at least one of `team_name`, `league_name`, `country_name`, `seasons`, `date_from`, `date_to`; `team_2_name` requires `team_name`.
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
- Each row omits `statistics` and `player_stats`; other stored fields (e.g. lineups, events) are included when present.
- Use when: you need watched-match payloads and already have ids.

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

- All tools require an authenticated MCP session (same headers as below).
- **Watched-match** and **player-on-watched** tools only return rows for that user’s watched games (`matches` + username).
- **Real-match** tools (`get_real_matches`, `count_real_matches_by_names`, `getLiveMatches`) read the global `real_matches` catalog; they do not filter by username, but still require a valid session.
- If `MCP_API_KEY` is set, send:
  - `Authorization: Bearer <MCP_API_KEY>`
  - `X-MegaGoal-Username: <username>`
- In non-production local usage (without `MCP_API_KEY`), the server uses `WEB_USERNAME` or `test`.

