export type LatestPrice = {
    asset: string;
    price: bigint;
    decimal: number;
}

const priceCache: Map<string, LatestPrice> = new Map();

export function getCurrentPrice(asset: string): bigint | null {
    const price = priceCache.get(asset);
    return price ? price.price : null;
}

export function setPrice(asset: string, price: LatestPrice) {
    priceCache.set(asset, price);
}
