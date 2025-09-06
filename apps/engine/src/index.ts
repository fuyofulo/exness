import { createClient } from 'redis';
import { listenToPrice } from './listener/price';
import { listenToOrders } from './listener/orders';
import { RedisClientType } from 'redis';

async function main() {

    const rClient = createClient();
    await rClient.connect();

    // await listenToPrice(rClient as RedisClientType);
    // await listenToOrders(rClient as RedisClientType);
     
    await Promise.all([
        listenToPrice(rClient as RedisClientType),
        listenToOrders(rClient as RedisClientType)
    ])
}



main();
