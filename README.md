# TickrFlow 🎫

🔗 **Live Demo:** [TickrFlow](https://frontend-20yao675b-suryas-projects-b65a9565.vercel.app)  
🔌 **Live Backend:** [TickrFlow API](https://tickrflow.onrender.com)

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

## System Architecture

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
