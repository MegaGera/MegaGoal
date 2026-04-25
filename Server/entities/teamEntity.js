import { z } from 'zod';

const seasonTeamSchema = z.object({
  league: z.string(),
  season: z.string()
});

const teamInfoSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  code: z.string(),
  country: z.string(),
  founded: z.number().int(),
  national: z.boolean(),
  logo: z.string()
});

const venueInfoSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  address: z.string(),
  city: z.string(),
  capacity: z.number().int(),
  surface: z.string(),
  image: z.string()
});

// Mirrors WebApp/src/app/models/team.ts -> Team interface.
const teamSchema = z.object({
  team: teamInfoSchema,
  venue: venueInfoSchema,
  seasons: z.array(seasonTeamSchema)
});

// MongoDB document can include auxiliary fields not present in frontend model.
const teamDocumentSchema = teamSchema.extend({
  previous: z.array(z.string()).optional()
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
  shortTeamAggregationPipeline,
  parseShortTeams,
  parseTeamDocument,
  parseTeamDocuments,
  parseTeamId,
  setPreviousImagePayloadSchema
};
