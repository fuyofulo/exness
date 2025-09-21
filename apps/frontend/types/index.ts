// Trading Platform Types

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
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

export interface User {
  email: string;
  userId?: number;
}

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
