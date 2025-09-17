import { promises as fs } from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { userBalances } from '../memory/balance';
import { openTrades, closedTrades, tradeTriggerBitmaps } from '../memory/trades';
import { priceCache } from '../memory/price';
import { EngineSnapshot, SnapshotData } from './types';
import {
  calculateChecksum,
  serializeUserBalance,
  serializeTrade,
  serializeTriggerBitmaps,
  generateMetadata
} from './utils';

const gzip = promisify(zlib.gzip);

export class SnapshotManager {
  private snapshotInterval: NodeJS.Timeout | undefined;
  private readonly SNAPSHOT_DIR = path.join(process.cwd(), 'snapshots');
  private readonly SNAPSHOT_VERSION = '1.0.0';
  private readonly SNAPSHOT_INTERVAL = 5000; // 5 seconds
  private readonly MAX_SNAPSHOTS = 10; // Keep last 10 snapshots

  /**
   * Initialize snapshot directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.SNAPSHOT_DIR, { recursive: true });
      console.log(`Snapshot directory initialized: ${this.SNAPSHOT_DIR}`);
    } catch (error) {
      console.error('Failed to initialize snapshot directory:', error);
      throw error;
    }
  }

  /**
   * Start periodic snapshot creation
   */
  start(): void {
    console.log(`Starting snapshot manager (interval: ${this.SNAPSHOT_INTERVAL / 1000}s)`);
    this.snapshotInterval = setInterval(() => {
      this.createSnapshot().catch(error => {
        console.error('Failed to create snapshot:', error);
      });
    }, this.SNAPSHOT_INTERVAL);
  }

