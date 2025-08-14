import { getDB } from '../config/db.js';

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
    res.status(201).json(result.acknowledged);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}
