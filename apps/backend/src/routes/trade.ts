import router from 'express';
const app = router();
import { v4 as uuidv4 } from "uuid";
import { createSpotOrderSchema, createCfdOrderSchema } from '../types';
import { createClient } from 'redis';
import { RedisSuscriber } from '../utils/orderResponse';

// Create a singleton subscriber instance
const subscriber = new RedisSuscriber();

interface CreateOrder {
    asset: string;
    direction: 'LONG' | 'SHORT';
    margin: number;
    leverage: number;
    slippage: number;
}

const STREAM_NAME: string = 'engine_input';
const SOURCE: string = 'backend';


app.post('/create', async (req, res) => {
    const startTime = Date.now();
    console.log('create order endpoint has been hit');

    try {
        // const email = req.body.email;
        // if(!email) {
        //     res.status(404).json({
        //         message: 'email not found'
        //     })
        // }

        const email = "hello123@gmail.com";

        const tradeData: CreateOrder = req.body;
        const orderId = uuidv4();
        const response_stream = `response_trade_id_${orderId}`;

        const rClient = createClient();
        await rClient.connect();

        const messageID = await rClient.xAdd(STREAM_NAME, '*', {
            source: SOURCE,
            data: JSON.stringify({
                email: email,
                orderId: orderId,
                response_stream: response_stream,
                tradeData: JSON.stringify(tradeData),
            }),
            timestamp: Date.now().toString()
        })
        console.log(`order send to engine ${messageID}`);

        console.log(`waiting for response from engine ${orderId}`);
        const responseFromEngine = await subscriber.waitForMessage(orderId);
        console.log(`response from engine ${responseFromEngine}`);

        const endTime = Date.now();
        const latency = endTime - startTime;
        res.json({
            'job done for new order': messageID,
            latency: latency
        })
    } catch {

    }
})

app.post('/close', async (req, res) => {

})

export const tradeRouter = app;