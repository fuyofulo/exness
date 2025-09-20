import { getUserBalance, createUserAccount, getUsdBalance, formatBalance, userBalances } from '../memory/balance';
import { createTrade, closeTrade, openTrades, closedTrades, userTrades, tradeTriggerBitmaps } from '../memory/trades';
import { getCurrentPrice } from '../memory/price';
import { RedisClientType } from 'redis';

const ENGINE_EVENTS = "engine_events";

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

// Decimals configuration (aligned with poller)
const ASSET_DECIMALS: Record<string, number> = {
    BTC_USDC: 4,
    ETH_USDC: 6,
    SOL_USDC: 6
};

const USD_DECIMALS = 4;

function toScaledBigInt(amount: number, decimals: number): bigint {
    // Avoid floating point errors by string conversion
    const s = amount.toFixed(decimals);
    const digits = s.replace('.', '');
    return BigInt(digits);
}

export async function processCommand(command: Command, rClient?: RedisClientType) {
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
                return await handleCloseTrade(email, data, rClient);

            case 'DELETE_USER':
                return await handleDeleteUser(email, rClient);

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
            data: error instanceof Error ? error.message : String(error)
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
            data: error instanceof Error ? error.message : String(error)
        }
    }
}

async function handleGetUsdBalance(email: string): Promise<ProcessorResponse> {
    try {
        const usdBalance = getUsdBalance(email);
        const formattedBalance = formatBalance(usdBalance, USD_DECIMALS);

        return {
            status: 'success',
            message: 'USD balance retrieved successfully',
            data: { email, usdBalance: formattedBalance }
        }
    } catch (error) {
        return {
            status: 'error',
            message: 'Error retrieving USD balance',
            data: error instanceof Error ? error.message : String(error)
        }
    }
}

async function handleCreateAccount(email: string): Promise<ProcessorResponse> {
    try {
        console.log(`Attempting to create account for: ${email}`);
        console.log(`Current users in engine:`, Array.from(userBalances.keys()));
        
        const existingBalance = getUserBalance(email);
        if (existingBalance) {
            console.log(`Account already exists for: ${email}`);
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
                initialUsdBalance: formatBalance(userBalance.balances['USD']?.balance || BigInt(0), USD_DECIMALS),                
                assets: Object.keys(userBalance.balances)
            }
        };
    } catch (error) {
        return {
            status: 'error',
            message: 'Error creating account',
            data: error instanceof Error ? error.message : String(error)
        }
    }
}

