import { z } from 'zod';
import { getDB } from '../config/db.js';
import { logAdminAction } from './logController.js';
import { createIndexes, ensureIndexes } from '../config/indexes.js';
import {
  buildNewLeagueSetting,
  parseChangeDailyUpdatePayload,
  parseChangeIsActivePayload,
  parseChangeLeagueColorsPayload,
  parseChangeUpdateFrequencyPayload,
  parseCreateLeagueSettingPayload,
  parseDeleteLeagueSettingPayload,
  parseLeagueSettings
} from '../entities/leagueEntity.js';
import {
  buildLandingMatchSetting,
  parseLandingMatchPayload,
  parseLandingMatchSettings
} from '../entities/settingsEntity.js';
import { parseAdminLineupUpdate, parseFixtureId } from '../entities/realMatchEntity.js';

const enrichSettingsWithStandingsRegistry = (settingsRows, standingsDocs) => {
  const seasonsByLeague = new Map();
  for (const doc of standingsDocs) {
    const id = doc.league_id;
    if (id == null) continue;
    let set = seasonsByLeague.get(id);
    if (!set) {
      set = new Set();
      seasonsByLeague.set(id, set);
    }
    for (const entry of doc.seasons || []) {
      if (entry?.season != null) set.add(entry.season);
    }
  }

  return settingsRows.map((setting) => {
    const seasonSet = seasonsByLeague.get(setting.league_id) ?? new Set();
    const availableSeasons = setting.available_seasons || [];
    const available_seasons = availableSeasons.map((row) => ({
      ...row,
      has_standings_registry: seasonSet.has(row.season)
    }));
    return { ...setting, available_seasons };
  });
};

