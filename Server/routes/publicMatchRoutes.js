import express from 'express';
import { getLandingPageInfo } from '../controllers/matchController.js';

const router = express.Router();

// Public endpoint for landing page (no authentication required)
router.get('/landing-info', getLandingPageInfo);

export default router;

