import { z } from 'zod';
import { getDB } from '../config/db.js';

const countryQuerySchema = z.object({
  country: z.string().trim().min(1)
});

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
        { $group: { _id: { $toLower: '$country' }, count: { $sum: 1 } } }
      ]).toArray()
    ]);

    const countByName = new Map(counts.map((row) => [row._id, row.count]));
    const rows = countries.map((country) => ({
      name: country.name,
      code: country.code ?? null,
      flag: country.flag ?? null,
      venueCount: countByName.get(String(country.name).toLowerCase()) ?? 0
    }));

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

export { getVenueCountries, getVenuesByCountry };
