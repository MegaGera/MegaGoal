import express from 'express';
import { createLocation, getLocationCounts, getLocations } from '../controllers/locationController.js';

const router = express.Router();

router.get('/', getLocations);
router.get('/counts/', getLocationCounts);
router.post('/', createLocation);

export default router;