import { createClient, RedisClientType } from "redis";
import { PrismaClient } from "../prisma/generated";

const ENGINE_EVENTS = "engine_events"; // Separate stream for events

export class EventListener {
    private client: RedisClientType;
    private prisma: PrismaClient;
    private isRunning: boolean = false;

    constructor() {
        this.client = createClient({
            url: "redis://redis:6379"
        });
        this.prisma = new PrismaClient();
        this.setupEventHandlers();
    }

    private setupEventHandlers() {
        this.client.on('error', (err) => {
            console.error('EventListener Redis error:', err);
        });

        this.client.on('connect', () => {
            console.log('EventListener connected to Redis');
        });

        this.client.on('disconnect', () => {
            console.log('EventListener disconnected from Redis');
        });
    }

    async start() {
        if (this.isRunning) {
            console.log('EventListener is already running');
            return;
        }

        try {
            await this.client.connect();
            console.log('Starting EventListener...');

            // Create consumer group for events
            try {
                await this.client.xGroupCreate(ENGINE_EVENTS, 'liquidation_group', '0', { MKSTREAM: true });
                console.log('Created liquidation consumer group');
            } catch (groupError: any) {
                if (!groupError.message?.includes('BUSYGROUP')) {
                    console.error('Failed to create consumer group:', groupError);
                    throw groupError;
                }
                console.log('Liquidation consumer group already exists');
            }

            this.isRunning = true;
            console.log('EventListener is now listening for events...');

            // Start the continuous event processing loop
            await this.processEvents();

        } catch (error: any) {
            console.error('Failed to start EventListener:', error?.message || error);
            throw error;
        }
    }

