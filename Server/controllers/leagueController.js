import { getDB } from '../config/db.js';

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
    const query = {
      $or: [
        { "league.id": 2 }, { "league.id": 3 }, { "league.id": 39 }, { "league.id": 140 }, { "league.id": 143 },
        { "league.id": 45 }, { "league.id": 141 }, { "league.id": 135 }, { "league.id": 78 }, { "league.id": 61 },
        { "league.id": 556 }, { "league.id": 531 }, { "league.id": 848 }, { "league.id": 4 }, { "league.id": 1 }, 
        { "league.id": 9 }, { "league.id": 40 }, { "league.id": 41 }, { "league.id": 42 }, { "league.id": 46 },
        { "league.id": 5 }
      ]
    }
    const result = await db.collection('leagues').find(query).toArray();
    console.log("Top Leagues Getted");
    res.send(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export { getLeagues, getTopLeagues };