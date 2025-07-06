import { getDB } from '../config/db.js';
import { getTopLeaguesInQuery, getTopLeaguesString, TOP_LEAGUES_IDS } from '../config/topLeagues.js';

// Get teams
const getTeams = async (req, res) => {
  const db = getDB();
  try {
    let {league_id, season, country} = req.query;

    const filters = [];
    if (league_id && season) {
      filters.push({
        "seasons": 
          { "$elemMatch": { "league": league_id, "season": season } } 
      });
    } else if (league_id && !season) {
      filters.push({ "seasons.league": league_id });
    }
    if (country) filters.push({ 'team.country': country });

    const query = filters.length > 0 ? { $and: filters } : {};
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

// Post add a previuos image for the team
const setPreviousImage = async (req, res) => {
  const db = getDB();
  try {
    let { team_id, image_title } = req.body;
    const filter = { "team.id": +team_id };
    const update = { $push: { "previous": image_title } };
    let result = await db.collection('teams').updateOne(filter, update);
    console.log("Previous image updated for team " + team_id + " with " + image_title);
    res.status(200).json(result.acknowledged);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// Delete a previous image for the team
const deletePreviousImage = async (req, res) => {
  const db = getDB();
  try {
    let { team_id, image_title } = req.body;
    const filter = { "team.id": +team_id };
    const update = { $pull: { "previous": image_title } };
    let result = await db.collection('teams').updateOne(filter, update);
    console.log("Previous image deleted for team " + team_id + " with " + image_title);
    res.status(200).json(result.acknowledged);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// Get teams by top leagues
const getTeamsByTopLeagues = async (req, res) => {
  const db = getDB();
  try {
    // Convert top league IDs to strings since they're stored as strings in the database
    const topLeaguesAsStrings = TOP_LEAGUES_IDS.map(id => id.toString());
    
    // Create query to find teams that have at least one of the top league IDs in their seasons array
    const query = {
      "seasons": {
        "$elemMatch": {
          "league": { "$in": topLeaguesAsStrings }
        }
      }
    };
    
    const result = await db.collection('teams').find(query, {
      projection: {
        "name": "$team.name",
        "id": "$team.id",
        "_id": 0
      }
    }).toArray();
    console.log(`Teams found for top leagues: ${result.length} teams`);
    res.send(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export { getTeams, getTeamByTeamId, setPreviousImage, deletePreviousImage, getTeamsByTopLeagues };