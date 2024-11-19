import express from 'express';
import { getLeaguesSettings, changeUpdateFrequency } from '../controllers/adminController.js';

const router = express.Router();

router.get('/leagues_settings/', getLeaguesSettings);
router.patch('/leagues_settings/update_frequency', changeUpdateFrequency);

export default router;