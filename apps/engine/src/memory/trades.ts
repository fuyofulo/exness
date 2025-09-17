export interface Order {
    orderId: string;
    email: string;
    asset: string;
    direction: 'LONG' | 'SHORT';
    command: string;
    margin: number;
    leverage: number;
    slippage: number;
    stopLossPrice?: number;     // Optional stop loss price (exact amount)
    takeProfitPrice?: number;   // Optional take profit price (exact amount)
    status: 'PENDING' | 'COMPLETED' | 'REJECTED';
    timestamp: number;
}


// CFD Trades (leverage/margin trading)
export interface Trade {
    orderId: string;
    email: string;
    asset: string;
    direction: 'LONG' | 'SHORT';
    margin: bigint;
    leverage: bigint;  // Integer: 10-1000 (representing 1.0x to 100.0x)
    entryPrice: bigint;
    entryPriceDecimals: number;
    liquidationPrice?: bigint;      // Optional - only for leveraged trades (>1x)
    liquidationPriceDecimals?: number; // Optional - only for leveraged trades (>1x)
    stopLossPrice?: bigint;        // Optional stop loss price (exact amount)
    takeProfitPrice?: bigint;      // Optional take profit price (exact amount)
    triggerDecimals?: number;       // Decimals for stop loss/take profit prices
    exitPrice?: bigint;             // Exit price when trade is closed
    exitPriceDecimals?: number;     // Decimals for exit price
    pnl: bigint;
    status: 'OPEN' | 'CLOSED' | 'LIQUIDATED' | 'STOP_LOSS' | 'TAKE_PROFIT';
    timestamp: number;
}

// Maps for fast lookups
export const openTrades = new Map<string, Trade>();           // CFD trades only
export const closedTrades = new Map<string, Trade>();         // CFD trades only
export const userTrades = new Map<string, string[]>();        // email -> tradeIds[]

// Unified trigger system for CFD trades (liquidation, stop loss, take profit)
export const tradeTriggerBitmaps = new Map<string, {
    long: Map<number, Set<{
        tradeId: string;
        triggerType: 'liquidation' | 'stop_loss' | 'take_profit';
        triggerPrice: bigint;
    }>>;
    short: Map<number, Set<{
        tradeId: string;
        triggerType: 'liquidation' | 'stop_loss' | 'take_profit';
        triggerPrice: bigint;
    }>>;
}>();

// Keep backward compatibility
export const liquidationBitmaps = tradeTriggerBitmaps;

// Price range for bitmap (adjust based on asset volatility)
const PRICE_RANGE: Record<string, { min: number; max: number; precision: number }> = {
    'BTC_USDC': { min: 0, max: 100000, precision: 0.0001 },  // 4 decimals = 0.0001 precision
    'ETH_USDC': { min: 0, max: 10000, precision: 0.000001 }, // 6 decimals = 0.000001 precision  
    'SOL_USDC': { min: 0, max: 1000, precision: 0.000001 }   // 6 decimals = 0.000001 precision
};


