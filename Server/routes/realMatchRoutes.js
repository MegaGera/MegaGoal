import express from 'express';
import { getRealMatches } from '../controllers/realMatchController.js';

const router = express.Router();

router.get('/', getRealMatches);

export default router;