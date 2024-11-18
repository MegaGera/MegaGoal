import { getDB } from '../config/db.js';

// Get locations
const getLocations = async (req, res) => {
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

// Post create a Location
const createLocation = async (req, res) => {
  const db = getDB();
  try {
    let location = req.body;
    let username = req.validateData.username;
    location.user = { username: username };

    let result = await db.collection('locations').insertOne(location);
    console.log("Location " + location.name + " inserted for user " + req.validateData.username);
    res.status(201).json(result.insertedId);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export { getLocations, createLocation };