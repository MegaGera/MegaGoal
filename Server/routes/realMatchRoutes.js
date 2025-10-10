import express from 'express';
import { getRealMatches, getRealMatchById } from '../controllers/realMatchController.js';

const router = express.Router();

router.get('/', getRealMatches);
router.get('/:id', getRealMatchById);

export default router;