    private async processEvents() {
        while (this.isRunning) {
            try {
                // Read events from the stream
                const response = await this.client.xReadGroup(
                    'liquidation_group',
                    'liquidation_consumer',
                    {
                        key: ENGINE_EVENTS,
                        id: '>'
                    },
                    {
                        COUNT: 10, // Process up to 10 events at once
                        BLOCK: 5000 // Block for 5 seconds if no events
                    }
                );

                if (!response) {
                    continue; // No events, continue the loop
                }

                // Process each event
                for (const stream of response) {
                    for (const message of stream.messages) {
                        try {
                            await this.processEvent(message);
                            // Acknowledge the message after successful processing
                            await this.client.xAck(ENGINE_EVENTS, 'liquidation_group', message.id);
                            console.log(`Processed and acknowledged event: ${message.id}`);
                        } catch (eventError: any) {
                            console.error(`Failed to process event ${message.id}:`, eventError?.message || eventError);
                            // Don't acknowledge failed events - they'll be retried
                        }
                    }
                }

            } catch (error: any) {
                console.error('Error in event processing loop:', error?.message || error);
                // Wait before retrying to avoid hammering Redis
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    private async processEvent(message: any) {
        const eventData = message.message;
        const eventType = eventData.eventType;

        console.log(`Processing ${eventType} event for trade ${eventData.tradeId || 'unknown'}`);

        // Only process messages that have an eventType (events)
        if (!eventType) {
            console.log(`Ignoring non-event message (order response)`);
            return;
        }

        switch (eventType) {
            case 'TRADE_LIQUIDATED':
                await this.handleTradeLiquidation(eventData);
                break;

            case 'TRADE_STOP_LOSS':
                await this.handleTradeClosure(eventData, 'STOP_LOSS');
                break;

            case 'TRADE_TAKE_PROFIT':
                await this.handleTradeClosure(eventData, 'TAKE_PROFIT');
                break;

            case 'TRADE_CLOSED':
                await this.handleTradeClosure(eventData, 'CLOSED');
                break;

            default:
                // Ignore unknown event types
                console.log(`Ignoring unknown event type: ${eventType}`);
                break;
        }
    }

    private async handleTradeLiquidation(eventData: any) {
        const { tradeId, email, asset, pnl, marginReturned, closePrice, timestamp } = eventData;

        console.log(`💥 Processing liquidation for trade ${tradeId}`);

        try {
            // Find the user by email to get userId
            const user = await this.prisma.user.findUnique({
                where: { email },
                select: { id: true }
            });

            if (!user) {
                console.error(` User not found for email: ${email}`);
                return;
            }

            // Update the trade record
            let pnlBigInt: bigint;
            let exitPriceBigInt: bigint | null = null;

            try {
                const pnlValue = pnl ? parseFloat(pnl.toString()) : 0;
                pnlBigInt = BigInt(Math.round(pnlValue * 10000));

                if (closePrice) {
                    const exitPriceValue = parseFloat(closePrice.toString());
                    exitPriceBigInt = BigInt(Math.round(exitPriceValue * 1000000));
                }
            } catch (error) {
                console.error(` Error parsing PnL/closePrice:`, error);
                pnlBigInt = BigInt(0);
            }

            // Update trade record with retry mechanism (race condition with creation)
            const maxRetries = 3;
            let retryCount = 0;
            let updatedTrade;

            while (retryCount < maxRetries) {
                try {
                    updatedTrade = await this.prisma.trade.update({
                        where: { tradeId },
                        data: {
                            status: 'LIQUIDATED',
                            pnl: pnlBigInt,
                            exitPrice: exitPriceBigInt,
                            exitPriceDecimals: exitPriceBigInt ? 6 : null,
                            updatedAt: new Date(parseInt(timestamp) || Date.now())
                        }
                    });
                    console.log(` Updated trade ${tradeId} to LIQUIDATED status`);
                    break; // Success, exit retry loop
                } catch (updateError: any) {
                    retryCount++;
                    if (retryCount >= maxRetries) {
                        console.error(` Failed to update trade ${tradeId} after ${maxRetries} retries:`, updateError?.message || updateError);
                        throw updateError; // Re-throw to prevent acknowledgment
                    }
                    console.log(` Retry ${retryCount}/${maxRetries} for trade ${tradeId} update`);
                    // Wait 100ms before retry
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            // Update the corresponding Order status to match the trade status
            try {
                await this.prisma.order.updateMany({
                    where: { tradeId: tradeId },
                    data: { status: 'LIQUIDATED' }
                });
                console.log(` Updated order status to LIQUIDATED for trade ${tradeId}`);
            } catch (orderUpdateError: any) {
                console.error(` Failed to update order status for trade ${tradeId}:`, orderUpdateError?.message || orderUpdateError);
            }

            // Note: Balances are maintained in-engine only, no database updates needed

        } catch (error: any) {
            console.error(` Failed to process liquidation for ${tradeId}:`, error?.message || error);
            throw error; // Re-throw to prevent acknowledgment
        }
    }

    private async handleTradeClosure(eventData: any, status: 'CLOSED' | 'STOP_LOSS' | 'TAKE_PROFIT' = 'CLOSED') {
        const { tradeId, email, pnl, marginReturned, closePrice, timestamp } = eventData;

        console.log(` Processing trade closure for ${tradeId}`);

        try {
            // Find the user by email to get userId
            const user = await this.prisma.user.findUnique({
                where: { email },
                select: { id: true }
            });

            if (!user) {
                console.error(` User not found for email: ${email}`);
                return;
            }

            // Update the trade record
            let pnlBigInt: bigint;
            let exitPriceBigInt: bigint | null = null;

            try {
                const pnlValue = pnl ? parseFloat(pnl.toString()) : 0;
                pnlBigInt = BigInt(Math.round(pnlValue * 10000));

                if (closePrice) {
                    const exitPriceValue = parseFloat(closePrice.toString());
                    exitPriceBigInt = BigInt(Math.round(exitPriceValue * 1000000));
                }
            } catch (error) {
                console.error(` Error parsing PnL/closePrice:`, error);
                pnlBigInt = BigInt(0);
            }

            // Update trade record with retry mechanism (race condition with creation)
            const maxRetries = 3;
            let retryCount = 0;
            let updatedTrade;

            while (retryCount < maxRetries) {
                try {
                    updatedTrade = await this.prisma.trade.update({
                        where: { tradeId },
                        data: {
                            status: status,
                            pnl: pnlBigInt,
                            exitPrice: exitPriceBigInt,
                            exitPriceDecimals: exitPriceBigInt ? 6 : null,
                            updatedAt: new Date(parseInt(timestamp) || Date.now())
                        }
                    });
                    console.log(` Updated trade ${tradeId} to ${status} status`);
                    break; // Success, exit retry loop
                } catch (updateError: any) {
                    retryCount++;
                    if (retryCount >= maxRetries) {
                        console.error(` Failed to update trade ${tradeId} after ${maxRetries} retries:`, updateError?.message || updateError);
                        throw updateError; // Re-throw to prevent acknowledgment
                    }
                    console.log(` Retry ${retryCount}/${maxRetries} for trade ${tradeId} update`);
                    // Wait 100ms before retry
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            // Update the corresponding Order status to match the trade status
            try {
                await this.prisma.order.updateMany({
                    where: { tradeId: tradeId },
                    data: { status: status }
                });
                console.log(` Updated order status to ${status} for trade ${tradeId}`);
            } catch (orderUpdateError: any) {
                console.error(` Failed to update order status for trade ${tradeId}:`, orderUpdateError?.message || orderUpdateError);
            }

            // Note: Balances are maintained in-engine only, no database updates needed

        } catch (error: any) {
            console.error(` Failed to process trade closure for ${tradeId}:`, error?.message || error);
            throw error; // Re-throw to prevent acknowledgment
        }
    }

    async stop() {
        console.log('🛑 Stopping EventListener...');
        this.isRunning = false;

        try {
            await this.client.disconnect();
            console.log(' EventListener stopped');
        } catch (error: any) {
            console.error(' Error stopping EventListener:', error?.message || error);
        }
    }

    // Health check method
    isHealthy(): boolean {
        return this.isRunning && this.client.isOpen;
    }
}
