import { z } from 'zod';

import { leagueColorsSchema } from './leagueEntity.js';

const seasonTeamSchema = z.object({
  league: z.string(),
  season: z.string()
});

const teamInfoSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  code: z.string().nullable(),
  country: z.string(),
  founded: z.number().int().nullable(),
  national: z.boolean(),
  logo: z.string()
});

const venueInfoSchema = z.object({
  id: z.number().int().nullable(),
  name: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  capacity: z.number().int().nullable(),
  surface: z.string().nullable(),
  image: z.string().nullable()
});

// Mirrors WebApp/src/app/models/team.ts -> Team interface.
const teamSchema = z.object({
  team: teamInfoSchema,
  venue: venueInfoSchema,
  seasons: z.array(seasonTeamSchema)
});

const domesticLeagueBundleSchema = z.object({
  league: z.object({
    id: z.number().int(),
    name: z.string(),
    type: z.string(),
    logo: z.string()
  }),
  country: z.object({
    name: z.string(),
    code: z.string().nullable(),
    flag: z.string().nullable()
  }),
  colors: leagueColorsSchema.optional()
});

// MongoDB document can include auxiliary fields not present in frontend model.
const teamDocumentSchema = teamSchema.extend({
  previous: z.array(z.string()).optional(),
  domestic_league: domesticLeagueBundleSchema.nullable().optional()
});

const shortTeamSchema = z.object({
  name: z.string(),
  id: z.number().int(),
  seasons: z.array(seasonTeamSchema)
});

const shortTeamAggregationPipeline = (matchQuery = {}) => {
  const pipeline = [];

  if (Object.keys(matchQuery).length > 0) {
    pipeline.push({ $match: matchQuery });
  }

  pipeline.push({
    $project: {
      _id: 0,
      name: '$team.name',
      id: '$team.id',
      seasons: 1
    }
  });

  return pipeline;
};

const setPreviousImagePayloadSchema = z.object({
  team_id: z.coerce.number().int(),
  image_title: z.string().min(1)
});

const parseTeamId = (teamId) => z.coerce.number().int().parse(teamId);

const buildTeamsQuery = ({ league_id, season, country }) => {
  const filters = [];

  if (league_id && season) {
    filters.push({
      seasons: { $elemMatch: { league: String(league_id), season: String(season) } }
    });
  } else if (league_id) {
    filters.push({ 'seasons.league': String(league_id) });
  }

  if (country) {
    filters.push({ 'team.country': String(country) });
  }

  return filters.length > 0 ? { $and: filters } : {};
};

const parseTeamDocuments = (documents) => z.array(teamDocumentSchema).parse(documents);
const parseTeamDocument = (document) => teamDocumentSchema.parse(document);
const parseShortTeams = (documents) => z.array(shortTeamSchema).parse(documents);

export {
  buildTeamsQuery,
  domesticLeagueBundleSchema,
  shortTeamAggregationPipeline,
  parseShortTeams,
  parseTeamDocument,
  parseTeamDocuments,
  parseTeamId,
  setPreviousImagePayloadSchema
};
