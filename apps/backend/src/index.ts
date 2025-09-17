import express from 'express';
import cookieParser from 'cookie-parser';
import { userRouter } from './routes/user';
import { engineRouter } from './routes/engine';
import { EventListener } from './eventlistener';
import { createClient } from 'redis';

const app = express();
app.use(express.json());
app.use(cookieParser());

const supportedAssets = [
    'SOL_USDC',
    'ETH_USDC',
    'BTC_USDC', 
];

app.use('/api/v1/user', userRouter);
app.use('/api/v1/engine', engineRouter);

const server = app.listen(3005, () => {
    console.log('Server is running on port 3005');
});

// Start the EventListener for handling liquidation events
const eventListener = new EventListener();
eventListener.start().catch((error) => {
    console.error('Failed to start EventListener:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await eventListener.stop();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGTERM', async () => {
    console.log('Shutting down gracefully...');
    await eventListener.stop();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

// http://localhost:3005?asset=SOL_USDC
app.get('/api/v1/price', async (req, res) => {
    const redisclient = createClient();
    await redisclient.connect();
    const asset = req.query.asset as string;
    const price = await redisclient.get(`price:${asset}`);
    res.json(price ? JSON.parse(price) : null);
})

app.get('/api/v1/supportedAssets', async (req, res) => {
    res.json(supportedAssets);
})
