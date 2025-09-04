import WebSocket from 'ws';
import { connectRedis, writeToStream } from '@repo/redis';
const ws = new WebSocket(('wss://ws.backpack.exchange/'));

const assets: string[] = ['BTC_USDC', 'ETH_USDC', 'SOL_USDC'];
let id = 1

interface priceUpdate {
    asset: string,
    price: number,
    decimal: number
}

// Store latest prices for each asset
const latestPrices: Map<string, priceUpdate> = new Map();

function checkDecimals (value: string) {
    if (!value.includes('.')) {
        return 0
    } else {
        return value.split('.')[1]!.length;
    }
}


ws.on('open', async () => {

    console.log('Connected to the WebSocket');
    await connectRedis();

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
            let messageId = await writeToStream('price_updates', {
                data: JSON.stringify(priceUpdates),
                timestamp: Date.now().toString()
            });
            console.log(`wrote to stream ${messageId}`);
        }
    }, 100);
    
});

ws.on('message', (data) => {
    const parsedData = JSON.parse(data.toString());
    // console.log(parsedData);

    if(parsedData.data.e === 'bookTicker') {

        const symbol = parsedData.data.s;
        const price = parseFloat(parsedData.data.a);
        const decimal = checkDecimals(parsedData.data.a);
        const scaledPrice = Math.round(price * (10 ** decimal));

        // Update the latest price for this asset
        latestPrices.set(symbol, {
            asset: symbol,
            price: scaledPrice,
            decimal: decimal
        });
    }
})




























// BTC_USDC 111536.4
// {
//     data: {
//       A: '0.03583',
//       B: '0.11660',
//       E: 1756899239068201,
//       T: 1756899239066524,
//       a: '111543.1',
//       b: '111543.0',
//       e: 'bookTicker',
//       s: 'BTC_USDC',
//       u: 1661287897
//     },
//     stream: 'bookTicker.BTC_USDC'
//  }


// SOL_USDC 210.77
// {
//     data: {
//       A: '1.24',
//       B: '231.55',
//       E: 1756899276392275,
//       T: 1756899276390638,
//       a: '210.85',
//       b: '210.84',
//       e: 'bookTicker',
//       s: 'SOL_USDC',
//       u: 2685477141
//     },
//     stream: 'bookTicker.SOL_USDC'
// }


// ETH_USDC 4375.49
// {
//     data: {
//       A: '0.2353',
//       B: '0.8608',
//       E: 1756899276371086,
//       T: 1756899276368874,
//       a: '4375.86',
//       b: '4375.67',
//       e: 'bookTicker',
//       s: 'ETH_USDC',
//       u: 1456908799
//     },
//     stream: 'bookTicker.ETH_USDC'
// }