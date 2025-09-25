import express from 'express';
import { getMatches, createMatch, deleteMatch, changeLocation, getLandingPageInfo } from '../controllers/matchController.js';

const router = express.Router();

router.get('/', getMatches);
router.get('/landing-info', getLandingPageInfo); // Public endpoint for landing page
router.post('/', createMatch);
router.delete('/:fixtureId', deleteMatch);
router.post('/set_location', changeLocation);

export default router;