import express from 'express';
import { createLocation, deleteLocation, getLocationCounts, getLocations, renameLocation, searchLocationPlaces, setLocationPlace } from '../controllers/locationController.js';

const router = express.Router();

router.get('/', getLocations);
router.get('/counts/', getLocationCounts);
router.get('/places/', searchLocationPlaces);
router.post('/', createLocation);
router.put('/:id/place', setLocationPlace);
router.patch('/:id', renameLocation);
router.delete('/:id', deleteLocation);

export default router;