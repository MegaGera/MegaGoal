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
      'Tools for MegaGoal football data. Use list_leagues for competitions (id, name, country); search_teams / list_teams_by_league_or_country for clubs. Watched matches (user-marked in `matches`): get_watched_matches / count_watched_matches by numeric ids (and location/fixture); search_watched_matches_by_names / count_watched_matches_by_names with team_name, optional team_2_name (head-to-head when both set), league_name, country_name, seasons, optional date_from/date_to (date takes precedence over seasons when provided), optional events array of { player_name?, event } (omit player_name for fixture-wide event presence). Writes: mutate_watched_matches_by_names with action mark or unmark uses the same name/date/events filters; mark inserts from real_matches (POST /match shape, skips already watched); unmark deletes watched rows (same as DELETE /match). Real matches (global fixture catalog in `real_matches`, not per-user): get_real_matches / count_real_matches_by_names with the same filters (list rows omit heavy fields); get_real_matches_full uses the same filters and returns up to 20 full documents for richer workflows. getLiveMatches returns all real_matches kicking off on the current UTC calendar day, each with live flags comparing server time to fixture.timestamp and classifying fixture.status.short using the same finished (FT,AET,PEN,PST,CANC) and not-started (NS,TBD) sets as the WebApp. player_played_watched_matches for slim rows where a named player played among watched fixtures; player_played_watched_stats for goals/assists totals and splits by team and season.',
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

  const watchedOrRealNameDateFilterMessage = {
    message:
      'Provide at least one of: non-empty team_name, league_name, country_name, date_from, date_to, a non-empty seasons array, or a non-empty events array.',
  };

  const team2NameRequiresTeamName = (d) => {
    const t2 = d.team_2_name != null ? String(d.team_2_name).trim() : '';
    const t = d.team_name != null ? String(d.team_name).trim() : '';
    return t2.length === 0 || t.length > 0;
  };

  const team2NameRequiresTeamNameMessage = {
    message:
      'team_2_name requires non-empty team_name (head-to-head between two clubs).',
  };

  /** Keep a single ZodObject + refine so JSON Schema has root type "object" (not allOf). Intersections break some MCP clients. */
  const watchedMatchNameFiltersSchema = watchedMatchNameBaseSchema
    .refine(hasWatchedOrRealNameDateFilter, watchedOrRealNameDateFilterMessage)
    .refine(team2NameRequiresTeamName, team2NameRequiresTeamNameMessage);

  const searchWatchedMatchesByNamesSchema = watchedMatchNameBaseSchema
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
      'Query the matches collection for the authenticated user using human-readable filters only (no team or league ids in the tool contract). team_name resolves via the teams collection; optional team_2_name with team_name restricts to head-to-head (home/away either way). league_name and country_name resolve to league ids via the leagues collection (country uses competition country on leagues). Optional seasons filters on league.season. Optional date_from/date_to filter fixture.timestamp (ISO date or date-time accepted). If date_from or date_to is provided, date filtering takes precedence and seasons is ignored. Optional events filter accepts objects like { player_name?, event }; player_name is optional: omit it (or send empty) to match any player in the fixture for that event (e.g. any missed penalty in the match). When player_name is set, it is resolved semantically via the players collection. Supported event values are lineup (startXI or bench), startingXI (startXI only), bench (substitutes only), substitute (involved in substitution, in or out), goal, assist, own_goal, missed_penalty, penalty (penalty scored), yellow_card, second_yellow, red_card, card, var, penalty_shootout_scored, and penalty_shootout_missed. Matched against real_matches lineups/events for fixture intersection. Filters AND together, so you can combine different players and event types in one request. Returns documents omitting statistics and player_stats only (same projection as get_watched_matches). Sorted by fixture timestamp descending. resolution.*_truncated flags indicate a name lookup hit the ' +
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
        teamName: args.team_name,
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
    name: 'count_watched_matches_by_names',
    title: 'Count watched matches by names',
    description:
      'Same name/season/date/events filters as search_watched_matches_by_names for the authenticated user in the matches collection (date takes precedence over season when provided), but returns only count plus resolution truncation flags.',
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
        await countWatchedMatchesByNames({
          username: sessionUser,
          teamName: args.team_name,
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

  const watchedMatchesMutateSchema = watchedMatchNameBaseSchema
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
      'Write tool: same human-readable filters as search_watched_matches_by_names / get_real_matches (team_name, optional team_2_name for head-to-head, league_name, country_name, seasons, date_from, date_to, events; at least one filter; team_2_name requires team_name). action=mark resolves fixtures in real_matches, builds the same watched payload as the WebApp when adding from a real match (no statistics), inserts into matches for the authenticated user, skips duplicates, and logs MATCH_CREATED like POST /match. action=unmark finds the user watched matches collection with the same filters as search_watched_matches_by_names, deletes up to limit rows (newest by kickoff first), and logs MATCH_DELETED per row like DELETE /match. Hard cap limit default 20, max 50 per call; truncated in the response means more rows matched—narrow filters or repeat. Returns counts, fixture_ids affected, resolution flags, and per-fixture errors when a row fails.',
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
        teamName: args.team_name,
        team2Name: args.team_2_name,
        leagueName: args.league_name,
        countryName: args.country_name,
        seasons: args.seasons,
        dateFrom: args.date_from,
        dateTo: args.date_to,
        events: args.events,
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
      'Returns rows from the `real_matches` MongoDB collection: the app’s synced fixture catalog (all supported fixtures), independent of whether the authenticated user marked them as watched. Same filters as search_watched_matches_by_names: optional team_name, optional team_2_name (head-to-head with team_name), league_name, country_name, seasons, date_from, date_to, events, limit; at least one filter must be non-empty (same constraint as watched name search). Date range applies to fixture.timestamp and takes precedence over seasons when any date boundary is set. Optional events accepts objects like { player_name?, event }; omit player_name to match that event for any player in the match. Supported values are lineup (startXI or bench), startingXI (startXI only), bench (substitutes only), substitute (involved in substitution, in or out), goal, assist, own_goal, missed_penalty, penalty (penalty scored), yellow_card, second_yellow, red_card, card, var, penalty_shootout_scored, and penalty_shootout_missed. Filters AND together so one request can require multiple players/events at once. Auth is required but results are not filtered by user — use watched-match tools when the question is about games the user saved. Each row omits statistics, lineups, and events (large payloads). Sorted by fixture timestamp descending.',
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
      } = await searchRealMatchesByNames({
        teamName: args.team_name,
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
      'Same name/season/date/events filters as get_real_matches on the `real_matches` collection; returns only count plus resolution truncation flags. Not scoped to the user’s watched list — use count_watched_matches_by_names when counting only marked games.',
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
      'Query `real_matches` with the same human-readable filters as get_real_matches / count_real_matches_by_names (team_name, optional team_2_name for head-to-head, league_name, country_name, seasons, date_from, date_to, events; at least one filter; team_2_name requires team_name). For events, pass objects like { player_name?, event }; omit player_name for match-wide event presence (any player). Supported values are lineup (startXI or bench), startingXI (startXI only), bench (substitutes only), substitute (involved in substitution, in or out), goal, assist, own_goal, missed_penalty, penalty (penalty scored), yellow_card, second_yellow, red_card, card, var, penalty_shootout_scored, and penalty_shootout_missed. Filters AND together, so you can express combinations like "player A scored and player B assisted and player C was on the bench". The MongoDB query is hard-capped at **20 documents** (sorted by fixture.timestamp descending). By default returns full match documents. Optional include flags let the client trim heavy fields when not needed: include_statistics, include_lineups, include_events (all default true). Use when you need complete fixtures for richer workflows (for example weekend batches in one league); use get_real_matches for larger trimmed lists.',
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
