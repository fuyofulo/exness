import WebSocket from 'ws';
import { createClient } from 'redis';
const ws = new WebSocket(('wss://ws.backpack.exchange/'));

const assets: string[] = ['BTC_USDC', 'ETH_USDC', 'SOL_USDC'];
let id = 1;

// Hardcoded decimal precision for each asset
const ASSET_DECIMALS: Record<string, number> = {
    'BTC_USDC': 4,   // 4 decimal places
    'ETH_USDC': 6,   // 6 decimal places  
    'SOL_USDC': 6    // 6 decimal places
};

interface priceUpdate {
    asset: string,
    price: bigint,
    decimal: number
}

const STREAM_NAME: string = 'engine_input';
const SOURCE: string = 'poller';

// Store latest prices for each asset
const latestPrices: Map<string, priceUpdate> = new Map();

ws.on('open', async () => {
    const rClient = createClient();
    await rClient.connect();

    console.log('Connected to the WebSocket');

    // subscribing to assets 
    assets.forEach(asset => {
        ws.send(JSON.stringify({
            method: 'SUBSCRIBE',
            params: [`bookTicker.${asset}`],
            id: id++
        }))
    })

    // publishes prices to redis stream every 100ms
    setInterval(async () => {
        const priceUpdates: priceUpdate[] = Array.from(latestPrices.values());
        if (priceUpdates.length > 0) {
            const serializedPriceUpdates = priceUpdates.map(update => ({
                asset: update.asset,
                price: update.price.toString(),
                decimal: update.decimal
            }));

            const jsonData = JSON.stringify(serializedPriceUpdates);
            const base64Data = Buffer.from(jsonData).toString('base64');

            await rClient.xAdd(STREAM_NAME, '*', {
                source: SOURCE,
                data: base64Data, // Send base64 encoded data
                format: 'base64_v1', // Version the format
                timestamp: Date.now().toString()
            });
        }
    }, 1000);
});

ws.on('message', (data) => {
    const parsedData = JSON.parse(data.toString());

    if(parsedData.data.e === 'bookTicker') {
        const symbol = parsedData.data.s;
        const priceString = parsedData.data.a;
        const price = parseFloat(priceString);
        
        // Get target decimal precision
        const targetDecimals = ASSET_DECIMALS[symbol] || 6;

        // Calculate the scaling factor to normalize to target decimals
        const scalingFactor = 10 ** targetDecimals;
        const scaledPrice = BigInt(Math.round(price * scalingFactor));

        // Update the latest price for this asset
            // Store price silently - no logging for every price update

        latestPrices.set(symbol, {
            asset: symbol,
            price: scaledPrice,
            decimal: targetDecimals
        });
    }
})