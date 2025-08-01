import express from 'express';
import { changeIsActive, changeUpdateFrequency, changeDailyUpdate } from '../controllers/adminController.js';

const router = express.Router();

router.patch('/leagues_settings/is_active', changeIsActive);
router.patch('/leagues_settings/update_frequency', changeUpdateFrequency);
router.patch('/leagues_settings/daily_update', changeDailyUpdate);

export default router;