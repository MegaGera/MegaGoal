import express from 'express';
import { getMatches, createMatch, deleteMatch, changeLocation } from '../controllers/matchController.js';

const router = express.Router();

router.get('/', getMatches);
router.post('/', createMatch);
router.delete('/:fixtureId', deleteMatch);
router.post('/set_location', changeLocation);

export default router;