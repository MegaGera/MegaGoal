import { getDB } from '../config/db.js';
import {
  logMatchCreated,
  logMatchDeleted,
  logMatchInteraction,
  logMatchUpdateLocation
} from './logController.js';
import { getWatchedMatchesForUser } from '../mcp/services/watchedMatchesQuery.js';
import {
  buildMatchDocument,
  mergeUserPicks,
  parseCreateMatchBody,
  parseFixtureId,
  parseMatch,
  parseMatches,
  parseSetLocationPayload,
  parseSetReactionsPayload,
  parseSetUserPicksPayload,
  parseTeamId,
  normalizeReactions,
  parseMatchReactions,
  parseMatchEngagementAggregate
} from '../entities/matchEntity.js';
import { findPlayerTeam } from '../mcp/services/playerWatchedPlayedQuery.js';
import {
  buildOfficialVenueLocation,
  parseVenueLocationId
} from '../entities/locationEntity.js';
import { parseVenueReference } from '../entities/venueEntity.js';
import { parseLandingMatchSettings } from '../entities/settingsEntity.js';
import {
  getWatchedCountsByFixtureIds,
  mergeWatchedCountIntoDocuments,
} from '../services/watchedMatchCounts.js';
import { getMatchEngagementByFixtureId } from '../services/matchEngagementAggregate.js';

