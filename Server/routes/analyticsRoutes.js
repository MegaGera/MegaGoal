import express from 'express';
import { logPageVisitEndpoint } from '../controllers/analyticsController.js';

const router = express.Router();

router.post('/page-visit', logPageVisitEndpoint);

export default router;

