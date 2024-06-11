import { getDB } from '../config/db.js';

// Get teams
const getTeams = async (req, res) => {
  const db = getDB();
  try {
    let {league_id, season} = req.query;
    const query = {
      "seasons": 
        { "$elemMatch": { "league": league_id, "season": season } } 
    };
    const result = await db.collection('teams').find(query).toArray();
    console.log("Teams Getted");
    res.send(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Get team by team_id
const getTeamByTeamId = async (req, res) => {
  const db = getDB();
  try {
    let { team_id } = req.params;
    const query = {
      "team.id": +team_id
    };
    const result = await db.collection('teams').findOne(query) || undefined;;
    console.log("Team getted " + team_id);
    res.send(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export { getTeams, getTeamByTeamId };