import { z } from 'zod';

const venueSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  address: z.string(),
  city: z.string(),
  country: z.string(),
  capacity: z.number().int(),
  surface: z.string(),
  image: z.string()
});

const venueReferenceSchema = venueSchema.pick({
  id: true,
  name: true
});

const parseVenue = (document) => venueSchema.parse(document);
const parseVenues = (documents) => z.array(venueSchema).parse(documents);
const parseVenueReference = (document) => venueReferenceSchema.parse(document);

export {
  parseVenue,
  parseVenueReference,
  parseVenues
};
