import { RedisClientType } from "redis";
import { setPrice } from '../memory/price';

const STREAM_NAME: string = 'engine_input';
const GROUP_NAME: string = 'engine_price_group';
const CONSUMER_NAME: string = 'engine_price_1';

export async function listenToPrice(rClient: RedisClientType) {
    try {
        await rClient.xGroupCreate(STREAM_NAME, GROUP_NAME, '0', { MKSTREAM: true });
    } catch (_) {
        // group already exists so chillax
    }

    console.log('engine is listening for price updates');

    while (true) {
        try {
            const messages = await rClient.xReadGroup(
                GROUP_NAME, 
                CONSUMER_NAME, 
                { key: STREAM_NAME, id: '>' }, 
                { COUNT: 10, BLOCK: 5000 }
            );

            if (messages) {
                for (const stream of messages as any) {
                    for (const message of stream.messages) {
                        const data = JSON.parse(message.message.data);
                        
                        if (Array.isArray(data)) {
                            // Update cache
                            for (const price of data) {
                                setPrice(price.asset, {
                                    asset: price.asset,
                                    price: BigInt(price.price),
                                    decimal: price.decimal
                                });
                            }
                            
                            // Batch Redis operations
                            const pipeline = rClient.multi();
                            for (const price of data) {
                                pipeline.setEx(`price:${price.asset}`, 15, JSON.stringify(price));
                            }
                            pipeline.xAck(STREAM_NAME, GROUP_NAME, message.id);
                            await pipeline.exec();
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