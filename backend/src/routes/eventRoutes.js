import express from 'express';
import { createEvent, getAllEvents, getEventDetails } from '../controllers/eventController.js';
import { authenticate, requireRole } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/', getAllEvents);
router.get('/:id', getEventDetails);
router.post('/', authenticate, requireRole('ORGANIZER'), createEvent);

export default router;
