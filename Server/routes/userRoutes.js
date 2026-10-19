import express from 'express';
import { getMe, markHomeNotification, setFavouriteTeam, setFavouriteLeague } from '../controllers/userController.js';
import {
  profilePictureUpload,
  uploadProfilePicture
} from '../controllers/profilePictureController.js';

const router = express.Router();

router.get('/me', getMe);
router.post('/me/notifications/home', markHomeNotification);
router.patch('/me/favourite-teams', setFavouriteTeam);
router.patch('/me/favourite-leagues', setFavouriteLeague);
router.post(
  '/me/profile-picture',
  (req, res, next) => {
    profilePictureUpload(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'Image too large (max 10MB)' });
        }
        return res.status(400).json({ message: err.message || 'Invalid upload' });
      }
      next();
    });
  },
  uploadProfilePicture
);

export default router;
