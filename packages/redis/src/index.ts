import { createClient, RedisClientType } from 'redis';
import { REDIS_URL } from '@repo/config';

let redisclient: RedisClientType | null = null;
let isConnected = false;

export async function connectRedis() {

    if (isConnected && redisclient) return;

    redisclient = createClient({ url: REDIS_URL as any });
    (redisclient as any).on('error', (err: unknown) => {
        console.error('redis client error', err);
        isConnected = false;
    });

    (redisclient as any).on('connect', () => {
        console.log('redis connected');
        isConnected = true;
    });

    await redisclient.connect();
}

export async function getRedis(): Promise<RedisClientType> {
    if(!redisclient) throw new Error('redis not initialized, call connectRedis() first');
    return redisclient;
}

export * from './ops';
export * from './price';
export * from './stream';