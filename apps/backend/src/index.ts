import express from 'express';
import cors from 'cors';
import { userRouter } from './routes/user';
import { engineRouter } from './routes/engine';
import { EventListener } from './eventlistener';
import { createClient } from 'redis';
import { candlesRouter } from './routes/candles';
import { ALLOWED_ORIGINS, WEB_BASE_URL } from '@repo/config';

const app = express();

function parseOrigins(): string[] {
    const list: string[] = [];
    if(ALLOWED_ORIGINS) {
        list.push(
            ...ALLOWED_ORIGINS
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean),
        )
    }
    if(WEB_BASE_URL) {
        try {
            const u = new URL(WEB_BASE_URL);
            list.push(`${u.protocol}//${u.host}`);
        } catch (error) {
            console.error('Error parsing WEB_BASE_URL:', error);
        }
    }
    return Array.from(new Set(list));
}

const allowedOrigins = parseOrigins();

const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    // Allow non-browser tools (no Origin header)
    if (!origin) return cb(null, true);
    return cb(null, allowedOrigins.includes(origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));


app.use(express.json());

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