// CFD Trade functions
export function createTrade(order: Order, entryPrice: bigint, entryPriceDecimals: number): Trade {
    const baseTrade: Trade = {
        orderId: order.orderId,
        email: order.email,
        asset: order.asset,
        direction: order.direction,
        margin: BigInt(order.margin * 10000),
        leverage: BigInt(order.leverage),  // Convert integer to bigint
        entryPrice,
        entryPriceDecimals,
        pnl: BigInt(0),
        status: 'OPEN',
        timestamp: Date.now()
    };

    // Only set liquidation price for leveraged trades
    if (BigInt(order.leverage) > BigInt(10)) {
        baseTrade.liquidationPrice = BigInt(0);
        baseTrade.liquidationPriceDecimals = entryPriceDecimals;
    }

    // Add optional properties only if they exist
    if (order.stopLossPrice) {
        // Check if price is already scaled (large number) or decimal
        const isScaled = order.stopLossPrice > 100000; // Assume scaled if > 100k
        if (isScaled) {
            baseTrade.stopLossPrice = BigInt(order.stopLossPrice);
        } else {
            baseTrade.stopLossPrice = BigInt(Math.round(order.stopLossPrice * (10 ** entryPriceDecimals)));
        }
        baseTrade.triggerDecimals = entryPriceDecimals;
    }

    if (order.takeProfitPrice) {
        // Check if price is already scaled (large number) or decimal
        const isScaled = order.takeProfitPrice > 100000; // Assume scaled if > 100k
        if (isScaled) {
            baseTrade.takeProfitPrice = BigInt(order.takeProfitPrice);
        } else {
            baseTrade.takeProfitPrice = BigInt(Math.round(order.takeProfitPrice * (10 ** entryPriceDecimals)));
        }
        baseTrade.triggerDecimals = entryPriceDecimals;
    }

    const trade: Trade = baseTrade;

    // Only leveraged CFD trades (leverage > 1x) have liquidation logic
    if (trade.leverage > BigInt(10)) {
        calculateLiquidationPrice(trade);
        addToLiquidationBitmap(trade);
    }

    // Register optional stop loss and take profit triggers
    if (trade.stopLossPrice) {
        addToTriggerBitmap(trade, 'stop_loss', trade.stopLossPrice);
    }
    if (trade.takeProfitPrice) {
        addToTriggerBitmap(trade, 'take_profit', trade.takeProfitPrice);
    }

    // Add to open trades map
    openTrades.set(order.orderId, trade);

    // Add to user's trades
    if (!userTrades.has(order.email)) {
        userTrades.set(order.email, []);
    }
    userTrades.get(order.email)!.push(order.orderId);

    return trade;
}

export function calculateLiquidationPrice(trade: Trade): void {
    // Only CFD trades have liquidation
    // Leverage is stored as integer (e.g., 225 = 22.5x), so divide by 10 for actual leverage
    const actualLeverage = Number(trade.leverage) / 10;

    // Calculate price change: entryPrice / leverage
    // For leverage 99.5x, priceChange = entryPrice / 99.5
    const priceChange = trade.entryPrice / BigInt(Math.round(actualLeverage));

    if (trade.direction === 'LONG') {
        trade.liquidationPrice = trade.entryPrice - priceChange;
    } else {
        trade.liquidationPrice = trade.entryPrice + priceChange;
    }

    // Liquidation price calculated silently
}

export function addToTriggerBitmap(trade: Trade, triggerType: 'liquidation' | 'stop_loss' | 'take_profit', triggerPrice: bigint): void {
    if (!tradeTriggerBitmaps.has(trade.asset)) {
        tradeTriggerBitmaps.set(trade.asset, {
            long: new Map(),
            short: new Map()
        });
    }

    const bitmap = tradeTriggerBitmaps.get(trade.asset)!;
    const priceKey = getPriceKey(trade.asset, triggerPrice, trade.triggerDecimals || trade.entryPriceDecimals);

    const triggerInfo = {
        tradeId: trade.orderId,
        triggerType,
        triggerPrice
    };

    if (trade.direction === 'LONG') {
        if (!bitmap.long.has(priceKey)) {
            bitmap.long.set(priceKey, new Set());
        }
        bitmap.long.get(priceKey)!.add(triggerInfo);
    } else {
        if (!bitmap.short.has(priceKey)) {
            bitmap.short.set(priceKey, new Set());
        }
        bitmap.short.get(priceKey)!.add(triggerInfo);
    }
}

// Backward compatibility function
export function addToLiquidationBitmap(trade: Trade): void {
    if (trade.liquidationPrice) {
        addToTriggerBitmap(trade, 'liquidation', trade.liquidationPrice);
    }
}

export function removeFromLiquidationBitmap(trade: Trade): void {
    const bitmap = liquidationBitmaps.get(trade.asset);
    if (!bitmap || !trade.liquidationPrice || !trade.liquidationPriceDecimals) return;

    const priceKey = getPriceKey(trade.asset, trade.liquidationPrice, trade.liquidationPriceDecimals);

    if (trade.direction === 'LONG') {
        const longSet = bitmap.long.get(priceKey);
        if (longSet) {
            // Find and remove the trigger info for this trade
            for (const triggerInfo of longSet) {
                if (triggerInfo.tradeId === trade.orderId && triggerInfo.triggerType === 'liquidation') {
                    longSet.delete(triggerInfo);
                    break;
                }
            }
            if (longSet.size === 0) {
                bitmap.long.delete(priceKey);
            }
        }
    } else {
        const shortSet = bitmap.short.get(priceKey);
        if (shortSet) {
            // Find and remove the trigger info for this trade
            for (const triggerInfo of shortSet) {
                if (triggerInfo.tradeId === trade.orderId && triggerInfo.triggerType === 'liquidation') {
                    shortSet.delete(triggerInfo);
                    break;
                }
            }
            if (shortSet.size === 0) {
                bitmap.short.delete(priceKey);
            }
        }
    }
}

