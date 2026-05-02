import { z } from 'zod';

const leagueInfoSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  type: z.string(),
  logo: z.string()
});

const countrySchema = z.object({
  name: z.string(),
  code: z.string().nullable(),
  flag: z.string().nullable()
});

const leagueSeasonSchema = z.object({
  year: z.number().int(),
  start: z.string().nullable(),
  end: z.string().nullable(),
  current: z.boolean(),
  coverage: z.object({
    fixtures: z.object({
      events: z.boolean(),
      lineups: z.boolean(),
      statistics_fixtures: z.boolean(),
      statistics_players: z.boolean()
    }),
    standings: z.boolean(),
    players: z.boolean(),
    top_scorers: z.boolean(),
    top_assists: z.boolean(),
    top_cards: z.boolean(),
    injuries: z.boolean(),
    predictions: z.boolean(),
    odds: z.boolean()
  })
});

const leagueColorsSchema = z.object({
  base_color: z.string().optional(),
  card_main_color: z.string().optional(),
  card_trans_color: z.string().optional()
});

const leagueSchema = z.object({
  league: leagueInfoSchema,
  country: countrySchema,
  seasons: z.array(leagueSeasonSchema),
  position: z.number().int().optional()
});

const topLeagueSchema = leagueSchema.extend({
  colors: leagueColorsSchema.optional()
});

const availableSeasonSchema = z.object({
  season: z.number().int(),
  real_matches: z.number().int().nullable().optional(),
  teams: z.number().int().nullable().optional(),
  players: z.number().int().nullable().optional(),
  lineups: z.number().int().nullable().optional(),
  events: z.number().int().nullable().optional(),
  statistics: z.number().int().nullable().optional()
});

const leagueSettingsSchema = z.object({
  league_id: z.number().int(),
  league_name: z.string(),
  update_frequency: z.coerce.number(),
  last_update: z.date().nullable().optional(),
  next_match: z.date().nullable().optional(),
  is_active: z.boolean(),
  last_daily_update: z.date().nullable().optional(),
  daily_update: z.boolean(),
  season: z.number().int(),
  position: z.number().int(),
  colors: leagueColorsSchema.optional(),
  available_seasons: z.array(availableSeasonSchema).optional()
});

const changeIsActivePayloadSchema = z.object({
  league_id: z.coerce.number().int(),
  is_active: z.boolean()
});

const changeUpdateFrequencyPayloadSchema = z.object({
  league_id: z.coerce.number().int(),
  update_frequency: z.coerce.number()
});

const changeDailyUpdatePayloadSchema = z.object({
  league_id: z.coerce.number().int(),
  daily_update: z.boolean()
});

const changeLeagueColorsPayloadSchema = z.object({
  league_id: z.coerce.number().int(),
  colors: leagueColorsSchema
});

const createLeagueSettingPayloadSchema = z.object({
  league_id: z.coerce.number().int(),
  league_name: z.string().min(1)
});

const leagueColorEntrySchema = z.object({
  league_id: z.number().int(),
  colors: leagueColorsSchema.optional()
});

const parseLeagues = (documents) => z.array(leagueSchema).parse(documents);
const parseTopLeagues = (documents) => z.array(topLeagueSchema).parse(documents);
const parseLeagueSettings = (documents) => z.array(leagueSettingsSchema).parse(documents);
const parseLeagueSettingsDocument = (document) => leagueSettingsSchema.parse(document);

const buildLeagueColorsMap = (settingsDocuments) => {
  const validatedSettings = z.array(leagueColorEntrySchema).parse(settingsDocuments);
  const colorsMap = {};

  validatedSettings.forEach((setting) => {
    if (setting.colors) {
      colorsMap[setting.league_id] = setting.colors;
    }
  });

  return colorsMap;
};

const parseChangeIsActivePayload = (body) => changeIsActivePayloadSchema.parse(body);
const parseChangeUpdateFrequencyPayload = (body) => changeUpdateFrequencyPayloadSchema.parse(body);
const parseChangeDailyUpdatePayload = (body) => changeDailyUpdatePayloadSchema.parse(body);
const parseChangeLeagueColorsPayload = (body) => changeLeagueColorsPayloadSchema.parse(body);
const parseCreateLeagueSettingPayload = (body) => createLeagueSettingPayloadSchema.parse(body);

const buildNewLeagueSetting = ({ league_id, league_name, position }) => parseLeagueSettingsDocument({
  league_id,
  league_name,
  update_frequency: 1,
  is_active: false,
  daily_update: false,
  season: 2025,
  position
});

export {
  buildLeagueColorsMap,
  buildNewLeagueSetting,
  leagueColorsSchema,
  parseChangeDailyUpdatePayload,
  parseChangeIsActivePayload,
  parseChangeLeagueColorsPayload,
  parseChangeUpdateFrequencyPayload,
  parseCreateLeagueSettingPayload,
  parseLeagueSettings,
  parseLeagues,
  parseTopLeagues
};
