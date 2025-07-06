import express from 'express';
import { getTeams, getTeamByTeamId, setPreviousImage, deletePreviousImage, getTeamsByTopLeagues } from '../controllers/teamController.js';

const router = express.Router();

router.get('/', getTeams);
router.get('/top_leagues', getTeamsByTopLeagues);
router.get('/:team_id', getTeamByTeamId);
router.post('/set_previous_image', setPreviousImage);
router.post('/delete_previous_image', deletePreviousImage);

export default router;