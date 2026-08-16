import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL;
let redisClient = null;
let isRedisConnected = false;

// Fallback in-memory storage for locks
const inMemoryLocks = new Map();
const inMemoryTimeouts = new Map();

export async function connectRedis() {
  if (!REDIS_URL) {
    console.warn('⚠️ No REDIS_URL provided. TickrFlow will run using an in-memory lock manager.');
    return null;
  }

  try {
    redisClient = createClient({
      url: REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 1) {
            // Stop retrying after 2 attempts to fallback to in-memory lock manager
            return new Error('Redis connection failed');
          }
          return 500; // wait 500ms before retrying
        }
      }
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis Connection Error:', err.message);
      isRedisConnected = false;
    });

    redisClient.on('connect', () => {
      console.log('🔌 Redis Client Connecting...');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis Client Ready and Connected!');
      isRedisConnected = true;
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('❌ Failed to connect to Redis. Falling back to in-memory lock manager.', error.message);
    redisClient = null;
    isRedisConnected = false;
    return null;
  }
}

/**
 * Attempts to lock a seat atomically for a given user.
 * @param {number|string} eventId 
 * @param {number|string} seatId 
 * @param {number|string} userId 
 * @param {number} ttlSeconds (default 5 minutes)
 * @returns {Promise<boolean>} True if lock was acquired, false otherwise
 */
export async function lockSeat(eventId, seatId, userId, ttlSeconds = 300) {
  const lockKey = `lock:event:${eventId}:seat:${seatId}`;

  if (isRedisConnected && redisClient) {
    try {
      // SET key value NX EX ttl
      // NX: Set if not exists, EX: Set expiry time in seconds
      const result = await redisClient.set(lockKey, String(userId), {
        NX: true,
        EX: ttlSeconds
      });
      return result === 'OK';
    } catch (err) {
      console.error('Redis lock error, falling back to memory:', err.message);
    }
  }

  // InMemory Fallback
  if (inMemoryLocks.has(lockKey)) {
    return false; // Already locked
  }

  // Set the lock
  inMemoryLocks.set(lockKey, String(userId));
  
  // Schedule expiration
  const timeoutId = setTimeout(() => {
    inMemoryLocks.delete(lockKey);
    inMemoryTimeouts.delete(lockKey);
    console.log(`⏰ InMemory Lock expired for seat ${seatId} (event ${eventId})`);
  }, ttlSeconds * 1000);

  inMemoryTimeouts.set(lockKey, timeoutId);
  return true;
}

/**
 * Unlocks a seat if and only if it is owned by the requesting user.
 * @param {number|string} eventId 
 * @param {number|string} seatId 
 * @param {number|string} userId 
 * @returns {Promise<boolean>} True if unlocked successfully, false if not owner or not locked
 */
export async function unlockSeat(eventId, seatId, userId) {
  const lockKey = `lock:event:${eventId}:seat:${seatId}`;

  if (isRedisConnected && redisClient) {
    try {
      const owner = await redisClient.get(lockKey);
      if (owner === String(userId)) {
        await redisClient.del(lockKey);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Redis unlock error, falling back to memory:', err.message);
    }
  }

  // InMemory Fallback
  if (!inMemoryLocks.has(lockKey)) {
    return false;
  }

  const owner = inMemoryLocks.get(lockKey);
  if (owner === String(userId)) {
    // Clear timeout
    const timeoutId = inMemoryTimeouts.get(lockKey);
    if (timeoutId) {
      clearTimeout(timeoutId);
      inMemoryTimeouts.delete(lockKey);
    }
    inMemoryLocks.delete(lockKey);
    return true;
  }

  return false;
}

/**
 * Checks who owns the lock on a seat.
 * @param {number|string} eventId 
 * @param {number|string} seatId 
 * @returns {Promise<string|null>} The owner's userId or null if not locked
 */
export async function getSeatLockOwner(eventId, seatId) {
  const lockKey = `lock:event:${eventId}:seat:${seatId}`;

  if (isRedisConnected && redisClient) {
    try {
      return await redisClient.get(lockKey);
    } catch (err) {
      console.error('Redis get lock owner error:', err.message);
    }
  }

  return inMemoryLocks.get(lockKey) || null;
}

/**
 * Retrieves all currently locked seats for a specific event.
 * @param {number|string} eventId 
 * @returns {Promise<Object>} Map of seatId -> userId
 */
export async function getLockedSeatsForEvent(eventId) {
  const pattern = `lock:event:${eventId}:seat:*`;
  const lockedSeats = {};

  if (isRedisConnected && redisClient) {
    try {
      // Fetch matching keys
      const keys = await redisClient.keys(pattern);
      for (const key of keys) {
        const parts = key.split(':');
        const seatId = parts[parts.length - 1];
        const userId = await redisClient.get(key);
        if (userId) {
          lockedSeats[seatId] = userId;
        }
      }
      return lockedSeats;
    } catch (err) {
      console.error('Redis keys scan error, falling back to memory:', err.message);
    }
  }

  // InMemory Fallback
  for (const [key, userId] of inMemoryLocks.entries()) {
    if (key.startsWith(`lock:event:${eventId}:seat:`)) {
      const parts = key.split(':');
      const seatId = parts[parts.length - 1];
      lockedSeats[seatId] = userId;
    }
  }

  return lockedSeats;
}

export { redisClient, isRedisConnected };
