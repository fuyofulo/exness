# 🚀 Trading Exchange Platform

A high-performance, real-time trading exchange built with modern technologies, featuring CFD (Contract for Difference) trading with leverage, automated liquidation systems, and enterprise-grade reliability.

## 📊 Overview

This platform provides a complete trading ecosystem with:
- **CFD Trading** with up to 100x leverage
- **Real-time Price Streaming** from multiple assets (BTC, ETH, SOL)
- **Automated Risk Management** with liquidation and stop-loss systems
- **High Availability** with snapshot-based recovery
- **Event-Driven Architecture** with Redis streams
- **Comprehensive Audit Trail** with database persistence

## 🏗️ Architecture

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Frontend    │    │     Backend     │    │     Engine      │
│                 │    │                 │    │                 │
│  - Next.js      │◄──►│  - Express      │◄──►│  - Trading Core │
│  - React        │    │  - PostgreSQL   │    │  - In-Memory DB │
│  - TypeScript   │    │  - JWT Auth     │    │  - Redis Streams│
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │     Database    │    │   Price Poller  │
                       │                 │    │                 │
                       │  - User Data    │◄──►│  - WebSocket    │
                       │  - Trade History│    │  - Real-time    │
                       │  - Orders       │    │  - BTC/ETH/SOL  │
                       └─────────────────┘    └─────────────────┘
