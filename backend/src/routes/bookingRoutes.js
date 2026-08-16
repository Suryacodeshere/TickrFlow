import express from 'express';
import {
  lockSeatsEndpoint,
  unlockSeatsEndpoint,
  createOrder,
  verifyPaymentEndpoint,
  razorpayWebhook,
  getUserBookings
} from '../controllers/bookingController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public webhook route (called by Razorpay)
router.post('/webhook', express.raw({ type: 'application/json' }), razorpayWebhook);

// Protected routes (require JWT)
router.post('/lock', authenticate, lockSeatsEndpoint);
router.post('/unlock', authenticate, unlockSeatsEndpoint);
router.post('/order', authenticate, createOrder);
router.post('/verify', authenticate, verifyPaymentEndpoint);
router.get('/my-bookings', authenticate, getUserBookings);

export default router;
