import { getDB } from '../config/db.js';

// Get locations
const getLocations = async (req, res) => {
  const db = getDB();
  try {
    const result = await db.collection('locations').find().toArray();
    console.log("Locations Getted");
    res.send(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export { getLocations };