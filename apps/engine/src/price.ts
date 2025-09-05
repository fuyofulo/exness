import { RedisClientType } from "redis";

const STREAM_NAME: string = 'engine_input';
const GROUP_NAME: string = 'engine_group';
const CONSUMER_NAME: string = 'engine_1';

const ENGINE_RESPONSE = 'engine_response';

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
                        const source = message.message.source;

                        if(source === 'poller') {
                            if(Array.isArray(data)) {
                                for (const price of data) {
                                    priceCache.set(price.asset, price);
                                    await rClient.setEx(
                                        `price:${price.asset}`, 15, JSON.stringify(price)
                                    );
                                    // console.log(`upserted price for ${price.asset}`, price);
                                    await rClient.xAck(STREAM_NAME, GROUP_NAME, message.id);
                                }
                            }
                        } else if(source === 'backend') {
                            const { orderId, response_stream, tradeData } = data;
                            const parsedTradeData = JSON.parse(tradeData);
                            console.log(`Processing order ${orderId}`, parsedTradeData);
                            
                            try {
                                await rClient.xAck(STREAM_NAME, GROUP_NAME, message.id);
                                console.log(`Acknowledged message ${message.id}`);
                                
                                const responseData = {
                                    orderId: orderId,
                                    status: 'processed',
                                    data: JSON.stringify({
                                        orderId: orderId,
                                        status: 'processed',
                                        tradeData: parsedTradeData
                                    })
                                };
                                
                                console.log(`Sending response to engine_response stream:`, responseData);
                                const responseId = await rClient.xAdd(ENGINE_RESPONSE, '*', responseData);
                                console.log(`Response sent with ID: ${responseId}`);
                            } catch (error) {
                                console.error('Error processing backend order:', error);
                            }
                        } else {
                            console.log(`bull shit source ${source}`)
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