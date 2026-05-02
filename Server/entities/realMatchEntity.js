import { z } from 'zod';

const nullableNumber = z.number().int().nullable();

const teamRefSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  logo: z.string()
});

const fixtureSchema = z.object({
  id: z.number().int(),
  referee: z.string().nullable().optional(),
  timezone: z.string(),
  date: z.string(),
  timestamp: z.number().int(),
  periods: z.object({
    first: nullableNumber.optional(),
    second: nullableNumber.optional()
  }).optional(),
  venue: z.object({
    id: z.number().int().nullable().optional(),
    name: z.string().nullable().optional(),
    city: z.string().nullable().optional()
  }).optional(),
  status: z.object({
    long: z.string(),
    short: z.string(),
    elapsed: nullableNumber.optional()
  })
});

const leagueSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  country: z.string(),
  logo: z.string(),
  flag: z.string().nullable(),
  season: z.number().int(),
  round: z.string()
});

const matchTeamSchema = teamRefSchema.extend({
  winner: z.boolean().nullable().optional()
});

const goalsSchema = z.object({
  home: nullableNumber,
  away: nullableNumber
});

const statisticEntrySchema = z.object({
  type: z.string(),
  value: z.union([z.number(), z.string(), z.null()])
});

const lineupPlayerSchema = z.object({
  player: z.object({
    id: z.number().int().nullable(),
    name: z.string(),
    number: z.number().int().nullable(),
    pos: z.string().nullable(),
    grid: z.string().nullable()
  })
});

const lineupSchema = z.object({
  team: teamRefSchema.extend({
    colors: z.object({
      player: z.object({
        primary: z.string(),
        number: z.string(),
        border: z.string()
      }),
      goalkeeper: z.object({
        primary: z.string(),
        number: z.string(),
        border: z.string()
      })
    }).nullable().optional()
  }),
  coach: z.object({
    id: z.number().int().nullable(),
    name: z.string().nullable(),
    photo: z.string().nullable().optional()
  }).optional(),
  formation: z.string().nullable().optional(),
  startXI: z.array(lineupPlayerSchema).optional(),
  substitutes: z.array(lineupPlayerSchema).optional()
});

const eventParticipantSchema = z.object({
  id: z.number().int().nullable(),
  name: z.string().nullable()
});

const eventSchema = z.object({
  time: z.object({
    elapsed: z.number().int().nullable(),
    extra: z.number().int().nullable().optional()
  }),
  team: teamRefSchema,
  player: eventParticipantSchema,
  assist: eventParticipantSchema.nullable(),
  type: z.string(),
  detail: z.string().nullable(),
  comments: z.string().nullable().optional()
});

const realMatchSchema = z.object({
  fixture: fixtureSchema,
  league: leagueSchema,
  teams: z.object({
    home: matchTeamSchema,
    away: matchTeamSchema
  }),
  goals: goalsSchema,
  score: z.object({
    halftime: goalsSchema,
    fulltime: goalsSchema,
    extratime: goalsSchema,
    penalty: goalsSchema
  }),
  statistics: z.array(z.object({
    team: teamRefSchema,
    statistics: z.array(statisticEntrySchema)
  })).optional(),
  lineups: z.array(lineupSchema).optional(),
  events: z.array(eventSchema).optional(),
  usernames: z.array(z.string()).optional()
});

const parseRealMatch = (document) => realMatchSchema.parse(document);
const parseRealMatches = (documents) => z.array(realMatchSchema).parse(documents);
const parseFixtureId = (id) => z.coerce.number().int().parse(id);

export {
  parseFixtureId,
  parseRealMatch,
  parseRealMatches
};
