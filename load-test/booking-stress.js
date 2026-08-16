import http from 'k6/http';
import { check, sleep } from 'k6';

// k6 configuration options
export const options = {
  scenarios: {
    hotSeatStress: {
      executor: 'per-vu-iterations',
      vus: 50,          // 50 concurrent users
      iterations: 1,    // Each user makes exactly 1 attempt
      maxDuration: '10s'
    }
  },
  thresholds: {
    // Assertions: we expect the rate of successful locking to be exactly 1 out of 50
    // (i.e. 2% success rate, 98% conflict rate)
    http_req_failed: ['rate>0.9'], // We expect most requests to fail (return 409 conflict)
  }
};

const BASE_URL = __ENV.API_URL || 'http://localhost:5000';

// Setup phase: runs once. Here, we registers/logs in 50 test users to get their JWT tokens
export function setup() {
  const tokens = [];

  console.log(`🎬 Setup: Registering 50 unique users to simulate concurrent booking traffic...`);

  for (let i = 1; i <= 50; i++) {
    const email = `k6_user_${i}_${Date.now()}@test.com`;
    const password = 'password123';
    
    // Register
    const signupRes = http.post(`${BASE_URL}/api/auth/signup`, JSON.stringify({
      name: `K6 User ${i}`,
      email: email,
      password: password,
      role: 'ATTENDEE'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

    if (signupRes.status === 201) {
      const data = JSON.parse(signupRes.body);
      tokens.push({
        id: data.user.id,
        token: data.token
      });
    } else {
      console.warn(`⚠️ Failed to register test user ${i}: HTTP ${signupRes.status}`);
    }
  }

  console.log(`✅ Registered ${tokens.length} users successfully. Starting concurrency test...`);
  return { tokens };
}

// Main virtual user execution loop
export default function (data) {
  // Get token for the current VU
  const vuIndex = __VU - 1;
  const userSession = data.tokens[vuIndex];

  if (!userSession) {
    console.error(`❌ No user session available for VU ${__VU}`);
    return;
  }

  // We all try to lock the exact same seat!
  // Coldplay event has seats A1-A8 with IDs starting from 1 (A1 is id 1)
  const payload = JSON.stringify({
    eventId: 1,      // Coldplay Event ID
    seatIds: [1]     // Seat A1
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userSession.token}`
    }
  };

  // Synchronized hit: We make the call immediately to catch race conditions!
  const res = http.post(`${BASE_URL}/api/bookings/lock`, payload, params);

  // We expect:
  // - Exactly 1 VU gets HTTP 200 (Success)
  // - 49 VUs get HTTP 409 (Conflict - Seat is locked)
  check(res, {
    'Acquired Lock (200)': (r) => r.status === 200,
    'Seat Already Locked (409)': (r) => r.status === 409,
  });

  // Log who got it
  if (res.status === 200) {
    console.log(`🏆 VU ${__VU} (User ID ${userSession.id}) SUCCESSFULLY ACQUIRED THE LOCK!`);
  }
}

// Teardown phase: runs once at the end
export function teardown(data) {
  console.log('🏁 Concurrency test completed. Clean up locks if any.');
}
