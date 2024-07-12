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

export { getLocations };