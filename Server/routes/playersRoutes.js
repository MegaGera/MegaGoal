import express from 'express';
import { getPlayers, getPlayersApiInfo, getPlayerById } from '../controllers/playersController.js';

const router = express.Router();

// Get all players
router.get('/', getPlayers);

// Get players API info
router.get('/players-api-info', getPlayersApiInfo);

// Get player by ID
router.get('/:id', getPlayerById);

export default router;
