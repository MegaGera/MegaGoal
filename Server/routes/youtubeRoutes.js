import express from 'express';
import { searchMatchHighlights } from '../controllers/youtubeController.js';

const router = express.Router();

router.get('/highlights', searchMatchHighlights);

export default router;

