import express from 'express';
import { getPlayers, getPlayersApiInfo } from '../controllers/playersController.js';

const router = express.Router();

// Get all players
router.get('/', getPlayers);

// Get players API info
router.get('/players-api-info', getPlayersApiInfo);

export default router;
