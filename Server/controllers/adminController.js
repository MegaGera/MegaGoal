import { getDB } from '../config/db.js';
import { logAdminAction } from './logController.js';
import { createIndexes, ensureIndexes } from '../config/indexes.js';

// Get leagues settings
export const getLeaguesSettings = async (req, res) => {
  const db = getDB();
  try {
    const result = await db.collection('league_settings').find().toArray();
    console.log("Leagues Settings Getted");
    res.send(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Patch change daily_update of a leagues settings
export const changeIsActive = async (req, res) => {
  const db = getDB();
  try {
    let {league_id, is_active} = req.body;
    const filter = { "league_id": +league_id};
    const update = is_active ? { $set: { "is_active": is_active } } : { $set: { "is_active": is_active, "daily_update": false } };
    let result = await db.collection('league_settings').updateOne(filter, update);
    console.log("Update is_active for league " + league_id + " to " + is_active);

    await logAdminAction(req.validateData.username, 'CHANGE_IS_ACTIVE', { league_id: league_id, is_active: is_active }, req);
    
    res.status(201).json(result.acknowledged);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// Patch change update frequency of a leagues settings
export const changeUpdateFrequency = async (req, res) => {
  const db = getDB();
  try {
    let {league_id, update_frequency} = req.body;
    const filter = { "league_id": +league_id};
    const update = { $set: { "update_frequency": update_frequency } };
    let result = await db.collection('league_settings').updateOne(filter, update);
    console.log("Update frequency updated for league " + league_id + " to " + update_frequency);

    await logAdminAction(req.validateData.username, 'CHANGE_UPDATE_FREQUENCY', { league_id: league_id, update_frequency: update_frequency }, req);

    res.status(201).json(result.acknowledged);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// Patch change daily_update of a leagues settings
export const changeDailyUpdate = async (req, res) => {
  const db = getDB();
  try {
    let {league_id, daily_update} = req.body;
    const filter = { "league_id": +league_id, "is_active": true };
    const update = { $set: { "daily_update": daily_update } };
    let result = await db.collection('league_settings').updateOne(filter, update);
    console.log("Update daily_update for league " + league_id + " to " + daily_update);

    await logAdminAction(req.validateData.username, 'CHANGE_DAILY_UPDATE', { league_id: league_id, daily_update: daily_update }, req);

    res.status(201).json(result.acknowledged);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// Create a new league setting
export const createLeagueSetting = async (req, res) => {
  const db = getDB();
  try {
    let {league_id, league_name} = req.body;
    
    // Check if league setting already exists
    const existingSetting = await db.collection('league_settings').findOne({ "league_id": +league_id });
    if (existingSetting) {
      return res.status(400).json({ message: "League setting already exists" });
    }
    
    // Get the highest position from existing league settings
    let nextPosition = 0;
    const highestPositionLeague = await db.collection('league_settings')
      .find({})
      .sort({ "position": -1 })
      .limit(1)
      .toArray();
    
    if (highestPositionLeague.length > 0 && highestPositionLeague[0].position) {
      nextPosition = highestPositionLeague[0].position + 1;
    }
    
    const newLeagueSetting = {
      league_id: +league_id,
      league_name: league_name,
      update_frequency: 1,
      is_active: false,
      daily_update: false,
      season: 2025,
      position: nextPosition
    };
    
    let result = await db.collection('league_settings').insertOne(newLeagueSetting);
    console.log("Created new league setting for league " + league_id + " - " + league_name + " with position " + nextPosition);
    
    await logAdminAction(req.validateData.username, 'CREATE_LEAGUE_SETTING', newLeagueSetting, req);

    res.status(201).json(result.acknowledged);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// Get real matches without statistics that have been marked by users
export const getRealMatchesWithoutStatistics = async (req, res) => {
  const db = getDB();
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 50; // Max 50 matches per request
    const skip = (page - 1) * limit;

    // Step 1: Get distinct fixture IDs from user matches
    const userMatchFixtureIds = await db.collection('matches')
      .distinct('fixture.id');

    if (userMatchFixtureIds.length === 0) {
      return res.send({ matches: [], total: 0, page, totalPages: 0 });
    }

    // Step 2: Use aggregation to get real matches with usernames
    const pipeline = [
      // Match real matches without statistics, lineups or events
      {
        $match: {
          'fixture.id': { $in: userMatchFixtureIds },
          $or: [
            { 'statistics': { $exists: false } },
            { 'statistics': null },
            { 'statistics': { $size: 0 } }
          ],
          $or: [
            { 'lineups': { $exists: false } },
            { 'lineups': null },
            { 'lineups': { $size: 0 } }
          ],
          $or: [
            { 'events': { $exists: false } },
            { 'events': null },
            { 'events': { $size: 0 } }
          ]
        }
      },
      // Lookup usernames from matches collection
      {
        $lookup: {
          from: 'matches',
          let: { fixtureId: '$fixture.id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$fixture.id', '$$fixtureId'] }
              }
            },
            {
              $project: {
                username: '$user.username'
              }
            }
          ],
          as: 'userMatches'
        }
      },
      // Add usernames array to each match
      {
        $addFields: {
          usernames: {
            $map: {
              input: '$userMatches',
              as: 'userMatch',
              in: '$$userMatch.username'
            }
          }
        }
      },
      // Remove the temporary userMatches field
      {
        $project: {
          userMatches: 0
        }
      },
      // Sort by fixture date (most recent first)
      {
        $sort: { 'fixture.timestamp': -1 }
      }
    ];

    // Get total count for pagination (without usernames for performance)
    const countPipeline = [
      {
        $match: {
          'fixture.id': { $in: userMatchFixtureIds },
          $or: [
            { 'statistics': { $exists: false } },
            { 'statistics': null },
            { 'statistics': { $size: 0 } }
          ],
          $or: [
            { 'lineups': { $exists: false } },
            { 'lineups': null },
            { 'lineups': { $size: 0 } }
          ],
          $or: [
            { 'events': { $exists: false } },
            { 'events': null },
            { 'events': { $size: 0 } }
          ]
        }
      },
      {
        $count: 'total'
      }
    ];

    const [countResult] = await db.collection('real_matches').aggregate(countPipeline).toArray();
    const total = countResult ? countResult.total : 0;
    const totalPages = Math.ceil(total / limit);

    // Get matches with pagination
    const matches = await db.collection('real_matches')
      .aggregate([
        ...pipeline,
        { $skip: skip },
        { $limit: limit }
      ])
      .toArray();

    console.log(`Real Matches without statistics, lineups or events found: ${matches.length} of ${total} total (page ${page}/${totalPages})`);
    
    res.send({
      matches,
      total,
      page,
      totalPages
    });
  } catch (error) {
    console.error("Error getting real matches without statistics, lineups or events:", error);
    res.status(500).json({ message: error.message });
  }
}

// Add a match to landing page matches
export const addLandingMatch = async (req, res) => {
  const db = getDB();
  try {
    const { fixture_id } = req.body;
    
    if (!fixture_id) {
      return res.status(400).json({ message: "fixture_id is required" });
    }

    // Check if match already exists in settings
    const existing = await db.collection('settings').findOne({ 
      type: 'LANDING_MATCH', 
      fixture_id: +fixture_id 
    });
    
    if (existing) {
      return res.status(400).json({ message: "Match already marked for landing page" });
    }

    // Add new landing match
    const newSetting = {
      type: 'LANDING_MATCH',
      fixture_id: +fixture_id,
      created_at: new Date()
    };
    
    const result = await db.collection('settings').insertOne(newSetting);
    console.log(`Added landing match: fixture_id=${fixture_id}`);
    
    await logAdminAction(req.validateData.username, 'ADD_LANDING_MATCH', { fixture_id: fixture_id }, req);

    res.status(201).json({ success: true, acknowledged: result.acknowledged });
  } catch (error) {
    console.error("Error adding landing match:", error);
    res.status(500).json({ message: error.message });
  }
}

// Remove a match from landing page matches
export const removeLandingMatch = async (req, res) => {
  const db = getDB();
  try {
    const { fixture_id } = req.body;
    
    if (!fixture_id) {
      return res.status(400).json({ message: "fixture_id is required" });
    }

    const result = await db.collection('settings').deleteOne({ 
      type: 'LANDING_MATCH', 
      fixture_id: +fixture_id 
    });
    
    console.log(`Removed landing match: fixture_id=${fixture_id}`);
    
    await logAdminAction(req.validateData.username, 'REMOVE_LANDING_MATCH', { fixture_id: fixture_id }, req);

    res.status(200).json({ success: true, acknowledged: result.acknowledged, deletedCount: result.deletedCount });
  } catch (error) {
    console.error("Error removing landing match:", error);
    res.status(500).json({ message: error.message });
  }
}

// Get all landing page matches (for admin view - shows all marked matches)
export const getLandingMatches = async (req, res) => {
  const db = getDB();
  try {
    // Get all fixture IDs from settings collection (no limit for admin view)
    const landingSettings = await db.collection('settings')
      .find({ type: 'LANDING_MATCH' })
      .sort({ created_at: -1 })
      .toArray();

    if (landingSettings.length === 0) {
      return res.send([]);
    }

    const fixtureIds = landingSettings.map(s => s.fixture_id);

    // Get the actual matches from real_matches collection
    const matches = await db.collection('real_matches')
      .find({ 'fixture.id': { $in: fixtureIds } })
      .toArray();

    // Sort matches in the same order as landingSettings
    const sortedMatches = fixtureIds
      .map(id => matches.find(m => m.fixture.id === id))
      .filter(m => m !== undefined);

    console.log(`Landing page matches retrieved for admin: ${sortedMatches.length}`);
    
    res.send(sortedMatches);
  } catch (error) {
    console.error("Error getting landing matches:", error);
    res.status(500).json({ message: error.message });
  }
}

// Create/ensure database indexes (for performance optimization)
export const createDatabaseIndexes = async (req, res) => {
  try {
    const { force } = req.query;
    
    if (force === 'true') {
      // Force create indexes (may fail if they already exist with different options)
      await createIndexes();
      await logAdminAction(req.validateData.username, 'CREATE_DATABASE_INDEXES', { force: true }, req);
      res.status(200).json({ 
        success: true, 
        message: 'Database indexes created/updated (force mode)' 
      });
    } else {
      // Ensure indexes exist (safe, won't fail if they already exist)
      await ensureIndexes();
      await logAdminAction(req.validateData.username, 'ENSURE_DATABASE_INDEXES', { force: false }, req);
      res.status(200).json({ 
        success: true, 
        message: 'Database indexes ensured (only missing indexes were created)' 
      });
    }
  } catch (error) {
    console.error("Error creating/ensuring database indexes:", error);
    res.status(500).json({ message: error.message });
  }
}
