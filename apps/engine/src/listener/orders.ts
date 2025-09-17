import { RedisClientType } from "redis";
import { processCommand } from "../processor/processor";

const STREAM_NAME: string = 'backend-to-engine';
const GROUP_NAME: string = 'engine_orders_group';
const CONSUMER_NAME: string = 'engine_2';

const ENGINE_RESPONSE = 'engine_response';

export async function listenToOrders(rClient: RedisClientType) {
    console.log('engine is listening for orders');

    // Reset consumer group to start fresh
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

    while(true) {
        try {
            const orders = await rClient.xReadGroup(GROUP_NAME, CONSUMER_NAME, { key: STREAM_NAME, id: '>' }, { COUNT: 10, BLOCK: 5000 });

            if(orders) {
               for (const stream of orders as any) {
                for (const message of stream.messages) {
                    const orderId = message.message.orderId;
                    const email = message.message.email;
                    const command = message.message.command;

                    let data;
                    try {
                        data = JSON.parse(message.message.tradeData);
                    } catch (parseError) {
                        console.error(`Failed to parse tradeData for order ${orderId}:`, parseError);
                        continue; // Skip this message
                    }

                    try {

                        console.log(`procesing order ${orderId}`, data);

                        const result = await processCommand({
                            command,
                            email,
                            data
                        }, rClient)

                        try {
                            await rClient.xAck(STREAM_NAME, GROUP_NAME, message.id);
                            console.log(`Acknowledged message ${message.id}`);
                        } catch (ackError) {
                            console.error('Error acknowledging message:', ackError);
                        }

                        const responseData = {
                            orderId: orderId,
                            status: result.status,
                            data: result.data ? JSON.stringify(result.data) : 'null',
                            message: result.message,
                            timestamp: Date.now().toString()
                        };

                        console.log(`Sending response to engine_response stream:`, responseData);
                        console.log(`Response details - status: ${result.status}, message: ${result.message}`);

                        // Ensure all values are strings for Redis
                        const redisData: Record<string, string> = {};
                        for (const [key, value] of Object.entries(responseData)) {
                            redisData[key] = String(value);
                        }

                        try {
                            const responseId = await rClient.xAdd(ENGINE_RESPONSE, '*', redisData);
                            console.log(`Response sent with ID: ${responseId}`);
                        } catch (sendError) {
                            console.error('Error sending response to Redis:', sendError);
                            throw sendError; // Re-throw to trigger the outer catch
                        }

                    } catch (error: any) {
                        console.error('Error processing backend order:', error?.message || error);
                        console.error('Order details:', { orderId, command, email });
                        // Continue processing other messages
                    }
                }
            }
        }

        } catch (error: any) {
            console.error('Critical error in orders listener:', error?.message || error);
            // Restart the listener after a delay
            setTimeout(() => {
                console.log('Restarting orders listener...');
                listenToOrders(rClient);
            }, 5000);
        }
    }



}