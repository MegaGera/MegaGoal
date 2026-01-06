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
    
    // Create a map of league_id to position and colors
    const leaguePositionMap = {};
    const leagueColorsMap = {};
    leagueSettings.forEach(setting => {
      leaguePositionMap[setting.league_id] = setting.position || Number.MAX_SAFE_INTEGER;
      leagueColorsMap[setting.league_id] = setting.colors || {};
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
    
    // Add position and colors to each league and sort by position
    const result = leagues.map(league => ({
      ...league,
      position: leaguePositionMap[league.league.id] || Number.MAX_SAFE_INTEGER,
      colors: leagueColorsMap[league.league.id] || {}
    })).sort((a, b) => {
      const posA = a.position || Number.MAX_SAFE_INTEGER;
      const posB = b.position || Number.MAX_SAFE_INTEGER;
      return posA - posB;
    });
    
    console.log("Top Leagues Getted with positions and colors");
    res.send(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Get league colors only (lightweight endpoint for colors)
const getLeagueColors = async (req, res) => {
  const db = getDB();
  try {
    // Get only league_id and colors from league_settings
    const leagueSettings = await db.collection('league_settings')
      .find({}, { projection: { league_id: 1, colors: 1 } })
      .toArray();
    
    // Create a map of league_id to colors
    const colorsMap = {};
    leagueSettings.forEach(setting => {
      if (setting.colors) {
        colorsMap[setting.league_id] = setting.colors;
      }
    });
    
    console.log("League Colors Getted for " + Object.keys(colorsMap).length + " leagues");
    res.send(colorsMap);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export { getLeagues, getTopLeagues, getLeagueColors };