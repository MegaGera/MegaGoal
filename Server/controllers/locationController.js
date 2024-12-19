import { getDB } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

// Get locations
export const getLocations = async (req, res) => {
  const db = getDB();
  try {
    let username = req.validateData.username;

    const filter = { "user.username": username };
    const result = await db.collection('locations').find(filter).toArray();
    console.log("Locations Getted");
    res.send(result);
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
    console.log("Location with counts retrieved");
    res.send(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Post create a Location
export const createLocation = async (req, res) => {
  const db = getDB();
  try {
    let location = req.body;
    let username = req.validateData.username;
    location.id = uuidv4();
    location.user = { username: username };
    location.official = false;
    location.stadium = false;
    location.private = true;

    let result = await db.collection('locations').insertOne(location);
    console.log("Location " + location.name + " inserted for user " + req.validateData.username);
    res.status(201).json(result.insertedId);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}