async function handleCreateTrade(email: string, data: any): Promise<ProcessorResponse> {
    try {
        // Check if user has account
        const userBalance = getUserBalance(email);
        if (!userBalance) {
            return {
                status: 'error',
                message: 'Account not found. Please create account first.'
            };
        }

        // Margin validation will be done per direction (USD for LONG, asset for SHORT)

        // Get current price
        const currentPrice = getCurrentPrice(data.asset);
        if (!currentPrice) {
            return {
                status: 'error',
                message: 'Price not available for this asset'
            };
        }

        // Create order object
        const order = {
            orderId: data.orderId || `trade_${Date.now()}`,
            email: email,
            asset: data.asset,
            direction: data.direction,
            command: 'CREATE_TRADE',
            margin: data.margin,
            leverage: data.leverage,
            slippage: data.slippage || 0,
            stopLossPrice: data.stopLossPrice,     // Optional stop loss
            takeProfitPrice: data.takeProfitPrice, // Optional take profit
            status: 'PENDING' as const,
            timestamp: Date.now()
        };

        // Spot vs CFD split: leverage<=10 -> spot balances only; >10 -> CFD
        const leverage = typeof data.leverage === 'number' && data.leverage > 0 ? data.leverage : 10;

        // Leverage validation: 10-1000 (representing 1.0x to 100.0x)
        if (leverage < 10 || leverage > 1000) {
            return {
                status: 'error',
                message: 'Leverage must be between 10 and 1000 (representing 1.0x to 100.0x)'
            };
        }
        if (!Number.isInteger(leverage)) {
            return {
                status: 'error',
                message: 'Leverage must be an integer (e.g., 225 for 22.5x)'
            };
        }

        // All trades are CFD trades (no spot/CFD distinction)
        const marginAmount = toScaledBigInt(data.margin as number, USD_DECIMALS);
        const usdBalanceObj = userBalance.balances['USD'];
        if (!usdBalanceObj || usdBalanceObj.balance < marginAmount) {
            return {
                status: 'error',
                message: 'Insufficient USD balance for margin'
            };
        }
        const assetDecimals = ASSET_DECIMALS[data.asset] ?? 6;
        const trade = createTrade(order, currentPrice, assetDecimals);
        usdBalanceObj.balance -= marginAmount;
        return {
            status: 'success',
            message: 'Trade created successfully',
            data: {
                email,
                tradeId: trade.orderId,
                entryPrice: formatBalance(trade.entryPrice, assetDecimals),
                ...(trade.leverage > BigInt(10) && trade.liquidationPrice && {
                    liquidationPrice: formatBalance(trade.liquidationPrice, assetDecimals)
                }),
                ...(trade.stopLossPrice && {
                    stopLossPrice: Number(trade.stopLossPrice) / (10 ** (trade.triggerDecimals || assetDecimals))
                }),
                ...(trade.takeProfitPrice && {
                    takeProfitPrice: Number(trade.takeProfitPrice) / (10 ** (trade.triggerDecimals || assetDecimals))
                }),
                margin: formatBalance(trade.margin, USD_DECIMALS),
                leverage: Number(trade.leverage) / 10  // Convert back to decimal for display
            }
        };
    } catch (error) {
        return {
            status: 'error',
            message: `Failed to create trade: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

async function handleCloseTrade(email: string, data: any, rClient?: RedisClientType): Promise<ProcessorResponse> {
    try {
        const tradeId = data.tradeId;
        if (!tradeId) {
            return {
                status: 'error',
                message: 'Trade ID is required'
            };
        }

        // First get the trade to know its asset
        const trade = openTrades.get(tradeId);
        if (!trade) {
            return {
                status: 'error',
                message: 'Trade not found or already closed'
            };
        }

        // Get current price for the trade's asset (not the one specified in request)
        const currentPrice = getCurrentPrice(trade.asset);
        if (!currentPrice) {
            return {
                status: 'error',
                message: 'Price not available for trade asset'
            };
        }

        // Close trade
        const assetDecimals = ASSET_DECIMALS[trade.asset] ?? 6;
        const closedTrade = closeTrade(tradeId, currentPrice, assetDecimals);
        if (!closedTrade) {
            return {
                status: 'error',
                message: 'Trade not found or already closed'
            };
        }

        // Return margin + PnL to USD balance
        const userBalance = getUserBalance(email);
        if (userBalance) {
            const usdBalanceObj = userBalance.balances['USD'];
            if (usdBalanceObj) {
                usdBalanceObj.balance += closedTrade.margin; // Return original margin
                usdBalanceObj.balance += closedTrade.pnl;   // Add/subtract PnL
            }
        }

        // Publish trade closure event to backend
        if (rClient) {
            try {
                await rClient.xAdd(ENGINE_EVENTS, '*', {
                    eventType: 'TRADE_CLOSED',
                    tradeId: closedTrade.orderId,
                    email: email,
                    asset: closedTrade.asset,
                    pnl: (Number(closedTrade.pnl) / 10000).toString(), // Convert back to decimal
                    marginReturned: (Number(closedTrade.margin) / 10000).toString(),
                    closePrice: (Number(currentPrice) / Math.pow(10, assetDecimals)).toFixed(assetDecimals),
                    timestamp: Date.now().toString()
                });
                console.log(`Published trade closure event for ${closedTrade.orderId}`);
            } catch (publishError) {
                console.error(`Failed to publish trade closure event for ${closedTrade.orderId}:`, publishError);
            }
        }

        return {
            status: 'success',
            message: 'Trade closed successfully',
            data: {
                email,
                tradeId: closedTrade.orderId,
                asset: closedTrade.asset,
                marginReturned: formatBalance(closedTrade.margin, USD_DECIMALS),
                pnl: formatBalance(closedTrade.pnl, USD_DECIMALS),
                totalReturn: formatBalance(closedTrade.margin + closedTrade.pnl, USD_DECIMALS),
                closePrice: formatBalance(currentPrice, assetDecimals)
            }
        };
    } catch (error) {
        return {
            status: 'error',
            message: `Failed to close trade: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

async function handleDeleteUser(email: string, rClient?: RedisClientType): Promise<ProcessorResponse> {
    try {
        // Check if user exists
        const userBalance = getUserBalance(email);
        if (!userBalance) {
            return {
                status: 'error',
                message: 'User not found'
            };
        }

        console.log(`Deleting user ${email} from engine`);

        // Step 1: Close all open trades for this user
        const allUserTradeIds = userTrades.get(email) || [];
        const openTradeIds = allUserTradeIds.filter(tradeId => openTrades.has(tradeId));
        
        let closedTradesCount = 0;
        let totalMarginReturned = BigInt(0);
        let totalPnL = BigInt(0);

        for (const tradeId of openTradeIds) {
            const trade = openTrades.get(tradeId);
            if (trade) {
                // Get current price for the trade's asset
                const currentPrice = getCurrentPrice(trade.asset);
                if (currentPrice) {
                    const assetDecimals = ASSET_DECIMALS[trade.asset] ?? 6;
                    const closedTrade = closeTrade(tradeId, currentPrice, assetDecimals);
                    
                    if (closedTrade) {
                        closedTradesCount++;
                        totalMarginReturned += closedTrade.margin;
                        totalPnL += closedTrade.pnl;

                        // Publish trade closure event
                        if (rClient) {
                            try {
                                await rClient.xAdd(ENGINE_EVENTS, '*', {
                                    eventType: 'TRADE_CLOSED',
                                    tradeId: closedTrade.orderId,
                                    email: email,
                                    asset: closedTrade.asset,
                                    pnl: (Number(closedTrade.pnl) / 10000).toString(),
                                    marginReturned: (Number(closedTrade.margin) / 10000).toString(),
                                    closePrice: (Number(currentPrice) / Math.pow(10, assetDecimals)).toFixed(assetDecimals),
                                    timestamp: Date.now().toString()
                                });
                                console.log(`Published trade closure event for ${closedTrade.orderId}`);
                            } catch (publishError) {
                                console.error(`Failed to publish trade closure event for ${closedTrade.orderId}:`, publishError);
                            }
                        }
                    }
                }
            }
        }

        // Step 2: Return all remaining balances to user (final balance)
        const finalUsdBalance = userBalance.balances['USD']?.balance || BigInt(0);
        const finalUsdFormatted = formatBalance(finalUsdBalance, USD_DECIMALS);

        // Step 3: Remove user from all in-memory data structures
        // Get user trade IDs before deleting userTrades (use the same variable from Step 1)
        const userTradeIdsForCleanup = allUserTradeIds;
        
        userBalances.delete(email);
        userTrades.delete(email);

        // Remove user's trades from trigger bitmaps
        for (const [asset, bitmapData] of tradeTriggerBitmaps.entries()) {
            // Remove from long triggers
            for (const [priceKey, triggers] of bitmapData.long.entries()) {
                const filteredTriggers = Array.from(triggers).filter(trigger => !userTradeIdsForCleanup.includes(trigger.tradeId));
                if (filteredTriggers.length === 0) {
                    bitmapData.long.delete(priceKey);
                } else {
                    bitmapData.long.set(priceKey, new Set(filteredTriggers));
                }
            }
            
            // Remove from short triggers
            for (const [priceKey, triggers] of bitmapData.short.entries()) {
                const filteredTriggers = Array.from(triggers).filter(trigger => !userTradeIdsForCleanup.includes(trigger.tradeId));
                if (filteredTriggers.length === 0) {
                    bitmapData.short.delete(priceKey);
                } else {
                    bitmapData.short.set(priceKey, new Set(filteredTriggers));
                }
            }
        }

        console.log(`User ${email} deleted from engine - closed ${closedTradesCount} trades, returned $${finalUsdFormatted}`);

        return {
            status: 'success',
            message: 'User deleted successfully',
            data: {
                email,
                closedTradesCount,
                finalBalance: finalUsdFormatted,
                totalMarginReturned: formatBalance(totalMarginReturned, USD_DECIMALS),
                totalPnL: formatBalance(totalPnL, USD_DECIMALS)
            }
        };

    } catch (error) {
        return {
            status: 'error',
            message: `Failed to delete user: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

// Removed handleBuy/handleSell; spot is handled via CREATE_TRADE leverage<=1