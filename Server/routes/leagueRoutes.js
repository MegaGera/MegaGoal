import express from 'express';
import { getLeagues, getTopLeagues } from '../controllers/leagueController.js';

const router = express.Router();

router.get('/', getLeagues);
router.get('/top', getTopLeagues);

export default router;