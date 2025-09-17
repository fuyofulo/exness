import { promises as fs } from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { userBalances, createUserAccount } from '../memory/balance';
import { openTrades, closedTrades, tradeTriggerBitmaps, userTrades } from '../memory/trades';
import { priceCache } from '../memory/price';
import { EngineSnapshot, SerializedUserBalance, SerializedTrade, SerializedTriggerBitmaps } from './types';
import { validateSnapshot, stringToBigInt } from './utils';

const gunzip = promisify(zlib.gunzip);

export class RecoveryManager {
  private readonly SNAPSHOT_DIR = path.join(process.cwd(), 'snapshots');

  /**
   * Recover from the latest snapshot
   */
  async recoverFromLatestSnapshot(): Promise<boolean> {
    try {
      console.log('Attempting to recover from latest snapshot...');

      const latestPath = path.join(this.SNAPSHOT_DIR, 'latest.json.gz');

      // Check if latest snapshot exists
      try {
        await fs.access(latestPath);
      } catch (error) {
        console.log('No latest snapshot found, starting with clean state');
        return false;
      }

      // Read and parse snapshot
      const snapshot = await this.loadSnapshot(latestPath);

      // Validate snapshot
      if (!validateSnapshot(snapshot)) {
        console.error('Latest snapshot validation failed, trying previous snapshots...');
        return await this.tryPreviousSnapshots();
      }

      // Recover state
      await this.recoverState(snapshot.data);

      console.log(`Successfully recovered from snapshot (created: ${new Date(snapshot.timestamp).toISOString()})`);
      return true;
    } catch (error) {
      console.error('Failed to recover from latest snapshot:', error);
      return false;
    }
  }

  /**
   * Try to recover from previous snapshots if latest fails
   */
  private async tryPreviousSnapshots(): Promise<boolean> {
    try {
      const files = await fs.readdir(this.SNAPSHOT_DIR) as string[];
      const snapshotFiles = files
        .filter(file => file.endsWith('.json.gz') && file !== 'latest.json.gz')
        .map((file: string) => ({
          name: file,
          timestamp: parseInt(file.split('.')[0] || '0')
        }))
        .sort((a: {name: string, timestamp: number}, b: {name: string, timestamp: number}) => b.timestamp - a.timestamp)
        .slice(0, 3); // Try last 3 snapshots

      for (const file of snapshotFiles as Array<{name: string, timestamp: number}>) {
        try {
          const filepath = path.join(this.SNAPSHOT_DIR, file.name);
          const snapshot = await this.loadSnapshot(filepath);

          if (validateSnapshot(snapshot)) {
            await this.recoverState(snapshot.data);
            console.log(`Successfully recovered from backup snapshot: ${file.name}`);
            return true;
          }
        } catch (error) {
          console.error(`Failed to load backup snapshot ${file.name}:`, error);
        }
      }

      console.log('No valid backup snapshots found');
      return false;
    } catch (error) {
      console.error('Failed to try previous snapshots:', error);
      return false;
    }
  }

  /**
   * Load snapshot from file
   */
  private async loadSnapshot(filepath: string): Promise<EngineSnapshot> {
    const compressedData = await fs.readFile(filepath);
    const jsonData = await gunzip(compressedData);
    const snapshot = JSON.parse(jsonData.toString()) as EngineSnapshot;
    return snapshot;
  }

  /**
   * Recover engine state from snapshot data
   */
  private async recoverState(data: any): Promise<void> {
    try {
      // Recover balances
      await this.recoverBalances(data.userBalances);

      // Recover trades
      await this.recoverTrades(data.openTrades, data.closedTrades);

      // Recover trigger bitmaps
      await this.recoverTriggerBitmaps(data.tradeTriggerBitmaps);

      // Skip price cache recovery - will be rebuilt from live stream
      // Price cache is ephemeral and not critical state

      console.log(`Recovery completed - ${data.metadata.totalUsers} users, ${data.metadata.totalOpenTrades} open trades, ${data.metadata.totalClosedTrades} closed trades`);
    } catch (error) {
      console.error('Error recovering state:', error);
      throw error;
    }
  }

  /**
   * Recover user balances
   */
  private async recoverBalances(balances: SerializedUserBalance[]): Promise<void> {
    userBalances.clear();

    for (const userBalance of balances) {
      // Create user account (this initializes with default USD balance)
      const account = createUserAccount(userBalance.email);

      // Override with snapshot balances
      for (const [asset, balanceData] of Object.entries(userBalance.balances)) {
        account.balances[asset] = {
          balance: stringToBigInt(balanceData.balance),
          decimals: balanceData.decimals
        };
      }
    }

    console.log(`Recovered ${balances.length} user balances`);
  }

