import express from 'express';
import {
  getRandomWatchedMatch,
  getWatchedStatus,
  searchWatchedMatches,
} from '../controllers/onzeMatchController.js';

const router = express.Router();

router.get('/watched/status', getWatchedStatus);
router.get('/watched/search', searchWatchedMatches);
router.get('/watched/random', getRandomWatchedMatch);

export default router;
