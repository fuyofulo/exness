# 🚀 Trading Exchange Platform

A high-performance, real-time trading exchange built with modern technologies, featuring CFD (Contract for Difference) trading with leverage, automated liquidation systems, and enterprise-grade reliability.

## 📖 Table of Contents

- [**📊 Overview**](#-overview)
- [**🏗️ Architecture**](#️-architecture)
  - [System Components](#system-components)
  - [Data Flow](#data-flow)
- [**🔄 Engine Architecture & Memory Management**](#-engine-architecture--memory-management)
  - [Redis Streams & Consumer Groups](#redis-streams--consumer-groups)
  - [Database Architecture](#-database-architecture)
  - [Complete Data Flow](#-complete-data-flow)
- [**🛠️ Tech Stack**](#️-tech-stack)
  - [Backend & Engine](#backend--engine)
  - [Frontend](#frontend)
  - [Infrastructure](#infrastructure)
- [**✨ Key Features**](#-key-features)
  - [Trading Features](#-trading-features)
  - [Risk Management](#️-risk-management)
  - [Performance](#-performance)
  - [Security & Reliability](#-security--reliability)
- [**⚡ Quick Start**](#-quick-start)
- [**📋 API Documentation**](#-api-documentation)
  - [Authentication Endpoints](#-authentication-endpoints)
  - [Public Endpoints](#-public-endpoints)
  - [Trading Endpoints](#-trading-endpoints)
  - [Response Format](#-response-format)
  - [Authentication](#-authentication)
  - [Rate Limiting & Performance](#-rate-limiting--performance)
- [**🧪 Testing**](#-testing)
- [**📁 Project Structure**](#-project-structure)
- [**🔧 Configuration**](#-configuration)
- [**🚀 Deployment**](#-deployment)
- [**📊 Monitoring & Observability**](#-monitoring--observability)
- [**🛠️ Development**](#️-development)

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

![System Architecture](./architecture.png)

### Data Flow

1. **Price Poller** → Streams real-time prices to Redis
2. **Trading Engine** → Processes trades, manages positions
3. **Backend API** → Handles user requests, authentication
4. **Database** → Persistent storage of trades and users
5. **Frontend** → User interface for trading

## 🔄 **Engine Architecture & Memory Management**

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

## ⚡ **Quick Start**

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- npm or yarn

### Installation & Setup

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

### 🔐 Authentication Endpoints

#### **User Signup**
```bash
POST /api/v1/user/signup
```

**Request Body:**
```json
{
  "email": "user123@gmail.com"
}
```

**Response:**
```json
{
  "message": "successfully sent email"
}
```

**Description:** Sends a verification email with a link. Click the link or use it in a GET request to complete signup.

#### **Complete Signup (via Email Link)**
```bash
GET /api/v1/user/signin/post?token=<jwt-token-from-email>
```

**Response:** Redirects to `http://localhost:3000` with auth cookie set.

**Description:** Validates the email token, creates user account in engine, stores user in database, and sets authentication cookie.


### 📊 Public Endpoints

#### **Get Asset Price**
```bash
GET /api/v1/price?asset=SOL_USDC
```

**Response:**
```json
{
  "asset": "SOL_USDC",
  "price": "236140000",
  "decimal": 6
}
```

**Supported Assets:** `SOL_USDC`, `ETH_USDC`, `BTC_USDC`

#### **Get Supported Assets**
```bash
GET /api/v1/supportedAssets
```

**Response:**
```json
[
  "SOL_USDC",
  "ETH_USDC",
  "BTC_USDC"
]
```

### 🎯 Trading Endpoints (Require Authentication)

**All trading endpoints require:** `Cookie: authToken=<jwt-token>`

```bash
POST /api/v1/engine
```

#### **Create Account**
```json
{
  "command": "CREATE_ACCOUNT"
}
```

**Response:**
```json
{
  "success": true,
  "orderId": "uuid-v4",
  "engineResponse": {
    "status": "success",
    "data": {
      "email": "user123@gmail.com",
      "initialUsdBalance": 5000,
      "assets": ["USD"]
    },
    "message": "account created successfully"
  },
  "latency": 5
}
```

#### **Get USD Balance**
```json
{
  "command": "GET_USD_BALANCE"
}
```

**Response:**
```json
{
  "success": true,
  "orderId": "uuid-v4",
  "engineResponse": {
    "status": "success",
    "data": {
      "email": "user123@gmail.com",
      "usdBalance": 5445.0095
    },
    "message": "USD balance retrieved successfully"
  },
  "latency": 5
}
```

#### **Get All Balances**
```json
{
  "command": "GET_BALANCE"
}
```

**Response:**
```json
{
  "success": true,
  "orderId": "uuid-v4",
  "engineResponse": {
    "status": "success",
    "data": {
      "email": "user123@gmail.com",
      "balances": {
        "USD": 5445.0095,
        "SOL_USDC": 0.392535
      }
    },
    "message": "Balance retrieved successfully"
  },
  "latency": 5
}
```

#### **Create Trade**
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

**Parameters:**
- `asset`: `"SOL_USDC" | "ETH_USDC" | "BTC_USDC"` (required)
- `direction`: `"LONG" | "SHORT"` (required)
- `margin`: `number > 0` (required - USD amount)
- `leverage`: `integer 10-1000` (optional, default: 10) **NOTE: Leverage is multiplied by 10, so 1x = 10, 5x = 50, 10x = 100**
- `stopLossPrice`: `number > 0` (optional - exact price level)
- `takeProfitPrice`: `number > 0` (optional - exact price level)

**Payload Examples:**

**Basic Spot Trade (1x leverage):**
```json
{
  "command": "CREATE_TRADE",
  "asset": "SOL_USDC",
  "direction": "LONG",
  "margin": 1000,
  "leverage": 10
}
```

**CFD Trade with 10x Leverage:**
```json
{
  "command": "CREATE_TRADE",
  "asset": "SOL_USDC",
  "direction": "LONG",
  "margin": 1000,
  "leverage": 100
}
```

**Trade with Stop Loss & Take Profit:**
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

**High Leverage CFD Trade (50x):**
```json
{
  "command": "CREATE_TRADE",
  "asset": "ETH_USDC",
  "direction": "SHORT",
  "margin": 5000,
  "leverage": 500
}
```

**Response Examples:**

**Basic Trade (1x leverage, no SL/TP):**
```json
{
  "success": true,
  "orderId": "uuid-v4",
  "engineResponse": {
    "status": "success",
    "data": {
      "email": "user123@gmail.com",
      "tradeId": "trade_1758117427013",
      "entryPrice": 235.95,
      "margin": 5000,
      "leverage": 1
    },
    "message": "Trade created successfully"
  },
  "latency": 5
}
```

**CFD Trade with Leverage:**
```json
{
  "success": true,
  "orderId": "uuid-v4",
  "engineResponse": {
    "status": "success",
    "data": {
      "email": "user123@gmail.com",
      "tradeId": "trade_1758117427013",
      "entryPrice": 235.95,
      "liquidationPrice": 238.3095,
      "margin": 5000,
      "leverage": 100
    },
    "message": "Trade created successfully"
  },
  "latency": 5
}
```

**Trade with Stop Loss & Take Profit:**
```json
{
  "success": true,
  "orderId": "uuid-v4",
  "engineResponse": {
    "status": "success",
    "data": {
      "email": "user123@gmail.com",
      "tradeId": "trade_1758099196941",
      "entryPrice": 236.17,
      "stopLossPrice": 236.11,
      "takeProfitPrice": 236.17,
      "margin": 500,
      "leverage": 1
    },
    "message": "Trade created successfully"
  },
  "latency": 8
}
```

#### **Close Trade**
```json
{
  "command": "CLOSE_TRADE",
  "tradeId": "trade_1758117427013"
}
```

**Parameters:**
- `tradeId`: `string` (required - trade ID from CREATE_TRADE response)

**Response:**
```json
{
  "success": true,
  "orderId": "uuid-v4",
  "engineResponse": {
    "status": "success",
    "data": {
      "email": "user123@gmail.com",
      "tradeId": "trade_1758117427013",
      "asset": "SOL_USDC",
      "marginReturned": 5000,
      "pnl": 445.0095,
      "totalReturn": 5445.0095,
      "closePrice": 235.74
    },
    "message": "Trade closed successfully"
  },
  "latency": 8
}
```

### 📋 Response Format

**Success Response:**
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

**Error Response:**
```json
{
  "success": false,
  "error": "Specific error message",
  "orderId": "uuid-v4",
  "engineResponse": {
    "status": "error",
    "data": null,
    "message": "Error details"
  },
  "latency": 5
}
```

### 🔑 Authentication

**Cookie-based Authentication:**
- All trading endpoints require `authToken` cookie
- Cookie is set automatically after signup/signin
- Token expires in 7 days

**Headers Example:**
```
Cookie: authToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### ⚡ Rate Limiting & Performance

- **Latency:** Typically 5-15ms for engine operations
- **Real-time:** Price updates every 1 second
- **Persistence:** All trades and orders logged to database
- **Recovery:** Automatic recovery from snapshots (< 5 seconds)

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

### 🚀 **In-Memory Trading Engine**

#### **Core Data Structures**
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

#### **Liquidation & Trigger System**
**Purpose:** O(1) lookups for automated trade closures

The engine uses **bitmap indexing** for ultra-fast trigger detection:

```typescript
// For each asset, maintain trigger price buckets
tradeTriggerBitmaps.set('SOL_USDC', {
  long: new Map([
    [20347000000, new Set([
      { tradeId: 'trade_123', triggerType: 'liquidation', triggerPrice: 20347000000n },
      { tradeId: 'trade_456', triggerType: 'stop_loss', triggerPrice: 20347000000n }
    ])]
  ]),
  short: new Map([
    [20123000000, new Set([
      { tradeId: 'trade_789', triggerType: 'take_profit', triggerPrice: 20123000000n }
    ])]
  ])
});
```

**Trigger Processing Flow:**
1. Price update arrives from poller
2. Engine checks bitmap for matching trigger prices
3. Executes trades instantly (liquidation, stop loss, take profit)
4. Updates balances and publishes events
5. Moves trade from `openTrades` to `closedTrades`

#### **File-Based Snapshots**
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

### 🔄 **Complete Engine Data Flow**

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

## 📁 **Project Structure**

```
exchange/
├── package.json                          # Monorepo root with turbo scripts
├── turbo.json                            # Turborepo build orchestration
├── pnpm-workspace.yaml                   # PNPM workspace configuration
├── pnpm-lock.yaml                        # PNPM lock file
├── docker-compose.yml                    # PostgreSQL + Redis infrastructure
├── init.sql                              # Optional database initialization
├── README.md                             # This file
├── apps/
│   ├── backend/                          # Express API server
│   │   ├── package.json                  # Backend dependencies & scripts
│   │   ├── tsconfig.json                 # TypeScript configuration
│   │   ├── tsconfig.tsbuildinfo          # TypeScript build cache
│   │   ├── prisma/                       # Database schema & migrations
│   │   │   ├── schema.prisma             # Database models & relations
│   │   │   └── generated/                # Prisma client (auto-generated)
│   │   └── src/
│   │       ├── index.ts                  # Express server setup & routes
│   │       ├── middleware.ts             # JWT authentication middleware
│   │       ├── types.ts                  # TypeScript interfaces & Zod schemas
│   │       ├── eventlistener.ts          # Redis event listener for liquidations
│   │       ├── routes/
│   │       │   ├── user.ts               # User signup/signin endpoints
│   │       │   └── engine.ts             # Trading engine API endpoints
│   │       └── utils/
│   │           ├── sendEmail.ts          # Email utility for verification
│   │           └── orderResponse.ts      # Redis response handler
│   ├── engine/                           # High-performance trading engine
│   │   ├── package.json                  # Engine dependencies & scripts
│   │   ├── tsconfig.json                 # TypeScript configuration
│   │   ├── tsconfig.tsbuildinfo          # TypeScript build cache
│   │   ├── snapshots/                    # File-based recovery snapshots
│   │   └── src/
│   │       ├── index.ts                  # Engine entry point & lifecycle
│   │       ├── listener/
│   │       │   ├── price.ts              # Redis price stream consumer
│   │       │   └── orders.ts             # Redis command stream consumer
│   │       ├── memory/
│   │       │   ├── balance.ts            # In-memory user balance management
│   │       │   ├── price.ts              # In-memory price cache
│   │       │   └── trades.ts             # In-memory trade & trigger management
│   │       ├── processor/
│   │       │   └── processor.ts          # Command processing logic
│   │       └── snapshot/
│   │           ├── SnapshotManager.ts    # Periodic snapshot creation
│   │           ├── RecoveryManager.ts    # Startup recovery from snapshots
│   │           ├── types.ts              # Snapshot data structures
│   │           └── utils.ts              # Serialization utilities
│   ├── frontend/                         # Next.js web application
│   │   ├── package.json                  # Frontend dependencies & scripts
│   │   ├── next.config.ts                # Next.js configuration
│   │   ├── next-env.d.ts                 # Next.js environment types
│   │   ├── postcss.config.mjs            # PostCSS configuration
│   │   ├── tsconfig.json                 # TypeScript configuration
│   │   ├── README.md                     # Frontend-specific documentation
│   │   ├── app/                          # Next.js app directory (pages & API routes)
│   │   └── public/                       # Static assets (images, fonts, etc.)
│   └── poller/                           # Real-time price poller
│       ├── package.json                  # Poller dependencies & scripts
│       ├── tsconfig.json                 # TypeScript configuration
│       ├── tsconfig.tsbuildinfo          # TypeScript build cache
│       └── src/
│           └── index.ts                  # WebSocket price streaming
├── packages/
│   ├── config/                           # Centralized configuration
│   │   ├── package.json                  # Config package definition
│   │   ├── tsconfig.json                 # TypeScript configuration
│   │   ├── tsconfig.tsbuildinfo          # TypeScript build cache
│   │   └── src/
│   │       └── index.ts                  # Environment variables export
│   └── typescript-config/                # Shared TypeScript presets
│       ├── package.json                  # TypeScript config package
│       ├── base.json                     # Base TypeScript configuration
│       ├── nextjs.json                   # Next.js specific config
│       └── react-library.json            # React library configuration
└── node_modules/                         # Root dependencies (turbo, etc.)
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

