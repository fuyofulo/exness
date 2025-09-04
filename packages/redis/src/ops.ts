import { getRedis } from "./index";


// publish message to channel
export async function rPublish(channel: string, data: any) {
    const r = await getRedis();
    console.log('publishing to channel', channel, data);
    return r.publish(channel, data);
}

// subscribe to channel
export async function rSubscribe(channel: string, callback: (message: string) => void) {
    // Use a dedicated subscriber connection so the main client can still run commands
    const base = await getRedis();
    const r = base.duplicate();
    await r.connect();
    await r.subscribe(channel, (message) => {
        callback(message);
    });
    return r;
}