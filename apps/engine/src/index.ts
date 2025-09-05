import { createClient } from 'redis';
import { listenToPrice } from './price';
import { RedisClientType } from 'redis';

async function main() {

    const rClient = createClient();
    await rClient.connect();

    await listenToPrice(rClient as RedisClientType);
    
    
}

main();
