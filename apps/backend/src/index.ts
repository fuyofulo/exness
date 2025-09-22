import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { userRouter } from './routes/user';
import { engineRouter } from './routes/engine';
import { EventListener } from './eventlistener';
import { createClient } from 'redis';
import { candlesRouter } from './routes/candles';
import dotenv from 'dotenv';
dotenv.config();
const { ALLOWED_ORIGINS, WEB_BASE_URL } = process.env;

const app = express();


app.use(express.json());
app.use(cookieParser());

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = ALLOWED_ORIGINS ? ALLOWED_ORIGINS.split(',') : [];
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

const supportedAssets = [
    'SOL_USDC',
    'ETH_USDC',
    'BTC_USDC', 
];

app.use('/api/v1/user', userRouter);
app.use('/api/v1/engine', engineRouter);
app.use('/api/v1/candles', candlesRouter);

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
    const redisclient = createClient({
        url: "redis://redis:6379"
    });
    await redisclient.connect();
    const asset = req.query.asset as string;
    const price = await redisclient.get(`price:${asset}`);
    res.json(price ? JSON.parse(price) : null);
})

app.get('/api/v1/supportedAssets', async (req, res) => {
    res.json(supportedAssets);
})
