# TickrFlow 🎫

🔗 **Live Demo:** [TickrFlow](https://frontend-suryas-projects-b65a9565.vercel.app)  

---

## About the Project ℹ️

### The Problem 🚨
During high-demand ticket sales (such as popular concerts or sporting events), thousands of users attempt to purchase the exact same seat layout simultaneously. Without concurrency controls, this results in:
- **Double Bookings**: Multiple users successfully paying for and receiving the same seat ticket.
- **Database Deadlocks**: Massive write collisions on the database layer causing request timeouts or crashes.
- **Frustrated Users**: Selecting seats, filling in details, only to have the transaction fail at the very end of the checkout process.

### The Solution 🛡️
TickrFlow handles high concurrency using a two-stage distributed lock and synchronization flow:
1. **Atomic Memory Locks (Upstash Redis)**: When User A selects a seat, the backend sets a temporary, atomic lock in Redis (`SET key NX EX 300`). Because this is an atomic operation, it guarantees that only one request can hold the lock. If User B attempts to reserve the same seat, they are instantly rejected at the memory layer before hitting the primary database.
2. **Real-time Live Sync (Socket.IO)**: Once User A holds the seat, a WebSocket message is broadcast to all active users looking at the same map, instantly turning User A's selected seat yellow (disabled) on their screens.
3. **Automatic Release (TTL)**: The Redis key is configured with a 300-second (5-minute) expiration time. If User A successfully pays via Razorpay, the ticket is permanently written to PostgreSQL. If User A abandons the page or fails to pay, the TTL expires, the lock is auto-deleted, and the seat instantly becomes available for other buyers.

---

## Features

### 1. 🔒 Secure Authentication
- JWT-based authentication for custom email signups
- **Google OAuth** integration using the official Google Identity Client library

### 2. ⚡ Atomic Seat Reservation
- Temporary 5-minute seat locks powered by **Upstash Redis** (`SET NX EX 300` TTL mechanism)
- Thread-safe, in-memory lock manager fallback if Redis is offline

### 3. 🌐 Real-Time Synchronization
- Immediate bidirectional UI updates across all clients using **Socket.IO WebSockets**
- Auto-reconnect safety features for dynamic client mounting

### 4. 💳 Razorpay Payments
- Mock checkouts and real integration workflows using the **Razorpay SDK**
- Secure backend signature verification for transaction integrity

### 5. 🛠️ Organizer Dashboard
- Custom grid constructor for defining rows, seat numbers, pricing categories, and capacities
- Direct management interface writing dynamically to the PostgreSQL database

### 6. 📱 Responsive CSS Map
- Interactive, responsive seat selection map built with Vanilla CSS
- Glassmorphic panels and pulsing seat lock animations

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 16 (App Router), TypeScript, TailwindCSS | Fast, server-rendered UI components with premium glassmorphic styling |
| **Backend** | Node.js, Express, Socket.IO | High-performance API server and real-time WebSocket events coordinator |
| **Database** | Supabase (PostgreSQL) | Relational storage for users, events, seat layouts, bookings, and payments |
| **Database ORM**| Prisma | Type-safe schema definition and query pooling matching Supabase transaction proxies |
| **Caching/Locking**| Upstash Redis | Remote memory cache for distributed, atomic seat locks with TTL expiration |
| **Payments** | Razorpay SDK | Secure, test-mode payment gateway integration |
| **Auth** | Google Identity Services, JWT | Dual-mode login allowing Google SSO or self-built JWT credentials |

---

## Local Setup

### Prerequisites
- Node.js v18+
- PostgreSQL database (Supabase)
- Redis instance (Upstash)

### 1. Clone the repository
```bash
git clone git@github.com:Suryacodeshere/TickrFlow.git
cd TickrFlow
```

### 2. Backend Config & Boot
Create `backend/.env`:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://user:password@host:port/db?pgbouncer=true"
DIRECT_URL="postgresql://user:password@host:port/db"
JWT_SECRET="your-secret"
RAZORPAY_KEY_ID="rzp_test_xxxx"
RAZORPAY_KEY_SECRET="yyyy"
GOOGLE_CLIENT_ID="google-client-id"
REDIS_URL="rediss://..."
```

Run migrations and seed the database:
```bash
cd backend
npm install
npx prisma db push
npm run db:seed
npm run dev
```

### 3. Frontend Config & Boot
Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=google-client-id
```

Run:
```bash
cd frontend
npm install
npm run dev
```

---

## Developer 👨‍💻

- [@Surya](https://github.com/suryacodeshere)