```

### Data Flow

1. **Price Poller** → Streams real-time prices to Redis
2. **Trading Engine** → Processes trades, manages positions
3. **Backend API** → Handles user requests, authentication
4. **Database** → Persistent storage of trades and users
5. **Frontend** → User interface for trading

## 🔄 **Data Architecture & Streams**

### Redis Streams & Consumer Groups

This platform uses **Redis Streams** for high-throughput, reliable message passing between components. Each stream has dedicated consumer groups for load balancing and fault tolerance.

#### 📊 **Stream 1: Price Updates (`engine_input`)**
**Purpose:** Real-time price streaming from Poller to Engine
```typescript
Stream: 'engine_input'
Producer: Price Poller (WebSocket → Redis)
Consumer: Engine Price Listener
Consumer Group: 'engine_price_group'
Consumer: 'engine_price_1'
```

**Data Format:**
```json
{
  "source": "poller",
  "data": "base64-encoded-json",
  "format": "base64_v1",
  "timestamp": "1758117494823"
}
```

**Decoded Data:**
```json
[{
  "asset": "SOL_USDC",
  "price": "20347000000",
  "decimal": 6
}]
```

#### 📊 **Stream 2: Commands (`backend-to-engine`)**
**Purpose:** User commands from Backend to Engine
```typescript
Stream: 'backend-to-engine'
Producer: Backend API
Consumer: Engine Orders Listener
Consumer Group: 'engine_orders_group'
Consumer: 'engine_2'
```

**Data Format:**
```json
{
  "orderId": "uuid-v4",
  "command": "CREATE_TRADE",
  "email": "user@example.com",
  "tradeData": "{\"asset\":\"SOL_USDC\",\"direction\":\"LONG\",\"margin\":1000,\"leverage\":50}",
  "timestamp": "1758117494823"
}
```

#### 📊 **Stream 3: Responses (`engine_response`)**
**Purpose:** Engine responses back to Backend
```typescript
Stream: 'engine_response'
Producer: Engine Orders Listener
Consumer: Backend Response Handler
Consumer Group: 'backend_group'
Consumer: 'backend_consumer'
```

**Data Format:**
```json
{
  "orderId": "uuid-v4",
  "status": "success",
  "data": "{\"email\":\"user@example.com\",\"tradeId\":\"trade_123\",\"entryPrice\":203.47}",
  "message": "Trade created successfully",
  "timestamp": "1758117494823"
}
```

#### 📊 **Stream 4: Events (`engine_events`)**
**Purpose:** Asynchronous events (liquidations, closures) from Engine to Backend
```typescript
Stream: 'engine_events'
Producer: Engine Price Listener (on trigger execution)
Consumer: Backend EventListener
Consumer Group: 'liquidation_group'
Consumer: 'liquidation_consumer'
```

**Data Format:**
```json
{
  "eventType": "TRADE_LIQUIDATED",
  "tradeId": "trade_123",
  "email": "user@example.com",
  "asset": "SOL_USDC",
  "pnl": "-5000.00",
  "marginReturned": "1000.00",
  "closePrice": "201.23",
  "timestamp": "1758117494823"
}
```

### 💾 **Database Architecture**

#### **PostgreSQL Database (Persistent Storage)**
**Purpose:** Long-term data persistence and audit trail

**Tables:**

1. **`users`** - User accounts
   ```sql
   CREATE TABLE users (
     id SERIAL PRIMARY KEY,
     email VARCHAR UNIQUE NOT NULL
   );
   ```

2. **`orders`** - All user commands and their results
   ```sql
   CREATE TABLE orders (
     id SERIAL PRIMARY KEY,
     orderId VARCHAR UNIQUE NOT NULL,
     userId INTEGER REFERENCES users(id),
     email VARCHAR NOT NULL,
     command VARCHAR NOT NULL,
     asset VARCHAR,
     direction VARCHAR,
     amount BIGINT,  -- Scaled BigInt (e.g., 10000000 = 1000.00 USD)
     leverage BIGINT,
     tradeId VARCHAR,
     status VARCHAR NOT NULL,  -- 'PENDING', 'SUCCESS', 'ERROR'
     latencyMs INTEGER
   );
   ```

3. **`trades`** - CFD trading positions
   ```sql
   CREATE TABLE trades (
     id SERIAL PRIMARY KEY,
     tradeId VARCHAR UNIQUE NOT NULL,
     userId INTEGER NOT NULL REFERENCES users(id),
     email VARCHAR NOT NULL,
     asset VARCHAR NOT NULL,
     direction VARCHAR NOT NULL,
     margin BIGINT NOT NULL,     -- Scaled USD (10000 = 1.00 USD)
     leverage BIGINT NOT NULL,   -- Integer: 10-1000 (1.0x to 100.0x)
     entryPrice BIGINT NOT NULL, -- Scaled price
     entryPriceDecimals INTEGER NOT NULL,
     liquidationPrice BIGINT,
     liquidationPriceDecimals INTEGER,
     stopLossPrice BIGINT,
     takeProfitPrice BIGINT,
     triggerDecimals INTEGER,
     exitPrice BIGINT,
     exitPriceDecimals INTEGER,
     pnl BIGINT,
     status VARCHAR NOT NULL,    -- 'OPEN', 'CLOSED', 'LIQUIDATED', 'STOP_LOSS', 'TAKE_PROFIT'
     createdAt TIMESTAMP DEFAULT NOW(),
     updatedAt TIMESTAMP DEFAULT NOW()
   );
   ```

#### **In-Memory Data Structures (Engine)**
**Purpose:** High-performance trading data with sub-millisecond access

**Maps:**

1. **`userBalances`** - User financial positions
   ```typescript
   Map<string, UserBalance>  // email → balances

   interface UserBalance {
     email: string;
     balances: Record<string, {
       balance: bigint;    // e.g., 50000000 = 5000.00 USD
       decimals: number;   // e.g., 4 (for 0.0001 precision)
     }>;
   }
   ```

2. **`openTrades`** - Active CFD positions
   ```typescript
   Map<string, Trade>  // tradeId → trade

   interface Trade {
     orderId: string;
     email: string;
     asset: string;
     direction: 'LONG' | 'SHORT';
     margin: bigint;
     leverage: bigint;
     entryPrice: bigint;
     entryPriceDecimals: number;
     liquidationPrice?: bigint;
     stopLossPrice?: bigint;
     takeProfitPrice?: bigint;
     triggerDecimals?: number;
     exitPrice?: bigint;
     exitPriceDecimals?: number;
     pnl: bigint;
     status: 'OPEN' | 'CLOSED' | 'LIQUIDATED' | 'STOP_LOSS' | 'TAKE_PROFIT';
     timestamp: number;
   }
   ```

3. **`closedTrades`** - Historical CFD positions
   ```typescript
   Map<string, Trade>  // tradeId → trade (same as openTrades)
   ```

4. **`userTrades`** - User trade lookup
   ```typescript
   Map<string, string[]>  // email → [tradeId1, tradeId2, ...]
   ```

5. **`tradeTriggerBitmaps`** - O(1) trigger lookups
   ```typescript
   Map<string, {  // asset → trigger data
     long: Map<number, Set<{
       tradeId: string;
       triggerType: 'liquidation' | 'stop_loss' | 'take_profit';
       triggerPrice: bigint;
     }>>;
     short: Map<number, Set<{
       tradeId: string;
       triggerType: 'liquidation' | 'stop_loss' | 'take_profit';
       triggerPrice: bigint;
     }>>;
   }>
   ```

6. **`priceCache`** - Latest asset prices
   ```typescript
   Map<string, LatestPrice>  // asset → price data

   interface LatestPrice {
     asset: string;
     price: bigint;     // e.g., 20347000000 = 203.47000000
     decimal: number;   // e.g., 6
   }
   ```

#### **File-Based Snapshots (Engine)**
**Purpose:** Crash recovery with < 5 second recovery time

**Storage:**
- **Location:** `/engine/snapshots/`
- **Format:** Compressed JSON (`timestamp.json.gz`)
- **Retention:** Last 10 snapshots
- **Frequency:** Every 5 seconds
- **Integrity:** SHA-256 checksums

**Snapshot Contents:**
```json
{
  "version": "1.0.0",
  "timestamp": 1758117494823,
  "checksum": "f19eca3b...",
  "data": {
    "userBalances": [...],
    "openTrades": [...],
    "closedTrades": [...],
    "tradeTriggerBitmaps": {...},
    "metadata": {...}
  }
}
```

**Recovery Process:**
1. Load latest snapshot from `/snapshots/latest.json.gz`
2. Validate checksum and version
3. Deserialize BigInt values from strings
4. Rebuild in-memory data structures
5. Resume normal operation

### 🔄 **Complete Data Flow**

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   Poller    │     │    Redis    │     │   Engine     │
│             │     │   Streams   │     │              │
│ WebSocket   │────►│engine_input │────►│Price Listener│
│ BTC/ETH/SOL │     │             │     │              │
└─────────────┘     └─────────────┘     └───────┬──────┘
                                                │
┌─────────────┐     ┌─────────────┐             │
│  Backend    │     │    Redis    │             │
│             │     │   Streams   │             │
│   API       ┼────►│ backend-to- │             │
│ Commands    │     │  engine     │             │
└─────────────┘     └─────────────┘             │
                              │                 │
                              ▼                 ▼
                       ┌─────────────┐    ┌─────────────┐
                       │ Engine Resp │    │Price Cache  │
                       │  Handler    │    │             │
                       │             │    │In-Memory    │
                       │engine_resp  │◄───┤Maps         │
                       │  stream     │    │             │
                       └─────────────┘    └──────┬──────┘
                              ▲                  │
                              │                  ▼
                       ┌──────────────┐    ┌──────────────┐
                       │Event Listener│    │Trade Triggers│
                       │              │    │              │
                       │engine_events │◄───┤Liquidation/  │
                       │  stream      │    │SL/TP Checks  │
                       └──────┬───────┘    └──────────────┘
                              │
                              ▼
                       ┌─────────────┐
                       │PostgreSQL   │
                       │Database     │
                       │             │
                       │Users/Orders/│
                       │Trades       │
                       └─────────────┘

┌──────────────┐
│File System   │
│Snapshots     │
│              │
│latest.json.gz│
│1758117*.json │
│checksums     │
└──────────────┘
```

