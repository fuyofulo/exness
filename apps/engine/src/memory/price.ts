export type LatestPrice = {
    asset: string;
    price: bigint;    // Changed to bigint
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

export function getAllPrices(): Map<string, LatestPrice> {
    return priceCache;
}

// Helper function to format price for display
export function formatPrice(price: bigint, decimals: number): number {
    return Number(price) / (10 ** decimals);
}