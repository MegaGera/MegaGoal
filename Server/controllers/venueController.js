import { z } from 'zod';
import { getDB } from '../config/db.js';
import { searchPhotonPlaces } from '../services/photonSearch.js';

const countryQuerySchema = z.object({
  country: z.string().trim().min(1)
});

const venueIdSchema = z.coerce.number().int();

const venuePlaceSchema = z.object({
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

const setVenuePlaceBodySchema = z.object({
  place: venuePlaceSchema
});

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const hasVenuePin = (venue) => {
  const lat = venue?.place?.lat;
  const lng = venue?.place?.lng;
  return Number.isFinite(lat) && Number.isFinite(lng);
};

const venuePlaceQuery = (venue, country) => {
  const full = [venue.name, venue.city, country].filter(Boolean).join(', ');
  if (full.length <= 80) {
    return full;
  }
  const shorter = [venue.name, country].filter(Boolean).join(', ');
  return shorter.slice(0, 80);
};

const placeFromPhoton = (result) => {
  const place = {
    provider: 'osm',
    lat: result.lat,
    lng: result.lng
  };
  if (result.osmId && result.osmType) {
    place.osmId = result.osmId;
    place.osmType = result.osmType;
  }
  if (result.name) {
    place.osmName = result.name;
  }
  if (result.formattedAddress) {
    place.formattedAddress = result.formattedAddress;
  }
  return place;
};

const getVenueCountries = async (req, res) => {
  try {
    const db = getDB();
    const [countries, counts] = await Promise.all([
      db.collection('countries')
        .find({}, { projection: { _id: 0, name: 1, code: 1, flag: 1 } })
        .sort({ name: 1 })
        .toArray(),
      db.collection('venues').aggregate([
        { $match: { country: { $type: 'string' } } },
        {
          $group: {
            _id: { $toLower: '$country' },
            count: { $sum: 1 },
            pinnedCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: [{ $type: '$place.lat' }, 'number'] },
                      { $eq: [{ $type: '$place.lng' }, 'number'] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]).toArray()
    ]);

    const countByName = new Map(counts.map((row) => [row._id, row.count]));
    const pinnedByName = new Map(counts.map((row) => [row._id, row.pinnedCount]));
    const rows = countries.map((country) => {
      const key = String(country.name).toLowerCase();
      return {
        name: country.name,
        code: country.code ?? null,
        flag: country.flag ?? null,
        venueCount: countByName.get(key) ?? 0,
        pinnedCount: pinnedByName.get(key) ?? 0
      };
    });

    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getVenuesByCountry = async (req, res) => {
  try {
    const { country } = countryQuerySchema.parse(req.query);
    const db = getDB();
    const known = await db.collection('countries').findOne({ name: country });
    if (!known) {
      return res.status(404).json({ message: 'Unknown country' });
    }

    const venues = await db.collection('venues')
      .find(
        { country: { $regex: `^${escapeRegex(country)}$`, $options: 'i' } },
        { projection: { _id: 0 } }
      )
      .sort({ name: 1 })
      .toArray();

    res.status(200).json(venues);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Country is required' });
    }
    res.status(500).json({ message: error.message });
  }
};

const cleanupDuplicateVenues = async (req, res) => {
  try {
    const db = getDB();
    const venues = db.collection('venues');
    const groups = await venues.aggregate([
      { $match: { id: { $ne: null } } },
      { $sort: { _id: 1 } },
      { $group: { _id: '$id', ids: { $push: '$_id' }, n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } }
    ]).toArray();

    const removeIds = groups.flatMap((group) => group.ids.slice(1));
    let removed = 0;
    if (removeIds.length > 0) {
      const result = await venues.deleteMany({ _id: { $in: removeIds } });
      removed = result.deletedCount ?? 0;
    }

    await venues.createIndex({ id: 1 }, { background: true, unique: true });

    res.status(200).json({
      removed,
      duplicateGroups: groups.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const setVenuePlaces = async (req, res) => {
  try {
    const { country } = countryQuerySchema.parse(req.body);
    const db = getDB();
    const known = await db.collection('countries').findOne({ name: country });
    if (!known) {
      return res.status(404).json({ message: 'Unknown country' });
    }

    const venues = await db.collection('venues')
      .find({ country: { $regex: `^${escapeRegex(country)}$`, $options: 'i' } })
      .sort({ name: 1 })
      .toArray();

    let placed = 0;
    let skipped = 0;
    let notFound = 0;
    let failed = 0;
    let searched = 0;

    for (const venue of venues) {
      if (hasVenuePin(venue)) {
        skipped += 1;
        continue;
      }
      if (searched > 0) {
        await sleep(200);
      }
      searched += 1;
      try {
        const results = await searchPhotonPlaces(venuePlaceQuery(venue, country));
        const match = results[0];
        if (!match) {
          notFound += 1;
          continue;
        }
        await db.collection('venues').updateOne(
          { _id: venue._id },
          {
            $set: {
              place: placeFromPhoton(match),
              placeUpdatedAt: new Date()
            }
          }
        );
        placed += 1;
      } catch (error) {
        console.error(`Venue place search failed for ${venue.name}:`, error.message);
        failed += 1;
      }
    }

    res.status(200).json({ placed, skipped, notFound, failed });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Country is required' });
    }
    res.status(500).json({ message: error.message });
  }
};

const getVenue = async (req, res) => {
  try {
    const id = venueIdSchema.parse(req.params.id);
    const db = getDB();
    const venue = await db.collection('venues').findOne({ id }, { projection: { _id: 0 } });
    if (!venue) {
      return res.status(404).json({ message: 'Venue not found' });
    }
    res.status(200).json(venue);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Venue id is required' });
    }
    res.status(500).json({ message: error.message });
  }
};

const searchVenuePlace = async (req, res) => {
  try {
    const id = venueIdSchema.parse(req.params.id);
    const db = getDB();
    const venue = await db.collection('venues').findOne({ id });
    if (!venue) {
      return res.status(404).json({ message: 'Venue not found' });
    }

    const results = await searchPhotonPlaces(venuePlaceQuery(venue, venue.country || ''));
    const match = results[0];
    if (!match) {
      return res.status(404).json({ message: 'No place found' });
    }

    const place = placeFromPhoton(match);
    await db.collection('venues').updateOne(
      { id },
      { $set: { place, placeUpdatedAt: new Date() } }
    );
    res.status(200).json({ id, place });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Venue id is required' });
    }
    res.status(500).json({ message: error.message });
  }
};

const setVenuePlace = async (req, res) => {
  try {
    const id = venueIdSchema.parse(req.params.id);
    const { place } = setVenuePlaceBodySchema.parse(req.body);
    const db = getDB();
    const result = await db.collection('venues').updateOne(
      { id },
      { $set: { place, placeUpdatedAt: new Date() } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Venue not found' });
    }
    res.status(200).json({ id, place });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid venue place' });
    }
    res.status(500).json({ message: error.message });
  }
};

export {
  cleanupDuplicateVenues,
  getVenue,
  getVenueCountries,
  getVenuesByCountry,
  searchVenuePlace,
  setVenuePlace,
  setVenuePlaces
};
