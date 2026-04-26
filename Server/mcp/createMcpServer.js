import { FastMCP, UserError } from 'fastmcp';
import { z } from 'zod';
import {
  countWatchedMatchesForUser,
  getWatchedMatchesForUser,
} from './services/watchedMatchesQuery.js';
import { listLeagues } from './services/leagueListQuery.js';
import {
  countRealMatchesByNames,
  countWatchedMatchesByNames,
  getRealMatchesFullByNames,
  searchRealMatchesByNames,
  searchWatchedMatchesByNames,
} from './services/matchSearchQuery.js';
import {
  markWatchedMatchesByNames,
  unmarkWatchedMatchesByNames,
} from './services/watchedMatchesWriteQuery.js';
import {
  getPlayedWatchedAggregateStats,
  getPlayedWatchedMatchesBasic,
  resolveSinglePlayerFromName,
  resolveTeamIdsFromOptionalName,
} from './services/playerWatchedPlayedQuery.js';
import { analyzeWatchedPlayerEvents } from './services/watchedPlayerEventsQuery.js';
import { analyzeRealPlayerEvents } from './services/realPlayerEventsQuery.js';
import { getLiveRealMatchesForUtcDay } from './services/liveRealMatchesQuery.js';
import {
  listTeamsByLeagueOrCountry,
  MAX_LIMIT,
  searchTeamsByName,
} from './services/teamSearchQuery.js';

function resolveAuth(request) {
  const apiKey = process.env.MCP_API_KEY;
  const authHeader = request.headers?.authorization;
  const bearer =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null;

  if (apiKey) {
    if (bearer !== apiKey) {
      throw new Error('Invalid or missing MCP API key (Authorization: Bearer)');
    }
    const usernameHeader = request.headers?.['x-megagoal-username'];
    const username = Array.isArray(usernameHeader)
      ? usernameHeader[0]
      : usernameHeader;
    if (!username || !String(username).trim()) {
      throw new Error('Missing X-MegaGoal-Username header');
    }
    return { username: String(username).trim() };
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'MCP_API_KEY is required in production. Set MCP_API_KEY and send Authorization + X-MegaGoal-Username.',
    );
  }

  return {
    username: process.env.WEB_USERNAME || 'test',
  };
}

