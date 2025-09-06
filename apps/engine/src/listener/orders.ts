import { RedisClientType } from "redis";

const STREAM_NAME: string = 'backend-to-engine';
const GROUP_NAME: string = 'engine_orders_group';
const CONSUMER_NAME: string = 'engine_2';

const ENGINE_RESPONSE = 'engine_response';

export async function listenToOrders(rClient: RedisClientType) {
    
    try {
        await rClient.xGroupCreate(STREAM_NAME, GROUP_NAME, '0', { MKSTREAM: true });
    } catch {
        // group already exists so chillax
    }

    console.log('engine is listening for orders');

    while(true) {
        try {
            const orders = await rClient.xReadGroup(GROUP_NAME, CONSUMER_NAME, { key: STREAM_NAME, id: '>' }, { COUNT: 10, BLOCK: 5000 });

            if(orders) {
               for (const stream of orders as any) {
                for (const message of stream.messages) {
                    try {
                        const orderId = message.message.orderId;
                        const tradeData = JSON.parse(message.message.tradeData);

                        console.log(`procesing order ${orderId}`, tradeData);

                        // send order for processing

                        await rClient.xAck(STREAM_NAME, GROUP_NAME, message.id);
                        console.log(`Acknowledged message ${message.id}`);

                        const responseData = {
                            orderId: orderId,
                            status: 'processed',
                            executionPrice: '100',
                            timestamp: Date.now().toString()
                        };

                        console.log(`Sending response to engine_response stream:`, responseData);
                        const responseId = await rClient.xAdd(ENGINE_RESPONSE, '*', responseData as any);
                        console.log(`Response sent with ID: ${responseId}`);

                    } catch (error) {
                        console.error('Error processing backend order:', error);
                    }
                }
            }
        }

        } catch {

        }
    }



}