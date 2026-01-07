import express from 'express';
import { getLeagueColors } from '../controllers/leagueController.js';

const router = express.Router();

// Public endpoint for league colors (used on landing page)
router.get('/colors', getLeagueColors);

export default router;

