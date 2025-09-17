export interface EngineSnapshot {
  version: string;
  timestamp: number;
  checksum: string;
  data: SnapshotData;
}

export interface SnapshotData {
  // Critical - User financial data
  userBalances: SerializedUserBalance[];

  // Critical - Active trading positions
  openTrades: SerializedTrade[];

  // Historical - Closed trades (for reference/completeness)
  closedTrades: SerializedTrade[];

  // Critical - Trigger system for automated closures
  tradeTriggerBitmaps: SerializedTriggerBitmaps;

  // Skip price cache - rebuilt from live stream on recovery

  // Metadata
  metadata: SnapshotMetadata;
}

export interface SerializedUserBalance {
  email: string;
  balances: Record<string, {
    balance: string;  // BigInt as string
    decimals: number;
  }>;
}

export interface SerializedTrade {
  tradeId: string;
  email: string;
  asset: string;
  direction: 'LONG' | 'SHORT';
  margin: string;        // BigInt as string
  leverage: string;      // BigInt as string
  entryPrice: string;    // BigInt as string
  entryPriceDecimals: number;
  liquidationPrice: string | null;
  liquidationPriceDecimals: number | null;
  stopLossPrice: string | null;
  takeProfitPrice: string | null;
  triggerDecimals: number | null;
  exitPrice: string | null;
  exitPriceDecimals: number | null;
  pnl: string;
  status: string;
  timestamp: number;
  createdAt: number;
  closedAt: number | null;
}

export interface SerializedTriggerBitmaps {
  [asset: string]: {
    long: {
      [priceKey: number]: Array<{
        tradeId: string;
        triggerType: 'liquidation' | 'stop_loss' | 'take_profit';
        triggerPrice: string; // BigInt as string
      }>;
    };
    short: {
      [priceKey: number]: Array<{
        tradeId: string;
        triggerType: 'liquidation' | 'stop_loss' | 'take_profit';
        triggerPrice: string; // BigInt as string
      }>;
    };
  };
}


export interface SnapshotMetadata {
  version: string;
  timestamp: number;
  totalUsers: number;
  totalOpenTrades: number;
  totalClosedTrades: number;
  totalTriggers: number;
  engineVersion: string;
}