## 🛠️ Tech Stack

### Backend & Engine
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Message Queue**: Redis with Streams
- **Authentication**: JWT with HTTP-only cookies

### Frontend
- **Framework**: Next.js 15 with Turbopack
- **Language**: TypeScript
- **Styling**: Tailwind CSS (assumed)

### Infrastructure
- **Containerization**: Docker (recommended)
- **Process Management**: PM2 (recommended)
- **Monitoring**: Built-in logging system

## ✨ Key Features

### 🎯 Trading Features
- **CFD Trading**: Contract for Difference with leverage
- **Multiple Assets**: BTC/USDC, ETH/USDC, SOL/USDC
- **Leverage**: 1x to 100x (configurable)
- **Position Types**: Long and Short positions
- **Real-time Execution**: Sub-millisecond trade processing

### 🛡️ Risk Management
- **Automated Liquidation**: Prevents negative balances
- **Stop Loss Orders**: User-defined exit triggers
- **Take Profit Orders**: Automated profit taking
- **Margin Requirements**: Dynamic margin calculation

### ⚡ Performance
- **In-Memory Processing**: Engine uses memory-mapped data structures
- **Redis Streams**: High-throughput message processing
- **Snapshot Recovery**: < 5 second recovery from failures
- **Horizontal Scaling**: Stateless design supports scaling

