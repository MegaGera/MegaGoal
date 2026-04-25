import { z } from 'zod';

const matchTeamSchema = z.object({
  id: z.number().int(),
  name: z.string()
});

const teamStatisticsSchema = z.object({
  team: z.object({
    id: z.number().int(),
    name: z.string(),
    logo: z.string()
  }),
  statistics: z.array(z.object({
    type: z.string(),
    value: z.union([z.number(), z.string(), z.null()])
  }))
});

const matchPlayerStatsSchema = z.object({
  started: z.boolean(),
  goals: z.number().int(),
  assists: z.number().int(),
  yellow_cards: z.number().int(),
  red_cards: z.number().int()
});

const matchVenueSchema = z.object({
  id: z.number().int().nullable(),
  name: z.string().nullable()
});

const matchSchema = z.object({
  fixture: z.object({
    id: z.number().int(),
    timestamp: z.number().int()
  }),
  league: z.object({
    id: z.number().int(),
    name: z.string(),
    round: z.string(),
    season: z.number().int()
  }),
  teams: z.object({
    home: matchTeamSchema,
    away: matchTeamSchema
  }),
  goals: z.object({
    home: z.number().int().nullable(),
    away: z.number().int().nullable()
  }),
  location: z.string().nullable().optional(),
  user: z.object({
    username: z.string()
  }),
  status: z.string().optional(),
  venue: matchVenueSchema.nullable().optional(),
  statistics: z.array(teamStatisticsSchema).optional(),
  player_stats: matchPlayerStatsSchema.optional()
});

const setLocationPayloadSchema = z.object({
  fixtureId: z.coerce.number().int(),
  location: z.string().min(1),
  venue: z.object({
    id: z.coerce.number().int(),
    name: z.string()
  }).optional()
});

const parseMatches = (documents) => z.array(matchSchema).parse(documents);
const parseMatch = (document) => matchSchema.parse(document);
const parseFixtureId = (fixtureId) => z.coerce.number().int().parse(fixtureId);
const parseTeamId = (teamId) => z.coerce.number().int().parse(teamId);
const parseCreateMatchBody = (body) => matchSchema.omit({ user: true }).parse(body);
const buildMatchDocument = ({ body, username }) => matchSchema.parse({
  ...body,
  user: { username }
});
const parseSetLocationPayload = (body) => setLocationPayloadSchema.parse(body);

export {
  buildMatchDocument,
  parseCreateMatchBody,
  parseFixtureId,
  parseMatch,
  parseMatches,
  parseSetLocationPayload,
  parseTeamId
};
