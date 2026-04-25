import { getDB } from '../config/db.js';
import {
  buildUserLocation,
  parseCreateLocationBody,
  parseLocationDocuments
} from '../entities/locationEntity.js';

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

    let result = await db.collection('locations').insertOne(location);
    console.log("Location " + location.name + " inserted for user " + req.validateData.username);
    res.status(201).json(result.insertedId);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}
