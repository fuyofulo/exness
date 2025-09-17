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
- PostgreSQL 14+
- Redis 7+
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
   cp .env.example .env
   # Edit .env with your database and Redis credentials
   ```

4. **Set up database**
   ```bash
   cd apps/backend
   npx prisma migrate dev
   npx prisma generate
   ```

5. **Build the project**
   ```bash
   npm run build
   ```

6. **Start all services**
   ```bash
   npm run dev
   ```

This will start:
- Backend API on `http://localhost:3005`
- Frontend on `http://localhost:3000`
- Trading Engine with snapshotting
- Price Poller for real-time data

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
ENGINE_SNAPSHOT_INTERVAL=15000  # 15 seconds
ENGINE_MAX_SNAPSHOTS=10

# Price Poller
POLLER_ASSETS="BTC_USDC,ETH_USDC,SOL_USDC"
POLLER_UPDATE_INTERVAL=1000  # 1 second
```

## 🚀 Deployment

### Development
```bash
npm run dev          # Start all services in development
npm run build        # Build all services
npm run start        # Start all services in production
```

### Production with PM2
```bash
npm install -g pm2
pm2 start ecosystem.config.js
```

### Docker Deployment
```bash
docker-compose up -d
```

## 📊 Monitoring & Observability

### Built-in Monitoring
- **Snapshot Health**: Automatic snapshot creation every 15s
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

