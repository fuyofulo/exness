interface assetBalance {
    balance: bigint,
    decimals: number
}

export interface UserBalance {
    email: string,
    balances: Record<string, assetBalance>
}

export const userBalances = new Map<string, UserBalance>();

