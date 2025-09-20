# Trading Exchange Frontend

A modern, responsive trading interface built with Next.js 15, TypeScript, and Tailwind CSS.

## Features

### ✅ Completed Features

- **Authentication System**: Email-based login/signup with JWT cookies
- **Real-time Charts**: TradingView lightweight charts with multiple timeframes (1m, 5m, 15m, 1h, 4h, 1d)
- **Trading Interface**: Complete trade creation form with leverage, margin, stop loss, and take profit
- **Balance Display**: Real-time balance updates for all assets
- **Portfolio View**: Open positions display with P&L tracking
- **Responsive Design**: Dark theme optimized for trading
- **API Integration**: Full integration with backend engine and candles endpoints

### 🎯 Trading Features

- **Multiple Assets**: Support for BTC, ETH, SOL trading pairs
- **CFD Trading**: Leverage up to 100x
- **Risk Management**: Stop loss and take profit orders
- **Real-time Data**: Live price feeds and candle data
- **Order Management**: Create and close positions

## Tech Stack

- **Framework**: Next.js 15 with Turbopack
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: TradingView Lightweight Charts
- **State Management**: Zustand (prepared for future use)
- **HTTP Client**: Axios with cookie support
- **Notifications**: React Hot Toast

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   # Copy and edit config.ts or create environment variables
   cp config.ts config.local.ts
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Open browser**:
   ```
   http://localhost:3000
   ```

## Project Structure

```
apps/frontend/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout with providers
│   ├── page.tsx          # Main page with auth/trading dashboard
│   └── signin/           # Email verification page
├── components/            # React components
│   ├── TradingDashboard.tsx    # Main dashboard layout
│   ├── TradingChart.tsx        # TradingView chart component
│   ├── TradingPanel.tsx        # Trade creation form
│   ├── BalancePanel.tsx        # Balance display
│   └── PositionsPanel.tsx      # Open positions display
├── lib/                  # Utilities and services
│   ├── api.ts           # Backend API client
│   ├── auth-context.tsx # Authentication context
│   └── ...
├── types/               # TypeScript type definitions
├── config.ts           # Frontend configuration
└── README.md           # This file
```

## API Integration

The frontend integrates with the backend through the following endpoints:

- `POST /api/v1/engine` - Trading operations (CREATE_TRADE, GET_BALANCE, etc.)
- `GET /api/v1/candles` - Historical candle data
- `POST /api/v1/user/signup` - User registration
- `GET /api/v1/user/signin/post` - Email verification

## Configuration

Key configuration options in `config.ts`:

```typescript
export const config = {
  API_URL: 'http://localhost:3005/api/v1',
  SUPPORTED_ASSETS: ['BTC', 'ETH', 'SOL'],
  DEFAULT_LEVERAGE: 10,
  MAX_LEVERAGE: 1000,
  TV_CHART_HEIGHT: 600,
};
```

## Development

### Adding New Features

1. **New Components**: Add to `components/` directory
2. **API Methods**: Add to `lib/api.ts`
3. **Types**: Add to `types/index.ts`
4. **State**: Use Zustand stores in `lib/stores/`

### Code Quality

- TypeScript strict mode enabled
- ESLint configuration
- Prettier formatting
- Component composition over inheritance

## Future Enhancements

### Phase 6: Enhanced Portfolio
- Trade history with pagination
- Performance analytics
- P&L charts over time

### Phase 7: Real-time Features
- WebSocket price updates
- Live balance updates
- Order status notifications
- Real-time position updates

### Additional Features
- Advanced order types (limit, market)
- Portfolio rebalancing
- Risk management dashboard
- Mobile app companion