  /**
   * Recover trades
   */
  private async recoverTrades(openTradesData: SerializedTrade[], closedTradesData: SerializedTrade[]): Promise<void> {
    openTrades.clear();
    closedTrades.clear();
    userTrades.clear();

    // Recover open trades
    for (const tradeData of openTradesData) {
      const trade = this.deserializeTrade(tradeData);
      openTrades.set(trade.orderId, trade);

      // Rebuild user trades map
      if (!userTrades.has(trade.email)) {
        userTrades.set(trade.email, []);
      }
      userTrades.get(trade.email)!.push(trade.orderId);
    }

    // Recover closed trades
    for (const tradeData of closedTradesData) {
      const trade = this.deserializeTrade(tradeData);
      closedTrades.set(trade.orderId, trade);
    }

    console.log(`Recovered ${openTradesData.length} open trades, ${closedTradesData.length} closed trades`);
  }

  /**
   * Recover trigger bitmaps
   */
  private async recoverTriggerBitmaps(bitmaps: SerializedTriggerBitmaps): Promise<void> {
    tradeTriggerBitmaps.clear();

    for (const [asset, bitmapData] of Object.entries(bitmaps)) {
      tradeTriggerBitmaps.set(asset, {
        long: new Map(),
        short: new Map()
      });

      const assetBitmap = tradeTriggerBitmaps.get(asset)!;

      // Recover long triggers
      for (const [priceKeyStr, triggers] of Object.entries(bitmapData.long)) {
        const priceKey = parseInt(priceKeyStr);
        const triggerSet = new Set();

        for (const trigger of triggers) {
          triggerSet.add({
            tradeId: trigger.tradeId,
            triggerType: trigger.triggerType,
            triggerPrice: stringToBigInt(trigger.triggerPrice)
          });
        }

        assetBitmap.long.set(priceKey, triggerSet as Set<{
          tradeId: string;
          triggerType: 'liquidation' | 'stop_loss' | 'take_profit';
          triggerPrice: bigint;
        }>);
      }

      // Recover short triggers
      for (const [priceKeyStr, triggers] of Object.entries(bitmapData.short)) {
        const priceKey = parseInt(priceKeyStr);
        const triggerSet = new Set();

        for (const trigger of triggers) {
          triggerSet.add({
            tradeId: trigger.tradeId,
            triggerType: trigger.triggerType,
            triggerPrice: stringToBigInt(trigger.triggerPrice)
          });
        }

        assetBitmap.short.set(priceKey, triggerSet as Set<{
          tradeId: string;
          triggerType: 'liquidation' | 'stop_loss' | 'take_profit';
          triggerPrice: bigint;
        }>);
      }
    }

    console.log(`Recovered trigger bitmaps for ${Object.keys(bitmaps).length} assets`);
  }


  /**
   * Convert serialized trade back to Trade object
   */
  private deserializeTrade(tradeData: SerializedTrade): any {
    return {
      orderId: tradeData.tradeId,
      email: tradeData.email,
      asset: tradeData.asset,
      direction: tradeData.direction,
      margin: stringToBigInt(tradeData.margin),
      leverage: stringToBigInt(tradeData.leverage),
      entryPrice: stringToBigInt(tradeData.entryPrice),
      entryPriceDecimals: tradeData.entryPriceDecimals,
      liquidationPrice: tradeData.liquidationPrice ? stringToBigInt(tradeData.liquidationPrice) : undefined,
      liquidationPriceDecimals: tradeData.liquidationPriceDecimals,
      stopLossPrice: tradeData.stopLossPrice ? stringToBigInt(tradeData.stopLossPrice) : undefined,
      takeProfitPrice: tradeData.takeProfitPrice ? stringToBigInt(tradeData.takeProfitPrice) : undefined,
      triggerDecimals: tradeData.triggerDecimals,
      exitPrice: tradeData.exitPrice ? stringToBigInt(tradeData.exitPrice) : undefined,
      exitPriceDecimals: tradeData.exitPriceDecimals,
      pnl: stringToBigInt(tradeData.pnl),
      status: tradeData.status,
      timestamp: tradeData.timestamp,
      createdAt: tradeData.createdAt,
      closedAt: tradeData.closedAt
    };
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats(): {
    users: number;
    openTrades: number;
    closedTrades: number;
    triggerAssets: number;
  } {
    return {
      users: userBalances.size,
      openTrades: openTrades.size,
      closedTrades: closedTrades.size,
      triggerAssets: tradeTriggerBitmaps.size
    };
  }
}
