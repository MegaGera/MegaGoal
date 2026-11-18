import express from 'express';
import { createLocation, getLocationCounts, getLocations, renameLocation, searchLocationPlaces, setLocationPlace } from '../controllers/locationController.js';

const router = express.Router();

router.get('/', getLocations);
router.get('/counts/', getLocationCounts);
router.get('/places/', searchLocationPlaces);
router.post('/', createLocation);
router.put('/:id/place', setLocationPlace);
router.patch('/:id', renameLocation);

export default router;