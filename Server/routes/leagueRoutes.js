import express from 'express';
import { getLeagues, getTopLeagues } from '../controllers/leagueController.js';
import { getLeaguesSettings } from '../controllers/adminController.js';

const router = express.Router();

router.get('/', getLeagues);
router.get('/settings', getLeaguesSettings);
router.get('/top', getTopLeagues);

export default router;