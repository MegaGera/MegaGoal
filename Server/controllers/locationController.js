import { getDB } from '../config/db.js';
import {
  buildUserLocation,
  parseCreateLocationBody,
  parseLocationDocuments,
  parseLocationId,
  parseRenameLocationBody,
  parseSetLocationPlaceBody
} from '../entities/locationEntity.js';
import { searchPhotonPlaces } from '../services/photonSearch.js';

const readPlaceBias = (query) => {
  const lat = Number(query.lat);
  const lng = Number(query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return { lat, lng };
};

// Get locations
export const getLocations = async (req, res) => {
  const db = getDB();
  try {
    let username = req.validateData.username;

    const filter = { "user.username": username };
    const result = await db.collection('locations').find(filter).toArray();
    const validatedResult = parseLocationDocuments(result);
    console.log("Locations Getted");
    res.send(validatedResult);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Get location counts
export const getLocationCounts = async (req, res) => {
  const db = getDB();
  try {
    let username = req.validateData.username;

    const pipeline = [
      { $match: { "user.username": username } },
      {
        $lookup: {
          from: 'matches',
          localField: 'id',
          foreignField: 'location',
          as: 'matches'
        }
      },
      {
        $addFields: {
          matchCount: { $size: "$matches" }
        }
      },
      {
        $project: {
          matches: 0
        }
      },
      {
        $sort: {
          matchCount: -1
        }
      }
    ];

    const result = await db.collection('locations').aggregate(pipeline).toArray();
    const validatedResult = parseLocationDocuments(result);
    console.log("Location with counts retrieved");
    res.send(validatedResult);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Post create a Location
export const createLocation = async (req, res) => {
  const db = getDB();
  try {
    const username = req.validateData.username;
    const { name } = parseCreateLocationBody(req.body);
    const location = buildUserLocation({ name, username });

    await db.collection('locations').insertOne(location);
    console.log("Location " + location.name + " inserted for user " + req.validateData.username);
    res.status(201).json({ id: location.id, name: location.name });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export const searchLocationPlaces = async (req, res) => {
  try {
    const query = String(req.query.q ?? '').trim();
    if (query.length < 2 || query.length > 80) {
      res.send([]);
      return;
    }
    const results = await searchPhotonPlaces(query, readPlaceBias(req.query));
    res.send(results);
  } catch (error) {
    res.status(502).json({ message: 'Place search is unavailable.' });
  }
}

export const renameLocation = async (req, res) => {
  const db = getDB();
  try {
    const username = req.validateData.username;
    const id = parseLocationId(req.params.id);
    const { name } = parseRenameLocationBody(req.body);
    const existing = await db.collection('locations').findOne({ id, 'user.username': username });
    if (!existing) {
      res.status(404).json({ message: 'Location not found' });
      return;
    }
    if (existing.stadium) {
      res.status(400).json({ message: 'Stadium locations stay linked to the match venue' });
      return;
    }
    await db.collection('locations').updateOne({ id, 'user.username': username }, { $set: { name } });
    res.send({ id, name });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export const setLocationPlace = async (req, res) => {
  const db = getDB();
  try {
    const username = req.validateData.username;
    const id = parseLocationId(req.params.id);
    const { place } = parseSetLocationPlaceBody(req.body);
    const existing = await db.collection('locations').findOne({ id, 'user.username': username });
    if (!existing) {
      res.status(404).json({ message: 'Location not found' });
      return;
    }
    if (existing.stadium) {
      res.status(400).json({ message: 'Stadium locations stay linked to the match venue' });
      return;
    }

    const official = Boolean(place?.osmId);
    const update = place
      ? { $set: { place, official } }
      : { $set: { official: false }, $unset: { place: '' } };
    await db.collection('locations').updateOne({ id, 'user.username': username }, update);
    res.send({
      id,
      official,
      stadium: false,
      place: place ?? null
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}
