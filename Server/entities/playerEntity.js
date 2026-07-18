import { z } from 'zod';

const playerBirthSchema = z.object({
  date: z.string().nullable(),
  place: z.string().nullable(),
  country: z.string().nullable()
});

const playerInfoSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  firstname: z.string().nullable(),
  lastname: z.string().nullable(),
  age: z.number().int().nullable(),
  birth: playerBirthSchema,
  nationality: z.string().nullable(),
  height: z.string().nullable(),
  weight: z.string().nullable(),
  number: z.number().int().nullable().optional(),
  position: z.string().nullable().optional(),
  injured: z.boolean().optional(),
  photo: z.string()
});

const playerTeamInfoSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  logo: z.string()
});

const playerTeamHistorySchema = z.object({
  team: playerTeamInfoSchema,
  seasons: z.array(z.number().int())
});

/** Country row from `countries` collection, attached on GET /players/:id */
const nationalityCountrySchema = z
  .object({
    name: z.string(),
    code: z.string().nullable(),
    flag: z.string().nullable()
  })
  .nullable()
  .optional();

const playerSchema = z.object({
  player: playerInfoSchema,
  teams: z.array(playerTeamHistorySchema).optional(),
  last_update: z.date().nullable().optional(),
  nationality_country: nationalityCountrySchema
});

const playerListResponseSchema = z.object({
  players: z.array(playerSchema),
  pagination: z.object({
    currentPage: z.number().int(),
    totalPages: z.number().int(),
    totalCount: z.number().int(),
    limit: z.number().int(),
    hasNextPage: z.boolean(),
    hasPrevPage: z.boolean()
  })
});

const parsePlayerId = (id) => z.coerce.number().int().parse(id);
const parsePlayer = (document) => playerSchema.parse(document);
const parsePlayers = (documents) => z.array(playerSchema).parse(documents);
const parsePlayerListResponse = (response) => playerListResponseSchema.parse(response);

export {
  parsePlayer,
  parsePlayerId,
  parsePlayerListResponse,
  parsePlayers
};
