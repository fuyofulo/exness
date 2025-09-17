export interface assetBalance {
    balance: bigint,
    decimals: number
}

export interface UserBalance {
    email: string,
    balances: Record<string, assetBalance>
}

export const userBalances = new Map<string, UserBalance>();

// Helper functions
export function createUserAccount(email: string): UserBalance {
    const userBalance: UserBalance = {
        email: email,
        balances: {
            'USD': {
                balance: BigInt(5000 * 10000), // 5000 USD with 4 decimals
                decimals: 4
            }
        }
    };
    
    userBalances.set(email, userBalance);
    return userBalance;
}

export function getUserBalance(email: string): UserBalance | null {
    return userBalances.get(email) || null;
}

export function getUsdBalance(email: string): bigint {
    const userBalance = userBalances.get(email);
    if (!userBalance) return BigInt(0);
    
    const usdBalance = userBalance.balances['USD'];
    return usdBalance ? usdBalance.balance : BigInt(0);
}


export function formatBalance(balance: bigint, decimals: number): number {
    return Number(balance) / (10 ** decimals);
}
