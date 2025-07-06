import { getDB } from '../config/db.js';
import { getTopLeaguesQuery } from '../config/topLeagues.js';

// Get leagues
const getLeagues = async (req, res) => {
  const db = getDB();
  try {
    const result = await db.collection('leagues').find().toArray();
    console.log("Leagues Getted");
    res.send(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Get top leagues
const getTopLeagues = async (req, res) => {
  const db = getDB();
  try {
    const query = getTopLeaguesQuery();
    const result = await db.collection('leagues').find(query).toArray();
    console.log("Top Leagues Getted");
    res.send(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export { getLeagues, getTopLeagues };