// Get leagues settings
export const getLeaguesSettings = async (req, res) => {
  const db = getDB();
  try {
    const result = await db.collection('league_settings').find().toArray();
    const leagueIds = [...new Set(result.map((r) => r.league_id).filter((id) => id != null))];
    const standingsDocs =
      leagueIds.length === 0
        ? []
        : await db
            .collection('league_standings')
            .find({ league_id: { $in: leagueIds } })
            .project({ league_id: 1, seasons: 1 })
            .toArray();
    const enriched = enrichSettingsWithStandingsRegistry(result, standingsDocs);
    const validatedResult = parseLeagueSettings(enriched);
    console.log('Leagues Settings Getted');
    res.send(validatedResult);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Patch change daily_update of a leagues settings
export const changeIsActive = async (req, res) => {
  const db = getDB();
  try {
    const { league_id, is_active } = parseChangeIsActivePayload(req.body);
    const filter = { "league_id": league_id };
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
    const { league_id, update_frequency } = parseChangeUpdateFrequencyPayload(req.body);
    // Ensure update_frequency is always stored as a number
    const updateFrequencyNumber = Number(update_frequency);
    const filter = { "league_id": league_id };
    const update = { $set: { "update_frequency": updateFrequencyNumber } };
    let result = await db.collection('league_settings').updateOne(filter, update);
    console.log("Update frequency updated for league " + league_id + " to " + updateFrequencyNumber);

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
    const { league_id, daily_update } = parseChangeDailyUpdatePayload(req.body);
    const filter = { "league_id": league_id, "is_active": true };
    const update = { $set: { "daily_update": daily_update } };
    let result = await db.collection('league_settings').updateOne(filter, update);
    console.log("Update daily_update for league " + league_id + " to " + daily_update);

    await logAdminAction(req.validateData.username, 'CHANGE_DAILY_UPDATE', { league_id: league_id, daily_update: daily_update }, req);

    res.status(201).json(result.acknowledged);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// Patch change colors of a league settings
export const changeLeagueColors = async (req, res) => {
  const db = getDB();
  try {
    const { league_id, colors } = parseChangeLeagueColorsPayload(req.body);
    const filter = { "league_id": league_id };
    const update = { $set: { "colors": colors } };
    let result = await db.collection('league_settings').updateOne(filter, update);
    console.log("Update colors for league " + league_id + " - colors: ", colors);

    await logAdminAction(req.validateData.username, 'CHANGE_LEAGUE_COLORS', { league_id: league_id, colors: colors }, req);

    res.status(201).json(result.acknowledged);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// Create a new league setting
export const createLeagueSetting = async (req, res) => {
  const db = getDB();
  try {
    const { league_id, league_name } = parseCreateLeagueSettingPayload(req.body);
    
    // Check if league setting already exists
    const existingSetting = await db.collection('league_settings').findOne({ "league_id": league_id });
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
    
    const newLeagueSetting = buildNewLeagueSetting({
      league_id,
      league_name,
      position: nextPosition
    });
    
    let result = await db.collection('league_settings').insertOne(newLeagueSetting);
    console.log("Created new league setting for league " + league_id + " - " + league_name + " with position " + nextPosition);
    
    await logAdminAction(req.validateData.username, 'CREATE_LEAGUE_SETTING', newLeagueSetting, req);

    res.status(201).json(result.acknowledged);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// Delete a league setting (removes automation config; does not delete catalog league data)
export const deleteLeagueSetting = async (req, res) => {
  const db = getDB();
  try {
    const { league_id } = parseDeleteLeagueSettingPayload(req.body);
    const result = await db.collection('league_settings').deleteOne({ league_id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'League setting not found' });
    }
    console.log('Deleted league setting for league ' + league_id);
    await logAdminAction(req.validateData.username, 'DELETE_LEAGUE_SETTING', { league_id }, req);
    res.status(200).json({ success: true, acknowledged: true, deletedCount: result.deletedCount });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

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
    const { fixture_id } = parseLandingMatchPayload(req.body);

    // Check if match already exists in settings
    const existing = await db.collection('settings').findOne({ 
      type: 'LANDING_MATCH', 
      fixture_id: +fixture_id 
    });
    
    if (existing) {
      return res.status(400).json({ message: "Match already marked for landing page" });
    }

    // Add new landing match
    const newSetting = buildLandingMatchSetting({ fixture_id });
    
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
    const { fixture_id } = parseLandingMatchPayload(req.body);

    const result = await db.collection('settings').deleteOne({ 
      type: 'LANDING_MATCH', 
      fixture_id
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
    const landingSettingsRaw = await db.collection('settings')
      .find({ type: 'LANDING_MATCH' })
      .sort({ created_at: -1 })
      .toArray();
    const landingSettings = parseLandingMatchSettings(landingSettingsRaw);

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

const gridPattern = /^\d+:\d+$/;

function formationFromStartXI(startXI) {
  const counts = new Map();
  for (const row of startXI || []) {
    const grid = row?.player?.grid;
    if (typeof grid !== 'string' || !gridPattern.test(grid)) continue;
    const rowNumber = Number(grid.split(':')[0]);
    counts.set(rowNumber, (counts.get(rowNumber) || 0) + 1);
  }
  const rows = [...counts.keys()].sort((a, b) => a - b);
  if (rows.length === 0) return null;
  const outfield = rows[0] === 1 && counts.get(1) === 1 ? rows.slice(1) : rows;
  if (outfield.length === 0) return null;
  return outfield.map((row) => String(counts.get(row))).join('-');
}

const lineupBuckets = [
  ['startXI', 'starting XI'],
  ['substitutes', 'bench']
];

function lineupText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function lineupNumber(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function describeLineupPlayer(player) {
  const number = player.number != null ? `#${player.number} ` : '';
  const position = player.pos ? ` ${player.pos}` : '';
  return `${number}${player.name || 'Unknown'}${position}`.replace(/\s+/g, ' ').trim();
}

function indexLineupPlayers(lineup) {
  const players = new Map();
  for (const [bucket] of lineupBuckets) {
    for (const row of lineup?.[bucket] || []) {
      const player = row?.player;
      if (!player || !Number.isInteger(player.id)) continue;
      players.set(player.id, {
        bucket,
        name: lineupText(player.name),
        number: lineupNumber(player.number),
        pos: lineupText(player.pos),
        grid: lineupText(player.grid)
      });
    }
  }
  return players;
}

function diffLineupSide(label, before, after) {
  const changes = [];
  const beforeFormation = lineupText(before?.formation);
  const afterFormation = lineupText(after?.formation);
  if (beforeFormation !== afterFormation) {
    changes.push(`${label}: formation ${beforeFormation || 'none'} → ${afterFormation || 'none'}`);
  }

  const beforeCoach = lineupText(before?.coach?.name);
  const afterCoach = lineupText(after?.coach?.name);
  const beforeCoachId = before?.coach?.id ?? null;
  const afterCoachId = after?.coach?.id ?? null;
  if (beforeCoach !== afterCoach) {
    changes.push(`${label}: coach ${beforeCoach || 'none'} → ${afterCoach || 'none'}`);
  } else if (beforeCoachId !== afterCoachId) {
    changes.push(`${label}: coach ${beforeCoach || 'none'} id ${beforeCoachId ?? 'none'} → ${afterCoachId ?? 'none'}`);
  }

  const previousPlayers = indexLineupPlayers(before);
  const nextPlayers = indexLineupPlayers(after);
  const bucketName = Object.fromEntries(lineupBuckets);

  for (const [, player] of nextPlayers) {
    const previous = previousPlayers.get(id);
    if (!previous) {
      changes.push(`${label}: added ${describeLineupPlayer(player)} to ${bucketName[player.bucket]}`);
      continue;
    }
    if (previous.bucket !== player.bucket) {
      changes.push(`${label}: moved ${describeLineupPlayer(player)} from ${bucketName[previous.bucket]} to ${bucketName[player.bucket]}`);
    }
    const fieldChanges = [];
    if (previous.number !== player.number) {
      fieldChanges.push(`number ${previous.number ?? 'none'} → ${player.number ?? 'none'}`);
    }
    if (previous.pos !== player.pos) {
      fieldChanges.push(`position ${previous.pos || 'none'} → ${player.pos || 'none'}`);
    }
    if (previous.grid !== player.grid) {
      fieldChanges.push(`grid ${previous.grid || 'none'} → ${player.grid || 'none'}`);
    }
    if (previous.name !== player.name) {
      fieldChanges.push(`name ${previous.name || 'none'} → ${player.name || 'none'}`);
    }
    if (fieldChanges.length) {
      changes.push(`${label}: ${describeLineupPlayer(previous)} ${fieldChanges.join(', ')}`);
    }
  }

  for (const [, player] of previousPlayers) {
    if (!nextPlayers.has(id)) {
      changes.push(`${label}: removed ${describeLineupPlayer(player)} from ${bucketName[player.bucket]}`);
    }
  }
  return changes;
}

function assertLineupPlayers(lineup, seen) {
  for (const bucket of [lineup.startXI || [], lineup.substitutes || []]) {
    for (const row of bucket) {
      const player = row?.player;
      if (!player || !Number.isInteger(player.id) || player.id <= 0) {
        throw new Error('Each player needs an id');
      }
      if (!player.name || !String(player.name).trim()) {
        throw new Error('Each player needs a name');
      }
      if (!Number.isInteger(player.number) || player.number < 0 || player.number > 99) {
        throw new Error(`Shirt number for ${player.name} must be 0–99`);
      }
      if (!player.pos || !String(player.pos).trim()) {
        throw new Error(`Position for ${player.name} is required`);
      }
      if (player.grid != null && !gridPattern.test(player.grid)) {
        throw new Error(`Grid for ${player.name} must look like 2:3`);
      }
      if (seen.has(player.id)) {
        throw new Error(`Player ${player.name} is listed more than once`);
      }
      seen.add(player.id);
    }
  }
  if ((lineup.startXI || []).length > 11) {
    throw new Error('Starting XI cannot have more than 11 players');
  }
}

export const updateMatchLineups = async (req, res) => {
  const db = getDB();
  try {
    const fixtureId = parseFixtureId(req.params.fixtureId);
    const { lineups } = parseAdminLineupUpdate(req.body);

    const match = await db.collection('real_matches').findOne(
      { 'fixture.id': fixtureId },
      { projection: { 'teams.home': 1, 'teams.away': 1, lineups: 1 } }
    );
    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }

    const homeId = match.teams?.home?.id;
    const awayId = match.teams?.away?.id;
    const byTeam = new Map(lineups.map((lineup) => [lineup.team.id, lineup]));
    if (!byTeam.has(homeId) || !byTeam.has(awayId) || byTeam.size !== 2) {
      return res.status(400).json({ message: 'Lineups must be the home and away teams of this match' });
    }

    const ordered = [byTeam.get(homeId), byTeam.get(awayId)];
    const seen = new Set();
    for (const lineup of ordered) {
      assertLineupPlayers(lineup, seen);
      const derived = formationFromStartXI(lineup.startXI);
      if (derived) lineup.formation = derived;
    }

    const username = req.validateData?.username || 'dev';
    const homeName = match.teams?.home?.name || 'Home';
    const awayName = match.teams?.away?.name || 'Away';
    const previousByTeam = new Map((match.lineups || []).map((lineup) => [lineup?.team?.id, lineup]));
    const changes = [
      ...diffLineupSide(homeName, previousByTeam.get(homeId), ordered[0]),
      ...diffLineupSide(awayName, previousByTeam.get(awayId), ordered[1])
    ];
    await db.collection('real_matches').updateOne(
      { 'fixture.id': fixtureId },
      {
        $set: {
          lineups: ordered,
          lineups_manual: true,
          lineups_manual_at: new Date()
        }
      }
    );
    await logAdminAction(username, 'UPDATE_MATCH_LINEUPS', {
      fixtureId,
      home: homeName,
      away: awayName,
      changes
    }, req);
    res.json({ lineups: ordered });
  } catch (error) {
    console.error('Error updating match lineups:', error);
    if (error instanceof z.ZodError || error.name === 'ZodError') {
      return res.status(400).json({ message: 'Invalid lineups' });
    }
    if (error.message && !error.message.includes('Mongo')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Failed to save lineups' });
  }
};

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
