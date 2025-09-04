import { connectRedis, upsertLatestPrice, readFromStream, createConsumerGroup, ackMessage } from '@repo/redis';

export type LatestPrice = {
    asset: string;
    price: number;
    decimal: number;
}

// In-memory price cache
const priceCache = new Map<string, LatestPrice>();

async function main() {
    await connectRedis();
    
    // Initialize consumer group
    await createConsumerGroup('price_updates', 'engine');
    
    console.log('Engine started, listening for price updates...');
    
    // Process price updates from stream
    while (true) {
        try {
            const messages = await readFromStream('price_updates', 'engine', 'engine-worker');
            
            for (const stream of messages) {
                for (const message of stream.messages) {
                    const data = JSON.parse(message.message.data);
                    
                    // Update price cache
                    for (const price of data) {
                        priceCache.set(price.asset, price);
                        await upsertLatestPrice(price as LatestPrice);
                        console.log(`upserted price for ${price.asset}`, price);
                    }
                    
                    // Acknowledge message processing
                    await ackMessage('price_updates', 'engine', message.id);
                }
            }
        } catch (err) {
            console.error('Price processing error:', err);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

main();