export function createMcpServer() {
  const server = new FastMCP({
    name: 'MegaGoal Server MCP',
    version: '0.0.1',
    instructions:
      'Tools for MegaGoal football data. Use list_leagues for competitions (id, name, country); search_teams / list_teams_by_league_or_country for clubs. Watched matches (user-marked in `matches`): get_watched_matches / count_watched_matches by numeric ids (and location UUID / fixture); search_watched_matches_by_names / count_watched_matches_by_names with optional ids (fixture ids array) or team_name, optional team_2_name (head-to-head when both set), league_name, country_name, optional location_name (substring on user `locations.name`, resolves to matches.location UUID), seasons, optional date_from/date_to (date takes precedence over seasons when provided), optional events array of { player_name?, event } (omit player_name for fixture-wide event presence). If ids is provided, other filters are ignored. Writes: mutate_watched_matches_by_names: mark inserts from real_matches (POST /match shape); optional location_name sets matches.location when a user location matches, otherwise the row is still created without location; unmark uses fixture filters only (location_name ignored, no bulk delete by location). To change a watched match location: unmark then mark again with the new location_name. Real matches (`real_matches`, no location_name): get_real_matches / count_real_matches_by_names with optional ids or the same team/league/country/date/events filters; if ids is provided, other filters are ignored; get_real_matches_full up to 20 full documents. getLiveMatches for today UTC day with live flags. player_played_watched_matches / player_played_watched_stats for single-player watched data. analyze_watched_player_events for reusable multi-player + multi-event analytics on watched fixtures. analyze_real_player_events for the same analytics patterns on global real_matches.',
    authenticate: async (request) => resolveAuth(request),
  });

  server.addTool({
    name: 'get_watched_matches',
    title: 'Get watched matches',
    description:
      'Returns watched matches for the authenticated MegaGoal user from the matches collection. Optional filters mirror GET /match: team_id, season, league_id, location, fixture_id. User identity comes from MCP auth (see X-MegaGoal-Username when using MCP_API_KEY). For filters by club or competition name (not ids), use search_watched_matches_by_names. Documents omit statistics and player_stats (large aggregates); other fields such as lineups and events are included when stored on the row.',
    parameters: z.object({
      team_id: z.coerce.number().int().optional(),
      season: z.coerce.number().int().optional(),
      league_id: z.coerce.number().int().optional(),
      location: z.string().optional(),
      fixture_id: z.coerce.number().int().optional(),
    }),
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
    },
    execute: async (args, context) => {
      const sessionUser =
        context.session &&
        typeof context.session.username === 'string'
          ? context.session.username
          : undefined;
      if (!sessionUser) {
        throw new UserError('Missing authenticated username on MCP session.');
      }
      const username = sessionUser;

      const matches = await getWatchedMatchesForUser({
        username,
        team_id: args.team_id,
        season: args.season,
        league_id: args.league_id,
        location: args.location,
        fixture_id: args.fixture_id,
      });

      return JSON.stringify(
        {
          count: matches.length,
          matches,
        },
        null,
        2,
      );
    },
  });

  server.addTool({
    name: 'count_watched_matches',
    title: 'Count watched matches',
    description:
      'Returns how many watched matches match the filters for the authenticated user. Same optional filters as get_watched_matches (team_id, season, league_id, location, fixture_id). Use this instead of get_watched_matches when you only need the total count. For counts by team/league/country names, use count_watched_matches_by_names.',
    parameters: z.object({
      team_id: z.coerce.number().int().optional(),
      season: z.coerce.number().int().optional(),
      league_id: z.coerce.number().int().optional(),
      location: z.string().optional(),
      fixture_id: z.coerce.number().int().optional(),
    }),
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
    },
    execute: async (args, context) => {
      const sessionUser =
        context.session &&
        typeof context.session.username === 'string'
          ? context.session.username
          : undefined;
      if (!sessionUser) {
        throw new UserError('Missing authenticated username on MCP session.');
      }

      const count = await countWatchedMatchesForUser({
        username: sessionUser,
        team_id: args.team_id,
        season: args.season,
        league_id: args.league_id,
        location: args.location,
        fixture_id: args.fixture_id,
      });

      return JSON.stringify({ count }, null, 2);
    },
  });

  server.addTool({
    name: 'search_teams',
    title: 'Search teams by name',
    description:
      'Find teams in the teams collection by case-insensitive substring on the official name. Returns id, name, and country when present. Use optional country or league_id (+ season) to narrow ambiguous names. If truncated is true or multiple teams match, refine filters or ask the user. Maximum ' +
      String(MAX_LIMIT) +
      ' results per call.',
    parameters: z.object({
      query: z.string().trim().min(1, 'query must not be empty'),
      limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
      country: z.string().trim().optional(),
      league_id: z.coerce.number().int().optional(),
      season: z.coerce.number().int().optional(),
    }),
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
    },
    execute: async (args, context) => {
      const sessionUser =
        context.session &&
        typeof context.session.username === 'string'
          ? context.session.username
          : undefined;
      if (!sessionUser) {
        throw new UserError('Missing authenticated username on MCP session.');
      }

      const { teams, truncated, limit } = await searchTeamsByName({
        query: args.query,
        limit: args.limit,
        country: args.country,
        league_id: args.league_id,
        season: args.season,
      });

      return JSON.stringify(
        { count: teams.length, teams, truncated, limit },
        null,
        2,
      );
    },
  });

  const listTeamsByScopeSchema = z
    .object({
      limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
      country: z.string().trim().optional(),
      league_id: z.coerce.number().int().optional(),
      season: z.coerce.number().int().optional(),
    })
    .refine(
      (d) => {
        const c = d.country?.trim();
        const hasCountry = c != null && c.length > 0;
        const hasLeague = d.league_id != null;
        return hasCountry || hasLeague;
      },
      { message: 'Provide non-empty country and/or league_id.' },
    )
    .refine(
      (d) => d.season == null || d.league_id != null,
      { message: 'season requires league_id.' },
    );

  server.addTool({
    name: 'list_teams_by_league_or_country',
    title: 'List teams by league or country',
    description:
      'List teams from the teams collection filtered by country and/or league_id (same semantics as GET /teams). Does not take a name query — use search_teams when you have a club name. Optional season narrows league membership. Results are sorted by name; truncated indicates more rows exist beyond the limit.',
    parameters: listTeamsByScopeSchema,
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
    },
    execute: async (args, context) => {
      const sessionUser =
        context.session &&
        typeof context.session.username === 'string'
          ? context.session.username
          : undefined;
      if (!sessionUser) {
        throw new UserError('Missing authenticated username on MCP session.');
      }

      const { teams, truncated, limit } = await listTeamsByLeagueOrCountry({
        limit: args.limit,
        country: args.country,
        league_id: args.league_id,
        season: args.season,
      });

      return JSON.stringify(
        { count: teams.length, teams, truncated, limit },
        null,
        2,
      );
    },
  });

  server.addTool({
    name: 'list_leagues',
    title: 'List leagues',
    description:
      'List football competitions from the leagues collection (id, name, type, logo URL, country name/code). Does not return the seasons array. Optional filters: query (substring on league name), country (substring on country name), league_id (exact id), top_only (restrict to the app’s configured top leagues). With no filters, returns the first page sorted by name; use truncated + a higher limit or tighter filters if needed.',
    parameters: z.object({
      limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
      query: z.string().trim().optional(),
      country: z.string().trim().optional(),
      league_id: z.coerce.number().int().optional(),
      top_only: z.boolean().optional(),
    }),
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
    },
    execute: async (args, context) => {
      const sessionUser =
        context.session &&
        typeof context.session.username === 'string'
          ? context.session.username
          : undefined;
      if (!sessionUser) {
        throw new UserError('Missing authenticated username on MCP session.');
      }

      const { leagues, truncated, limit } = await listLeagues({
        limit: args.limit,
        query: args.query,
        country: args.country,
        league_id: args.league_id,
        top_only: Boolean(args.top_only),
      });

      return JSON.stringify(
        { count: leagues.length, leagues, truncated, limit },
        null,
        2,
      );
    },
  });

  const watchedMatchNameBaseSchema = z.object({
    ids: z.array(z.coerce.number().int()).min(1).optional(),
    team_name: z.string().optional(),
    team_2_name: z.string().optional(),
    league_name: z.string().optional(),
    country_name: z.string().optional(),
    seasons: z.array(z.coerce.number().int()).optional(),
    date_from: z.string().trim().optional(),
    date_to: z.string().trim().optional(),
    events: z
      .array(
        z.object({
          player_name: z.string().optional(),
          event: z.string().min(1),
        }),
      )
      .optional(),
  });

  const hasWatchedOrRealNameDateFilter = (d) => {
    const ids = Array.isArray(d.ids)
      ? d.ids.map((x) => Number(x)).filter((n) => Number.isFinite(n))
      : [];
    if (ids.length > 0) return true;
    const t = d.team_name != null ? String(d.team_name).trim() : '';
    const l = d.league_name != null ? String(d.league_name).trim() : '';
    const c = d.country_name != null ? String(d.country_name).trim() : '';
    const s = Array.isArray(d.seasons)
      ? d.seasons.map((x) => Number(x)).filter((n) => Number.isFinite(n))
      : [];
    const df = d.date_from != null ? String(d.date_from).trim() : '';
    const dt = d.date_to != null ? String(d.date_to).trim() : '';
    const ev = Array.isArray(d.events) ? d.events : [];
    return (
      t.length > 0 ||
      l.length > 0 ||
      c.length > 0 ||
      s.length > 0 ||
      df.length > 0 ||
      dt.length > 0 ||
      ev.length > 0
    );
  };

  const watchedMatchNameWithLocationSchema = watchedMatchNameBaseSchema.extend({
    location_name: z.string().optional(),
  });

  const hasWatchedSearchOrLocationFilter = (d) => {
    const ids = Array.isArray(d.ids)
      ? d.ids.map((x) => Number(x)).filter((n) => Number.isFinite(n))
      : [];
    if (ids.length > 0) return true;
    const loc =
      d.location_name != null ? String(d.location_name).trim() : '';
    return hasWatchedOrRealNameDateFilter(d) || loc.length > 0;
  };

  const watchedOrRealNameDateFilterMessage = {
    message:
      'Provide at least one of: non-empty ids array, team_name, league_name, country_name, date_from, date_to, a non-empty seasons array, or a non-empty events array.',
  };

  const watchedSearchOrLocationFilterMessage = {
    message:
      'Provide at least one of: non-empty ids array, team_name, league_name, country_name, date_from, date_to, a non-empty seasons array, a non-empty events array, or non-empty location_name (watched matches and locations collection only; not used for real_matches list tools).',
  };

  const team2NameRequiresTeamName = (d) => {
    const ids = Array.isArray(d.ids)
      ? d.ids.map((x) => Number(x)).filter((n) => Number.isFinite(n))
      : [];
    if (ids.length > 0) return true;
    const t2 = d.team_2_name != null ? String(d.team_2_name).trim() : '';
    const t = d.team_name != null ? String(d.team_name).trim() : '';
    return t2.length === 0 || t.length > 0;
  };

  const team2NameRequiresTeamNameMessage = {
    message:
      'team_2_name requires non-empty team_name (head-to-head between two clubs), unless ids is provided.',
  };

  /** Real-match tools: no location_name (real_matches have no per-user location). */
  const watchedMatchNameFiltersSchema = watchedMatchNameBaseSchema
    .refine(hasWatchedOrRealNameDateFilter, watchedOrRealNameDateFilterMessage)
    .refine(team2NameRequiresTeamName, team2NameRequiresTeamNameMessage);

  const watchedMatchNameFiltersWithLocationSchema =
    watchedMatchNameWithLocationSchema
      .refine(hasWatchedSearchOrLocationFilter, watchedSearchOrLocationFilterMessage)
      .refine(team2NameRequiresTeamName, team2NameRequiresTeamNameMessage);

  const searchWatchedMatchesByNamesSchema = watchedMatchNameWithLocationSchema
    .extend({
      limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
    })
    .refine(hasWatchedSearchOrLocationFilter, watchedSearchOrLocationFilterMessage)
    .refine(team2NameRequiresTeamName, team2NameRequiresTeamNameMessage);

  const searchRealMatchesByNamesSchema = watchedMatchNameBaseSchema
    .extend({
      limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
    })
    .refine(hasWatchedOrRealNameDateFilter, watchedOrRealNameDateFilterMessage)
    .refine(team2NameRequiresTeamName, team2NameRequiresTeamNameMessage);

  const getRealMatchesFullSchema = watchedMatchNameBaseSchema
    .extend({
      include_statistics: z.boolean().optional(),
      include_lineups: z.boolean().optional(),
      include_events: z.boolean().optional(),
    })
    .refine(hasWatchedOrRealNameDateFilter, watchedOrRealNameDateFilterMessage)
    .refine(team2NameRequiresTeamName, team2NameRequiresTeamNameMessage);

  server.addTool({
    name: 'search_watched_matches_by_names',
    title: 'Search watched matches by names',
    description:
      'Query the matches collection for the authenticated user using human-readable filters (no team/league numeric ids in the tool contract). Optional ids (array of fixture ids): when provided and non-empty, the query uses only fixture.id in ids and ignores all other filters. Otherwise, team_name resolves via the teams collection; optional team_2_name with team_name restricts to head-to-head (home/away either way). league_name and country_name resolve to league ids via the leagues collection (country uses competition country on leagues). Optional location_name resolves via the locations collection for that user (substring on name, case-insensitive); matches.location stores the location UUID. Optional seasons filters on league.season. Optional date_from/date_to filter fixture.timestamp (ISO date or date-time accepted). If date_from or date_to is provided, date filtering takes precedence and seasons is ignored. Optional events filter accepts objects like { player_name?, event }; player_name is optional: omit it (or send empty) to match any player in the fixture for that event (e.g. any missed penalty in the match). When player_name is set, it is resolved semantically via the players collection. Supported event values are called_up (in squad: startXI or bench), lineup (played minutes: startXI or entered from bench), startingXI (startXI only), bench (substitutes only), substitute (involved in substitution, in or out), goal, assist, own_goal, missed_penalty, penalty (penalty scored), yellow_card, second_yellow, red_card, card, var, penalty_shootout_scored, and penalty_shootout_missed. Matched against real_matches lineups/events for fixture intersection. Filters AND together, so you can combine different players and event types in one request. Returns documents omitting statistics and player_stats only (same projection as get_watched_matches). Sorted by fixture timestamp descending. resolution.*_truncated flags indicate a name lookup hit the ' +
      String(MAX_LIMIT) +
      ' cap — narrow the query if needed.',
    parameters: searchWatchedMatchesByNamesSchema,
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
    },
    execute: async (args, context) => {
      const sessionUser =
        context.session &&
        typeof context.session.username === 'string'
          ? context.session.username
          : undefined;
      if (!sessionUser) {
        throw new UserError('Missing authenticated username on MCP session.');
      }

      const {
        matches,
        truncated,
        limit,
        resolution,
        empty_reason: emptyReason,
      } = await searchWatchedMatchesByNames({
        username: sessionUser,
        ids: args.ids,
        teamName: args.team_name,
        team2Name: args.team_2_name,
        leagueName: args.league_name,
        countryName: args.country_name,
        seasons: args.seasons,
        dateFrom: args.date_from,
        dateTo: args.date_to,
        events: args.events,
        locationName: args.location_name,
        limit: args.limit,
      });

      const payload = {
        count: matches.length,
        matches,
        truncated,
        limit,
        resolution,
        ...(emptyReason != null ? { empty_reason: emptyReason } : {}),
      };

      return JSON.stringify(payload, null, 2);
    },
  });

  server.addTool({
    name: 'count_watched_matches_by_names',
    title: 'Count watched matches by names',
    description:
      'Same filters as search_watched_matches_by_names for the authenticated user in the matches collection, but returns only count plus resolution truncation flags. Optional ids (fixture ids array) short-circuits all other filters.',
    parameters: watchedMatchNameFiltersWithLocationSchema,
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
    },
    execute: async (args, context) => {
      const sessionUser =
        context.session &&
        typeof context.session.username === 'string'
          ? context.session.username
          : undefined;
      if (!sessionUser) {
        throw new UserError('Missing authenticated username on MCP session.');
      }

      const { count, resolution, empty_reason: emptyReason } =
        await countWatchedMatchesByNames({
          username: sessionUser,
          ids: args.ids,
          teamName: args.team_name,
          team2Name: args.team_2_name,
          leagueName: args.league_name,
          countryName: args.country_name,
          seasons: args.seasons,
          dateFrom: args.date_from,
          dateTo: args.date_to,
          events: args.events,
          locationName: args.location_name,
        });

      const payload = {
        count,
        resolution,
        ...(emptyReason != null ? { empty_reason: emptyReason } : {}),
      };

      return JSON.stringify(payload, null, 2);
    },
  });

  const watchedMatchesMutateSchema = watchedMatchNameWithLocationSchema
    .extend({
      action: z.enum(['mark', 'unmark']),
      limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
    })
    .refine(hasWatchedOrRealNameDateFilter, watchedOrRealNameDateFilterMessage)
    .refine(team2NameRequiresTeamName, team2NameRequiresTeamNameMessage);

  server.addTool({
    name: 'mutate_watched_matches_by_names',
    title: 'Mark or unmark watched matches by names',
    description:
      'Write tool: at least one fixture filter is required (ids or team_name/league_name/country_name/seasons/date_from/date_to/events). Optional ids (fixture ids array): when provided and non-empty, only ids are used and all other filters are ignored. Optional location_name on mark: resolves user locations by name; if none match, the watched row is still created with null location. action=mark resolves real_matches, inserts into matches, skips duplicates, MATCH_CREATED logging. action=unmark ignores location_name (no bulk delete by location); deletes up to limit watched rows matching the fixture filters only, MATCH_DELETED per row. Hard cap limit default 20, max 50. Returns counts, fixture_ids, resolution, errors; mark may include location_name_unmatched when a location_name was given but not found.',
    parameters: watchedMatchesMutateSchema,
    annotations: {
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args, context) => {
      const sessionUser =
        context.session &&
        typeof context.session.username === 'string'
          ? context.session.username
          : undefined;
      if (!sessionUser) {
        throw new UserError('Missing authenticated username on MCP session.');
      }

      const common = {
        username: sessionUser,
        ids: args.ids,
        teamName: args.team_name,
        team2Name: args.team_2_name,
        leagueName: args.league_name,
        countryName: args.country_name,
        seasons: args.seasons,
        dateFrom: args.date_from,
        dateTo: args.date_to,
        events: args.events,
        locationName: args.location_name,
        limit: args.limit,
      };

      const payload =
        args.action === 'mark'
          ? await markWatchedMatchesByNames(common)
          : await unmarkWatchedMatchesByNames(common);

      return JSON.stringify(payload, null, 2);
    },
  });

  server.addTool({
    name: 'get_real_matches',
    title: 'Get real matches',
    description:
      'Returns rows from the `real_matches` MongoDB collection: the app’s synced fixture catalog (all supported fixtures), independent of whether the authenticated user marked them as watched. Optional ids (array of fixture ids): when provided and non-empty, only fixture.id in ids is used and all other filters are ignored. Otherwise same team/league/country/season/date/events filters as watched name search (optional team_name, optional team_2_name with team_name for head-to-head, league_name, country_name, seasons, date_from, date_to, events, limit); no location_name — real_matches have no per-user location. At least one filter must be non-empty. Date range applies to fixture.timestamp and takes precedence over seasons when any date boundary is set. Optional events accepts objects like { player_name?, event }; omit player_name to match that event for any player in the match. Supported values are called_up (in squad: startXI or bench), lineup (played minutes: startXI or entered from bench), startingXI (startXI only), bench (substitutes only), substitute (involved in substitution, in or out), goal, assist, own_goal, missed_penalty, penalty (penalty scored), yellow_card, second_yellow, red_card, card, var, penalty_shootout_scored, and penalty_shootout_missed. Filters AND together so one request can require multiple players/events at once. Auth is required but results are not filtered by user — use watched-match tools when the question is about games the user saved. Each row omits statistics, lineups, and events (large payloads). Sorted by fixture timestamp descending.',
    parameters: searchRealMatchesByNamesSchema,
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
    },
    execute: async (args, context) => {
      const sessionUser =
        context.session &&
        typeof context.session.username === 'string'
          ? context.session.username
          : undefined;
      if (!sessionUser) {
        throw new UserError('Missing authenticated username on MCP session.');
      }

      const {
        matches,
        truncated,
        limit,
        resolution,
        empty_reason: emptyReason,
      } = await searchRealMatchesByNames({
        teamName: args.team_name,
        ids: args.ids,
        team2Name: args.team_2_name,
        leagueName: args.league_name,
        countryName: args.country_name,
        seasons: args.seasons,
        dateFrom: args.date_from,
        dateTo: args.date_to,
        events: args.events,
        limit: args.limit,
      });

      const payload = {
        count: matches.length,
        matches,
        truncated,
        limit,
        resolution,
        ...(emptyReason != null ? { empty_reason: emptyReason } : {}),
      };

      return JSON.stringify(payload, null, 2);
    },
  });

  server.addTool({
    name: 'count_real_matches_by_names',
    title: 'Count real matches by names',
    description:
      'Same filters as get_real_matches on the `real_matches` collection (no location_name); returns only count plus resolution truncation flags. Optional ids (fixture ids array) short-circuits all other filters. Not scoped to the user’s watched list — use count_watched_matches_by_names when counting only marked games.',
    parameters: watchedMatchNameFiltersSchema,
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
    },
    execute: async (args, context) => {
      const sessionUser =
        context.session &&
        typeof context.session.username === 'string'
          ? context.session.username
          : undefined;
      if (!sessionUser) {
        throw new UserError('Missing authenticated username on MCP session.');
      }

      const { count, resolution, empty_reason: emptyReason } =
        await countRealMatchesByNames({
          teamName: args.team_name,
          ids: args.ids,
          team2Name: args.team_2_name,
          leagueName: args.league_name,
          countryName: args.country_name,
          seasons: args.seasons,
          dateFrom: args.date_from,
          dateTo: args.date_to,
          events: args.events,
        });

      const payload = {
        count,
        resolution,
        ...(emptyReason != null ? { empty_reason: emptyReason } : {}),
      };

      return JSON.stringify(payload, null, 2);
    },
  });

  server.addTool({
    name: 'get_real_matches_full',
    title: 'Get real matches full (max 20 docs)',
    description:
      'Query `real_matches` with the same human-readable filters as get_real_matches / count_real_matches_by_names (team_name, optional team_2_name for head-to-head, league_name, country_name, seasons, date_from, date_to, events; no location_name; at least one filter; team_2_name requires team_name). Optional ids (fixture ids array): when provided and non-empty, only fixture.id in ids is used and all other filters are ignored. For events, pass objects like { player_name?, event }; omit player_name for match-wide event presence (any player). Supported values are called_up (in squad: startXI or bench), lineup (played minutes: startXI or entered from bench), startingXI (startXI only), bench (substitutes only), substitute (involved in substitution, in or out), goal, assist, own_goal, missed_penalty, penalty (penalty scored), yellow_card, second_yellow, red_card, card, var, penalty_shootout_scored, and penalty_shootout_missed. Filters AND together, so you can express combinations like "player A scored and player B assisted and player C was on the bench". The MongoDB query is hard-capped at **20 documents** (sorted by fixture.timestamp descending). By default returns full match documents. Optional include flags let the client trim heavy fields when not needed: include_statistics, include_lineups, include_events (all default true). Use when you need complete fixtures for richer workflows (for example weekend batches in one league); use get_real_matches for larger trimmed lists.',
    parameters: getRealMatchesFullSchema,
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
    },
    execute: async (args, context) => {
      const sessionUser =
        context.session &&
        typeof context.session.username === 'string'
          ? context.session.username
          : undefined;
      if (!sessionUser) {
        throw new UserError('Missing authenticated username on MCP session.');
      }

      const {
        matches,
        count,
        max_documents: maxDocuments,
        resolution,
        empty_reason: emptyReason,
      } = await getRealMatchesFullByNames({
        teamName: args.team_name,
        ids: args.ids,
        team2Name: args.team_2_name,
        leagueName: args.league_name,
        countryName: args.country_name,
        seasons: args.seasons,
        dateFrom: args.date_from,
        dateTo: args.date_to,
        events: args.events,
        includeStatistics:
          args.include_statistics == null ? true : args.include_statistics,
        includeLineups:
          args.include_lineups == null ? true : args.include_lineups,
        includeEvents: args.include_events == null ? true : args.include_events,
      });

      const payload = {
        count,
        max_documents: maxDocuments,
        matches,
        resolution,
        ...(emptyReason != null ? { empty_reason: emptyReason } : {}),
      };

      return JSON.stringify(payload, null, 2);
    },
  });

  server.addTool({
    name: 'getLiveMatches',
    title: 'Get live matches (today, real_matches)',
    description:
      'Queries the `real_matches` collection for fixtures whose kickoff (`fixture.timestamp`) falls on the **current UTC calendar day** (midnight–midnight UTC). Not scoped to the watched list. Each document omits statistics, lineups, and events. Adds a `live` object per row: `kickoff_passed` (server time >= kickoff), `status_finished` and `status_not_started` derived from `fixture.status.short` using the same codes as the MegaGoal WebApp (`WebApp/src/app/config/matchStatus.ts`): not started = NS, TBD; finished = FT, AET, PEN, PST, CANC; plus `kickoff_passed_and_not_finished` for likely ongoing or break-time games. Response includes `status_legend`, `utc_date`, `now_unix`, and day bounds for clarity.',
    parameters: z.object({}),
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
    },
    execute: async (_args, context) => {
      const sessionUser =
        context.session &&
        typeof context.session.username === 'string'
          ? context.session.username
          : undefined;
      if (!sessionUser) {
        throw new UserError('Missing authenticated username on MCP session.');
      }

      const payload = await getLiveRealMatchesForUtcDay();
      return JSON.stringify(payload, null, 2);
    },
  });

  const playerPlayedWatchedFiltersSchema = z
    .object({
      player_name: z.string(),
      team_name: z.string().optional(),
      seasons: z.array(z.coerce.number().int()).optional(),
    })
    .refine(
      (d) => String(d.player_name ?? '').trim().length > 0,
      { message: 'player_name must be a non-empty string.' },
    );

  const watchedPlayerEventsAnalyticsSchema = watchedMatchNameWithLocationSchema
    .extend({
      players: z.array(z.string().trim().min(1)).optional(),
      events: z.array(z.string().trim().min(1)).optional(),
      pair_mode: z.enum(['paired', 'independent']).optional(),
      logic: z.enum(['and', 'or']).optional(),
      response_event_scope: z.enum(['matched_only', 'all_in_scope']).optional(),
      group_by: z.enum(['player', 'match']).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    })
    .refine(hasWatchedSearchOrLocationFilter, watchedSearchOrLocationFilterMessage)
    .refine(team2NameRequiresTeamName, team2NameRequiresTeamNameMessage);

  const realPlayerEventsAnalyticsSchema = watchedMatchNameBaseSchema
    .extend({
      players: z.array(z.string().trim().min(1)).optional(),
      events: z.array(z.string().trim().min(1)).optional(),
      pair_mode: z.enum(['paired', 'independent']).optional(),
      logic: z.enum(['and', 'or']).optional(),
      response_event_scope: z.enum(['matched_only', 'all_in_scope']).optional(),
      group_by: z.enum(['player', 'match']).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    })
    .refine(hasWatchedOrRealNameDateFilter, watchedOrRealNameDateFilterMessage)
    .refine(team2NameRequiresTeamName, team2NameRequiresTeamNameMessage);

  server.addTool({
    name: 'player_played_watched_matches',
    title: 'Player played watched matches (basic)',
    description:
      'Among the authenticated user watched matches (`matches`), optional filter by club name substring (team_name → team ids) and/or seasons. Resolves player_name to a single player via the players collection; if multiple players match, returns candidates so the query can be refined. Uses `real_matches` lineups/events only to confirm the player participated (started or came on as sub). Returns a slim list per match: fixture_id, timestamp, date, league id/name/season, teams id/name, score — no lineups or events.',
    parameters: playerPlayedWatchedFiltersSchema,
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
    },
    execute: async (args, context) => {
      const sessionUser =
        context.session &&
        typeof context.session.username === 'string'
          ? context.session.username
          : undefined;
      if (!sessionUser) {
        throw new UserError('Missing authenticated username on MCP session.');
      }

      const resolved = await resolveSinglePlayerFromName(args.player_name);
      if (!resolved.ok) {
        return JSON.stringify(
          {
            ok: false,
            reason: resolved.reason,
            candidates: resolved.candidates,
            resolution_truncated: resolved.resolution_truncated,
          },
          null,
          2,
        );
      }

      const teamRes = await resolveTeamIdsFromOptionalName(args.team_name);
      const tn =
        args.team_name != null ? String(args.team_name).trim() : '';
      if (tn.length > 0 && teamRes.team_ids.length === 0) {
        return JSON.stringify(
          {
            ok: false,
            empty_reason: 'no_teams_for_team_name',
            team_resolution_truncated: teamRes.team_resolution_truncated,
          },
          null,
          2,
        );
      }

      const payload = await getPlayedWatchedMatchesBasic({
        username: sessionUser,
        playerId: resolved.player_id,
        displayName: resolved.display_name,
        teamIds: teamRes.team_ids,
        seasons: args.seasons,
      });

      return JSON.stringify(
        {
          ok: true,
          team_resolution_truncated: teamRes.team_resolution_truncated,
          ...payload,
        },
        null,
        2,
      );
    },
  });

  server.addTool({
    name: 'analyze_real_player_events',
    title: 'Analyze real match player events',
    description:
      'Same analytics semantics as analyze_watched_player_events but over global real_matches (not user watched list). Scope by the same real name/date filters as get_real_matches (optional ids short-circuit; no location_name). Optional players (array of names) and/or events array. pair_mode controls paired vs independent behavior when both players and events are set. logic controls and/or matching. response_event_scope controls matched-only vs all parsed events in included matches. group_by=player returns ranking rows; group_by=match adds per-match event timelines.',
    parameters: realPlayerEventsAnalyticsSchema,
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
    },
    execute: async (args, context) => {
      const sessionUser =
        context.session &&
        typeof context.session.username === 'string'
          ? context.session.username
          : undefined;
      if (!sessionUser) {
        throw new UserError('Missing authenticated username on MCP session.');
      }

      const payload = await analyzeRealPlayerEvents({
        ids: args.ids,
        teamName: args.team_name,
        team2Name: args.team_2_name,
        leagueName: args.league_name,
        countryName: args.country_name,
        seasons: args.seasons,
        dateFrom: args.date_from,
        dateTo: args.date_to,
        players: args.players,
        events: args.events,
        pairMode: args.pair_mode ?? 'paired',
        logic: args.logic ?? 'or',
        responseEventScope: args.response_event_scope ?? 'matched_only',
        groupBy: args.group_by ?? 'player',
        limit: args.limit,
      });

      return JSON.stringify(payload, null, 2);
    },
  });

  server.addTool({
    name: 'analyze_watched_player_events',
    title: 'Analyze watched player events',
    description:
      'Reusable watched analytics for mixed player/event questions. Scope by the same watched name/date/location filters as search_watched_matches_by_names (optional ids short-circuit). Add optional players (array of player names) and/or events (goal, assist, cards, called_up, lineup, substitute, etc.). pair_mode controls semantics when both are present: paired (default) keeps player-event coupling, independent evaluates player and event conditions separately at match level. logic (default or) combines requested conditions. response_event_scope controls payload: matched_only (default) or all_in_scope events from included matches. group_by=player returns ranking rows; group_by=match adds per-match event timelines ordered by watched timestamp desc.',
    parameters: watchedPlayerEventsAnalyticsSchema,
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
    },
    execute: async (args, context) => {
      const sessionUser =
        context.session &&
        typeof context.session.username === 'string'
          ? context.session.username
          : undefined;
      if (!sessionUser) {
        throw new UserError('Missing authenticated username on MCP session.');
      }

      const payload = await analyzeWatchedPlayerEvents({
        username: sessionUser,
        ids: args.ids,
        teamName: args.team_name,
        team2Name: args.team_2_name,
        leagueName: args.league_name,
        countryName: args.country_name,
        locationName: args.location_name,
        seasons: args.seasons,
        dateFrom: args.date_from,
        dateTo: args.date_to,
        players: args.players,
        events: args.events,
        pairMode: args.pair_mode ?? 'paired',
        logic: args.logic ?? 'or',
        responseEventScope: args.response_event_scope ?? 'matched_only',
        groupBy: args.group_by ?? 'player',
        limit: args.limit,
      });

      return JSON.stringify(payload, null, 2);
    },
  });

  server.addTool({
    name: 'player_played_watched_stats',
    title: 'Player played watched stats (aggregate)',
    description:
      'Same filters as player_played_watched_matches (player_name required; optional team_name, seasons). Returns totals.matches, totals.goals, totals.assists among watched fixtures where the player participated, plus by_team and by_season with the same three metrics per bucket. Participation and goal/assist counting align with Stats player_general_stats / real_matches events.',
    parameters: playerPlayedWatchedFiltersSchema,
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
    },
    execute: async (args, context) => {
      const sessionUser =
        context.session &&
        typeof context.session.username === 'string'
          ? context.session.username
          : undefined;
      if (!sessionUser) {
        throw new UserError('Missing authenticated username on MCP session.');
      }

      const resolved = await resolveSinglePlayerFromName(args.player_name);
      if (!resolved.ok) {
        return JSON.stringify(
          {
            ok: false,
            reason: resolved.reason,
            candidates: resolved.candidates,
            resolution_truncated: resolved.resolution_truncated,
          },
          null,
          2,
        );
      }

      const teamRes = await resolveTeamIdsFromOptionalName(args.team_name);
      const tn =
        args.team_name != null ? String(args.team_name).trim() : '';
      if (tn.length > 0 && teamRes.team_ids.length === 0) {
        return JSON.stringify(
          {
            ok: false,
            empty_reason: 'no_teams_for_team_name',
            team_resolution_truncated: teamRes.team_resolution_truncated,
          },
          null,
          2,
        );
      }

      const payload = await getPlayedWatchedAggregateStats({
        username: sessionUser,
        playerId: resolved.player_id,
        displayName: resolved.display_name,
        teamIds: teamRes.team_ids,
        seasons: args.seasons,
      });

      return JSON.stringify(
        {
          ok: true,
          team_resolution_truncated: teamRes.team_resolution_truncated,
          ...payload,
        },
        null,
        2,
      );
    },
  });

  return server;
}

/**
 * Streamable HTTP MCP (default path /mcp). SSE also served per FastMCP defaults.
 */
export async function startMcpHttpIfEnabled() {
  const disabled =
    process.env.MCP_DISABLED === '1' ||
    process.env.MCP_DISABLED === 'true';
  if (disabled) {
    console.log('MCP: disabled (MCP_DISABLED)');
    return;
  }

  const port = Number(process.env.MCP_PORT || 3151);
  if (!Number.isFinite(port) || port <= 0) {
    console.warn('MCP: invalid MCP_PORT, skipping MCP server');
    return;
  }

  const server = createMcpServer();
  await server.start({
    transportType: 'httpStream',
    httpStream: {
      port,
      host: process.env.MCP_HOST || '0.0.0.0',
    },
  });

  const host = process.env.MCP_HOST || '0.0.0.0';
  console.log(
    `MCP: FastMCP httpStream on http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/mcp (SSE on /sse)`,
  );
}
