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
    // First, get all league_ids and positions from league_settings
    const leagueSettings = await db.collection('league_settings').find({}).toArray();
    
    // Create a map of league_id to position
    const leaguePositionMap = {};
    leagueSettings.forEach(setting => {
      leaguePositionMap[setting.league_id] = setting.position || Number.MAX_SAFE_INTEGER;
    });
    
    // Get the league IDs from settings
    const leagueIds = leagueSettings.map(setting => setting.league_id);
    
    // If no leagues in settings, return empty array
    if (leagueIds.length === 0) {
      console.log("No leagues found in settings");
      res.send([]);
      return;
    }
    
    // Query leagues collection with the IDs from settings
    const query = {
      $or: leagueIds.map(leagueId => ({ "league.id": leagueId }))
    };
    
    const leagues = await db.collection('leagues').find(query).toArray();
    
    // Add position to each league and sort by position
    const result = leagues.map(league => ({
      ...league,
      position: leaguePositionMap[league.league.id] || Number.MAX_SAFE_INTEGER
    })).sort((a, b) => {
      const posA = a.position || Number.MAX_SAFE_INTEGER;
      const posB = b.position || Number.MAX_SAFE_INTEGER;
      return posA - posB;
    });
    
    console.log("Top Leagues Getted with positions");
    res.send(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export { getLeagues, getTopLeagues };