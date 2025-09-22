import { createClient, RedisClientType } from "redis";

export const ENGINE_RESPONSE = "engine_response";
export class RedisSuscriber {
    private client: RedisClientType;
    private callbacks: Record<string, any>;

    constructor() {
        this.client = createClient({
            url: "redis://redis:6379"
        });
        this.client.connect();
        this.callbacks = {};
    }

    async runloop() {
        // Create consumer group for engine responses
        try {
            await this.client.xGroupCreate(ENGINE_RESPONSE, 'backend_group', '0', { MKSTREAM: true });
        } catch (_) {
            // Group already exists
        }
        
        // Only run when there are callbacks waiting
        while (Object.keys(this.callbacks).length > 0) {
            try {
                const response = await this.client.xReadGroup('backend_group', 'backend_consumer', {
                    key: ENGINE_RESPONSE,
                    id: '>'
                }, 
                {
                    COUNT: 1,
                    BLOCK: 0
                })

                if(!response) {
                    continue;
                }
                
                // Process the response and call the appropriate callback
                for (const stream of response) {
                    for (const message of stream.messages) {
                        const orderId = message.message.orderId;
                        const status = message.message.status;
                        const data = message.message.data;
                        const msg = message.message.message;

                        if (orderId && this.callbacks[orderId]) {
                            console.log(`Found callback for orderId: ${orderId}`);

                            let parsedData = null;
                            if (data) {
                                try {
                                    parsedData = JSON.parse(data);
                                } catch (parseError) {
                                    console.error(`Failed to parse data for ${orderId}:`, parseError);
                                    parsedData = null;
                                }
                            }

                            const responseData = {
                                orderId: orderId,
                                status: status,
                                data: parsedData,
                                message: msg // Include the message field
                            };
                            this.callbacks[orderId](responseData);
                            delete this.callbacks[orderId]; // Clean up
                        }
                        
                        // Acknowledge the message
                        try {
                            console.log(`Acknowledging message ${message.id}`);
                            await this.client.xAck(ENGINE_RESPONSE, 'backend_group', message.id);
                            console.log(`Successfully acknowledged message ${message.id}`);
                        } catch (ackError: any) {
                            console.error('Error acknowledging message:', ackError?.message || ackError);
                            console.error('Message ID:', message.id);
                            console.error('Ack error stack:', ackError?.stack);
                            // Don't throw - just log the error to prevent backend crash
                        }
                    }
                }
            } catch (error: any) {
                console.error('Error in RedisSuscriber runloop:', error?.message || error);
                console.error('Runloop error stack:', error?.stack);
                // Continue the loop instead of crashing
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    waitForMessage(callbackId: string) {
        return new Promise((resolve, reject) => {
            this.callbacks[callbackId] = resolve;
            
            // Start the runloop if it's not already running
            if (Object.keys(this.callbacks).length === 1) {
                this.runloop().catch(console.error);
            }
            
            setTimeout(() => {
                if (this.callbacks[callbackId]) {
                    delete this.callbacks[callbackId];
                    reject(new Error(`Timeout waiting for engine response for orderId: ${callbackId}`));
                }
            }, 5000);
        })
    }
}