// Get matches
const getMatches = async (req, res) => {
  try {
    let { team_id, season, league_id, location, fixture_id, include_watched_counts } = req.query;
    let username = req.validateData.username;

    let result = await getWatchedMatchesForUser({
      username,
      team_id,
      season,
      league_id,
      location,
      fixture_id,
    });
    if (include_watched_counts === 'true' || include_watched_counts === '1') {
      const ids = result.map((r) => r.fixture?.id).filter((id) => id != null);
      const counts = await getWatchedCountsByFixtureIds(ids);
      result = mergeWatchedCountIntoDocuments(result, counts);
    }
    const validatedResult = parseMatches(result);

    console.log("Matches Getted");
    res.send(validatedResult);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Get matches by team id
const getMatchesByTeamId = async (req, res) => {
  try {
    const parsedTeamId = parseTeamId(req.params.teamId);
    const { season, league_id, location, fixture_id, include_watched_counts } = req.query;
    const username = req.validateData.username;

    if (!parsedTeamId) {
      return res.status(400).json({ message: "Team ID is required" });
    }

    let result = await getWatchedMatchesForUser({
      username,
      team_id: parsedTeamId,
      season,
      league_id,
      location,
      fixture_id,
    });
    if (include_watched_counts === 'true' || include_watched_counts === '1') {
      const ids = result.map((r) => r.fixture?.id).filter((id) => id != null);
      const counts = await getWatchedCountsByFixtureIds(ids);
      result = mergeWatchedCountIntoDocuments(result, counts);
    }
    const validatedResult = parseMatches(result);

    console.log(`Matches retrieved for team ${parsedTeamId}`);
    res.send(validatedResult);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Post create a Match
const createMatch = async (req, res) => {
  const db = getDB();
  try {
    const username = req.validateData.username;
    const createMatchBody = parseCreateMatchBody(req.body);
    let match = buildMatchDocument({ body: createMatchBody, username });

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
    const fixtureId = parseFixtureId(req.params.fixtureId);
    let username = req.validateData.username;
    let filter = {};

    if (fixtureId && username) {
      filter = { "fixture.id": fixtureId, "user.username": username };
    } else {
      return res.status(400).json({ message: "Invalid request" });
    }

    let result = await db.collection('matches').findOne(filter) || undefined;
    if (!result) {
      return res.status(404).json({ message: "Match not found" });
    }
    const validatedResult = parseMatch(result);
    if (validatedResult.user.username !== username) {
      return res.status(401).json({ message: "Not authorized" });
    }

    await db.collection('matches').deleteOne(filter);
    console.log("Match deleted with id " + fixtureId + " and username " + username);
    
    // Log the match deletion to RabbitMQ
    await logMatchDeleted(username, validatedResult, req);
    
    res.status(200).json({ message: "Match deleted successfully" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// Post change location of a match
const changeLocation = async (req, res) => {
  const db = getDB();
  try {
    let { fixtureId, location, venue } = parseSetLocationPayload(req.body);
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

    const filter = { "fixture.id": fixtureId, "user.username": username };
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

    const parsedLocationId = parseVenueLocationId(location_id);
    const alreadyLocation = await db.collection('locations').findOne({ "user.username": username, "venue_id": parsedLocationId });
    if (alreadyLocation) {
      return alreadyLocation.id;
    }
    const venue = await db.collection('venues').findOne({ "id": parsedLocationId });

    let location;
    if (venue) {
      const parsedVenue = parseVenueReference(venue);
      location = buildOfficialVenueLocation({
        name: parsedVenue.name,
        username,
        venueId: parsedVenue.id
      });
    } else if (venueParams) {
      const parsedVenueParams = parseVenueReference({
        id: venueParams.id,
        name: venueParams.name
      });
      location = buildOfficialVenueLocation({
        name: parsedVenueParams.name,
        username,
        venueId: parsedVenueParams.id
      });
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
// Randomly selects up to 3 matches from all marked landing matches
const getLandingPageInfo = async (req, res) => {
  const db = getDB();
  try {
    // Get random 3 fixture IDs from settings collection using MongoDB's $sample
    const landingSettingsRaw = await db.collection('settings')
      .aggregate([
        { $match: { type: 'LANDING_MATCH' } },
        { $sample: { size: 3 } }
      ])
      .toArray();
    const landingSettings = parseLandingMatchSettings(landingSettingsRaw);

    if (landingSettings.length === 0) {
      // Return empty matches array if none configured
      console.log('No landing matches configured');
      return res.send({ matches: [] });
    }

    const fixtureIds = landingSettings.map(s => s.fixture_id);
    
    // Get only the selected matches from real_matches collection
    const matches = await db.collection('real_matches')
      .find({ 'fixture.id': { $in: fixtureIds } })
      .toArray();

    console.log(`Landing page info retrieved: ${matches.length} matches (randomly selected)`);
    res.send({ matches });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Get users and their match counts (admin endpoint - returns data for all users)
// Does not validate username from req.validateData to return all users' data
const getUsersMatchCounts = async (req, res) => {
  const db = getDB();
  try {
    // Aggregate matches by username and count them
    const result = await db.collection('matches')
      .aggregate([
        {
          $group: {
            _id: '$user.username',
            matchCount: { $sum: 1 }
          }
        },
        {
          $project: {
            _id: 0,
            username: '$_id',
            matchCount: 1
          }
        },
        {
          $sort: { matchCount: -1 }
        }
      ])
      .toArray();

    console.log(`Users match counts retrieved: ${result.length} users`);
    res.send(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

const teamLabelFromRealMatch = (realMatch, teamId) => {
  const homeId = realMatch?.teams?.home?.id;
  const awayId = realMatch?.teams?.away?.id;
  if (teamId === homeId) return realMatch.teams.home.name;
  if (teamId === awayId) return realMatch.teams.away.name;
  for (const lineup of realMatch?.lineups || []) {
    if (lineup?.team?.id === teamId) return lineup.team.name;
  }
  return undefined;
};

const validatePlayerPick = (realMatch, pick) => {
  if (pick == null) {
    return { ok: true, pick: null };
  }
  const playerId = Number(pick.id);
  const { teamId, participated } = findPlayerTeam(realMatch, playerId);
  if (!participated || teamId == null) {
    return { ok: false, message: `Player ${pick.name} did not participate in this match` };
  }
  if (Number(pick.team_id) !== Number(teamId)) {
    return { ok: false, message: `Player ${pick.name} team_id does not match lineup data` };
  }
  return {
    ok: true,
    pick: {
      id: playerId,
      name: String(pick.name),
      team_id: Number(teamId),
      team_name: pick.team_name ?? teamLabelFromRealMatch(realMatch, teamId)
    }
  };
};

const USER_PICK_PLAYER_KEYS = [
  'mvp',
  'bluff',
  'underrated',
  'most_entertaining'
];

const buildMatchInteractionContext = (fixtureId, matchDoc) => ({
  fixtureId,
  fixture: matchDoc?.fixture,
  league: matchDoc?.league,
  teams: matchDoc?.teams
});

const logReactionChanges = async (username, fixtureId, matchDoc, previousReactions, nextReactions, req) => {
  const previous = new Set(normalizeReactions(previousReactions ?? []));
  const next = new Set(normalizeReactions(nextReactions ?? []));
  const context = buildMatchInteractionContext(fixtureId, matchDoc);

  for (const reaction of next) {
    if (!previous.has(reaction)) {
      await logMatchInteraction(username, {
        ...context,
        type: 'reaction',
        change: 'added',
        reaction
      }, req);
    }
  }

  for (const reaction of previous) {
    if (!next.has(reaction)) {
      await logMatchInteraction(username, {
        ...context,
        type: 'reaction',
        change: 'removed',
        reaction
      }, req);
    }
  }
};

const logUserPicksChanges = async (username, fixtureId, matchDoc, incomingPicks, mergedPicks, req) => {
  const context = buildMatchInteractionContext(fixtureId, matchDoc);

  if (incomingPicks.rating !== undefined) {
    const rating = mergedPicks?.rating ?? null;
    await logMatchInteraction(username, {
      ...context,
      type: 'match_rating',
      change: rating == null ? 'cleared' : 'set',
      rating
    }, req);
  }

  for (const category of USER_PICK_PLAYER_KEYS) {
    if (incomingPicks[category] === undefined) {
      continue;
    }
    const player = mergedPicks?.[category] ?? null;
    await logMatchInteraction(username, {
      ...context,
      type: 'player_voted',
      change: player == null ? 'cleared' : 'set',
      category,
      player
    }, req);
  }
};

// Post user picks (rating, mvp, bluff, underrated, most_entertaining) for a watched match
const setUserPicks = async (req, res) => {
  const db = getDB();
  try {
    const { fixtureId, user_picks: incomingPicks } = parseSetUserPicksPayload(req.body);
    const username = req.validateData.username;

    if (!fixtureId || !username) {
      return res.status(400).json({ message: 'Invalid request' });
    }

    const filter = { 'fixture.id': fixtureId, 'user.username': username };
    const existing = await db.collection('matches').findOne(filter);
    if (!existing) {
      return res.status(404).json({ message: 'Match not found' });
    }

    const realMatch = await db.collection('real_matches').findOne({ 'fixture.id': fixtureId });
    if (!realMatch) {
      return res.status(404).json({ message: 'Fixture not found in catalog' });
    }

    const normalizedIncoming = { ...incomingPicks };
    for (const key of USER_PICK_PLAYER_KEYS) {
      if (incomingPicks[key] === undefined) {
        continue;
      }
      const pickResult = validatePlayerPick(realMatch, incomingPicks[key]);
      if (!pickResult.ok) {
        return res.status(400).json({ message: pickResult.message });
      }
      normalizedIncoming[key] = pickResult.pick;
    }

    const merged = mergeUserPicks(existing.user_picks, normalizedIncoming);
    const update =
      merged == null
        ? { $unset: { user_picks: '' } }
        : { $set: { user_picks: merged } };

    const result = await db.collection('matches').updateOne(filter, update);
    console.log(`User picks updated for fixture ${fixtureId} by ${username}`);

    await logUserPicksChanges(username, fixtureId, existing, incomingPicks, merged, req);

    res.status(201).json({ acknowledged: result.acknowledged, user_picks: merged });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Post match reactions (multi-select emojis) for a watched match
const setReactions = async (req, res) => {
  const db = getDB();
  try {
    const { fixtureId, reactions } = parseSetReactionsPayload(req.body);
    const username = req.validateData.username;

    if (!fixtureId || !username) {
      return res.status(400).json({ message: 'Invalid request' });
    }

    const filter = { 'fixture.id': fixtureId, 'user.username': username };
    const existing = await db.collection('matches').findOne(filter);
    if (!existing) {
      return res.status(404).json({ message: 'Match not found' });
    }

    const normalized = normalizeReactions(reactions);
    const validated =
      normalized.length > 0 ? parseMatchReactions(normalized) : [];

    const update =
      validated.length === 0
        ? { $unset: { reactions: '' } }
        : { $set: { reactions: validated } };

    const result = await db.collection('matches').updateOne(filter, update);
    console.log(`Reactions updated for fixture ${fixtureId} by ${username}`);

    await logReactionChanges(
      username,
      fixtureId,
      existing,
      existing.reactions,
      validated.length > 0 ? validated : [],
      req
    );

    res.status(201).json({
      acknowledged: result.acknowledged,
      reactions: validated.length > 0 ? validated : null
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Get aggregated reactions, rating, and player votes for a fixture (all users)
const getMatchEngagement = async (req, res) => {
  try {
    const fixtureId = parseFixtureId(req.params.fixtureId);
    const aggregate = await getMatchEngagementByFixtureId(fixtureId);
    const validated = parseMatchEngagementAggregate(aggregate);
    console.log(`Match engagement aggregate retrieved for fixture ${fixtureId}`);
    res.send(validated);
  } catch (error) {
    if (error?.issues) {
      return res.status(500).json({ message: error.message });
    }
    res.status(400).json({ message: error.message });
  }
};

export {
  getMatches,
  getMatchesByTeamId,
  createMatch,
  deleteMatch,
  changeLocation,
  setUserPicks,
  setReactions,
  getMatchEngagement,
  getLandingPageInfo,
  getUsersMatchCounts
};