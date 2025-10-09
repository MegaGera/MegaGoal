import { getDB } from '../config/db.js';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { logMatchCreated, logMatchDeleted, logMatchUpdateLocation } from './logController.js';

// Get matches
const getMatches = async (req, res) => {
  const db = getDB();
  try {
    let {team_id, season, location, fixture_id} = req.query;
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
    if (location) filters.push({ 'location': location });
    if (fixture_id) filters.push({ 'fixture.id': +fixture_id });
    
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

    // Check if location exists and is NOT a UUID (no dashes) - treat it as a venue ID
    if (match.location && match.location.split('-').length === 1) {
      const location = await checkLocationIsVenue(match.location, username, match.fixture.venue);
      if (location) {
        match.location = location;
      } else {
        match.location = null;
      }
    }

    let matchExists = await db.collection('matches').findOne({ "fixture.id": match.fixture.id, "user.username": username });
    if (matchExists) {
      return res.status(400).json({ message: "Match already exists" });
    }

    let result = await db.collection('matches').insertOne(match);
    console.log("Match inserted for fixture " + match.fixture.id);
    
    // Log the match creation to RabbitMQ
    await logMatchCreated(username, { ...match, _id: result.insertedId }, req);
    
    res.status(201).json(result.insertedId);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// Delete a match
const deleteMatch = async (req, res) => {
  const db = getDB();
  try {
    let { fixtureId } = req.params;
    let username = req.validateData.username;
    let filter = {};

    if (fixtureId && username) {
      filter = { "fixture.id": +fixtureId, "user.username": username };
    } else {
      return res.status(400).json({ message: "Invalid request" });
    }

    let result = await db.collection('matches').findOne(filter) || undefined;
    if (!result) {
      return res.status(404).json({ message: "Match not found" });
    }
    if (result.user.username !== username) {
      return res.status(401).json({ message: "Not authorized" });
    }

    await db.collection('matches').deleteOne(filter);
    console.log("Match deleted with id " + fixtureId + " and username " + username);
    
    // Log the match deletion to RabbitMQ
    await logMatchDeleted(username, result, req);
    
    res.status(200).json({ message: "Match deleted successfully" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// Post change location of a match
const changeLocation = async (req, res) => {
  const db = getDB();
  try {
    let {fixtureId, location, venue} = req.body;
    let username = req.validateData.username;

    if (!fixtureId || !location || !username) {
      return res.status(400).json({ message: "Invalid request" });
    }

    // Check if location is NOT a UUID (no dashes) - treat it as a venue ID
    if (location.split('-').length === 1) {
      const newLocation = await checkLocationIsVenue(location, username, venue);
      if (newLocation) {
        location = newLocation;
      }
    }

    const filter = { "fixture.id": +fixtureId, "user.username": username };
    const update = { $set: { "location": location} };
    let result = await db.collection('matches').updateOne(filter, update);
    console.log("Location updated for fixture " + fixtureId + " to " + location);

    await logMatchUpdateLocation(username, { fixtureId: fixtureId, location: location }, req);

    res.status(201).json(result.acknowledged);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

const checkLocationIsVenue = async (location_id, username, venueParams) => {

  const db = getDB();
  try {

    const alreadyLocation = await db.collection('locations').findOne({ "user.username": username, "venue_id": location_id });
    if (alreadyLocation) {
      return alreadyLocation.id;
    }
    const venue = await db.collection('venues').findOne({ "id": +location_id });

    const location = {
      id: uuidv4(),
      user: { username: username },
      official: true,
      stadium: true,
      private: true
    };

    location.id = uuidv4();
    if (venue) {
      location.name = venue.name;
      location.venue_id = venue.id;
    } else if (venueParams) {
      location.name = venueParams.name;
      location.venue_id = venueParams.id;
    } else {
      return false;
    }

    let result = await db.collection('locations').insertOne(location);
    if (result) {
      console.log("New location inserted: " + location.id);
      return location.id;
    }
    
    return false;
  } catch (error) {
    console.error("Error checking if location is venue:", error);
    return false;
  }
}

// Get landing page information with multiple matches (public endpoint)
const getLandingPageInfo = async (req, res) => {
  const db = getDB();
  try {
    // Define the fixture IDs we want to show on the landing page
    const fixtureIds = [1379015, 1451030, 1390851];
    
    const matches = [];
    
    for (const fixtureId of fixtureIds) {
      // First try to get from real_matches collection
      let match = await db.collection('real_matches').findOne({ "fixture.id": +fixtureId });
      
      if (!match) {
        // If not found in real_matches, try matches collection (user's tracked matches)
        match = await db.collection('matches').findOne({ "fixture.id": +fixtureId });
      }
      
      if (match) {
        matches.push(match);
      }
    }

    if (matches.length === 0) {
      return res.status(404).json({ message: "No matches found for landing page" });
    }

    console.log(`Landing page info retrieved: ${matches.length} matches`);
    res.send({ matches });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export { getMatches, createMatch, deleteMatch, changeLocation, getLandingPageInfo };