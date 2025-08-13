import express from 'express';
import { changeIsActive, changeUpdateFrequency, changeDailyUpdate, createLeagueSetting } from '../controllers/adminController.js';

const router = express.Router();

router.patch('/leagues_settings/is_active', changeIsActive);
router.patch('/leagues_settings/update_frequency', changeUpdateFrequency);
router.patch('/leagues_settings/daily_update', changeDailyUpdate);
router.post('/leagues_settings/create', createLeagueSetting);

export default router;