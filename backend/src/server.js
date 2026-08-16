import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/authRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import { connectRedis } from './config/redis.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*', // In production, replace with specific origins for security
    methods: ['GET', 'POST']
  }
});

// Store io instance on app to make it accessible in controllers
app.set('socketio', io);

// Global Middlewares
app.use(cors());

// IMPORTANT: Razorpay webhook requires the raw body to verify signature.
// We must place this route BEFORE applying express.json() globally.
app.post('/api/bookings/webhook', express.raw({ type: 'application/json' }));

// For all other routes, parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/bookings', bookingRoutes);

// Socket.IO Room Coordination
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Room subscription for event page seat map tracking
  socket.on('join:event', (eventId) => {
    const roomName = `event:${eventId}`;
    socket.join(roomName);
    console.log(`👤 Client ${socket.id} joined room: ${roomName}`);
  });

  socket.on('leave:event', (eventId) => {
    const roomName = `event:${eventId}`;
    socket.leave(roomName);
    console.log(`👤 Client ${socket.id} left room: ${roomName}`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Graceful Start Server
const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    // Connect to Redis (falls back to memory lock manager if offline)
    await connectRedis();

    server.listen(PORT, () => {
      console.log(`🚀 TickrFlow Server running on port ${PORT}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Failed to bootstrap the server:', error);
    process.exit(1);
  }
}

bootstrap();
