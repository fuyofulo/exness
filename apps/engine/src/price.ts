import { RedisClientType } from "redis";

const STREAM_NAME: string = 'engine_input';
const GROUP_NAME: string = 'engine_group';
const CONSUMER_NAME: string = 'engine_1';

// Interface for the latest price
export type LatestPrice = {
    asset: string;
    price: number;
    decimal: number;
}

const priceCache: Map<string, LatestPrice> = new Map();

export async function listenToPrice(rClient: RedisClientType) {
    // Create the consumer group
    try {
        await rClient.xGroupCreate(STREAM_NAME, GROUP_NAME, '0', { MKSTREAM: true });
    } catch (_) {
        // group already exists so chillax
    }

    console.log('engine is listening for price updates');

    // Process price updates from stream
    while (true) {
        try {
            const messages = await rClient.xReadGroup ( GROUP_NAME, CONSUMER_NAME, 
                {
                    key: STREAM_NAME,
                    id: '>'
                }, 
                {
                    COUNT: 10,
                    BLOCK: 5000
                }
            )            
            
            // Check if messages is not null before iterating
            if (messages) {
                for (const stream of messages as any) {
                    for (const message of stream.messages) {
                        const data = JSON.parse(message.message.data);
                        if(Array.isArray(data)) {
                            for (const price of data) {
                                priceCache.set(price.asset, price);
                                await rClient.setEx(
                                    `price:${price.asset}`, 15, JSON.stringify(price)
                                );
                                console.log(`upserted price for ${price.asset}`, price);
                            }
                            await rClient.xAck(STREAM_NAME, GROUP_NAME, message.id);
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Price processing error:', err);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}