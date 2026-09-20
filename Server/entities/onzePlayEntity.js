import { z } from 'zod';

const onzePlayGameSchema = z.enum(['guess_xi', 'guess_goals']);
const onzePlayDifficultySchema = z.enum(['easy', 'medium', 'hard', 'extreme']);
const onzePlayTeamScopeSchema = z.enum(['both', 'home', 'away']);
const onzePlayStatusSchema = z.enum(['won', 'timeout']);
const onzePlayOutcomeSchema = z.enum(['clean', 'hinted', 'resolved']);

const onzePlayTeamRefSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1)
});

const onzePlayPlayerSchema = z.object({
  player_id: z.number().int().nullable(),
  name: z.string().min(1),
  slot_key: z.string().min(1),
  team_side: z.enum(['home', 'away']),
  team_id: z.number().int(),
  team_name: z.string().min(1),
  hints: z.number().int().nonnegative(),
  outcome: onzePlayOutcomeSchema,
  points: z.number().int().min(0).max(100),
  is_own_goal: z.boolean().optional(),
  minute_label: z.string().min(1).optional()
});

const onzePlayXiConfigSchema = z.object({
  difficulty: onzePlayDifficultySchema,
  team_scope: onzePlayTeamScopeSchema,
  timer_seconds: z.number().int().positive(),
  include_subs: z.boolean(),
  is_national_fixture: z.boolean()
});

const onzePlayGoalsConfigSchema = z.object({
  team_scope: onzePlayTeamScopeSchema,
  timer_seconds: z.number().int().positive(),
  is_national_fixture: z.boolean()
});

const onzePlayConfigSchema = z.union([onzePlayXiConfigSchema, onzePlayGoalsConfigSchema]);

const onzePlayResultSchema = z.object({
  status: onzePlayStatusSchema,
  seconds_left: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  guessed_by_name: z.number().int().nonnegative(),
  tries: z.number().int().nonnegative(),
  player_points: z.number().int().nonnegative(),
  time_points: z.number().int().nonnegative(),
  bonuses: z.object({
    all_guessed: z.boolean(),
    perfect_tries: z.boolean(),
    no_hints: z.boolean()
  }),
  total_points: z.number().int().nonnegative()
});

/** Stored document in the `onze_plays` collection (without Mongo `_id`). */
const onzePlayDocumentSchema = z.object({
  client_id: z.uuid(),
  user: z.object({
    username: z.string().min(1)
  }),
  game: onzePlayGameSchema,
  fixture: z.object({
    id: z.number().int(),
    timestamp: z.number().int(),
    venue: z
      .object({
        name: z.string().nullable().optional(),
        city: z.string().nullable().optional(),
      })
      .nullish()
  }),
  league: z.object({
    id: z.number().int(),
    name: z.string().min(1),
    round: z.string(),
    season: z.number().int()
  }),
  teams: z.object({
    home: onzePlayTeamRefSchema,
    away: onzePlayTeamRefSchema
  }),
  goals: z.object({
    home: z.number().int().nullable(),
    away: z.number().int().nullable()
  }),
  config: onzePlayConfigSchema,
  result: onzePlayResultSchema,
  players: z.array(onzePlayPlayerSchema),
  created_at: z.coerce.date()
});

const parseOnzePlayDocument = (document) => onzePlayDocumentSchema.parse(document);
const parseOnzePlayDocuments = (documents) => z.array(onzePlayDocumentSchema).parse(documents);

export {
  onzePlayConfigSchema,
  onzePlayDocumentSchema,
  onzePlayGameSchema,
  onzePlayPlayerSchema,
  onzePlayResultSchema,
  parseOnzePlayDocument,
  parseOnzePlayDocuments
};
