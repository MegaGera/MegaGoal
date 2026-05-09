import { z } from 'zod';

/** Goals block inside all / home / away segments */
const standingsGoalsSchema = z.object({
  for: z.number().int(),
  against: z.number().int()
});

/** Per-venue totals for one club row */
const standingsSegmentSchema = z.object({
  played: z.number().int(),
  win: z.number().int(),
  draw: z.number().int(),
  lose: z.number().int(),
  goals: standingsGoalsSchema
});

/** One row in a standings table (API-Football GET standings → response[].league.standings) */
const standingsRowSchema = z.object({
  rank: z.number().int(),
  team: z.object({
    id: z.number().int(),
    name: z.string(),
    logo: z.string()
  }),
  points: z.number().int(),
  goalsDiff: z.number().int(),
  group: z.string().nullable().optional(),
  form: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  all: standingsSegmentSchema,
  home: standingsSegmentSchema,
  away: standingsSegmentSchema,
  /** ISO datetime string from API */
  update: z.string()
});

/**
 * Snapshot of league metadata for one season (matches API `league` object without nested `standings`).
 */
const standingsLeagueSnapshotSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  country: z.string(),
  logo: z.string(),
  flag: z.string().nullable(),
  season: z.number().int()
});

/**
 * Standings for one league season. Outer array = groups/phases; inner array = ordered rows.
 */
const standingsSeasonEntrySchema = z.object({
  season: z.number().int(),
  league: standingsLeagueSnapshotSchema,
  standings: z.array(z.array(standingsRowSchema)),
  /** When this season block was last stored from the API */
  fetched_at: z.coerce.date().nullable().optional()
});

/**
 * One MongoDB document per API-Football league: all tracked seasons in `seasons`.
 */
const leagueStandingsDocumentSchema = z.object({
  league_id: z.number().int(),
  seasons: z.array(standingsSeasonEntrySchema),
  updated_at: z.coerce.date().nullable().optional()
});

const parseStandingsRow = (document) => standingsRowSchema.parse(document);
const parseStandingsSeasonEntry = (document) => standingsSeasonEntrySchema.parse(document);
const parseLeagueStandingsDocument = (document) => leagueStandingsDocumentSchema.parse(document);
const parseLeagueStandingsDocuments = (documents) => z.array(leagueStandingsDocumentSchema).parse(documents);

export {
  leagueStandingsDocumentSchema,
  standingsGoalsSchema,
  standingsLeagueSnapshotSchema,
  standingsRowSchema,
  standingsSeasonEntrySchema,
  standingsSegmentSchema,
  parseLeagueStandingsDocument,
  parseLeagueStandingsDocuments,
  parseStandingsRow,
  parseStandingsSeasonEntry
};
