import { getDB } from '../config/db.js';

// Get leagues settings
const getLeaguesSettings = async (req, res) => {
  const db = getDB();
  try {
    const result = await db.collection('settings').find().toArray();
    console.log("Leagues Settings Getted");
    res.send(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Patch change update frequency of a leagues settings
const changeUpdateFrequency = async (req, res) => {
  const db = getDB();
  try {
    let {league_id, update_frequency} = req.body;
    const filter = { "league_id": +league_id};
    const update = { $set: { "update_frequency": update_frequency } };
    let result = await db.collection('settings').updateOne(filter, update);
    console.log("Update frequency updated for league " + league_id + " to " + update_frequency);
    res.status(201).json(result.acknowledged);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export { getLeaguesSettings, changeUpdateFrequency };