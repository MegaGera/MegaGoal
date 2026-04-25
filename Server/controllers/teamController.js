import { getDB } from '../config/db.js';
import { TOP_LEAGUES_IDS } from '../config/topLeagues.js';
import {
  buildTeamsQuery,
  parseShortTeams,
  parseTeamDocument,
  parseTeamDocuments,
  parseTeamId,
  shortTeamAggregationPipeline,
  setPreviousImagePayloadSchema
} from '../entities/teamEntity.js';

// Get teams
const getTeams = async (req, res) => {
  const db = getDB();
  try {
    const query = buildTeamsQuery(req.query);
    const result = await db.collection('teams').find(query).toArray();
    const validatedResult = parseTeamDocuments(result);
    console.log("Teams Getted");
    res.send(validatedResult);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Get team by team_id
const getTeamByTeamId = async (req, res) => {
  const db = getDB();
  try {
    const { team_id } = req.params;
    const parsedTeamId = parseTeamId(team_id);
    const query = {
      "team.id": parsedTeamId
    };
    const result = await db.collection('teams').findOne(query);
    const validatedResult = result ? parseTeamDocument(result) : undefined;
    console.log("Team getted " + parsedTeamId);
    res.send(validatedResult);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Post add a previuos image for the team
const setPreviousImage = async (req, res) => {
  const db = getDB();
  try {
    const { team_id, image_title } = setPreviousImagePayloadSchema.parse(req.body);
    const filter = { "team.id": team_id };
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
    const { team_id, image_title } = setPreviousImagePayloadSchema.parse(req.body);
    const filter = { "team.id": team_id };
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
    
    const shortTeamsPipeline = shortTeamAggregationPipeline(query);
    const result = await db.collection('teams').aggregate(shortTeamsPipeline).toArray();
    const validatedResult = parseShortTeams(result);
    console.log(`Teams found for top leagues: ${validatedResult.length} teams`);
    res.send(validatedResult);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export { getTeams, getTeamByTeamId, setPreviousImage, deletePreviousImage, getTeamsByTopLeagues };