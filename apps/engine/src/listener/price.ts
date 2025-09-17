import { RedisClientType } from "redis";
import { setPrice } from '../memory/price';
import { checkTradeTriggers, closeTradeWithReason } from '../memory/trades';
import { userBalances } from '../memory/balance';

const ENGINE_EVENTS = "engine_events";

const STREAM_NAME: string = 'engine_input';
const GROUP_NAME: string = 'engine_price_group';
const CONSUMER_NAME: string = 'engine_price_1';

export async function listenToPrice(rClient: RedisClientType) {
    console.log('engine is listening for price updates');

    // Reset consumer group to start fresh and avoid old messages
    try {
        await rClient.xGroupDestroy(STREAM_NAME, GROUP_NAME);
        console.log(`Destroyed old consumer group: ${GROUP_NAME}`);
    } catch (err) {
        // Group might not exist, that's fine
    }

    // Create fresh consumer group starting from latest messages
    try {
        await rClient.xGroupCreate(STREAM_NAME, GROUP_NAME, '$', { MKSTREAM: true });
        console.log(`Created fresh consumer group: ${GROUP_NAME} starting from latest`);
    } catch (err) {
        // Group might already exist
    }

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
                        // Handle new format where data is stored as separate fields
                        const messageData = message.message;
                        const count = parseInt(messageData.count || '0');

                        let data: any[] = [];

                        if (count > 0) {
                            // New format: data stored as separate fields
                            for (let i = 0; i < count; i++) {
                                data.push({
                                    asset: messageData[`asset_${i}`],
                                    price: messageData[`price_${i}`],
                                    decimal: parseInt(messageData[`decimal_${i}`] || '6')
                                });
                            }
                        } else if (messageData.data) {
                            // Handle data based on format
                            if (messageData.format === 'base64_v1') {
                                // Decode base64 data (new format)
                                const decodedJson = Buffer.from(messageData.data, 'base64').toString('utf8');
                                data = JSON.parse(decodedJson);
                            } else {
                                // Skip old/unformatted messages
                                data = [];
                            }
                        }

                        if (Array.isArray(data)) {
                            // Update cache and check for liquidations
                            let processedCount = 0;
                            for (const price of data) {
                                const priceUpdate = {
                                    asset: price.asset,
                                    price: BigInt(price.price),
                                    decimal: price.decimal
                                };


                                // Update price cache
                                setPrice(price.asset, priceUpdate);

                                // Check for all trigger types on this asset (liquidation, stop loss, take profit)
                                const triggeredTrades = checkTradeTriggers(
                                    price.asset,
                                    priceUpdate.price,
                                    priceUpdate.decimal
                                );

                                // Handle triggered trades - return margin + add PnL to user balances
                                for (const triggeredTrade of triggeredTrades) {
                                    const userBalance = userBalances.get(triggeredTrade.email);
                                    if (userBalance) {
                                        const usdBalance = userBalance.balances['USD'];
                                        if (usdBalance) {
                                            usdBalance.balance += triggeredTrade.margin; // Return margin
                                            usdBalance.balance += triggeredTrade.pnl;   // Add PnL
                                        }
                                    }

                                    // Publish appropriate event based on trigger type
                                    const eventType = triggeredTrade.status === 'LIQUIDATED' ? 'TRADE_LIQUIDATED' :
                                                     triggeredTrade.status === 'STOP_LOSS' ? 'TRADE_STOP_LOSS' :
                                                     triggeredTrade.status === 'TAKE_PROFIT' ? 'TRADE_TAKE_PROFIT' : 'TRADE_CLOSED';

                                    try {
                                        await rClient.xAdd(ENGINE_EVENTS, '*', {
                                            eventType: eventType,
                                            tradeId: triggeredTrade.orderId,
                                            email: triggeredTrade.email,
                                            asset: triggeredTrade.asset,
                                            pnl: (Number(triggeredTrade.pnl) / 10000).toString(),
                                            marginReturned: (Number(triggeredTrade.margin) / 10000).toString(),
                                            closePrice: (Number(priceUpdate.price) / Math.pow(10, priceUpdate.decimal)).toFixed(priceUpdate.decimal),
                                            triggerType: triggeredTrade.status,
                                            timestamp: Date.now().toString()
                                        });
                                        console.log(`Published ${eventType} event for trade ${triggeredTrade.orderId}`);
                                    } catch (publishError) {
                                        console.error(`Failed to publish ${eventType} event for ${triggeredTrade.orderId}:`, publishError);
                                    }

                                    console.log(`${triggeredTrade.status} trade ${triggeredTrade.orderId} for user ${triggeredTrade.email}, PnL: ${triggeredTrade.pnl}`);
                                }

                                if (triggeredTrades.length > 0) {
                                    console.log(`Processed ${triggeredTrades.length} triggered trades for ${price.asset}`);
                                }

                                processedCount++;
                            }

                            // Batch Redis operations (only if we have data to cache)
                            if (data.length > 0) {
                                const pipeline = rClient.multi();
                                for (const price of data) {
                                    pipeline.setEx(`price:${price.asset}`, 15, JSON.stringify(price));
                                }
                                pipeline.xAck(STREAM_NAME, GROUP_NAME, message.id);
                                await pipeline.exec();
                            } else {
                                // Just acknowledge the message if no data to process
                                await rClient.xAck(STREAM_NAME, GROUP_NAME, message.id);
                            }
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