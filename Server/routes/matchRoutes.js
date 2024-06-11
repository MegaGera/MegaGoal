import express from 'express';
import { getMatches, createMatch, changeLocation } from '../controllers/matchController.js';

const router = express.Router();

router.get('/', getMatches);
router.post('/', createMatch);
router.post('/set_location', changeLocation);

export default router;