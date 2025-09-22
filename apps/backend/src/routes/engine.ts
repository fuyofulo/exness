import router from 'express';
const app = router();
import { v4 as uuidv4 } from "uuid";
import { createClient } from 'redis';
import { RedisSuscriber } from '../utils/orderResponse';
import { authMiddleware } from '../middleware';
import { PrismaClient } from '../../prisma/generated';

const prisma = new PrismaClient();

// Create a singleton subscriber instance
const subscriber = new RedisSuscriber();

// Helper function to extract order data for database
function extractOrderData(originalCommand: string, body: EngineRequestBody, payload: any, email: string, orderId: string, userId: number) {
    const baseData = {
        orderId,
        userId,
        email,
        command: originalCommand,
        status: 'PENDING' as const
    };

    switch (originalCommand) {
        case 'CREATE_TRADE':
            return {
                ...baseData,
                asset: body.asset || null,
                direction: body.direction || null,
                amount: body.margin ? BigInt(Math.round(body.margin * 10000)) : null,
                leverage: body.leverage ? BigInt(body.leverage) : null,
                tradeId: null // Will be updated after engine response
            };

        case 'CLOSE_TRADE':
            return {
                ...baseData,
                tradeId: body.tradeId || null,
                asset: body.asset || null
            };

        case 'GET_BALANCE':
        case 'GET_USD_BALANCE':
        case 'CREATE_ACCOUNT':
        default:
            return baseData; // These commands don't need specific fields
    }
}


type EngineCommand =
  | 'GET_BALANCE'
  | 'GET_USD_BALANCE'
  | 'GET_ASSET_PRICE'
  | 'CREATE_ACCOUNT'
  | 'CREATE_TRADE'
  | 'CLOSE_TRADE'
  | 'DELETE_USER';


interface EngineRequestBody {
    command: EngineCommand;
    asset?: string;
    direction?: 'LONG' | 'SHORT';
    margin?: number;
    leverage?: number;
    slippage?: number;
    tradeId?: string;
    stopLossPrice?: number;     // Optional stop loss price (exact amount)
    takeProfitPrice?: number;   // Optional take profit price (exact amount)
}

const STREAM_NAME: string = 'backend-to-engine';


