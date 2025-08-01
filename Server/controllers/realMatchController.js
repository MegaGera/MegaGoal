import { getDB } from '../config/db.js';

// Get real matches
const getRealMatches = async (req, res) => {
  const db = getDB();
  try {
    let { league_id, team_id, team_2_id, season, finished } = req.query;

    // Count non-finished parameters to ensure minimum 2
    const nonFinishedParams = [league_id, team_id, team_2_id, season].filter(param => param !== undefined && param !== null);
    
    if (nonFinishedParams.length < 2) {
      console.log("Real Matches - Invalid query: minimum 2 parameters required");
      return res.status(400).json({ message: "Minimum 2 parameters required (excluding finished)" });
    }

    const filters = [];

    // Add league filter
    if (league_id) {
      filters.push({ 'league.id': +league_id });
    }

    // Add season filter
    if (season) {
      filters.push({ 'league.season': +season });
    }

    // Add team filters
    if (team_id && team_2_id) {
      // Both teams provided - find matches where both teams play (any position)
      filters.push({
        $and: [
          {
            $or: [
              { "teams.home.id": +team_id },
              { "teams.away.id": +team_id }
            ]
          },
          {
            $or: [
              { "teams.home.id": +team_2_id },
              { "teams.away.id": +team_2_id }
            ]
          }
        ]
      });
    } else if (team_id) {
      // Only team_1 provided
      filters.push({
        $or: [
          { "teams.home.id": +team_id },
          { "teams.away.id": +team_id }
        ]
      });
    } else if (team_2_id) {
      // Only team_2 provided
      filters.push({
        $or: [
          { "teams.home.id": +team_2_id },
          { "teams.away.id": +team_2_id }
        ]
      });
    }

    // Add finished filter
    if (finished && finished === 'true') {
      filters.push({ 'fixture.status.short': { $in: ["FT", "AET", "PEN", "PST", "CANC"] } });
    }

    const query = filters.length > 0 ? { $and: filters } : {};
    
    // console.log("Real Matches query:", JSON.stringify(query, null, 2));
    
    const result = await db.collection('real_matches').find(query).toArray();

    console.log(`Real Matches found: ${result.length} matches`);
    res.send(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export { getRealMatches };