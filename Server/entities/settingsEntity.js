import { z } from 'zod';

const playersApiInfoSettingSchema = z.object({
  type: z.literal('PLAYERS_API_INFO'),
  pages_searched: z.array(z.number().int()),
  total_pages: z.number().int(),
  last_update: z.date().nullable()
});

const landingMatchSettingSchema = z.object({
  type: z.literal('LANDING_MATCH'),
  fixture_id: z.number().int(),
  created_at: z.date().optional()
});

const landingMatchPayloadSchema = z.object({
  fixture_id: z.coerce.number().int()
});

const defaultPlayersApiInfoSetting = () => playersApiInfoSettingSchema.parse({
  type: 'PLAYERS_API_INFO',
  pages_searched: [],
  total_pages: 0,
  last_update: null
});

const buildLandingMatchSetting = ({ fixture_id }) => landingMatchSettingSchema.parse({
  type: 'LANDING_MATCH',
  fixture_id,
  created_at: new Date()
});

const parsePlayersApiInfoSetting = (document) => playersApiInfoSettingSchema.parse(document);
const parseLandingMatchSetting = (document) => landingMatchSettingSchema.parse(document);
const parseLandingMatchSettings = (documents) => z.array(landingMatchSettingSchema).parse(documents);
const parseLandingMatchPayload = (body) => landingMatchPayloadSchema.parse(body);

export {
  buildLandingMatchSetting,
  defaultPlayersApiInfoSetting,
  parseLandingMatchPayload,
  parseLandingMatchSetting,
  parseLandingMatchSettings,
  parsePlayersApiInfoSetting
};
