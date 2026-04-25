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

### Player events filter semantics (`events`)

When using name-based match tools, `events` is an optional array of objects:

- Shape: `[{ "player_name": "Cristiano Ronaldo", "event": "goal" }]`
- `player_name`: semantic, case-insensitive name lookup in the `players` collection.
- `event`: accepted values and exact meaning:
  - `lineup`: player appears in either `lineups.startXI` or `lineups.substitutes`.
  - `startingXI`: player appears in `lineups.startXI`.
  - `bench`: player appears in `lineups.substitutes`.
  - `goal`: player is the scorer on a `goal` event (`events.type = goal`), excluding `own goal` and `missed penalty`.
  - `assist`: player is the assister on a `goal` event (`events.type = goal`).
  - `own_goal`: player is the scorer on a `goal` event with `detail = own goal`.
  - `missed_penalty`: player is the scorer on a `goal` event with `detail = missed penalty`.
  - `penalty`: player is the scorer on a `goal` event with `detail = penalty` (penalty scored).
  - `substitute`: player appears on a substitution event (`events.type = subst`) as either the replaced player (`events.player`) or the incoming player (`events.assist`).
  - `yellow_card`: player is booked on a `card` event where `detail` contains `yellow`.
  - `second_yellow`: player is booked on a `card` event where `detail` contains `second yellow`.
  - `red_card`: player is sent off on a `card` event where `detail` contains `red`.
  - `card`: player has any `card` event (yellow, second yellow, red, etc.).
  - `var`: player appears on a `var` event (`events.type = var`).
  - `penalty_shootout_scored`: player appears on a `goal` event with `detail` containing `penalty shootout` and comments not indicating a miss.
  - `penalty_shootout_missed`: player appears on a `goal` event with `detail` containing `penalty shootout` and comments indicating a miss.
- Multiple entries are combined with **AND** semantics.
  - Example: Ronaldo `goal` + Benzema `assist` + Bale `bench` returns only matches where all three conditions hold.
- Scope rules:
  - **Real-match tools** apply this directly on `real_matches`.
  - **Watched-match tools** apply it on `real_matches` first, then intersect by fixture id with user-scoped `matches`.

### `get_real_matches`

- Purpose: list real (synced) fixtures matching name and/or date filters.
- Filters: same as `search_watched_matches_by_names` — optional `team_name`, optional `team_2_name` (with `team_name`: only fixtures between those two clubs, home/away either way), `league_name`, `country_name`, `seasons`, `date_from`, `date_to`, `events`, `limit`.
- Constraint: provide at least one of `team_name`, `league_name`, `country_name`, `seasons`, `date_from`, `date_to`, `events`. If `team_2_name` is set, `team_name` must be non-empty (Zod).
- Returns: `{ count, matches[], truncated, limit, resolution, empty_reason? }` (same shape as watched name search).
- Notes: date filters use `fixture.timestamp`; if `date_from` or `date_to` is set, `seasons` is ignored. `events` accepts objects like `{ "player_name": "Lamine Yamal", "event": "lineup" }`. Supported event values are `lineup` (startXI or bench), `startingXI` (startXI only), `bench` (bench only), `substitute` (in/out on substitution), `goal`, `assist`, `own_goal`, `missed_penalty`, `penalty`, `yellow_card`, `second_yellow`, `red_card`, `card`, `var`, `penalty_shootout_scored`, and `penalty_shootout_missed`, with semantic player-name resolution. Rows omit `statistics`, `lineups`, and `events`.

### `count_real_matches_by_names`

- Purpose: count-only variant of `get_real_matches` with the same filter contract.
- Returns: `{ count, resolution, empty_reason? }`.

### `get_real_matches_full`

- Purpose: narrow to one or a few **`real_matches`** rows using the **same** name/season/date/events filters as `get_real_matches`, but return **complete** documents (including `statistics`, `lineups`, and `events`).
- Filters: same contract as `get_real_matches` / `count_real_matches_by_names` (no `limit` parameter — the server always caps the query at **20** documents).
- Optional include flags: `include_statistics`, `include_lineups`, `include_events` (all default to `true`). Set any to `false` to omit that field from returned rows.
- Returns: `{ count, max_documents: 20, matches[], resolution, empty_reason? }`.
- Sort: `fixture.timestamp` descending (most recent first among the cap).
- Use when: the agent needs full fixture payloads (single or multiple fixtures, e.g. a whole weekend in one league); use `get_real_matches` for larger trimmed lists.

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
  - `events` (optional array of objects `{ player_name, event }`; supported events: `lineup`, `startingXI`, `bench`, `substitute`, `goal`, `assist`, `own_goal`, `missed_penalty`, `penalty`, `yellow_card`, `second_yellow`, `red_card`, `card`, `var`, `penalty_shootout_scored`, `penalty_shootout_missed`)
  - `limit` (optional)
- Constraint: provide at least one of `team_name`, `league_name`, `country_name`, `seasons`, `date_from`, `date_to`, `events`. `team_2_name` alone is invalid; it must accompany `team_name`.
- Returns: `{ count, matches[], truncated, limit, resolution, empty_reason? }`.
- Notes:
  - Name filters are combined with AND semantics.
  - Team names resolve via `teams`; with both `team_name` and `team_2_name`, only matches where those two resolved club sets face each other are returned. `resolution.team_2_resolution_truncated` mirrors the second name lookup cap.
  - Date range filters apply on `fixture.timestamp`.
  - If `date_from` or `date_to` is provided, date filtering takes precedence and `seasons` is ignored.
  - `events` filters are applied by resolving `player_name` semantically against `players`; for watched matches, matching is done by intersecting watched fixtures with `real_matches` lineup/event matches.
  - Example `events`: `[{"player_name":"Lamine Yamal","event":"lineup"}]`.
  - Event semantics: `lineup` checks startXI or bench, `startingXI` checks startXI only, `bench` checks bench only, `substitute` checks substitution involvement (in or out), `goal` checks goal scorer events (excluding own goals and missed penalties), `assist` checks assister on goal events, `own_goal` checks own goals, `missed_penalty` checks missed penalties, `penalty` checks scored penalties, `yellow_card` checks yellow cards, `second_yellow` checks second-yellow cards, `red_card` checks red cards, `card` checks any card, `var` checks VAR events, `penalty_shootout_scored`/`penalty_shootout_missed` check penalty-shootout outcomes.
  - Multiple `events` entries are combined with AND semantics, so one query can require conditions across different players (for example: Ronaldo `goal`, Benzema `assist`, Bale `bench`).
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
- `events` (optional array of objects `{ player_name, event }`; supported events: `lineup`, `startingXI`, `bench`, `substitute`, `goal`, `assist`, `own_goal`, `missed_penalty`, `penalty`, `yellow_card`, `second_yellow`, `red_card`, `card`, `var`, `penalty_shootout_scored`, `penalty_shootout_missed`)
- Constraint: provide at least one of `team_name`, `league_name`, `country_name`, `seasons`, `date_from`, `date_to`, `events`; `team_2_name` requires `team_name`.
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
- **Real-match** tools (`get_real_matches`, `count_real_matches_by_names`, `get_real_matches_full`, `getLiveMatches`) read the global `real_matches` catalog; they do not filter by username, but still require a valid session.
- If `MCP_API_KEY` is set, send:
  - `Authorization: Bearer <MCP_API_KEY>`
  - `X-MegaGoal-Username: <username>`
- In non-production local usage (without `MCP_API_KEY`), the server uses `WEB_USERNAME` or `test`.

