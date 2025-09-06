import { getUserBalance, createUserAccount, getUsdBalance, formatBalance } from '../memory/balance';

interface Command {
    command: string,
    email: string,
    data?: any
}

interface ProcessorResponse {
    status: 'success' | 'error',
    message?: string,
    data?: any
}

export async function processCommand(command: Command) {
    const {command: cmd, email, data} = command;

    try {
        switch(cmd) {
            case 'GET_BALANCE':
                return await handleGetBalance(email);

            case 'GET_USD_BALANCE':
                return await handleGetUsdBalance(email);

            case 'CREATE_ACCOUNT':
                return await handleCreateAccount(email);

            case 'CREATE_TRADE':
                return await handleCreateTrade(email, data);

            case 'CLOSE_TRADE':
                return await handleCloseTrade(email, data);

            default:
                return {
                    status: 'error',
                    message: `Invalid command: ${cmd}`
                }
        }
    } catch (error) {
        return {
            status: 'error',
            message: `Error processing command: ${cmd}`,
            data: error
        }
    }
}

async function handleGetBalance(email: string): Promise<ProcessorResponse> {
    try {
        const userBalance = getUserBalance(email);
        if (!userBalance) {
            return {
                status: 'error',
                message: 'User balance not found'
            }
        }
        
        const formattedBalances: Record<string, number> = {};
        for (const [asset, balance] of Object.entries(userBalance.balances)) {
            formattedBalances[asset] = formatBalance(balance.balance, balance.decimals)
        }

        return {
            status: 'success',
            message: 'Balance retrieved successfully',
            data: { email, balances: formattedBalances }
        }
    } catch (error) {
        return {
            status: 'error',
            message: 'Error retrieving balance',
            data: error
        }
    }
}

async function handleGetUsdBalance(email: string): Promise<ProcessorResponse> {
    try {
        const userBalance = getUsdBalance(email);
        const formattedBalance = formatBalance(userBalance, 4);

        return {
            status: 'success',
            message: 'USD balance retrieved successfully',
            data: { email, usdBalance: formattedBalance }
        }
    } catch (error) {
        return {
            status: 'error',
            message: 'Error retrieving USD balance',
            data: error
        }
    }
}

async function handleCreateAccount(email: string): Promise<ProcessorResponse> {
    try {
        const existingBalance = getUserBalance(email);
        if (existingBalance) {
            return {
                status: 'error',
                message: 'Account already exists'
            }
        }

        const userBalance = createUserAccount(email);
        return {
            status: 'success',
            message: 'account created successfully',
            data: {
                email, 
                initialUsdBalance: formatBalance(userBalance.balances['USD']?.balance || BigInt(0), 4),                
                assets: Object.keys(userBalance.balances)
            }
        };
    } catch (error) {
        return {
            status: 'error',
            message: 'Error creating account',
            data: error
        }

    }
}

async function handleCreateTrade(email: string, data: any): Promise<ProcessorResponse> {
    return {
        status: 'success',
        message: 'Trade created successfully',
        data: { email, tradeData: data }
    };
}

async function handleCloseTrade(email: string, data: any): Promise<ProcessorResponse> {
    return {
        status: 'success',
        message: 'Trade closed successfully',
        data: { email, tradeData: data }
    };
}

