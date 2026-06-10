import express from 'express';
import { getMatches, getMatchesByTeamId, createMatch, deleteMatch, changeLocation, setUserPicks, setReactions, getMatchEngagement, getLandingPageInfo, getUsersMatchCounts } from '../controllers/matchController.js';

const router = express.Router();

router.get('/', getMatches);
router.get('/team/:teamId', getMatchesByTeamId);
router.get('/landing-info', getLandingPageInfo); // Public endpoint for landing page
router.get('/users-match-counts', getUsersMatchCounts); // Admin endpoint for user match counts
router.get('/engagement/:fixtureId', getMatchEngagement);
router.post('/', createMatch);
router.delete('/:fixtureId', deleteMatch);
router.post('/set_location', changeLocation);
router.post('/set_user_picks', setUserPicks);
router.post('/set_reactions', setReactions);

export default router;