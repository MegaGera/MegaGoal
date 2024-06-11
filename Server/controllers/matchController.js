import { getDB } from '../config/db.js';

// Get matches
const getMatches = async (req, res) => {
  const db = getDB();
  try {
    let {team_id, season} = req.query;

    const filters = [];
    if (team_id) {
      filters.push({
          $or: [
              { 'teams.home.id': +team_id },
              { 'teams.away.id': +team_id }
          ]
      });
    }
    if (season) filters.push({ 'league.season': +season });

    const query = filters.length > 0 ? { $and: filters } : {};
    const result = await db.collection('matches').find(query).toArray();

    console.log("Matches Getted");
    res.send(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Post create a Match
const createMatch = async (req, res) => {
  const db = getDB();
  try {
    let match = req.body;
    let result = db.collection('matches').insertOne(match);
    console.log("Match inserted for fixture " + match.fixture.id);
    res.status(201).json(result.ops[0]);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}


// Post change location of a match
const changeLocation = async (req, res) => {
  const db = getDB();
  try {
    let {fixtureId, location} = req.body;
    const filter = { "fixture.id": +fixtureId };
    const update = { $set: { "location": location} };
    let result = db.collection('matches').updateOne(filter, update);
    console.log("Location updated for fixture " + match.fixture.id + " to " + location);
    res.status(201).json(result.ops[0]);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export { getMatches, createMatch, changeLocation };