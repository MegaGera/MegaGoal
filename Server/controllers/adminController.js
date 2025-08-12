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
