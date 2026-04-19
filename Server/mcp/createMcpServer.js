import { FastMCP, UserError } from 'fastmcp';
import { z } from 'zod';
import {
  countWatchedMatchesForUser,
  getWatchedMatchesForUser,
} from './services/watchedMatchesQuery.js';

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
      'Tools for MegaGoal football data. Use get_watched_matches to list watched matches; use count_watched_matches when only the number of matches is needed (same filters, efficient).',
    authenticate: async (request) => resolveAuth(request),
  });

  server.addTool({
    name: 'get_watched_matches',
    title: 'Get watched matches',
    description:
      'Returns watched matches for the authenticated MegaGoal user from the matches collection. Optional filters mirror GET /match: team_id, season, location, fixture_id. User identity comes from MCP auth (see X-MegaGoal-Username when using MCP_API_KEY).',
    parameters: z.object({
      team_id: z.coerce.number().int().optional(),
      season: z.coerce.number().int().optional(),
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
      'Returns how many watched matches match the filters for the authenticated user. Same optional filters as get_watched_matches (team_id, season, location, fixture_id). Use this instead of get_watched_matches when you only need the total count.',
    parameters: z.object({
      team_id: z.coerce.number().int().optional(),
      season: z.coerce.number().int().optional(),
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
        location: args.location,
        fixture_id: args.fixture_id,
      });

      return JSON.stringify({ count }, null, 2);
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