export function getPriceKey(asset: string, price: bigint, decimals: number): number {
    const range = PRICE_RANGE[asset];
    if (!range) return 0;
    
    // Convert scaled price to actual price
    const actualPrice = Number(price) / (10 ** decimals);
    
    // Round to precision and return as integer key
    return Math.round(actualPrice / range.precision);
}

export function closeTrade(orderId: string, closePrice: bigint, closePriceDecimals: number): Trade | null {
    const trade = openTrades.get(orderId);
    if (!trade) return null;
    
    // Calculate final PnL for CFD trades
    const entryPriceActual = Number(trade.entryPrice) / (10 ** trade.entryPriceDecimals);
    const closePriceActual = Number(closePrice) / (10 ** closePriceDecimals);

    const priceDiffPercent = (closePriceActual - entryPriceActual) / entryPriceActual;
    // For SHORT trades, invert the price difference (profit when price goes down)
    const directionMultiplier = trade.direction === 'SHORT' ? -1 : 1;
    const leverageMultiplier = Number(trade.leverage) / 10;  // Convert integer leverage to actual leverage
    const marginActual = Number(trade.margin) / 10000;

    const pnlActual = priceDiffPercent * directionMultiplier * marginActual * leverageMultiplier;

    // PnL calculated silently

    trade.pnl = BigInt(Math.round(pnlActual * 10000));
    
    // Remove from liquidation bitmap
    removeFromLiquidationBitmap(trade);
    
    // Move to closed trades
    trade.status = 'CLOSED';
    trade.timestamp = Date.now();
    
    openTrades.delete(orderId);
    closedTrades.set(orderId, trade);
    
    return trade;
}

// O(1) trigger checking using unified bitmaps! (liquidation, stop loss, take profit)
export function checkTradeTriggers(asset: string, currentPrice: bigint, currentPriceDecimals: number): Trade[] {
    const bitmap = tradeTriggerBitmaps.get(asset);
    if (!bitmap) return [];

    const triggeredTrades: Trade[] = [];
    const priceKey = getPriceKey(asset, currentPrice, currentPriceDecimals);

    // Check LONG triggers (price went down - stop loss for longs, liquidation for longs)
    for (const [triggerPriceKey, triggerInfos] of bitmap.long.entries()) {
        if (triggerPriceKey >= priceKey) {  // Price dropped to/below trigger level
            for (const triggerInfo of triggerInfos) {
                const trade = openTrades.get(triggerInfo.tradeId);
                if (trade && trade.status === 'OPEN') {
                    const closedTrade = closeTradeWithReason(triggerInfo.tradeId, currentPrice, currentPriceDecimals, triggerInfo.triggerType);
                    if (closedTrade) triggeredTrades.push(closedTrade);
                }
            }
        }
    }

    // Check SHORT triggers (price went up - take profit for shorts, liquidation for shorts)
    for (const [triggerPriceKey, triggerInfos] of bitmap.short.entries()) {
        if (triggerPriceKey <= priceKey) {  // Price rose to/above trigger level
            for (const triggerInfo of triggerInfos) {
                const trade = openTrades.get(triggerInfo.tradeId);
                if (trade && trade.status === 'OPEN') {
                    const closedTrade = closeTradeWithReason(triggerInfo.tradeId, currentPrice, currentPriceDecimals, triggerInfo.triggerType);
                    if (closedTrade) triggeredTrades.push(closedTrade);
                }
            }
        }
    }

    return triggeredTrades;
}

