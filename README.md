# 🎫 TickrFlow: Real-Time Concert & Event Ticketing Platform

### 🚀 Live Demo
* **Frontend (Next.js)**: [https://frontend-20yao675b-suryas-projects-b65a9565.vercel.app](https://frontend-20yao675b-suryas-projects-b65a9565.vercel.app)
* **Backend API (Express)**: [https://tickrflow.onrender.com](https://tickrflow.onrender.com)
* **Live Cache (Upstash Redis)**: Connected for real-time seat lock orchestration.

---

## 📖 Project Overview
TickrFlow is a high-concurrency event ticketing and seat booking platform designed to prevent double-booking of seats during high-demand sales (such as Coldplay or Boiler Room concerts). 

By combining **distributed memory locks** (Redis TTL holds) and **bidirectional real-time communication** (Socket.IO WebSockets), the application guarantees that when a user selects a seat, it is instantly reserved for them for 5 minutes and visualised as "Locked" to all other active buyers on the map, preventing race conditions before payment is processed.

---

## 🛠️ Technology Stack

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

## ⚙️ Core Logic & Architecture

```mermaid
sequenceDiagram
    autonumber
    actor Attendee as User A (Tab 1)
    actor Browser2 as User B (Tab 2)
    participant API as Express API
    participant Redis as Upstash Redis
    participant DB as Supabase PostgreSQL
    participant WS as Socket.IO Server

    Attendee->>API: Selects seat A7 & click "Reserve"
    API->>Redis: Set Key "lock:event:1:seat:A7" NX EX 300
    alt Lock Acquired (Successful)
        Redis-->>API: OK (Lock acquired)
        API->>WS: Broadcast "seats:locked" (A7, User A)
        WS-->>Browser2: Live update: Seat A7 turns yellow (Locked)
        API-->>Attendee: Return 5-minute reservation timer
    else Lock Failed (Seat already reserved)
        Redis-->>API: Null
        API-->>Attendee: Return 409 Conflict ("Seat already held")
    end

    alt Payment Success (Within 5 minutes)
        Attendee->>API: Process Razorpay Checkout
        API->>DB: Create Booking & mark Seat A7 as BOOKED
        API->>Redis: Delete Key "lock:event:1:seat:A7"
        API->>WS: Broadcast "seats:booked" (A7)
        WS-->>Browser2: Live update: Seat A7 turns red (Booked)
    else Expiration (Timer hits 0)
        Redis--xAPI: TTL expires (300s)
        API->>WS: Broadcast "seats:unlocked" (A7)
        WS-->>Browser2: Live update: Seat A7 turns grey (Available)
    end
```

### 1. Concurrency Management (Atomic Seat Locking)
Double-booking is prevented using Redis **atomic operations**:
* When a user attempts to lock a set of seats, the backend uses Redis `SET key value NX EX 300`.
  * `NX`: Only set the key if it doesn't already exist (prevents overwriting other users' holds).
  * `EX 300`: Automatically expires the lock after 300 seconds (5 minutes), freeing up the seats if the user closes their browser or fails to pay.
* If Redis goes offline, the backend gracefully falls back to a thread-safe **in-memory lock manager** to prevent server crashes.

### 2. Live Synchronization (WebSockets)
* As soon as a user successfully acquires a temporary lock, the API triggers a Socket.IO broadcast:
  `io.to("event:1").emit("seats:locked", { seatIds, userId })`
* All other clients currently looking at that event map immediately receive the event and animate the corresponding seat nodes to a yellow (Locked by other user) state.
* The frontend uses connection-resilient React hooks that dynamically join the WebSockets rooms only when the socket object becomes active, resolving race conditions.

---

## 📂 Project Structure

```
TickrFlow/
├── backend/
│   ├── prisma/             # Database schemas & seed scripts
│   ├── src/
│   │   ├── config/         # Database and Redis configurations
│   │   ├── controllers/    # Request handlers (Booking, Auth, Events)
│   │   ├── middleware/     # JWT Auth guards & raw body parsers
│   │   └── routes/         # Express endpoints
│   ├── render.yaml         # Render blueprint for backend Web Service
│   └── Procfile            # Deployment boot script
└── frontend/
    ├── src/
    │   ├── app/            # Next.js pages (Login, Dashboard, Event Details)
    │   ├── context/        # React Context providers (Auth, Socket)
    │   └── components/     # UI layouts & seat maps
    └── vercel.json         # Vercel deployment configuration
```

---

## 🔧 Local Installation & Setup

### Prerequisites
* Node.js v18+
* PostgreSQL database instance (or Supabase account)
* Redis instance (optional, falls back to in-memory)

### 1. Clone the repository
```bash
git clone git@github.com:Suryacodeshere/TickrFlow.git
cd TickrFlow
```

### 2. Configure Backend
Create `backend/.env` file:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://user:password@host:port/db?pgbouncer=true"
DIRECT_URL="postgresql://user:password@host:port/db"
JWT_SECRET="your-super-secret-key"
RAZORPAY_KEY_ID="rzp_test_xxxx"
RAZORPAY_KEY_SECRET="yyyy"
GOOGLE_CLIENT_ID="your-google-client-id"
REDIS_URL="rediss://default:password@endpoint.upstash.io:6379"
```

Initialize database & seed events:
```bash
cd backend
npm install
npx prisma db push
npm run db:seed
npm run dev
```

### 3. Configure Frontend
Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

Run dev server:
```bash
cd frontend
npm install
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser!

---

## 👤 Default Demo Accounts
* **Attendee Account**: `attendee@tickrflow.com` (Password: `password123`)
* **Organizer Account**: `organizer@tickrflow.com` (Password: `password123`)
  *(Organizer dashboard allows creating custom seat maps dynamically).*
