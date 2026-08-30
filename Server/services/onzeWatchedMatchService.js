import { z } from 'zod';
import { getDB } from '../config/db.js';
import { buildWatchedMatchesQuery } from '../mcp/services/watchedMatchesQuery.js';
import { REAL_MATCH_LIST_PROJECTION } from '../config/matchProjection.js';
import { buildMatchListResponse } from './matchPagination.js';

const FINISHED_STATUSES = ['FT', 'AET', 'PEN'];

const NON_FINAL_ROUND_REGEX =
  /(preliminary|semi|quarter|1\/2|1\/4|1\/8|1\/16|16th|sixteenth|dieciseisavos?|round of|8th|eighth|eigth|octavos?|play-?off|qualification|3rd|third|bronze)/i;

const PLAYABLE_MODES = ['xi', 'goals', 'events'];

const PLAYABLE_MODE_FILTERS = {
  xi: {
    lineups: { $elemMatch: { 'startXI.0': { $exists: true } } },
  },
  goals: {
    events: {
      $elemMatch: {
        type: /^goal$/i,
        detail: { $not: /own goal|missed penalty/i },
      },
    },
  },
  events: {
    events: { $exists: true, $not: { $size: 0 } },
  },
};

const nullableNumber = z.number().int().nullable();

const h2hMatchSchema = z.object({
  fixture: z.object({
    id: z.number().int(),
    date: z.string(),
    timestamp: z.number().int(),
    venue: z
      .object({
        id: z.number().int().nullable().optional(),
        name: z.string().nullable().optional(),
        city: z.string().nullable().optional(),
      })
      .optional(),
    status: z
      .object({
        long: z.string().optional(),
        short: z.string().optional(),
      })
      .optional(),
  }),
  league: z.object({
    id: z.number().int(),
    name: z.string(),
    country: z.string(),
    logo: z.string().nullish(),
    flag: z.string().nullish(),
    season: z.number().int(),
    round: z.string().optional(),
  }),
  teams: z.object({
    home: z.object({
      id: z.number().int(),
      name: z.string(),
      logo: z.string().nullish(),
    }),
    away: z.object({
      id: z.number().int(),
      name: z.string(),
      logo: z.string().nullish(),
    }),
  }),
  goals: z.object({
    home: nullableNumber,
    away: nullableNumber,
  }),
});

function parseH2hMatches(documents) {
  return z.array(h2hMatchSchema).parse(documents);
}

function parseH2hMatch(document) {
  return h2hMatchSchema.parse(document);
}

export function parseOnzePlayMode(raw) {
  const mode = String(raw ?? 'xi').trim().toLowerCase();
  if (!PLAYABLE_MODES.includes(mode)) {
    const error = new Error(`mode must be one of: ${PLAYABLE_MODES.join(', ')}`);
    error.status = 400;
    throw error;
  }
  return mode;
}

function parseTeamId(raw) {
  if (raw == null || raw === '') return null;
  return z.coerce.number().int().parse(raw);
}

export function parseOnzeWatchedFilters(query) {
  const hasTeam = query.team_id != null && query.team_id !== '';
  const hasRival = query.team_2_id != null && query.team_2_id !== '';

  if (hasRival && !hasTeam) {
    const error = new Error('team_id is required when team_2_id is set');
    error.status = 400;
    throw error;
  }

  const teamId = hasTeam ? parseTeamId(query.team_id) : null;
  const team2Id = hasRival ? parseTeamId(query.team_2_id) : null;

  if (teamId != null && team2Id != null && teamId === team2Id) {
    const error = new Error('team_id and team_2_id must be different');
    error.status = 400;
    throw error;
  }

  const leagueId =
    query.league_id != null && query.league_id !== '' ? parseTeamId(query.league_id) : null;
  const season =
    query.season != null && query.season !== '' ? parseTeamId(query.season) : null;
  const finalsOnly = query.finals_only === '1' || query.finals_only === 'true';

  return { teamId, team2Id, leagueId, season, finalsOnly };
}