// Close trade with specific trigger reason
export function closeTradeWithReason(orderId: string, closePrice: bigint, closePriceDecimals: number, triggerType: 'liquidation' | 'stop_loss' | 'take_profit'): Trade | null {
    const trade = openTrades.get(orderId);
    if (!trade) return null;

    // Calculate PnL (same logic as before)
    const entryPriceActual = Number(trade.entryPrice) / (10 ** trade.entryPriceDecimals);
    const closePriceActual = Number(closePrice) / (10 ** closePriceDecimals);

    const priceDiffPercent = (closePriceActual - entryPriceActual) / entryPriceActual;
    const directionMultiplier = trade.direction === 'SHORT' ? -1 : 1;
    const leverageMultiplier = Number(trade.leverage) / 10;
    const marginActual = Number(trade.margin) / 10000;

    const pnlActual = priceDiffPercent * directionMultiplier * marginActual * leverageMultiplier;
    trade.pnl = BigInt(Math.round(pnlActual * 10000));

    // Set exit price
    trade.exitPrice = closePrice;
    trade.exitPriceDecimals = closePriceDecimals;

    // Set status based on trigger type
    switch (triggerType) {
        case 'liquidation':
            trade.status = 'LIQUIDATED';
            break;
        case 'stop_loss':
            trade.status = 'STOP_LOSS';
            break;
        case 'take_profit':
            trade.status = 'TAKE_PROFIT';
            break;
    }

    // Remove from all trigger bitmaps
    removeFromTriggerBitmap(trade);

    // Move to closed trades
    trade.timestamp = Date.now();
    openTrades.delete(orderId);
    closedTrades.set(orderId, trade);

    return trade;
}

// Remove trade from all trigger bitmaps
export function removeFromTriggerBitmap(trade: Trade): void {
    const bitmap = tradeTriggerBitmaps.get(trade.asset);
    if (!bitmap) return;

    // Remove liquidation trigger
    if (trade.liquidationPrice && trade.liquidationPriceDecimals) {
        const priceKey = getPriceKey(trade.asset, trade.liquidationPrice, trade.liquidationPriceDecimals);
        const directionMap = trade.direction === 'LONG' ? bitmap.long : bitmap.short;
        const triggerSet = directionMap.get(priceKey);
        if (triggerSet) {
            // Remove all triggers for this trade
            for (const triggerInfo of triggerSet) {
                if (triggerInfo.tradeId === trade.orderId) {
                    triggerSet.delete(triggerInfo);
                }
            }
            if (triggerSet.size === 0) {
                directionMap.delete(priceKey);
            }
        }
    }

    // Remove stop loss trigger
    if (trade.stopLossPrice) {
        const priceKey = getPriceKey(trade.asset, trade.stopLossPrice, trade.triggerDecimals || trade.entryPriceDecimals);
        const directionMap = trade.direction === 'LONG' ? bitmap.long : bitmap.short;
        const triggerSet = directionMap.get(priceKey);
        if (triggerSet) {
            for (const triggerInfo of triggerSet) {
                if (triggerInfo.tradeId === trade.orderId && triggerInfo.triggerType === 'stop_loss') {
                    triggerSet.delete(triggerInfo);
                }
            }
            if (triggerSet.size === 0) {
                directionMap.delete(priceKey);
            }
        }
    }

    // Remove take profit trigger
    if (trade.takeProfitPrice) {
        const priceKey = getPriceKey(trade.asset, trade.takeProfitPrice, trade.triggerDecimals || trade.entryPriceDecimals);
        const directionMap = trade.direction === 'LONG' ? bitmap.long : bitmap.short;
        const triggerSet = directionMap.get(priceKey);
        if (triggerSet) {
            for (const triggerInfo of triggerSet) {
                if (triggerInfo.tradeId === trade.orderId && triggerInfo.triggerType === 'take_profit') {
                    triggerSet.delete(triggerInfo);
                }
            }
            if (triggerSet.size === 0) {
                directionMap.delete(priceKey);
            }
        }
    }
}

// Backward compatibility function
export function checkLiquidations(asset: string, currentPrice: bigint, currentPriceDecimals: number): Trade[] {
    return checkTradeTriggers(asset, currentPrice, currentPriceDecimals);
}

