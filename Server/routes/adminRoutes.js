import express from 'express';
import { changeIsActive, changeUpdateFrequency, changeDailyUpdate, createLeagueSetting, getRealMatchesWithoutStatistics, addLandingMatch, removeLandingMatch, getLandingMatches } from '../controllers/adminController.js';

const router = express.Router();

router.patch('/leagues_settings/is_active', changeIsActive);
router.patch('/leagues_settings/update_frequency', changeUpdateFrequency);
router.patch('/leagues_settings/daily_update', changeDailyUpdate);
router.post('/leagues_settings/create', createLeagueSetting);
router.get('/real_matches/without_statistics', getRealMatchesWithoutStatistics);
router.post('/landing_matches/add', addLandingMatch);
router.delete('/landing_matches/remove', removeLandingMatch);
router.get('/landing_matches', getLandingMatches);

export default router;