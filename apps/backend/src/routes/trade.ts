import router from 'express';
import { writeToStream } from '@repo/redis';
const app = router();
import { createSpotOrderSchema, createCfdOrderSchema } from '../types';


app.post('/create', async (req, res) => {
    console.log('create order endpoint has been hit');

    const orderType = req.body.orderType;
    if(orderType === 'SPOT') {
        const parsedData = createSpotOrderSchema.parse(req.body);
        if(!parsedData) {
            console.log('Invalid spot order body');
            res.json({
                message: 'invalid spot order body'
            })
        }
    } else if(orderType === 'CFD') {
        const parsedData = createCfdOrderSchema.parse(req.body);
        if(!parsedData) {
            console.log('Invalid cfd order body');
            res.json({
                message: 'invalid cfd order body'
            })
        }
    } else {
        console.log('Invalid order type');
        res.json({
            message: 'invalid order type'
        })
    }
})

app.post('/close', async (req, res) => {

})

export const tradeRouter = app;