### 🔒 Security & Reliability
- **JWT Authentication**: Secure token-based auth
- **Data Integrity**: SHA-256 checksums on snapshots
- **Audit Trail**: Complete transaction history
- **Graceful Shutdown**: Clean process termination
- **Error Recovery**: Automatic retry mechanisms

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd exchange
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cd packages/config
   cp .env.example .env  # Create this file with your configuration
   ```

   **Required environment variables in `packages/config/.env`:**
   ```bash
   # Redis Configuration
   REDIS_URL=redis://localhost:6379

   # Database Configuration
   PERSISTENT_DATABASE_URL=postgresql://postgres:password123@localhost:5432/exchange

   # JWT Secrets (Generate strong random strings)
   AUTH_JWT_SECRET=your-super-secret-auth-jwt-key-here-make-it-long-and-random
   EMAIL_JWT_SECRET=your-email-jwt-secret-here

   # Email Configuration (for user verification)
   GOOGLE_EMAIL=your-email@gmail.com
   GOOGLE_APP_PASSWORD=your-google-app-password

   # Backend Configuration
   BACKEND_URL=http://localhost:3005
   ```

4. **Start Docker services**
   ```bash
   # First time setup: Start PostgreSQL and Redis
   docker-compose up -d

   # If containers already exist, restart them
   docker-compose restart

   # Or if you need to recreate containers (removes old data)
   docker-compose down
   docker-compose up -d

   # Verify containers are running
   docker ps
   ```

5. **Set up database**
   ```bash
   cd apps/backend
   npx prisma migrate dev
   npx prisma generate
   ```

6. **Build and start the platform**
   ```bash
   cd ../..  # Back to root
   npm run dev
   ```

### 🐳 Docker Services

The platform uses two Docker containers:

**PostgreSQL Database:**
- **Image:** `postgres:15-alpine`
- **Port:** `5432`
- **Database:** `exchange`
- **User:** `postgres`
- **Password:** `password123`

**Redis Cache/Message Queue:**
- **Image:** `redis:7-alpine`
- **Port:** `6379`
- **Persistence:** Enabled with append-only file

### 🖥️ Running Services

After setup, you'll have:
- **Backend API:** `http://localhost:3005`
- **Frontend:** `http://localhost:3000` (when implemented)
- **Trading Engine:** Running with snapshotting
- **Price Poller:** Streaming real-time prices

### 🔧 Docker Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Clean up (removes volumes too)
docker-compose down -v
```

## 📋 API Documentation

### Authentication
```bash
POST /api/v1/auth/signup
POST /api/v1/auth/signin
GET /api/v1/auth/me
```

### Trading Operations
```bash
POST /api/v1/engine
```

#### Create Account
```json
{
  "command": "CREATE_ACCOUNT"
}
```

#### Get Balance
```json
{
  "command": "GET_BALANCE"
}
```

#### Get USD Balance
```json
{
  "command": "GET_USD_BALANCE"
}
```

#### Create Trade
```json
{
  "command": "CREATE_TRADE",
  "asset": "SOL_USDC",
  "direction": "LONG",
  "margin": 1000,
  "leverage": 50,
  "stopLossPrice": 230.50,
  "takeProfitPrice": 250.75
}
```

#### Close Trade
```json
{
  "command": "CLOSE_TRADE",
  "tradeId": "trade_123456789"
}
```

### Response Format
```json
{
  "success": true,
  "orderId": "uuid-v4",
  "engineResponse": {
    "status": "success",
    "data": { ... },
    "message": "Operation completed"
  },
  "latency": 15
}
```

## 🧪 Testing

### Manual Testing

1. **Start all services**
   ```bash
   npm run dev
   ```

2. **Create an account**
   ```bash
   curl -X POST http://localhost:3005/api/v1/engine \
     -H "Cookie: authToken=your-jwt-token" \
     -H "Content-Type: application/json" \
     -d '{"command": "CREATE_ACCOUNT"}'
   ```

3. **Create a trade**
   ```bash
   curl -X POST http://localhost:3005/api/v1/engine \
     -H "Cookie: authToken=your-jwt-token" \
     -H "Content-Type: application/json" \
     -d '{
       "command": "CREATE_TRADE",
       "asset": "SOL_USDC",
       "direction": "LONG",
       "margin": 1000,
       "leverage": 10
     }'
   ```

4. **Check balance**
   ```bash
   curl -X POST http://localhost:3005/api/v1/engine \
     -H "Cookie: authToken=your-jwt-token" \
     -H "Content-Type: application/json" \
     -d '{"command": "GET_BALANCE"}'
   ```

### Automated Testing
```bash
npm run test
```

## 📁 Project Structure

```
exchange/
├── apps/
│   ├── backend/           # Express API server
│   │   ├── src/
│   │   │   ├── middleware/    # Auth middleware
│   │   │   ├── routes/        # API routes
│   │   │   ├── services/      # Business logic
│   │   │   ├── utils/         # Utilities
│   │   │   └── index.ts       # Server entry point
│   │   └── prisma/            # Database schema & migrations
│   ├── engine/            # Trading engine
│   │   ├── src/
│   │   │   ├── memory/        # In-memory data structures
│   │   │   ├── listener/      # Redis stream listeners
│   │   │   ├── processor/     # Command processor
│   │   │   ├── snapshot/      # Snapshot system
│   │   │   └── index.ts       # Engine entry point
│   │   └── snapshots/         # Snapshot storage
│   ├── frontend/          # Next.js web app
│   └── poller/            # Price data poller
├── packages/
│   ├── redis/            # Redis utilities
│   ├── config/           # Shared configuration
│   └── typescript-config/# TypeScript configuration
├── docker/               # Docker configurations
├── docs/                 # Documentation
└── README.md            # This file
```

## 🔧 Configuration

### Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/exchange"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
AUTH_JWT_SECRET="your-secret-key"

# Engine
ENGINE_SNAPSHOT_INTERVAL=5000   # 5 seconds
ENGINE_MAX_SNAPSHOTS=10

# Price Poller
POLLER_ASSETS="BTC_USDC,ETH_USDC,SOL_USDC"
POLLER_UPDATE_INTERVAL=1000  # 1 second
```

