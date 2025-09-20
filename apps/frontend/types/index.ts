// Trading Platform Types

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Asset {
  symbol: string;
  name: string;
  decimals: number;
}

export interface TradeRequest {
  command: 'CREATE_TRADE' | 'CLOSE_TRADE' | 'GET_BALANCE' | 'CREATE_ACCOUNT';
  asset?: string;
  direction?: 'LONG' | 'SHORT';
  margin?: number;
  leverage?: number;
  tradeId?: string;
  stopLossPrice?: number;
  takeProfitPrice?: number;
}

export interface TradeResponse {
  success: boolean;
  orderId: string;
  engineResponse: {
    status: 'success' | 'error';
    data?: any;
    message: string;
  };
  latency: number;
  error?: string;
}

export interface BalanceData {
  email: string;
  balances: Record<string, {
    balance: number;
    decimals: number;
  }>;
}

export interface TradePosition {
  tradeId: string;
  asset: string;
  direction: 'LONG' | 'SHORT';
  margin: number;
  leverage: number;
  entryPrice: number;
  liquidationPrice?: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  status: 'OPEN' | 'CLOSED' | 'LIQUIDATED';
  pnl: number;
}

export interface User {
  email: string;
  userId?: number;
}

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

export const ASSETS: Asset[] = [
  { symbol: 'SOL', name: 'Solana', decimals: 6 },
  { symbol: 'ETH', name: 'Ethereum', decimals: 6 },
  { symbol: 'BTC', name: 'Bitcoin', decimals: 6 },
];
