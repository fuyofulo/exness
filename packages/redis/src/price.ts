import { getRedis } from "./index";

function priceKey(asset: string) {
    return `price:${asset}`;
}

export async function upsertLatestPrice(
    payload: { asset: string; price: number; decimal: number },
    ttlSeconds = 15
) { 
    const r = await getRedis();
    const key = priceKey(payload.asset);
    const json = JSON.stringify(payload);


    const tx = r.multi();
    tx.setEx(key, ttlSeconds, json);
    const res = await tx.exec();
    return res;
}

export async function getLatestPrice(symbol: string) {
    const r = await getRedis();
    const s = await r.get(priceKey(symbol));    
    return s ? JSON.parse(s) as { asset: string; price: number; decimal: number } : null;
}