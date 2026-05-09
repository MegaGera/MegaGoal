import express from 'express';
import { getRealMatches, getRealMatchById, getTeamOpponentsSummary } from '../controllers/realMatchController.js';

const router = express.Router();

router.get('/team-opponents/summary', getTeamOpponentsSummary);
router.get('/', getRealMatches);
router.get('/:id', getRealMatchById);

export default router;