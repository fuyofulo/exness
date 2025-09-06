import router from 'express';
const app = router();
import { v4 as uuidv4 } from "uuid";
import { createClient } from 'redis';
import { RedisSuscriber } from '../utils/orderResponse';
import { string } from 'zod';

// Create a singleton subscriber instance
const subscriber = new RedisSuscriber();

interface CreateOrder {
    asset: string;
    direction: 'LONG' | 'SHORT';
    command: string,
    margin: number;
    leverage: number;
    slippage: number;
}

const STREAM_NAME: string = 'backend-to-engine';
const SOURCE: string = 'backend';


app.post('/create', async (req, res) => {
    const startTime = Date.now();
    console.log('create order endpoint has been hit');

    try {
        const email = "hello123@gmail.com";
        const tradeData: CreateOrder = req.body;
        const orderId = uuidv4();

        const rClient = createClient();
        await rClient.connect();

        const messageID = await rClient.xAdd(STREAM_NAME, '*', {
            orderId: orderId,
            command: tradeData.command,  // Add command field
            email: email,  // Add userId field
            tradeData: JSON.stringify(tradeData),
            timestamp: Date.now().toString()
        });

        console.log(`order send to engine ${messageID}`);

        console.log(`waiting for response from engine ${orderId}`);
        const responseFromEngine = await subscriber.waitForMessage(orderId);
        console.log(`response from engine ${responseFromEngine}`);

        const endTime = Date.now();
        const latency = endTime - startTime;

        // Send the engine's response back to the user
        res.json({
            success: true,
            orderId: orderId,
            engineResponse: responseFromEngine,
            latency: latency
        });

    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
});

app.post('/close', async (req, res) => {

})

export const tradeRouter = app;