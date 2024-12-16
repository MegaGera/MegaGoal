import { getDB } from '../config/db.js';
import { ObjectId } from 'mongodb';

// Get matches
const getMatches = async (req, res) => {
  const db = getDB();
  try {
    let {team_id, season} = req.query;
    let username = req.validateData.username;

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
    if (username) filters.push({ 'user.username': username });

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
    let username = req.validateData.username;
    match.user = { username: username };

    let result = await db.collection('matches').insertOne(match);
    console.log("Match inserted for fixture " + match.fixture.id);
    res.status(201).json(result.insertedId);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// Delete a match
const deleteMatch = async (req, res) => {
  const db = getDB();
  try {
    let { _id } = req.params;
    let username = req.validateData.username;
    // The "_id" can be a string or an ObjectId
    const filter = {
      $or: [
      { "_id": new ObjectId(_id) },
      { "_id": _id }
      ]
    };
    let result = await db.collection('matches').findOne(filter) || undefined;
    if (!result) {
      return res.status(404).json({ message: "Match not found" });
    }
    if (result.user.username !== username) {
      return res.status(401).json({ message: "Not authorized" });
    }
    await db.collection('matches').deleteOne(filter);
    console.log("Match deleted with id " + id);
    res.status(200).json({ message: "Match deleted successfully" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// Post change location of a match
const changeLocation = async (req, res) => {
  const db = getDB();
  try {
    let {fixtureId, location} = req.body;
    let username = req.validateData.username;
    const filter = { "fixture.id": +fixtureId, "user.username": username };
    const update = { $set: { "location": location} };
    let result = await db.collection('matches').updateOne(filter, update);
    console.log("Location updated for fixture " + fixtureId + " to " + location);
    res.status(201).json(result.acknowledged);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export { getMatches, createMatch, deleteMatch, changeLocation };