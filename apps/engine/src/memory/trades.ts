export interface Trade {
    orderId: string,
    email: string,
    asset: string,
    type: 'LONG' | 'SHORT',
    margin: bigint,
    leverage: bigint,
    slippage: bigint,
    status: 'OPEN' | 'CLOSED',
    timestamp: number
}

export const trades = new Map<string, Trade>();



