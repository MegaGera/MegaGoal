import express from 'express';
import { getTeams, getTeamByTeamId } from '../controllers/teamController.js';

const router = express.Router();

router.get('/', getTeams);
router.get('/:team_id', getTeamByTeamId);

export default router;