  /**
   * Stop periodic snapshot creation
   */
  stop(): void {
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = undefined;
      console.log('Snapshot manager stopped');
    }
  }

  /**
   * Create a snapshot of current engine state
   */
  async createSnapshot(): Promise<void> {
    try {
      const snapshotData = this.gatherSnapshotData();
      const snapshot: EngineSnapshot = {
        version: this.SNAPSHOT_VERSION,
        timestamp: Date.now(),
        checksum: calculateChecksum(snapshotData),
        data: snapshotData
      };

      // Save to file
      await this.saveSnapshot(snapshot);

      // Update latest symlink
      await this.updateLatestSymlink(snapshot.timestamp);

      // Cleanup old snapshots
      await this.cleanupOldSnapshots();

      console.log(`Snapshot created (checksum: ${snapshot.checksum.substring(0, 8)}...)`);
    } catch (error) {
      console.error('Error creating snapshot:', error);
      throw error;
    }
  }

  /**
   * Gather all snapshot data from memory
   */
  private gatherSnapshotData(): SnapshotData {
    // Serialize user balances
    const serializedBalances = Array.from(userBalances.entries()).map(([email, userBalance]) =>
      serializeUserBalance(email, userBalance.balances)
    );

    // Serialize open trades
    const serializedOpenTrades = Array.from(openTrades.values()).map(trade =>
      serializeTrade(trade)
    );

    // Serialize closed trades
    const serializedClosedTrades = Array.from(closedTrades.values()).map(trade =>
      serializeTrade(trade)
    );

    // Serialize trigger bitmaps
    const serializedTriggerBitmaps = serializeTriggerBitmaps(tradeTriggerBitmaps);

    // Skip price cache - will be rebuilt from live stream on recovery
    const serializedPriceCache = {};

    // Generate metadata
    const metadata = generateMetadata(
      serializedBalances.length,
      serializedOpenTrades.length,
      serializedClosedTrades.length,
      this.countTriggers(serializedTriggerBitmaps)
    );

    return {
      userBalances: serializedBalances,
      openTrades: serializedOpenTrades,
      closedTrades: serializedClosedTrades,
      tradeTriggerBitmaps: serializedTriggerBitmaps,
      metadata
    };
  }

  /**
   * Count total triggers in serialized bitmaps
   */
  private countTriggers(bitmaps: any): number {
    let total = 0;
    for (const asset of Object.values(bitmaps) as any[]) {
      // Count long triggers
      for (const triggers of Object.values(asset.long)) {
        total += (triggers as any[]).length;
      }
      // Count short triggers
      for (const triggers of Object.values(asset.short)) {
        total += (triggers as any[]).length;
      }
    }
    return total;
  }

  /**
   * Save snapshot to compressed file
   */
  private async saveSnapshot(snapshot: EngineSnapshot): Promise<void> {
    const filename = `${snapshot.timestamp}.json.gz`;
    const filepath = path.join(this.SNAPSHOT_DIR, filename);

    const jsonData = JSON.stringify(snapshot, null, 2);
    const compressedData = await gzip(Buffer.from(jsonData));

    await fs.writeFile(filepath, compressedData);
  }

  /**
   * Update latest snapshot symlink
   */
  private async updateLatestSymlink(timestamp: number): Promise<void> {
    const latestPath = path.join(this.SNAPSHOT_DIR, 'latest.json.gz');
    const targetPath = `${timestamp}.json.gz`;

    try {
      // Remove existing symlink if it exists
      await fs.unlink(latestPath).catch(() => {});
      // Create new symlink
      await fs.symlink(targetPath, latestPath);
    } catch (error) {
      console.error('Failed to update latest symlink:', error);
    }
  }

  /**
   * Clean up old snapshots (keep last MAX_SNAPSHOTS)
   */
  private async cleanupOldSnapshots(): Promise<void> {
    try {
      const files = await fs.readdir(this.SNAPSHOT_DIR) as string[];
      const snapshotFiles = files
        .filter(file => file.endsWith('.json.gz') && file !== 'latest.json.gz')
        .map((file: string) => ({
          name: file,
          timestamp: parseInt(file.split('.')[0] || '0')
        }))
        .sort((a: {name: string, timestamp: number}, b: {name: string, timestamp: number}) => b.timestamp - a.timestamp);

      if (snapshotFiles.length > this.MAX_SNAPSHOTS) {
        const filesToDelete = snapshotFiles.slice(this.MAX_SNAPSHOTS);

        for (const file of filesToDelete as Array<{name: string, timestamp: number}>) {
          const filepath = path.join(this.SNAPSHOT_DIR, file.name);
          await fs.unlink(filepath);
        }

        console.log(`Cleaned up ${filesToDelete.length} old snapshots`);
      }
    } catch (error) {
      console.error('Failed to cleanup old snapshots:', error);
    }
  }

  /**
   * Force create a snapshot immediately
   */
  async forceSnapshot(): Promise<void> {
    console.log('Creating forced snapshot...');
    await this.createSnapshot();
  }

  /**
   * Get list of available snapshots
   */
  async listSnapshots(): Promise<Array<{timestamp: number, checksum: string, size: number}>> {
    try {
      const files = await fs.readdir(this.SNAPSHOT_DIR);
      const snapshots = [];

      for (const file of files as string[]) {
        if (file.endsWith('.json.gz') && file !== 'latest.json.gz') {
          const filepath = path.join(this.SNAPSHOT_DIR, file);
          const stats = await fs.stat(filepath);
          const timestamp = parseInt(file.split('.')[0] || '0');

          snapshots.push({
            timestamp,
            checksum: file.split('.')[0] || 'unknown', // We can enhance this later
            size: stats.size
          });
        }
      }

      return snapshots.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Failed to list snapshots:', error);
      return [];
    }
  }

  /**
   * Get current snapshot statistics
   */
  getStats(): {
    totalUsers: number;
    totalOpenTrades: number;
    totalClosedTrades: number;
    totalTriggers: number;
  } {
    const serializedTriggerBitmaps = serializeTriggerBitmaps(tradeTriggerBitmaps);

    return {
      totalUsers: userBalances.size,
      totalOpenTrades: openTrades.size,
      totalClosedTrades: closedTrades.size,
      totalTriggers: this.countTriggers(serializedTriggerBitmaps)
    };
  }
}
