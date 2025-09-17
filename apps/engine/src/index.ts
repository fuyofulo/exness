import { createClient } from 'redis';
import { listenToPrice } from './listener/price';
import { listenToOrders } from './listener/orders';
import { RedisClientType } from 'redis';
import { SnapshotManager } from './snapshot/SnapshotManager';
import { RecoveryManager } from './snapshot/RecoveryManager';

async function main() {
    const rClient = createClient();
    await rClient.connect();

    // Initialize snapshot and recovery managers
    const snapshotManager = new SnapshotManager();
    const recoveryManager = new RecoveryManager();

    try {
        // Initialize snapshot directory
        await snapshotManager.initialize();

        // Try to recover from latest snapshot
        const recovered = await recoveryManager.recoverFromLatestSnapshot();
        if (recovered) {
            console.log('✅ Recovered from snapshot');
        } else {
            console.log('🆕 Starting with clean state');
        }

        // Start periodic snapshotting BEFORE listeners
        snapshotManager.start();
        console.log(`Snapshot manager started - will snapshot every ${5000 / 1000} seconds`);

        // Start listeners (these run indefinitely)
        await Promise.all([
            listenToPrice(rClient as RedisClientType),
            listenToOrders(rClient as RedisClientType)
        ]);

        console.log('Engine started successfully with snapshotting enabled');

        // Graceful shutdown handling
        process.on('SIGINT', async () => {
            console.log('\nShutting down engine...');
            snapshotManager.stop();
            await rClient.quit();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            console.log('\nShutting down engine...');
            snapshotManager.stop();
            await rClient.quit();
            process.exit(0);
        });

    } catch (error) {
        console.error('Failed to start engine:', error);
        snapshotManager.stop();
        await rClient.quit();
        process.exit(1);
    }
}

main();