## 🚀 Deployment

### Development with Docker
```bash
# Start database and Redis
docker-compose up -d

# Start all services in development
npm run dev

# View all running services
docker ps
npm run dev  # Shows which services are running
```

### Production with Docker
```bash
# Start all infrastructure
docker-compose up -d

# Build and start services
npm run build
npm run start
```

### Infrastructure Management
```bash
# Start database and Redis only
docker-compose up -d

# Stop infrastructure
docker-compose down

# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Clean up (removes volumes)
docker-compose down -v
```

### 🔧 Troubleshooting Docker Issues

**If containers already exist:**
```bash
# Restart existing containers
docker-compose restart

# Or recreate containers (keeps data)
docker-compose up -d --force-recreate

# Or remove and recreate (loses data)
docker-compose down
docker-compose up -d
```

**Check container status:**
```bash
# List all containers (running and stopped)
docker ps -a

# List only running containers
docker ps

# Remove specific container if needed
docker rm redis-exchange backend-exchange
```

**Common issues:**
- **Port conflicts**: Check if ports 5432 or 6379 are already in use
- **Container name conflicts**: Use `docker rm` to remove old containers
- **Volume issues**: Use `docker-compose down -v` to clean volumes

## 📊 Monitoring & Observability

### Built-in Monitoring
- **Snapshot Health**: Automatic snapshot creation every 5s
- **Recovery Status**: Logs recovery success/failure
- **Trade Processing**: Real-time trade execution metrics
- **Error Handling**: Comprehensive error logging

### Key Metrics to Monitor
- Snapshot creation success rate
- Recovery time
- Trade processing latency
- Redis stream lag
- Memory usage

## 🛠️ Development

### Adding New Features

1. **Database Changes**
   ```bash
   cd apps/backend
   npx prisma migrate dev --name your-feature
   npx prisma generate
   ```

2. **Engine Features**
   - Add to `apps/engine/src/memory/` for data structures
   - Add to `apps/engine/src/processor/` for command handling
   - Update snapshot system if new data needs persistence

3. **API Endpoints**
   - Add routes in `apps/backend/src/routes/`
   - Update TypeScript interfaces
   - Add validation and error handling

### Code Quality
- **TypeScript**: Strict type checking enabled
- **ESLint**: Code linting and formatting
- **Prettier**: Automatic code formatting
- **Jest**: Unit testing framework

### Performance Optimization
- **Memory Management**: In-memory data structures for speed
- **Redis Streams**: High-throughput message processing
- **Snapshot Compression**: Gzip compression for storage efficiency
- **Connection Pooling**: Efficient database connections

