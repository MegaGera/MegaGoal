import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

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
  venue_id: z.number().int().optional()
});

const createLocationBodySchema = z.object({
  name: z.string().min(1)
});

const parseLocationDocuments = (documents) => z.array(locationSchema).parse(documents);
const parseLocationDocument = (document) => locationSchema.parse(document);
const parseCreateLocationBody = (body) => createLocationBodySchema.parse(body);
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
  parseVenueLocationId
};
