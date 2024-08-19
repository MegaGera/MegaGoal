import { getDB } from '../config/db.js';

// Get real matches
const getRealMatches = async (req, res) => {
  const db = getDB();
  try {
    let { league_id, team_id, season } = req.query;

    let query;
    if (team_id && season) {
      // Select matches from a team in a season
      query = {
        $and: [
          {
            $or: [
              { "teams.home.id": +team_id },
              { "teams.away.id": +team_id }]
          },
          { "league.season": +season }]
      };
    } else if (league_id && season) {
      // Select matches from a league in a season
      const filters = [];
      if (league_id) filters.push({ 'league.id': +league_id });
      if (season) filters.push({ 'league.season': +season });
      query = filters.length > 0 ? { $and: filters } : {};
    } else {
      // Invalid query
      console.log("Real Matches - Invalid query");
      res.send(400).json({ message: "Invalid query" });
      return;
    }

    const result = await db.collection('real_matches').find(query).toArray();

    console.log("Real Matches getted from team " + team_id + " and season " + season);
    res.send(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export { getRealMatches };