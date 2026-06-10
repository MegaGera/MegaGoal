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

const matchPlayerPickSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  team_id: z.number().int(),
  team_name: z.string().optional()
});

const matchRatingSchema = z
  .number()
  .min(1)
  .max(5)
  .refine((n) => Number.isInteger(n * 2), {
    message: 'Rating must use 0.5 steps between 1 and 5'
  });

const normalizeUserPicksDocument = (picks) => {
  if (picks == null || typeof picks !== 'object') {
    return picks;
  }
  const next = { ...picks };
  if (next.bluff == null && next.worst != null) {
    next.bluff = next.worst;
  }
  delete next.worst;
  return next;
};

const matchUserPicksFieldsSchema = z.object({
  rating: matchRatingSchema.nullable().optional(),
  mvp: matchPlayerPickSchema.nullable().optional(),
  bluff: matchPlayerPickSchema.nullable().optional(),
  underrated: matchPlayerPickSchema.nullable().optional(),
  most_entertaining: matchPlayerPickSchema.nullable().optional()
});

const matchUserPicksSchema = z.preprocess(
  normalizeUserPicksDocument,
  matchUserPicksFieldsSchema
);

const MATCH_REACTION_EMOJIS = [
  '🔥',
  '😭',
  '🤩',
  '😡',
  '🍿',
  '😴',
  '🤯',
  '🚌'
];

const matchReactionEmojiSchema = z.enum(MATCH_REACTION_EMOJIS);
const matchReactionsSchema = z.array(matchReactionEmojiSchema);

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
  player_stats: matchPlayerStatsSchema.optional(),
  user_picks: matchUserPicksSchema.optional(),
  reactions: matchReactionsSchema.optional(),
  /** Global watched-user count for this fixture; only when requested */
  watched_count: z.number().int().optional()
});

const setLocationPayloadSchema = z.object({
  fixtureId: z.coerce.number().int(),
  location: z.string().min(1),
  venue: z.object({
    id: z.coerce.number().int(),
    name: z.string()
  }).optional()
});

const setUserPicksPayloadSchema = z.object({
  fixtureId: z.coerce.number().int(),
  user_picks: matchUserPicksFieldsSchema
    .partial()
    .refine(
      (picks) =>
        picks.rating !== undefined ||
        picks.mvp !== undefined ||
        picks.bluff !== undefined ||
        picks.underrated !== undefined ||
        picks.most_entertaining !== undefined,
      { message: 'At least one user_picks field must be provided' }
    )
});

const parseMatches = (documents) => z.array(matchSchema).parse(documents);
const parseMatch = (document) => matchSchema.parse(document);
const parseFixtureId = (fixtureId) => z.coerce.number().int().parse(fixtureId);
const parseTeamId = (teamId) => z.coerce.number().int().parse(teamId);
const parseCreateMatchBody = (body) => matchSchema.omit({ user: true, watched_count: true }).parse(body);
const buildMatchDocument = ({ body, username }) => matchSchema.parse({
  ...body,
  user: { username }
});
const parseSetLocationPayload = (body) => setLocationPayloadSchema.parse(body);
const setReactionsPayloadSchema = z.object({
  fixtureId: z.coerce.number().int(),
  reactions: matchReactionsSchema
});

const parseSetUserPicksPayload = (body) => setUserPicksPayloadSchema.parse(body);
const parseSetReactionsPayload = (body) => setReactionsPayloadSchema.parse(body);
const parseUserPicks = (document) => matchUserPicksSchema.parse(document);
const parseMatchReactions = (reactions) => matchReactionsSchema.parse(reactions);

const normalizeReactions = (reactions) => {
  if (!Array.isArray(reactions)) {
    return [];
  }
  const allowed = new Set(MATCH_REACTION_EMOJIS);
  return [...new Set(reactions.filter((r) => allowed.has(r)))];
};

const USER_PICK_PLAYER_KEYS = [
  'mvp',
  'bluff',
  'underrated',
  'most_entertaining'
];

const matchReactionCountSchema = z.object({
  reaction: matchReactionEmojiSchema,
  count: z.number().int().nonnegative()
});

const matchPlayerVoteCountSchema = matchPlayerPickSchema.extend({
  votes: z.number().int().positive()
});

const matchEngagementAggregateSchema = z.object({
  fixture_id: z.number().int(),
  reactions: z.array(matchReactionCountSchema),
  rating: z.object({
    average: z.number().min(1).max(5).nullable(),
    count: z.number().int().nonnegative()
  }),
  player_votes: z.object({
    mvp: z.array(matchPlayerVoteCountSchema),
    bluff: z.array(matchPlayerVoteCountSchema),
    underrated: z.array(matchPlayerVoteCountSchema),
    most_entertaining: z.array(matchPlayerVoteCountSchema)
  })
});

const parseMatchEngagementAggregate = (document) =>
  matchEngagementAggregateSchema.parse(document);

const mergeUserPicks = (existing, incoming) => {
  const base = normalizeUserPicksDocument(existing ?? {});
  const merged = { ...base };
  if (incoming.rating !== undefined) {
    merged.rating = incoming.rating;
  }
  for (const key of USER_PICK_PLAYER_KEYS) {
    if (incoming[key] !== undefined) {
      merged[key] = incoming[key];
    }
  }
  delete merged.worst;
  const hasValue =
    merged.rating != null ||
    USER_PICK_PLAYER_KEYS.some((key) => merged[key] != null);
  if (!hasValue) {
    return null;
  }
  return parseUserPicks(merged);
};

export {
  MATCH_REACTION_EMOJIS,
  USER_PICK_PLAYER_KEYS,
  buildMatchDocument,
  mergeUserPicks,
  normalizeReactions,
  parseCreateMatchBody,
  parseFixtureId,
  parseMatch,
  parseMatchEngagementAggregate,
  parseMatchReactions,
  parseMatches,
  parseSetLocationPayload,
  parseSetReactionsPayload,
  parseSetUserPicksPayload,
  parseTeamId
};
