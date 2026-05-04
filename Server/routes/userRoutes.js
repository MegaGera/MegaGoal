import express from 'express';
import { getMe, markHomeNotification, setFavouriteTeam, setFavouriteLeague } from '../controllers/userController.js';

const router = express.Router();

router.get('/me', getMe);
router.post('/me/notifications/home', markHomeNotification);
router.patch('/me/favourite-teams', setFavouriteTeam);
router.patch('/me/favourite-leagues', setFavouriteLeague);

export default router;
