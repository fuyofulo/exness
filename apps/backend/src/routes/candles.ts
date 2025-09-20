import axios from 'axios';
import router from 'express';
const app = router();

app.get('/', async (req, res) => {
    try {
        const asset = req.query.asset;
        if (!asset) {
            return res.status(400).json({ error: 'Asset not provided' });
        }

        if (!['SOL', 'ETH', 'BTC'].includes(asset as string)) {
            return res.status(400).json({ error: 'Invalid asset' });
        }

        const interval = req.query.interval || '1h';
        const now = Math.floor(Date.now() / 1000);
        const startTime = now - 24 * 60 * 60; // 24h ago
        const endTime = now;

        const backpackAPI = `https://api.backpack.exchange/api/v1/klines?symbol=${asset}_USDC&interval=${interval}&startTime=${startTime}&endTime=${endTime}`;

        console.log(backpackAPI);

        const { data } = await axios.get(backpackAPI);
        return res.status(200).json(data);
    } catch (error) {
        console.error(error instanceof Error ? error.message : 'Unknown error');
        return res.status(500).json({ error: 'Internal server error' });
    }
});


export const candlesRouter = app;