import { createHash } from 'crypto';
import { EngineSnapshot, SerializedUserBalance, SerializedTrade, SerializedTriggerBitmaps, SnapshotMetadata } from './types';

/**
 * Calculate SHA-256 checksum for snapshot integrity
 */
export function calculateChecksum(data: any): string {
  const jsonString = JSON.stringify(data, Object.keys(data).sort());
  return createHash('sha256').update(jsonString).digest('hex');
}

/**
 * Convert BigInt to string for JSON serialization
 */
export function bigIntToString(value: bigint | number): string {
  return BigInt(value).toString();
}

/**
 * Convert string back to BigInt for deserialization
 */
export function stringToBigInt(value: string): bigint {
  return BigInt(value);
}

/**
 * Serialize user balance for snapshot
 */
export function serializeUserBalance(email: string, balances: Record<string, { balance: bigint; decimals: number }>): SerializedUserBalance {
  const serializedBalances: Record<string, { balance: string; decimals: number }> = {};

  for (const [asset, balanceData] of Object.entries(balances)) {
    serializedBalances[asset] = {
      balance: bigIntToString(balanceData.balance),
      decimals: balanceData.decimals
    };
  }

  return {
    email,
    balances: serializedBalances
  };
}

/**
 * Serialize trade for snapshot
 */
export function serializeTrade(trade: any): SerializedTrade {
  return {
    tradeId: trade.orderId,
    email: trade.email,
    asset: trade.asset,
    direction: trade.direction,
    margin: bigIntToString(trade.margin),
    leverage: bigIntToString(trade.leverage),
    entryPrice: bigIntToString(trade.entryPrice),
    entryPriceDecimals: trade.entryPriceDecimals,
    liquidationPrice: trade.liquidationPrice ? bigIntToString(trade.liquidationPrice) : null,
    liquidationPriceDecimals: trade.liquidationPriceDecimals || null,
    stopLossPrice: trade.stopLossPrice ? bigIntToString(trade.stopLossPrice) : null,
    takeProfitPrice: trade.takeProfitPrice ? bigIntToString(trade.takeProfitPrice) : null,
    triggerDecimals: trade.triggerDecimals || null,
    exitPrice: trade.exitPrice ? bigIntToString(trade.exitPrice) : null,
    exitPriceDecimals: trade.exitPriceDecimals || null,
    pnl: bigIntToString(trade.pnl),
    status: trade.status,
    timestamp: trade.timestamp,
    createdAt: trade.createdAt || trade.timestamp,
    closedAt: trade.closedAt || null
  };
}

/**
 * Serialize trigger bitmaps for snapshot
 */
export function serializeTriggerBitmaps(triggerBitmaps: Map<string, any>): SerializedTriggerBitmaps {
  const serialized: SerializedTriggerBitmaps = {};

  for (const [asset, bitmap] of triggerBitmaps.entries()) {
    serialized[asset] = {
      long: {},
      short: {}
    };

    // Serialize long triggers
    for (const [priceKey, triggerSet] of bitmap.long.entries()) {
      const triggers = Array.from(triggerSet as Set<{
        tradeId: string;
        triggerType: 'liquidation' | 'stop_loss' | 'take_profit';
        triggerPrice: bigint;
      }>);
      serialized[asset].long[priceKey] = triggers.map(trigger => ({
        tradeId: trigger.tradeId,
        triggerType: trigger.triggerType,
        triggerPrice: bigIntToString(trigger.triggerPrice)
      }));
    }

    // Serialize short triggers
    for (const [priceKey, triggerSet] of bitmap.short.entries()) {
      const triggers = Array.from(triggerSet as Set<{
        tradeId: string;
        triggerType: 'liquidation' | 'stop_loss' | 'take_profit';
        triggerPrice: bigint;
      }>);
      serialized[asset].short[priceKey] = triggers.map(trigger => ({
        tradeId: trigger.tradeId,
        triggerType: trigger.triggerType,
        triggerPrice: bigIntToString(trigger.triggerPrice)
      }));
    }
  }

  return serialized;
}


/**
 * Generate snapshot metadata
 */
export function generateMetadata(
  totalUsers: number,
  totalOpenTrades: number,
  totalClosedTrades: number,
  totalTriggers: number
): SnapshotMetadata {
  return {
    version: '1.0.0',
    timestamp: Date.now(),
    totalUsers,
    totalOpenTrades,
    totalClosedTrades,
    totalTriggers,
    engineVersion: process.env.npm_package_version || '1.0.0'
  };
}

/**
 * Validate snapshot integrity
 */
export function validateSnapshot(snapshot: EngineSnapshot): boolean {
  try {
    // Check required fields
    if (!snapshot.version || !snapshot.checksum || !snapshot.data || !snapshot.timestamp) {
      console.error('Snapshot missing required fields');
      return false;
    }

    // Check version compatibility
    if (snapshot.version !== '1.0.0') {
      console.error(`Incompatible snapshot version: ${snapshot.version}`);
      return false;
    }

    // Validate checksum
    const calculatedChecksum = calculateChecksum(snapshot.data);
    if (calculatedChecksum !== snapshot.checksum) {
      console.error('Snapshot checksum mismatch');
      return false;
    }

    // Check timestamp is reasonable (not in future, not too old)
    const now = Date.now();
    const snapshotAge = now - snapshot.timestamp;
    if (snapshot.timestamp > now + 60000) { // 1 minute in future
      console.error('Snapshot timestamp is in the future');
      return false;
    }
    if (snapshotAge > 24 * 60 * 60 * 1000) { // 24 hours old
      console.error('Snapshot is too old (>24 hours)');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error validating snapshot:', error);
    return false;
  }
}
