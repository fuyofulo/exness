import router from 'express';
const app = router();
import { v4 as uuidv4 } from "uuid";
import { createSpotOrderSchema, createCfdOrderSchema } from '../types';
import { createClient } from 'redis';

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
    console.log('create order endpoint has been hit');

    try {
        // const email = req.body.email;
        // if(!email) {
        //     res.status(404).json({
        //         message: 'email not found'
        //     })
        // }

        const tradeData: CreateOrder = req.body;
        const orderId = uuidv4();
        const response_stream = `response_trade_id_${orderId}`;

        const rClient = createClient();
        await rClient.connect();

        const messageID = await rClient.xAdd(STREAM_NAME, '*', {
            source: SOURCE,
            data: JSON.stringify({
                // email: email,
                orderId: orderId,
                response_stream: response_stream,
                tradeData: JSON.stringify(tradeData),
            }),
            timestamp: Date.now().toString()
        })

        res.json({
            'job done for new order': messageID
        })
    } catch {

    }

    // const orderType = req.body.orderType;
    // if(orderType === 'SPOT') {
    //     const parsedData = createSpotOrderSchema.parse(req.body);
    //     if(!parsedData) {
    //         console.log('Invalid spot order body');
    //         res.json({
    //             message: 'invalid spot order body'
    //         })
    //     }
    // } else if(orderType === 'CFD') {
    //     const parsedData = createCfdOrderSchema.parse(req.body);
    //     if(!parsedData) {
    //         console.log('Invalid cfd order body');
    //         res.json({
    //             message: 'invalid cfd order body'
    //         })
    //     }
    // } else {
    //     console.log('Invalid order type');
    //     res.json({
    //         message: 'invalid order type'
    //     })
    // }
})

app.post('/close', async (req, res) => {

})

export const tradeRouter = app;