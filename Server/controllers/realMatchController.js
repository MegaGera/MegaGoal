import { getDB } from '../config/db.js';

// Get real matches
const getRealMatches = async (req, res) => {
  const db = getDB();
  try {
    let {team_id, season} = req.query;

    const query = {
      $and:[
        {$or: [ 
          { "teams.home.id": +team_id } ,
          { "teams.away.id": +team_id }]},
        {"league.season": +season}]
    };
    const result = await db.collection('real_matches').find(query).toArray();

    console.log("Real Matches getted from team " + team_id + " and season " + season);
    res.send(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export { getRealMatches };