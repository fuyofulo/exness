import express from 'express';
import { connectRedis, getLatestPrice } from '@repo/redis';
import { userRouter } from './routes/user';
import { tradeRouter } from './routes/trade';
import { balanceRouter } from './routes/balance';

const app = express();
app.use(express.json());

const supportedAssets = [
    'SOL_USDC',
    'ETH_USDC',
    'BTC_USDC', 
];

app.use('/api/v1/user', userRouter);
app.use('/api/v1/trade', tradeRouter);
app.use('/api/v1/balance', balanceRouter);

app.listen(3005, () => {
    console.log('Server is running on port 3005');
});

// http://localhost:3000?asset=SOL_USDC
app.get('/', async (req, res) => {
    await connectRedis();
    console.log('get latest price endpoint has been hit');
    const asset = req.query.asset as string;
    const price = await getLatestPrice(asset);
    res.json(price);
})

app.get('/api/v1/supportedAssets', async (req, res) => {
    res.json(supportedAssets);
})