function buildRealMatchFilters({ mode, leagueId, season, teamId, team2Id, finalsOnly }) {
  const filters = [
    { 'fixture.status.short': { $in: FINISHED_STATUSES } },
    PLAYABLE_MODE_FILTERS[mode],
  ];

  if (leagueId != null) {
    filters.push({ 'league.id': leagueId });
  }

  if (season != null) {
    filters.push({ 'league.season': season });
  }

  if (teamId != null && team2Id != null) {
    filters.push({
      $or: [
        {
          $and: [{ 'teams.home.id': teamId }, { 'teams.away.id': team2Id }],
        },
        {
          $and: [{ 'teams.home.id': team2Id }, { 'teams.away.id': teamId }],
        },
      ],
    });
  } else if (teamId != null) {
    filters.push({
      $or: [{ 'teams.home.id': teamId }, { 'teams.away.id': teamId }],
    });
  }

  if (finalsOnly) {
    filters.push({ 'league.round': { $regex: 'final', $options: 'i' } });
    filters.push({ 'league.round': { $not: NON_FINAL_ROUND_REGEX } });
  }

  return filters;
}

function buildPlayableWatchedPipeline(username, filters, mode) {
  const watchedQuery = buildWatchedMatchesQuery({
    username,
    team_id: filters.teamId,
    season: filters.season,
    league_id: filters.leagueId,
  });

  const realFilters = buildRealMatchFilters({ mode, ...filters });

  return [
    { $match: watchedQuery },
    {
      $lookup: {
        from: 'real_matches',
        localField: 'fixture.id',
        foreignField: 'fixture.id',
        as: 'real',
      },
    },
    { $unwind: '$real' },
    { $replaceRoot: { newRoot: '$real' } },
    { $match: { $and: realFilters } },
  ];
}

async function countPlayableWatchedMatches(username, filters, mode) {
  const db = getDB();
  const pipeline = [
    ...buildPlayableWatchedPipeline(username, filters, mode),
    { $count: 'total' },
  ];
  const result = await db.collection('matches').aggregate(pipeline).toArray();
  return result[0]?.total ?? 0;
}

export async function getOnzeWatchedStatus(username) {
  const db = getDB();
  const watchedCount = await db
    .collection('matches')
    .countDocuments({ 'user.username': username });

  if (watchedCount === 0) {
    return {
      hasWatched: false,
      watchedCount: 0,
      playable: { xi: 0, goals: 0, events: 0 },
      fixtureIds: [],
    };
  }

  const [xi, goals, events, fixtureIds] = await Promise.all([
    ...PLAYABLE_MODES.map((mode) => countPlayableWatchedMatches(username, {}, mode)),
    db.collection('matches').distinct('fixture.id', { 'user.username': username }),
  ]);

  return {
    hasWatched: true,
    watchedCount,
    playable: { xi, goals, events },
    fixtureIds: fixtureIds
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id)),
  };
}

export async function searchOnzeWatchedMatches(username, filters, mode, pagination) {
  const db = getDB();
  const { limit, offset } = pagination;
  const basePipeline = buildPlayableWatchedPipeline(username, filters, mode);

  const [countResult, rows] = await Promise.all([
    db
      .collection('matches')
      .aggregate([...basePipeline, { $count: 'total' }])
      .toArray(),
    db
      .collection('matches')
      .aggregate([
        ...basePipeline,
        { $sort: { 'fixture.timestamp': -1 } },
        { $skip: offset },
        { $limit: limit },
        { $project: REAL_MATCH_LIST_PROJECTION },
      ])
      .toArray(),
  ]);

  const total = countResult[0]?.total ?? 0;
  const matches = parseH2hMatches(rows);
  return buildMatchListResponse(matches, total, limit, offset);
}

export async function pickRandomOnzeWatchedMatch(username, filters, mode) {
  const db = getDB();
  const pipeline = [
    ...buildPlayableWatchedPipeline(username, filters, mode),
    { $sample: { size: 1 } },
    { $project: REAL_MATCH_LIST_PROJECTION },
  ];

  const result = await db.collection('matches').aggregate(pipeline).toArray();
  if (!result.length) {
    const error = new Error('No playable watched matches found for the current filters');
    error.status = 404;
    throw error;
  }

  return parseH2hMatch(result[0]);
}
