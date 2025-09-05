import { createClient, RedisClientType } from "redis";

export const ENGINE_RESPONSE = "engine_response";
export class RedisSuscriber {
    private client: RedisClientType;
    private callbacks: Record<string, any>;

    constructor() {
        this.client = createClient();
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
                        
                        if (orderId && this.callbacks[orderId]) {
                            console.log(`Found callback for orderId: ${orderId}`);
                            const responseData = {
                                orderId: orderId,
                                status: status,
                                data: data ? JSON.parse(data) : null
                            };
                            this.callbacks[orderId](responseData);
                            delete this.callbacks[orderId]; // Clean up
                        }
                        
                        // Acknowledge the message
                        await this.client.xAck(ENGINE_RESPONSE, 'backend_group', message.id);
                    }
                }
            } catch (error) {
                console.error('Error in RedisSuscriber runloop:', error);
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
                    reject()
                }
            }, 5000)
        })
    }
}