app.post('/', authMiddleware, async (req, res) => {
    const startTime = Date.now();
    console.log('engine endpoint hit with command ', req.body.command);

    try {
        // Get user info from auth middleware
        const { email } = req.user!;

        const body: EngineRequestBody = req.body;
        const { command } = body;
        const orderId = uuidv4();

        const badRequest = (msg: string) => res.status(400).json({ success: false, error: msg });
        if (!command) return badRequest('command is required');

        switch (command) {
            case 'GET_BALANCE':
            case 'GET_USD_BALANCE':
            case 'GET_ASSET_PRICE':
            case 'CREATE_ACCOUNT':
            case 'DELETE_USER':
                break;
            case 'CREATE_TRADE':
                if (!body.asset) return badRequest('asset is required');
                if (!body.direction) return badRequest('direction is required');
                if (typeof body.margin !== 'number' || body.margin <= 0) return badRequest('margin must be > 0');

                // Leverage validation: 10-1000 (representing 1.0x to 100.0x)
                const leverage = body.leverage || 10;
                if (leverage < 10 || leverage > 1000) {
                    return badRequest('leverage must be between 10 and 1000 (representing 1.0x to 100.0x)');
                }
                // Must be integer (no decimals allowed)
                if (!Number.isInteger(leverage)) {
                    return badRequest('leverage must be an integer (e.g., 225 for 22.5x)');
                }

                // Stop loss and take profit validation (optional fields)
                if (body.stopLossPrice !== undefined) {
                    if (typeof body.stopLossPrice !== 'number' || body.stopLossPrice <= 0) {
                        return badRequest('stopLossPrice must be a positive number');
                    }
                }
                if (body.takeProfitPrice !== undefined) {
                    if (typeof body.takeProfitPrice !== 'number' || body.takeProfitPrice <= 0) {
                        return badRequest('takeProfitPrice must be a positive number');
                    }
                }
                break;
            case 'CLOSE_TRADE':
                if (!body.tradeId) return badRequest('tradeId is required');
                // asset is optional since we get it from the trade
                break;
            default:
                return badRequest('unsupported command');
        }

        const rClient = createClient({
            url: "redis://redis:6379"
        });
        await rClient.connect();

        // Normalize payload: set default leverage for CREATE_TRADE
        let sendCommand = command as EngineCommand;
        let payload: any = { ...body };

        // For CREATE_TRADE, pass stop loss and take profit to engine and set default leverage
        if (command === 'CREATE_TRADE') {
            payload.stopLossPrice = body.stopLossPrice;
            payload.takeProfitPrice = body.takeProfitPrice;
            payload.leverage = typeof body.leverage === 'number' && body.leverage > 0 ? body.leverage : 10; // Default to 10 (1x)
        }

        // 🚀 SEND TO ENGINE FIRST (no DB call here for speed)
        const messageID = await rClient.xAdd(STREAM_NAME, '*', {
            orderId: orderId,
            command: sendCommand,
            email: email,
            tradeData: JSON.stringify(payload),
            timestamp: Date.now().toString()
        });

        console.log(`sent to engine ${messageID}`);

        console.log(`waiting for engine response ${orderId}`);
        let responseFromEngine;
        try {
            responseFromEngine = await subscriber.waitForMessage(orderId);
        } catch (waitError: any) {
            console.error('Error waiting for engine response:', waitError?.message || waitError);
            console.error('Wait error stack:', waitError?.stack);

            // Return a meaningful error response instead of crashing
            return res.status(500).json({
                success: false,
                error: 'Failed to get response from engine',
                orderId: orderId,
                details: waitError?.message || 'Timeout or connection error',
                latency: Date.now() - startTime
            });
        }
        console.log(`Received response from engine for ${orderId}`);

        const endTime = Date.now();
        const latency = endTime - startTime;

        // Create order record in database after engine response (skip for read-only commands)
        if (!['CREATE_ACCOUNT', 'GET_BALANCE', 'GET_USD_BALANCE', 'GET_ASSET_PRICE', 'DELETE_USER'].includes(command)) {
            try {
                const orderData = extractOrderData(command, body, payload, email, orderId, req.user!.userId);
                await prisma.order.create({
                    data: orderData
                });
                console.log(`Order record created: ${orderId}`);
            } catch (dbError: any) {
                console.error('Failed to create order record:', dbError?.message || dbError);
                // Continue anyway - don't block the response
            }
        }

        // Check if engine returned an error and handle it properly
        if (responseFromEngine && (responseFromEngine as any).status === 'error') {
            console.log(`Engine error detected for ${orderId}:`, (responseFromEngine as any).message);

            // Update order status to ERROR in database
            try {
                await prisma.order.update({
                    where: { orderId },
                    data: {
                        status: 'ERROR',
                        latencyMs: latency
                    }
                });
                console.log(`Order status updated to ERROR: ${orderId}`);
            } catch (dbUpdateError: any) {
                console.error('Failed to update order status:', dbUpdateError?.message || dbUpdateError);
                // Continue anyway - don't block the response
            }

            // Return engine's specific error message instead of generic success
            console.log(`Sending 400 error response for ${orderId}`);
            const errorResponse = {
                success: false,
                error: (responseFromEngine as any).message || 'Engine operation failed',
                orderId: orderId,
                engineResponse: responseFromEngine,
                latency: latency
            };
            console.log('Error response:', JSON.stringify(errorResponse, null, 2));
            return res.status(400).json(errorResponse);
        }

        console.log(`Engine operation successful for ${orderId}`);

            // Update order status based on actual trade lifecycle status (skip for read-only commands)
        if (!['CREATE_ACCOUNT', 'GET_BALANCE', 'GET_USD_BALANCE', 'GET_ASSET_PRICE', 'DELETE_USER'].includes(command)) {
            try {
                let orderStatus = 'SUCCESS'; // Default for non-trade commands
                
                if (command === 'CREATE_TRADE') {
                    // For trade creation, status should be OPEN (trade is now active)
                    orderStatus = 'OPEN';
                } else if (command === 'CLOSE_TRADE') {
                    // For trade closure, status should be CLOSED (trade is now closed)
                    orderStatus = 'CLOSED';
                }
                
                await prisma.order.update({
                    where: { orderId },
                    data: {
                        status: orderStatus,
                        latencyMs: latency
                    }
                });
                console.log(`Order status updated to ${orderStatus}: ${orderId}`);
            } catch (dbUpdateError: any) {
                console.error('Failed to update order status:', dbUpdateError?.message || dbUpdateError);
                // Continue anyway - don't block the response
            }
        }

        // Create trade record in database for CREATE_TRADE commands
        if (command === 'CREATE_TRADE' && responseFromEngine && (responseFromEngine as any).data) {
            const engineData = (responseFromEngine as any).data;
            if (engineData.tradeId) {
                try {
                    console.log(`Creating trade record for ${engineData.tradeId}`);
                    await prisma.trade.create({
                        data: {
                            tradeId: engineData.tradeId,
                            userId: req.user!.userId,
                            email: req.user!.email,
                            asset: engineData.asset || body.asset,
                            direction: body.direction || 'LONG',
                            margin: BigInt(Math.round((body.margin || 0) * 10000)),
                            leverage: BigInt(body.leverage || 10),  // Store as BigInt integer
                            entryPrice: BigInt(Math.round((engineData.entryPrice || 0) * 1000000)), // Assuming 6 decimals
                            entryPriceDecimals: 6,
                            liquidationPrice: engineData.liquidationPrice ? BigInt(Math.round(engineData.liquidationPrice * 1000000)) : null,
                            liquidationPriceDecimals: engineData.liquidationPrice ? 6 : null,
                            stopLossPrice: engineData.stopLossPrice ? BigInt(Math.round(engineData.stopLossPrice * 1000000)) : null, // Optional stop loss (scaled for DB)
                            takeProfitPrice: engineData.takeProfitPrice ? BigInt(Math.round(engineData.takeProfitPrice * 1000000)) : null, // Optional take profit (scaled for DB)
                            triggerDecimals: (engineData.stopLossPrice || engineData.takeProfitPrice) ? 6 : null, // Decimals for triggers
                            status: 'OPEN'
                        }
                    });
                    console.log(`Trade record created: ${engineData.tradeId}`);

                    // Update the Order record with the tradeId
                    try {
                        await prisma.order.update({
                            where: { orderId },
                            data: { tradeId: engineData.tradeId }
                        });
                        console.log(`Order ${orderId} updated with tradeId: ${engineData.tradeId}`);
                    } catch (orderUpdateError: any) {
                        console.error('Failed to update order with tradeId:', orderUpdateError?.message || orderUpdateError);
                        // Continue anyway - don't block the response
                    }
                } catch (tradeCreateError: any) {
                    console.error('Failed to create trade record:', tradeCreateError?.message || tradeCreateError);
                    // Continue anyway - don't block the response
                }
            }
        }

        // Send the engine's response back to the user
        res.json({
            success: true,
            orderId: orderId,
            engineResponse: responseFromEngine,
            latency: latency
        });

    } catch (error: any) {
        console.error('Error creating order:', error?.message || error);
        console.error('Error stack:', error?.stack);

        // Only send response if we haven't sent one already
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error?.message || 'Unknown error'
            });
        }
    }
});

// Cleanup on exit
process.on('beforeExit', async () => {
    await prisma.$disconnect();
});

export const engineRouter = app;