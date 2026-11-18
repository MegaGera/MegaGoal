import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const locationPlaceSchema = z.object({
  provider: z.literal('osm'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  osmId: z.string().min(1).optional(),
  osmType: z.enum(['N', 'W', 'R']).optional(),
  osmName: z.string().min(1).optional(),
  formattedAddress: z.string().min(1).optional()
}).refine((place) => Boolean(place.osmId) === Boolean(place.osmType), {
  message: 'osmId and osmType are set together'
});

const locationSchema = z.object({
  name: z.string(),
  id: z.uuid(),
  user: z.object({
    username: z.string()
  }),
  private: z.boolean(),
  stadium: z.boolean(),
  official: z.boolean(),
  matchCount: z.number().int().nonnegative().optional(),
  venue_id: z.number().int().optional(),
  place: locationPlaceSchema.optional()
});

const createLocationBodySchema = z.object({
  name: z.string().min(1)
});

const setLocationPlaceBodySchema = z.object({
  place: locationPlaceSchema.nullable()
});

const renameLocationBodySchema = z.object({
  name: z.string().trim().min(1)
});

const parseLocationDocuments = (documents) => z.array(locationSchema).parse(documents);
const parseLocationDocument = (document) => locationSchema.parse(document);
const parseCreateLocationBody = (body) => createLocationBodySchema.parse(body);
const parseSetLocationPlaceBody = (body) => setLocationPlaceBodySchema.parse(body);
const parseRenameLocationBody = (body) => renameLocationBodySchema.parse(body);
const parseLocationId = (locationId) => z.uuid().parse(locationId);
const parseVenueLocationId = (locationId) => z.coerce.number().int().parse(locationId);

const buildUserLocation = ({ name, username }) => parseLocationDocument({
  name,
  id: uuidv4(),
  user: { username },
  official: false,
  stadium: false,
  private: true
});

const buildOfficialVenueLocation = ({ name, username, venueId }) => parseLocationDocument({
  name,
  id: uuidv4(),
  user: { username },
  official: true,
  stadium: true,
  private: true,
  venue_id: venueId
});

export {
  buildOfficialVenueLocation,
  buildUserLocation,
  parseCreateLocationBody,
  parseLocationDocument,
  parseLocationDocuments,
  parseLocationId,
  parseRenameLocationBody,
  parseSetLocationPlaceBody,
  parseVenueLocationId
};
