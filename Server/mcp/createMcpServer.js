import { FastMCP, UserError } from 'fastmcp';
import { z } from 'zod';
import {
  countWatchedMatchesForUser,
  getWatchedMatchesForUser,
} from './services/watchedMatchesQuery.js';
import { listLeagues } from './services/leagueListQuery.js';
import {
  countWatchedMatchesByNames,
  searchWatchedMatchesByNames,
} from './services/matchSearchQuery.js';
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
      'Tools for MegaGoal football data. Use list_leagues for competitions (id, name, country); search_teams / list_teams_by_league_or_country for clubs; get_watched_matches / count_watched_matches for watched matches by numeric ids (and location/fixture); search_watched_matches_by_names / count_watched_matches_by_names for the same watched rows filtered by team_name, league_name, country_name, and seasons.',
    authenticate: async (request) => resolveAuth(request),
  });

  server.addTool({
    name: 'get_watched_matches',
    title: 'Get watched matches',
    description:
      'Returns watched matches for the authenticated MegaGoal user from the matches collection. Optional filters mirror GET /match: team_id, season, league_id, location, fixture_id. User identity comes from MCP auth (see X-MegaGoal-Username when using MCP_API_KEY). For filters by club or competition name (not ids), use search_watched_matches_by_names.',
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

  const watchedMatchNameFiltersSchema = z
    .object({
      team_name: z.string().optional(),
      league_name: z.string().optional(),
      country_name: z.string().optional(),
      seasons: z.array(z.coerce.number().int()).optional(),
    })
    .refine(
      (d) => {
        const t = d.team_name != null ? String(d.team_name).trim() : '';
        const l = d.league_name != null ? String(d.league_name).trim() : '';
        const c = d.country_name != null ? String(d.country_name).trim() : '';
        const s = Array.isArray(d.seasons)
          ? d.seasons.map((x) => Number(x)).filter((n) => Number.isFinite(n))
          : [];
        return t.length > 0 || l.length > 0 || c.length > 0 || s.length > 0;
      },
      {
        message:
          'Provide at least one of: non-empty team_name, league_name, country_name, or a non-empty seasons array.',
      },
    );

  const searchWatchedMatchesByNamesSchema = watchedMatchNameFiltersSchema.and(
    z.object({
      limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
    }),
  );

  server.addTool({
    name: 'search_watched_matches_by_names',
    title: 'Search watched matches by names',
    description:
      'Query the matches collection for the authenticated user using human-readable filters only (no team or league ids in the tool contract). team_name resolves via the teams collection; league_name and country_name resolve to league ids via the leagues collection (country uses competition country on leagues). seasons filters on league.season. Name filters AND together, and the query is always scoped to the MCP user. Returns documents minus lineups, statistics, and events (same projection as get_watched_matches). Sorted by fixture timestamp descending. resolution.*_truncated flags indicate a name lookup hit the ' +
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
        leagueName: args.league_name,
        countryName: args.country_name,
        seasons: args.seasons,
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
      'Same name/season filters as search_watched_matches_by_names for the authenticated user in the matches collection, but returns only count plus resolution truncation flags.',
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
          leagueName: args.league_name,
          countryName: args.country_name,
          seasons: args.seasons,
        });

      const payload = {
        count,
        resolution,
        ...(emptyReason != null ? { empty_reason: emptyReason } : {}),
      };

      return JSON.stringify(payload, null, 2);
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
